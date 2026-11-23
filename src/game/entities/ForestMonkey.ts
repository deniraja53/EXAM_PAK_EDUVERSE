import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assetManifest';
import { GAME_HEIGHT, WORLD_SPRITE_SCALE } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { ENTITY_TEXTURE_KEYS } from '../systems/PixelArtEntities';

export interface MonkeyPlacement {
  id: string;
  x: number;
  y: number;
  patrolMinX: number;
  patrolMaxX: number;
}

export type MonkeyLifeStatus = 'alive' | 'defeated' | 'dead';
type MonkeyState = 'IDLE' | 'PATROL' | 'PREPARE' | 'THROW' | 'DEFEATED';

interface MonkeyNode {
  id: string;
  sprite: MonkeySprite;
  headZone: Phaser.GameObjects.Zone;
  patrolMinX: number;
  patrolMaxX: number;
  direction: 1 | -1;
  lifeStatus: MonkeyLifeStatus;
  state: MonkeyState;
  stateTimerMs: number;
  cooldownMs: number;
  targetXAtThrow: number;
  targetYAtThrow: number;
}

const PATROL_SPEED = 74;
const IDLE_DURATION_MS = 650;
const PREPARE_DURATION_MS = 460;
const THROW_DURATION_MS = 340;
const ATTACK_COOLDOWN_MS = 2100;
const DETECT_RANGE_X = 430;
const DETECT_RANGE_Y = 210;
const PROJECTILE_SPEED = 290;

export interface EnemyVisualProfile {
  textureKey: string;
  initialFrame: string;
  projectileFrame: string;
  splatFrame?: string;
  bodyW: number;
  bodyH: number;
  animKeys: {
    idle: string;
    walk: string;
    prepare: string;
    throw: string;
    defeat: string;
    projSpin: string;
    projSplat?: string;
  };
}

// Measured against monkey_ca920cfc.png frames (125..152w x 132..142h) at WORLD_SPRITE_SCALE = 0.5
// Enemy body world size: 112 * 0.5 = 56px wide, 132 * 0.5 = 66px tall
const MONKEY_BODY_W_TEX = 112;
const MONKEY_BODY_H_TEX = 132;
// Dedicated head stomp sensor zone anchored to the top of enemy body (world px)
const HEAD_ZONE_WIDTH_PAD_PX = 6;
const HEAD_ZONE_HEIGHT_PX = 36;
const HEAD_ZONE_TOP_LIFT_PX = 6;

const DEFAULT_MONKEY_PROFILE: EnemyVisualProfile = {
  textureKey: ASSET_KEYS.MONKEY,
  initialFrame: 'monkey_idle_0',
  projectileFrame: 'banana_0',
  splatFrame: 'banana_splat_0',
  bodyW: MONKEY_BODY_W_TEX,
  bodyH: MONKEY_BODY_H_TEX,
  animKeys: {
    idle: 'monkey-sheet-idle',
    walk: 'monkey-sheet-walk',
    prepare: 'monkey-sheet-prepare',
    throw: 'monkey-sheet-throw',
    defeat: 'monkey-sheet-defeat',
    projSpin: 'monkey-banana-spin',
    projSplat: 'monkey-banana-splat',
  },
};

export const STAGE2_SCORPION_PROFILE: EnemyVisualProfile = {
  textureKey: ASSET_KEYS.STAGE2_ENEMY,
  initialFrame: 'scorpion_idle_0',
  projectileFrame: 'scorpion_orb_0',
  bodyW: 150,
  bodyH: 108,
  animKeys: {
    idle: 'scorpion-idle',
    walk: 'scorpion-walk',
    prepare: 'scorpion-prepare',
    throw: 'scorpion-throw',
    defeat: 'scorpion-defeat',
    projSpin: 'scorpion-orb-spin',
  },
};

/**
 * Custom Arcade Sprite so hitbox bottom-alignment stays invariant
 * across frames with slightly different cut heights (idle/walk/prepare/throw/defeat),
 * keeping the top of the hitbox aligned with the enemy's head.
 */
class MonkeySprite extends Phaser.Physics.Arcade.Sprite {
  private readonly useSpriteSheet: boolean;
  private readonly bodyW: number;
  private readonly bodyH: number;
  private lastSyncedFrameName = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    useSpriteSheet: boolean,
    profile: EnemyVisualProfile
  ) {
    super(
      scene,
      x,
      y,
      useSpriteSheet ? profile.textureKey : ENTITY_TEXTURE_KEYS.MONKEY_IDLE_0,
      useSpriteSheet ? profile.initialFrame : undefined
    );
    this.useSpriteSheet = useSpriteSheet;
    this.bodyW = profile.bodyW;
    this.bodyH = profile.bodyH;
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncHitbox();
  }

  public syncHitbox(force = false): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.frame) return;

    if (this.useSpriteSheet) {
      if (!force && this.frame.name === this.lastSyncedFrameName) return;
      this.lastSyncedFrameName = this.frame.name;
      const offsetX = (this.frame.width - this.bodyW) * 0.5;
      const offsetY = this.frame.height - this.bodyH;
      body.setOffset(offsetX, offsetY);
    } else if (force) {
      body.setSize(22, 26, false);
      body.setOffset(5, 5);
    }
  }
}

/**
 * Enemy & projectile manager powered by monkey_ca920cfc.png (Stage 1)
 * or Stage 2 Scorpion sprite sheet (enemy.png).
 * Life statuses: 'alive' -> 'defeated' (on head stomp) -> 'dead' (after defeat anim).
 */
export class ForestMonkeyManager {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly profile: EnemyVisualProfile;
  private readonly useSpriteSheet: boolean;
  private readonly monkeysGroup: Phaser.Physics.Arcade.Group;
  private readonly headZonesGroup: Phaser.Physics.Arcade.Group;
  private readonly projectilesGroup: Phaser.Physics.Arcade.Group;
  private readonly monkeys: MonkeyNode[] = [];
  private readonly dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private paused = false;
  private getHealthState?: () => { lives: number; maxLives: number };

  // Hitbox & stomp diagnostics (toggle with F9, backtick `, or ?debug=1)
  private debugEnabled = false;
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugLabel?: Phaser.GameObjects.Text;
  private readonly enemyDebugLabels = new Map<string, Phaser.GameObjects.Text>();
  private readonly headZoneDebugLabels = new Map<string, Phaser.GameObjects.Text>();
  private lastContactStatus: 'NONE' | 'HEAD_BOUNCE' | 'HEART_HIT' | 'DAMAGE' = 'NONE';
  private lastContactEnemyId = '-';
  private lastContactEnemyState: 'ALIVE' | 'DEFEATED' | '-' = '-';
  private lastHeartBefore: number | null = null;
  private lastHeartAfter: number | null = null;
  private lastContactVy: number | null = null;
  private debugKeyHandler?: () => void;

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    placements: MonkeyPlacement[],
    dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter,
    profile?: EnemyVisualProfile
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.dustEmitter = dustEmitter;
    this.profile = profile ?? DEFAULT_MONKEY_PROFILE;
    this.useSpriteSheet = scene.textures.exists(this.profile.textureKey);

    this.monkeysGroup = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.headZonesGroup = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.projectilesGroup = scene.physics.add.group({
      allowGravity: false,
    });

    for (const p of placements) {
      this.spawnMonkey(p);
    }

    this.initDebugOverlay();
  }

  private initDebugOverlay(): void {
    const queryDebug =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';
    this.debugEnabled = queryDebug;

    const keyboard = this.scene.input?.keyboard;
    if (keyboard) {
      this.debugKeyHandler = () => {
        this.setDebugEnabled(!this.debugEnabled);
      };
      keyboard.on('keydown-F9', this.debugKeyHandler);
      keyboard.on('keydown-BACKTICK', this.debugKeyHandler);
    }

    if (this.debugEnabled) {
      this.ensureDebugObjects();
    }
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (enabled) {
      this.ensureDebugObjects();
      this.debugGraphics?.setVisible(true);
      this.debugLabel?.setVisible(true);
    } else {
      this.debugGraphics?.clear();
      this.debugGraphics?.setVisible(false);
      this.debugLabel?.setVisible(false);
      this.enemyDebugLabels.forEach((lbl) => lbl.setVisible(false));
      this.headZoneDebugLabels.forEach((lbl) => lbl.setVisible(false));
    }
  }

  private ensureDebugObjects(): void {
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics().setDepth(50);
    }
    if (!this.debugLabel) {
      // Positioned at y=112 so it always clears the React GameHUD top-left bar
      this.debugLabel = this.scene.add
        .text(16, 112, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#fef08a',
          backgroundColor: '#091120e6',
          padding: { x: 10, y: 7 },
          lineSpacing: 4,
        })
        .setScrollFactor(0)
        .setDepth(55);
    }
  }

  private showDebugContactBanner(
    x: number,
    y: number,
    status: 'HEAD_BOUNCE' | 'HEART_HIT' | 'DAMAGE'
  ): void {
    if (!this.debugEnabled) return;
    const text =
      status === 'HEART_HIT'
        ? 'HEART HIT! MUSUH KALAH'
        : status === 'HEAD_BOUNCE'
          ? 'HEAD BOUNCE (NO DAMAGE)'
          : 'DAMAGE! -1 HEART';
    const color =
      status === 'HEART_HIT'
        ? '#f43f5e'
        : status === 'HEAD_BOUNCE'
          ? '#4ade80'
          : '#fb7185';
    const banner = this.scene.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color,
        backgroundColor: '#091120dd',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(56);

    this.scene.tweens.add({
      targets: banner,
      y: y - 34,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => banner.destroy(),
    });
  }

  private renderDebugOverlay(player: Phaser.Physics.Arcade.Sprite): void {
    if (!this.debugEnabled) return;
    this.ensureDebugObjects();
    const gfx = this.debugGraphics;
    if (!gfx) return;
    gfx.clear();

    const health = this.getHealthState?.() ?? { lives: 3, maxLives: 3 };
    const pBody = player.body as Phaser.Physics.Arcade.Body | null;
    let playerLine = `PLAYER VY: - | HEART: ${health.lives}/${health.maxLives}`;
    if (pBody) {
      // 1. Kotak Hitbox Player (biru terang) + Garis Posisi Kaki Player (kuning)
      gfx.lineStyle(2, 0x38bdf8, 1);
      gfx.strokeRect(pBody.left, pBody.top, pBody.width, pBody.height);
      gfx.lineStyle(3, 0xfacc15, 1);
      gfx.lineBetween(pBody.left - 6, pBody.bottom, pBody.right + 6, pBody.bottom);
      gfx.fillStyle(0xfacc15, 1);
      gfx.fillCircle(pBody.center.x, pBody.bottom, 4);

      const vy = pBody.velocity.y;
      const vyDir = vy > 8 ? 'TURUN' : vy < -8 ? 'NAIK' : 'DIAM';
      const vySigned = `${vy >= 0 ? '+' : ''}${vy.toFixed(0)}`;
      playerLine =
        `PLAYER VY: ${vyDir} (${vySigned} px/s) | KAKI Y: ${pBody.bottom.toFixed(1)} | ` +
        `HEART: ${health.lives}/${health.maxLives}`;
    }

    const activeIds = new Set<string>();
    for (const node of this.monkeys) {
      if (!node.sprite.scene || node.lifeStatus === 'dead') continue;
      activeIds.add(node.id);

      const mBody = node.sprite.body as Phaser.Physics.Arcade.Body | null;
      const headBody = node.headZone.body as Phaser.Physics.Arcade.Body | null;
      const isAlive = node.lifeStatus === 'alive';

      let lbl = this.enemyDebugLabels.get(node.id);
      if (!lbl) {
        lbl = this.scene.add
          .text(node.sprite.x, node.sprite.y - 90, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#091120dd',
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(54);
        this.enemyDebugLabels.set(node.id, lbl);
      }
      lbl.setVisible(true);
      lbl.setPosition(
        node.sprite.x,
        (headBody ? headBody.top : mBody ? mBody.top : node.sprite.y - 72) - 4
      );
      lbl.setText(`${node.id}: ${isAlive ? 'ALIVE' : 'DEFEATED'}`);
      lbl.setColor(isAlive ? '#4ade80' : '#f87171');

      if (!mBody) continue;
      if (isAlive && mBody.enable) {
        // 2. Kotak Hitbox Enemy (oranye/merah untuk kontak damage badan/samping)
        gfx.lineStyle(2, 0xf97316, 0.95);
        gfx.strokeRect(mBody.left, mBody.top, mBody.width, mBody.height);

        // 3. Zona Kepala Enemy khusus (hijau terang dengan label HEAD)
        if (headBody && headBody.enable) {
          gfx.fillStyle(0x22c55e, 0.3);
          gfx.fillRect(headBody.left, headBody.top, headBody.width, headBody.height);
          gfx.lineStyle(2, 0x4ade80, 1);
          gfx.strokeRect(headBody.left, headBody.top, headBody.width, headBody.height);

          let hLbl = this.headZoneDebugLabels.get(node.id);
          if (!hLbl) {
            hLbl = this.scene.add
              .text(headBody.right + 4, headBody.top, 'HEAD', {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#4ade80',
                backgroundColor: '#052e16cc',
                padding: { x: 3, y: 1 },
              })
              .setOrigin(0, 0)
              .setDepth(54);
            this.headZoneDebugLabels.set(node.id, hLbl);
          }
          hLbl.setVisible(true);
          hLbl.setPosition(headBody.right + 4, headBody.top);
        }
      } else {
        gfx.lineStyle(1, 0x94a3b8, 0.55);
        gfx.strokeRect(mBody.left, mBody.top, mBody.width, mBody.height);
        this.headZoneDebugLabels.get(node.id)?.setVisible(false);
      }
    }

    this.enemyDebugLabels.forEach((lbl, id) => {
      if (!activeIds.has(id)) {
        lbl.setVisible(false);
      }
    });
    this.headZoneDebugLabels.forEach((lbl, id) => {
      if (!activeIds.has(id)) {
        lbl.setVisible(false);
      }
    });

    const heartDiffText =
      this.lastHeartBefore !== null && this.lastHeartAfter !== null
        ? `${this.lastHeartBefore} -> ${this.lastHeartAfter}`
        : `${health.lives} -> ${health.lives}`;
    const contactVyText =
      this.lastContactVy !== null ? ` @vy=${this.lastContactVy.toFixed(0)}` : '';
    const statusLine =
      `KONTAK: ${this.lastContactStatus}${contactVyText} | ` +
      `HEART: ${heartDiffText} | ENEMY: ${this.lastContactEnemyId} (${this.lastContactEnemyState})`;
    const hintLine = `[F9 / \` : Matikan Debug] | Biru=Player | Kuning=Kaki | Hijau=Head | Oranye=Body`;

    const color =
      this.lastContactStatus === 'HEART_HIT' || this.lastContactStatus === 'HEAD_BOUNCE'
        ? '#4ade80'
        : this.lastContactStatus === 'DAMAGE'
          ? '#fb7185'
          : '#fef08a';
    this.debugLabel?.setColor(color);
    this.debugLabel?.setText(`${playerLine}\n${statusLine}\n${hintLine}`);
  }

  private getAnimKey(state: MonkeyState): string {
    if (this.useSpriteSheet) {
      switch (state) {
        case 'IDLE':
          return this.profile.animKeys.idle;
        case 'PATROL':
          return this.profile.animKeys.walk;
        case 'PREPARE':
          return this.profile.animKeys.prepare;
        case 'THROW':
          return this.profile.animKeys.throw;
        case 'DEFEATED':
          return this.profile.animKeys.defeat;
      }
    }

    switch (state) {
      case 'IDLE':
        return 'monkey-idle';
      case 'PATROL':
        return 'monkey-walk';
      default:
        return 'monkey-idle';
    }
  }

  private playStateAnim(node: MonkeyNode, state: MonkeyState, force = false): void {
    const key = this.getAnimKey(state);
    if (!this.scene.anims.exists(key)) return;
    if (
      !force &&
      node.sprite.anims.currentAnim?.key === key &&
      node.sprite.anims.isPlaying
    ) {
      return;
    }
    node.sprite.play(key, true);
    node.sprite.syncHitbox(true);
  }

  private syncHeadZone(node: MonkeyNode): void {
    if (node.lifeStatus !== 'alive' || !node.headZone.scene) return;
    const mBody = node.sprite.body as Phaser.Physics.Arcade.Body | null;
    const headBody = node.headZone.body as Phaser.Physics.Arcade.Body | null;
    if (!mBody || !headBody || !headBody.enable) return;

    const headW = Math.round(mBody.width + HEAD_ZONE_WIDTH_PAD_PX * 2);
    const headH = HEAD_ZONE_HEIGHT_PX;
    const centerX = mBody.center.x;
    const centerY = mBody.top - HEAD_ZONE_TOP_LIFT_PX + headH * 0.5;

    node.headZone.setSize(headW, headH);
    node.headZone.setPosition(centerX, centerY);
    headBody.setSize(headW, headH, true);
    headBody.updateFromGameObject();
  }

  private spawnMonkey(p: MonkeyPlacement): void {
    const sprite = new MonkeySprite(
      this.scene,
      p.x,
      p.y,
      this.useSpriteSheet,
      this.profile
    );
    this.scene.add.existing(sprite);
    this.monkeysGroup.add(sprite);

    sprite.setScale(this.useSpriteSheet ? WORLD_SPRITE_SCALE : 2);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(19);
    sprite.setFlipX(true); // Start facing left toward approaching player

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    if (this.useSpriteSheet) {
      body.setSize(this.profile.bodyW, this.profile.bodyH, false);
    } else {
      body.setSize(22, 26, false);
    }
    sprite.syncHitbox(true);
    body.updateFromGameObject();

    // Dedicated non-solid Head Stomp Sensor Zone anchored to top of enemy physics body
    const headW = Math.round(body.width + HEAD_ZONE_WIDTH_PAD_PX * 2);
    const headZone = this.scene.add.zone(
      body.center.x,
      body.top - HEAD_ZONE_TOP_LIFT_PX + HEAD_ZONE_HEIGHT_PX * 0.5,
      headW,
      HEAD_ZONE_HEIGHT_PX
    );
    this.headZonesGroup.add(headZone);
    const headBody = headZone.body as Phaser.Physics.Arcade.Body;
    headBody.setAllowGravity(false);
    headBody.setImmovable(true);
    headBody.setSize(headW, HEAD_ZONE_HEIGHT_PX, true);
    headBody.updateFromGameObject();

    const node: MonkeyNode = {
      id: p.id,
      sprite,
      headZone,
      patrolMinX: p.patrolMinX,
      patrolMaxX: p.patrolMaxX,
      direction: -1,
      lifeStatus: 'alive',
      state: 'PATROL',
      stateTimerMs: 0,
      cooldownMs: 900,
      targetXAtThrow: p.x - 120,
      targetYAtThrow: p.y - 36,
    };

    this.playStateAnim(node, 'PATROL', true);
    sprite.setData('monkeyNode', node);
    headZone.setData('monkeyNode', node);
    this.monkeys.push(node);
    this.syncHeadZone(node);
  }

  private spawnImpactSplat(x: number, y: number): void {
    if (
      this.useSpriteSheet &&
      this.profile.splatFrame &&
      this.profile.animKeys.projSplat &&
      this.scene.anims.exists(this.profile.animKeys.projSplat)
    ) {
      const splat = this.scene.add
        .sprite(x, y, this.profile.textureKey, this.profile.splatFrame)
        .setScale(WORLD_SPRITE_SCALE * 0.9)
        .setDepth(22);
      splat.play(this.profile.animKeys.projSplat);
      splat.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (splat.scene) splat.destroy();
      });
      return;
    }

    if (this.dustEmitter) {
      this.dustEmitter.explode(6, x, y);
    }
  }

  public registerColliders(
    player: Phaser.Physics.Arcade.Sprite,
    platformsGroup: Phaser.Physics.Arcade.StaticGroup,
    onPlayerHit: (sourceX: number) => void,
    onMonkeyDefeated: (x: number, y: number, bonus: number) => void,
    getHealthState?: () => { lives: number; maxLives: number }
  ): void {
    this.getHealthState = getHealthState;

    // 1. PRIORITY FIRST: Dedicated Head Stomp Sensor Zone overlap (runs BEFORE body/projectile)
    this.scene.physics.add.overlap(
      player,
      this.headZonesGroup,
      (playerObj, zoneObj) => {
        const node = (zoneObj as Phaser.GameObjects.Zone).getData(
          'monkeyNode'
        ) as MonkeyNode | undefined;
        if (!node) return;
        this.resolvePlayerMonkeyContact(
          playerObj as Phaser.Physics.Arcade.Sprite & {
            bounceFromStomp?: (bounceVelocity?: number) => void;
            isInvulnerable?: () => boolean;
          },
          node,
          true,
          onPlayerHit,
          onMonkeyDefeated
        );
      }
    );

    // 2. Enemy Body overlap (routed through the SAME contact coordinator; never bypasses stomp priority)
    this.scene.physics.add.overlap(
      player,
      this.monkeysGroup,
      (playerObj, monkeyObj) => {
        const node = (monkeyObj as Phaser.Physics.Arcade.Sprite).getData(
          'monkeyNode'
        ) as MonkeyNode | undefined;
        if (!node) return;
        this.resolvePlayerMonkeyContact(
          playerObj as Phaser.Physics.Arcade.Sprite & {
            bounceFromStomp?: (bounceVelocity?: number) => void;
            isInvulnerable?: () => boolean;
          },
          node,
          false,
          onPlayerHit,
          onMonkeyDefeated
        );
      }
    );

    // 3. Projectile hits Deni -> destroy projectile immediately, damage once (respects stompGraceMs)
    this.scene.physics.add.overlap(
      player,
      this.projectilesGroup,
      (playerObj, projObj) => {
        const proj = projObj as Phaser.Physics.Arcade.Sprite;
        if (proj.getData('consumed')) return;
        proj.setData('consumed', true);
        const px = proj.x;
        const py = proj.y;
        proj.destroy();
        this.spawnImpactSplat(px, py);

        const pSprite = playerObj as Phaser.Physics.Arcade.Sprite & {
          isInvulnerable?: () => boolean;
        };
        if (typeof pSprite.isInvulnerable === 'function' && pSprite.isInvulnerable()) {
          return;
        }
        const beforeLives = this.getHealthState?.().lives ?? null;
        onPlayerHit(px);
        const afterLives = this.getHealthState?.().lives ?? null;
        this.lastContactStatus = 'DAMAGE';
        this.lastContactEnemyId = String(proj.getData('ownerId') ?? 'banana');
        this.lastContactEnemyState = 'ALIVE';
        this.lastHeartBefore = beforeLives;
        this.lastHeartAfter = afterLives;
        this.lastContactVy = (pSprite.body as Phaser.Physics.Arcade.Body | null)?.velocity.y ?? null;
        this.showDebugContactBanner(px, py - 24, 'DAMAGE');
      }
    );

    // 4. Projectile hits solid terrain/platforms -> splash & remove cleanly
    this.scene.physics.add.collider(
      this.projectilesGroup,
      platformsGroup,
      (projObj) => {
        const proj = projObj as Phaser.Physics.Arcade.Sprite;
        if (proj.getData('consumed')) return;
        proj.setData('consumed', true);
        const px = proj.x;
        const py = proj.y;
        proj.destroy();
        this.spawnImpactSplat(px, py);
      }
    );
  }

  public registerHeartProjectileCollider(
    heartGroup: Phaser.Physics.Arcade.Group,
    onMonkeyDefeated: (x: number, y: number, bonus: number) => void,
    onProjectileHit?: (x: number, y: number) => void
  ): void {
    this.scene.physics.add.overlap(
      heartGroup,
      this.monkeysGroup,
      (projObj, monkeyObj) => {
        const proj = projObj as Phaser.Physics.Arcade.Sprite;
        if (!proj.active || proj.getData('consumed')) return;

        const node = (monkeyObj as Phaser.Physics.Arcade.Sprite).getData(
          'monkeyNode'
        ) as MonkeyNode | undefined;
        if (!node || node.lifeStatus !== 'alive') return;

        const mBody = node.sprite.body as Phaser.Physics.Arcade.Body | null;
        if (!mBody || !mBody.enable) return;

        proj.setData('consumed', true);
        const hitX = proj.x;
        const hitY = proj.y;
        proj.destroy();

        onProjectileHit?.(hitX, hitY);
        this.defeatMonkey(node, onMonkeyDefeated);

        const lives = this.getHealthState?.().lives ?? null;
        this.lastContactStatus = 'HEART_HIT';
        this.lastContactEnemyId = node.id;
        this.lastContactEnemyState = 'DEFEATED';
        this.lastHeartBefore = lives;
        this.lastHeartAfter = lives;
        this.showDebugContactBanner(node.sprite.x, mBody.top - 18, 'HEART_HIT');
      },
      (projObj, monkeyObj) => {
        const proj = projObj as Phaser.Physics.Arcade.Sprite;
        const node = (monkeyObj as Phaser.Physics.Arcade.Sprite).getData(
          'monkeyNode'
        ) as MonkeyNode | undefined;
        return Boolean(
          proj.active &&
            !proj.getData('consumed') &&
            node &&
            node.lifeStatus === 'alive'
        );
      },
      this
    );
  }

  private resolvePlayerMonkeyContact(
    pSprite: Phaser.Physics.Arcade.Sprite & {
      bounceFromStomp?: (bounceVelocity?: number) => void;
      isInvulnerable?: () => boolean;
    },
    node: MonkeyNode,
    viaHeadZone: boolean,
    onPlayerHit: (sourceX: number) => void,
    _onMonkeyDefeated: (x: number, y: number, bonus: number) => void
  ): void {
    const mBody = node.sprite.body as Phaser.Physics.Arcade.Body | null;
    const headBody = node.headZone.body as Phaser.Physics.Arcade.Body | null;
    const pBody = pSprite.body as Phaser.Physics.Arcade.Body | null;

    if (!pBody || !mBody || !mBody.enable || node.lifeStatus !== 'alive') {
      return;
    }

    const evalResult = this.evaluateHeadStomp(pBody, mBody, headBody, viaHeadZone);
    const contactVy = pBody.velocity.y;

    if (evalResult.stomp) {
      // Kontak kepala TIDAK mengalahkan musuh (hanya Heart Projectile yang dapat mengalahkan musuh),
      // dan membatalkan damage + memantul ringan agar kontak tumpang tindih tidak mengurangi heart player.
      if (typeof pSprite.bounceFromStomp === 'function') {
        pSprite.bounceFromStomp(-340);
      } else {
        pBody.setVelocityY(-340);
      }

      const currentLives = this.getHealthState?.().lives ?? null;
      this.lastContactStatus = 'HEAD_BOUNCE';
      this.lastContactEnemyId = node.id;
      this.lastContactEnemyState = 'ALIVE';
      this.lastHeartBefore = currentLives;
      this.lastHeartAfter = currentLives;
      this.lastContactVy = contactVy;
      this.showDebugContactBanner(node.sprite.x, mBody.top - 18, 'HEAD_BOUNCE');
      return;
    }

    // Abaikan padding headZone untuk damage samping/bawah; biarkan hitbox badan aktual (monkeysGroup) yang menentukan damage
    if (viaHeadZone) {
      return;
    }

    // KONDISI B — DAMAGE: kontak dari samping atau bawah badan musuh (hanya jika tidak invulnerable)
    if (typeof pSprite.isInvulnerable === 'function' && pSprite.isInvulnerable()) {
      return;
    }

    const heartBefore = this.getHealthState?.().lives ?? null;
    onPlayerHit(node.sprite.x);
    const heartAfter = this.getHealthState?.().lives ?? null;

    this.lastContactStatus = 'DAMAGE';
    this.lastContactEnemyId = node.id;
    this.lastContactEnemyState = 'ALIVE';
    this.lastHeartBefore = heartBefore;
    this.lastHeartAfter = heartAfter;
    this.lastContactVy = contactVy;
    this.showDebugContactBanner(pSprite.x, pBody.top - 12, 'DAMAGE');

    if (this.debugEnabled) {
      console.info('[MonkeyContact] DAMAGE', {
        id: node.id,
        viaHeadZone,
        vy: contactVy,
        pBot: pBody.bottom,
        headTop: evalResult.headTop,
        headBottom: evalResult.headBottom,
        heart: `${heartBefore} -> ${heartAfter}`,
      });
    }
  }

  private evaluateHeadStomp(
    pBody: Phaser.Physics.Arcade.Body,
    mBody: Phaser.Physics.Arcade.Body,
    headBody: Phaser.Physics.Arcade.Body | null,
    viaHeadZone: boolean
  ): {
    stomp: boolean;
    overlapX: number;
    frameDeltaY: number;
    prevBottom: number;
    headTop: number;
    headBottom: number;
  } {
    const headLeft = headBody ? headBody.left : mBody.left - HEAD_ZONE_WIDTH_PAD_PX;
    const headRight = headBody ? headBody.right : mBody.right + HEAD_ZONE_WIDTH_PAD_PX;
    const headTop = headBody ? headBody.top : mBody.top - HEAD_ZONE_TOP_LIFT_PX;
    const headBottom = headBody ? headBody.bottom : headTop + HEAD_ZONE_HEIGHT_PX;

    const isAirborne = !(pBody.blocked.down || pBody.touching.down);
    const frameDeltaY = pBody.position.y - pBody.prev.y;
    // Player sedang turun atau tepat di puncak apex (tolak lompatan naik dari bawah)
    const movingDownOrApex = pBody.velocity.y >= -30 || frameDeltaY >= -0.25;

    const overlapX = Math.min(pBody.right, headRight) - Math.max(pBody.left, headLeft);
    const horizontalHeadOverlap = overlapX > 0;

    const prevBottom = pBody.prev.y + pBody.height;
    const maxFastStepDepth = mBody.top + mBody.height * 0.78;
    const cameFromAbove = prevBottom <= headBottom + 8;

    const feetHitHeadZone =
      pBody.bottom <= headBottom + 8 ||
      (cameFromAbove && pBody.bottom <= maxFastStepDepth);

    const stomp =
      isAirborne &&
      movingDownOrApex &&
      horizontalHeadOverlap &&
      (viaHeadZone ? feetHitHeadZone : pBody.bottom <= headBottom + 6 && cameFromAbove);

    return {
      stomp,
      overlapX,
      frameDeltaY,
      prevBottom,
      headTop,
      headBottom,
    };
  }

  private defeatMonkey(
    node: MonkeyNode,
    onMonkeyDefeated: (x: number, y: number, bonus: number) => void
  ): void {
    if (node.lifeStatus !== 'alive') return;

    node.lifeStatus = 'defeated';
    node.state = 'DEFEATED';
    node.stateTimerMs = 0;

    // Nonaktifkan body damage & zona kepala agar kontak berikutnya tidak pernah mengurangi heart
    const body = node.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
      body.checkCollision.none = true;
      body.setVelocity(0, 0);
    }
    this.monkeysGroup.remove(node.sprite, false, false);

    const headBody = node.headZone.body as Phaser.Physics.Arcade.Body | null;
    if (headBody) {
      headBody.enable = false;
      headBody.checkCollision.none = true;
    }
    this.headZonesGroup.remove(node.headZone, false, false);
    if (node.headZone.scene) {
      node.headZone.destroy();
    }

    // Hapus seluruh proyektil aktif milik musuh yang dikalahkan
    if (this.projectilesGroup?.children) {
      const children = [...this.projectilesGroup.getChildren()];
      for (const child of children) {
        const proj = child as Phaser.Physics.Arcade.Sprite;
        if (proj.getData('ownerId') === node.id) {
          proj.setData('consumed', true);
          proj.destroy();
        }
      }
    }

    AudioSystem.playLand();
    if (this.dustEmitter) {
      this.dustEmitter.explode(12, node.sprite.x, node.sprite.y - 26);
    }
    this.spawnImpactSplat(node.sprite.x, node.sprite.y - 42);
    onMonkeyDefeated(node.sprite.x, node.sprite.y - 48, 100);

    if (this.useSpriteSheet && this.scene.anims.exists(this.profile.animKeys.defeat)) {
      this.playStateAnim(node, 'DEFEATED', true);
      node.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        node.lifeStatus = 'dead';
        if (node.sprite.scene) {
          node.sprite.destroy();
        }
      });
    } else {
      node.sprite.stop();
      node.sprite.setTexture(ENTITY_TEXTURE_KEYS.MONKEY_HIT);
      this.scene.tweens.add({
        targets: node.sprite,
        alpha: 0,
        y: node.sprite.y + 18,
        duration: 240,
        onComplete: () => {
          node.lifeStatus = 'dead';
          if (node.sprite.scene) {
            node.sprite.destroy();
          }
        },
      });
    }
  }

  public resetProximityThreat(
    spawnX: number,
    safeRadius = 540,
    cooldownMs = 2400
  ): void {
    if (this.projectilesGroup?.children) {
      const children = [...this.projectilesGroup.getChildren()];
      for (const child of children) {
        const proj = child as Phaser.Physics.Arcade.Sprite;
        if (Math.abs(proj.x - spawnX) <= safeRadius + 160) {
          proj.setData('consumed', true);
          proj.destroy();
        }
      }
    }

    for (const node of this.monkeys) {
      if (node.lifeStatus !== 'alive' || !node.sprite.scene) continue;
      if (Math.abs(node.sprite.x - spawnX) <= safeRadius) {
        node.cooldownMs = Math.max(node.cooldownMs, cooldownMs);
        if (node.state === 'PREPARE' || node.state === 'THROW') {
          node.state = 'IDLE';
          node.stateTimerMs = 500;
          const body = node.sprite.body as Phaser.Physics.Arcade.Body | null;
          body?.setVelocityX(0);
          this.playStateAnim(node, 'IDLE', true);
        }
      }
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;

    for (const node of this.monkeys) {
      if (node.lifeStatus !== 'alive' || !node.sprite.scene) continue;
      const body = node.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (paused) {
        body?.setVelocityX(0);
        node.sprite.anims?.pause();
      } else {
        node.sprite.anims?.resume();
      }
    }

    if (!this.projectilesGroup?.children) return;

    this.projectilesGroup.getChildren().forEach((child) => {
      const proj = child as Phaser.Physics.Arcade.Sprite;
      const body = proj.body as Phaser.Physics.Arcade.Body | null;
      if (!body) return;
      if (paused) {
        proj.setData('savedVx', body.velocity.x);
        proj.setData('savedVy', body.velocity.y);
        body.setVelocity(0, 0);
        proj.anims?.pause();
      } else {
        proj.anims?.resume();
        const vx = proj.getData('savedVx') as number | undefined;
        const vy = proj.getData('savedVy') as number | undefined;
        if (typeof vx === 'number' && typeof vy === 'number') {
          body.setVelocity(vx, vy);
        }
      }
    });
  }

  public update(deltaMs: number, player: Phaser.Physics.Arcade.Sprite): void {
    if (this.paused) return;
    const dt = Math.min(deltaMs, 50) / 1000;

    for (const node of this.monkeys) {
      if (node.lifeStatus !== 'alive' || !node.sprite.scene) continue;
      const body = node.sprite.body as Phaser.Physics.Arcade.Body;

      if (node.cooldownMs > 0) {
        node.cooldownMs = Math.max(0, node.cooldownMs - deltaMs);
      }

      const dx = player.x - node.sprite.x;
      const dy = Math.abs((player.y - 36) - (node.sprite.y - 28));
      const playerInRange =
        Math.abs(dx) <= DETECT_RANGE_X && dy <= DETECT_RANGE_Y;

      const playerDirectlyOverhead =
        Math.abs(dx) < 95 && player.y < node.sprite.y - 24;

      if (node.state === 'PREPARE') {
        body.setVelocityX(0);
        node.sprite.setFlipX(player.x < node.sprite.x);
        node.stateTimerMs -= deltaMs;
        if (node.stateTimerMs <= 0) {
          if (playerDirectlyOverhead) {
            node.state = 'IDLE';
            node.stateTimerMs = 450;
            node.cooldownMs = 700;
            this.playStateAnim(node, 'IDLE', true);
          } else {
            this.enterThrowState(node, player);
          }
        }
        continue;
      }

      if (node.state === 'THROW') {
        body.setVelocityX(0);
        node.stateTimerMs -= deltaMs;
        if (node.stateTimerMs <= 0) {
          node.state = 'PATROL';
          this.playStateAnim(node, 'PATROL', true);
        }
        continue;
      }

      // DETECT PLAYER: stop patrolling temporarily and face Deni while in guard zone
      if (playerInRange) {
        body.setVelocityX(0);
        node.sprite.setFlipX(player.x < node.sprite.x);

        if (node.cooldownMs <= 0 && !playerDirectlyOverhead) {
          node.state = 'PREPARE';
          node.stateTimerMs = PREPARE_DURATION_MS;
          if (this.useSpriteSheet) {
            this.playStateAnim(node, 'PREPARE', true);
          } else {
            node.sprite.stop();
            node.sprite.setTexture(ENTITY_TEXTURE_KEYS.MONKEY_PREPARE);
          }
        } else {
          node.state = 'IDLE';
          this.playStateAnim(node, 'IDLE');
        }
        continue;
      }

      // RETURN TO GUARD: resume patrol inside [patrolMinX, patrolMaxX] once Deni moves away
      if (node.state === 'IDLE') {
        body.setVelocityX(0);
        node.stateTimerMs -= deltaMs;
        if (node.stateTimerMs <= 0) {
          node.state = 'PATROL';
          this.playStateAnim(node, 'PATROL', true);
        }
        continue;
      }

      // PATROL within [patrolMinX, patrolMaxX]
      this.playStateAnim(node, 'PATROL');
      node.sprite.setFlipX(node.direction < 0);
      body.setVelocityX(node.direction * PATROL_SPEED);

      if (node.direction < 0 && node.sprite.x <= node.patrolMinX) {
        node.sprite.x = node.patrolMinX;
        node.direction = 1;
        node.state = 'IDLE';
        node.stateTimerMs = IDLE_DURATION_MS;
        body.setVelocityX(0);
        this.playStateAnim(node, 'IDLE', true);
      } else if (node.direction > 0 && node.sprite.x >= node.patrolMaxX) {
        node.sprite.x = node.patrolMaxX;
        node.direction = -1;
        node.state = 'IDLE';
        node.stateTimerMs = IDLE_DURATION_MS;
        body.setVelocityX(0);
        this.playStateAnim(node, 'IDLE', true);
      }
    }

    // Sync Head Stomp Sensor Zone to every alive monkey's physics body
    for (const node of this.monkeys) {
      if (node.lifeStatus === 'alive' && node.sprite.scene) {
        this.syncHeadZone(node);
      }
    }

    // Spin (if procedural fallback) & clean up projectiles exiting level bounds
    if (this.projectilesGroup?.children) {
      const children = [...this.projectilesGroup.getChildren()];
      for (const child of children) {
        const proj = child as Phaser.Physics.Arcade.Sprite;
        if (!proj.active) continue;
        if (!this.useSpriteSheet) {
          proj.angle += 420 * dt;
        }
        if (
          proj.x < -40 ||
          proj.x > this.worldWidth + 40 ||
          proj.y < -80 ||
          proj.y > GAME_HEIGHT + 80
        ) {
          proj.destroy();
        }
      }
    }

    this.renderDebugOverlay(player);
  }

  private enterThrowState(
    node: MonkeyNode,
    player: Phaser.Physics.Arcade.Sprite
  ): void {
    if (node.lifeStatus !== 'alive') return;
    node.state = 'THROW';
    node.stateTimerMs = THROW_DURATION_MS;
    node.cooldownMs = ATTACK_COOLDOWN_MS;
    node.sprite.setFlipX(player.x < node.sprite.x);

    if (this.useSpriteSheet) {
      this.playStateAnim(node, 'THROW', true);
    } else {
      node.sprite.stop();
      node.sprite.setTexture(ENTITY_TEXTURE_KEYS.MONKEY_THROW);
    }

    const facing = node.sprite.flipX ? -1 : 1;
    const spawnX = node.sprite.x + facing * 22;
    const spawnY = node.sprite.y - 38;

    node.targetXAtThrow = player.x;
    node.targetYAtThrow = player.y - 42;

    const dx = node.targetXAtThrow - spawnX;
    const dy = node.targetYAtThrow - spawnY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const vx = (dx / dist) * PROJECTILE_SPEED;
    const vy = (dy / dist) * PROJECTILE_SPEED;

    const proj = this.useSpriteSheet
      ? (this.projectilesGroup.create(
          spawnX,
          spawnY,
          this.profile.textureKey,
          this.profile.projectileFrame
        ) as Phaser.Physics.Arcade.Sprite)
      : (this.projectilesGroup.create(
          spawnX,
          spawnY,
          ENTITY_TEXTURE_KEYS.MONKEY_PROJECTILE
        ) as Phaser.Physics.Arcade.Sprite);

    proj.setScale(this.useSpriteSheet ? WORLD_SPRITE_SCALE * 0.9 : 1.8);
    proj.setDepth(21);
    proj.setData('consumed', false);
    proj.setData('ownerId', node.id);

    const pBody = proj.body as Phaser.Physics.Arcade.Body;
    pBody.setAllowGravity(false);
    if (this.useSpriteSheet) {
      pBody.setSize(28, 28, true);
      if (this.scene.anims.exists(this.profile.animKeys.projSpin)) {
        proj.play(this.profile.animKeys.projSpin);
      }
    } else {
      pBody.setSize(8, 8, false);
      pBody.setOffset(3, 3);
    }
    pBody.setVelocity(vx, vy);

    AudioSystem.playJump();
  }

  public destroy(): void {
    if (this.debugKeyHandler && this.scene.input?.keyboard) {
      this.scene.input.keyboard.off('keydown-F9', this.debugKeyHandler);
      this.scene.input.keyboard.off('keydown-BACKTICK', this.debugKeyHandler);
      this.debugKeyHandler = undefined;
    }
    this.debugGraphics?.destroy();
    this.debugGraphics = undefined;
    this.debugLabel?.destroy();
    this.debugLabel = undefined;
    this.enemyDebugLabels.forEach((lbl) => lbl.destroy());
    this.enemyDebugLabels.clear();
    this.headZoneDebugLabels.forEach((lbl) => lbl.destroy());
    this.headZoneDebugLabels.clear();

    for (const node of this.monkeys) {
      if (node.headZone.scene) {
        node.headZone.destroy();
      }
      if (node.sprite.scene) {
        node.sprite.destroy();
      }
    }
    this.monkeys.length = 0;

    if (this.projectilesGroup?.children) {
      this.projectilesGroup.clear(true, true);
    }
    if (this.headZonesGroup?.children) {
      this.headZonesGroup.clear(true, true);
    }
    if (this.monkeysGroup?.children) {
      this.monkeysGroup.clear(true, true);
    }
  }
}
