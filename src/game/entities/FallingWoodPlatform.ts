import Phaser from 'phaser';
import { ASSET_KEYS, getFrameSpec } from '../config/assetManifest';
import { GAME_HEIGHT, WORLD_SPRITE_SCALE } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { ENTITY_TEXTURE_KEYS } from '../systems/PixelArtEntities';

export interface FallingWoodPlacement {
  id: string;
  x: number;
  y: number;
}

type FallingWoodState = 'IDLE' | 'ARMED' | 'FALLING' | 'GONE';

interface FallingWoodNode {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  baseX: number;
  baseY: number;
  baseBodyLeft: number;
  baseBodyTop: number;
  state: FallingWoodState;
  armedElapsedMs: number;
}

const FALL_DELAY_MS = 3000;

/**
 * Independent falling wooden plank obstacles.
 * Each plank maintains its own 3-second single-shot countdown triggered only when Deni
 * lands cleanly on top, shakes visually before dropping, disables collision when falling,
 * and cleans itself up once out of world bounds.
 */
export class FallingWoodPlatformManager {
  private readonly scene: Phaser.Scene;
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly placements: FallingWoodPlacement[];
  private readonly nodes: FallingWoodNode[] = [];
  private readonly dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    placements: FallingWoodPlacement[],
    dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter
  ) {
    this.scene = scene;
    this.placements = placements;
    this.dustEmitter = dustEmitter;
    this.group = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    for (const p of placements) {
      this.createPlank(p);
    }
  }

  private createPlank(placement: FallingWoodPlacement): void {
    const hasSheet = this.scene.textures.exists(ASSET_KEYS.FLOATING_PLATFORMS);
    const frameSpec = hasSheet
      ? getFrameSpec(ASSET_KEYS.FLOATING_PLATFORMS, 'plank_wood')
      : undefined;

    const sprite = hasSheet && frameSpec
      ? (this.group.create(
          placement.x,
          placement.y,
          ASSET_KEYS.FLOATING_PLATFORMS,
          'plank_wood'
        ) as Phaser.Physics.Arcade.Sprite)
      : (this.group.create(
          placement.x,
          placement.y,
          ENTITY_TEXTURE_KEYS.FALLING_WOOD_FALLBACK
        ) as Phaser.Physics.Arcade.Sprite);

    const scale = hasSheet && frameSpec ? WORLD_SPRITE_SCALE : 1;
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 0.5);
    sprite.setDepth(10);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    if (hasSheet && frameSpec) {
      const inset = frameSpec.collider ?? {
        topInset: 8,
        bottomInset: 16,
        leftInset: 12,
        rightInset: 12,
      };
      const bodyW = Math.max(16, frameSpec.w - inset.leftInset - inset.rightInset);
      const bodyH = Math.max(12, frameSpec.h - inset.topInset - inset.bottomInset);
      body.setSize(bodyW, bodyH, false);
      body.setOffset(inset.leftInset, inset.topInset);
    } else {
      body.setSize(124, 24, false);
      body.setOffset(3, 4);
    }

    body.updateFromGameObject();

    const node: FallingWoodNode = {
      id: placement.id,
      sprite,
      baseX: placement.x,
      baseY: placement.y,
      baseBodyLeft: body.x,
      baseBodyTop: body.y,
      state: 'IDLE',
      armedElapsedMs: 0,
    };

    sprite.setData('fallingWoodNode', node);
    this.nodes.push(node);
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  public isSolidPlatform(platObj: unknown): boolean {
    const go = platObj as { getData?: (key: string) => unknown } | null;
    const node = go?.getData?.('fallingWoodNode') as FallingWoodNode | undefined;
    return Boolean(node && (node.state === 'IDLE' || node.state === 'ARMED'));
  }

  public registerPlayerCollider(player: Phaser.Physics.Arcade.Sprite): void {
    this.scene.physics.add.collider(
      player,
      this.group,
      (playerObj, platObj) => {
        const pSprite = playerObj as Phaser.Physics.Arcade.Sprite;
        const wSprite = platObj as Phaser.Physics.Arcade.Sprite;
        const node = wSprite.getData('fallingWoodNode') as FallingWoodNode | undefined;
        if (!node || node.state !== 'IDLE') return;

        const pBody = pSprite.body as Phaser.Physics.Arcade.Body;
        const wBody = wSprite.body as Phaser.Physics.Arcade.Body;
        // Arm only when Deni's feet land cleanly on top of the plank
        const landedOnTop =
          pBody.velocity.y >= -15 &&
          pBody.bottom <= wBody.top + 14 &&
          pBody.right > wBody.left + 4 &&
          pBody.left < wBody.right - 4;

        if (landedOnTop) {
          this.armNode(node);
        }
      },
      (_playerObj, platObj) => this.isSolidPlatform(platObj)
    );
  }

  private armNode(node: FallingWoodNode): void {
    if (node.state !== 'IDLE') return;
    node.state = 'ARMED';
    node.armedElapsedMs = 0;
    AudioSystem.playLand();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    for (const node of this.nodes) {
      if (node.state === 'GONE') continue;
      const body = node.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (!body) continue;
      if (paused) {
        body.setAllowGravity(false);
        body.setVelocity(0, 0);
      } else if (node.state === 'FALLING') {
        body.setAllowGravity(true);
        body.setVelocityY(Math.max(120, body.velocity.y));
      }
    }
  }

  public update(deltaMs: number): void {
    if (this.paused) return;
    const dt = Math.min(deltaMs, 50) / 1000;

    for (const node of this.nodes) {
      if (node.state === 'IDLE' || node.state === 'GONE') continue;

      if (node.state === 'ARMED') {
        node.armedElapsedMs += deltaMs;
        const progress = Math.min(1, node.armedElapsedMs / FALL_DELAY_MS);
        const amplitude = progress < 0.5 ? 1.0 : 2.6;
        const freq = progress < 0.5 ? 28 : 54;
        const shakeX = Math.sin(node.armedElapsedMs * 0.001 * freq) * amplitude;

        node.sprite.setPosition(node.baseX + shakeX, node.baseY);
        const body = node.sprite.body as Phaser.Physics.Arcade.Body;
        // Keep physics top surface rock-steady during the 3-second countdown
        body.position.set(node.baseBodyLeft, node.baseBodyTop);
        body.updateCenter();

        if (progress > 0.55) {
          const pulse = Math.floor(node.armedElapsedMs / 110) % 2 === 0;
          node.sprite.setTint(pulse ? 0xfbbf24 : 0xffffff);
        }

        if (node.armedElapsedMs >= FALL_DELAY_MS) {
          this.triggerFall(node);
        }
      } else if (node.state === 'FALLING') {
        node.sprite.angle += 22 * dt;
        if (node.sprite.y > GAME_HEIGHT + 160) {
          node.state = 'GONE';
          node.sprite.destroy();
        }
      }
    }
  }

  private triggerFall(node: FallingWoodNode): void {
    node.state = 'FALLING';
    node.sprite.clearTint();
    node.sprite.setPosition(node.baseX, node.baseY);

    const body = node.sprite.body as Phaser.Physics.Arcade.Body;
    body.checkCollision.none = true;
    body.setImmovable(false);
    body.setAllowGravity(true);
    body.setVelocityY(90);

    if (this.dustEmitter) {
      this.dustEmitter.explode(8, node.baseX, node.baseY + 8);
    }
  }

  public resetAll(): void {
    for (const node of this.nodes) {
      if (node.sprite.scene) {
        node.sprite.destroy();
      }
    }
    this.nodes.length = 0;
    this.group.clear(true, true);

    for (const p of this.placements) {
      this.createPlank(p);
    }
  }

  public destroy(): void {
    for (const node of this.nodes) {
      if (node.sprite.scene) {
        node.sprite.destroy();
      }
    }
    this.nodes.length = 0;
  }
}
