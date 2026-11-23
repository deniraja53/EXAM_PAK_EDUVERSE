import Phaser from 'phaser';
import {
  ASSET_KEYS,
  getFrameSpec,
} from '../config/assetManifest';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  WORLD_SPRITE_SCALE,
} from '../config/constants';
import { FallingWoodPlatformManager } from '../entities/FallingWoodPlatform';
import {
  ForestMonkeyManager,
  STAGE2_SCORPION_PROFILE,
} from '../entities/ForestMonkey';
import { HeartProjectileManager } from '../entities/HeartProjectile';
import { Player } from '../entities/Player';
import { QuestionBoxManager } from '../entities/QuestionBox';
import { GameBridge } from '../GameBridge';
import {
  LevelDecorPlacement,
  LevelDefinition,
  LevelObstaclePlacement,
  LevelPlatformPlacement,
} from '../levels/level01';
import { getLevelById } from '../levels/levelRegistry';
import { AudioSystem } from '../systems/AudioSystem';
import { AnimatedGifBackground } from '../systems/AnimatedGifBackground';
import { InputSystem } from '../systems/InputSystem';
import {
  addSavannaParallaxBackdrop,
  ensureRetroBackdropTextures,
  SavannaBackdropLayers,
} from '../systems/PixelArtBackdrop';
import { ensureLevel01EntityTextures } from '../systems/PixelArtEntities';
import {
  detectGroundWaterGaps,
  PixelArtWaterLayer,
} from '../systems/PixelArtWater';
import { StorageSystem } from '../systems/StorageSystem';
import {
  createExamSessionAllocator,
  ExamSessionAllocator,
} from '../../teacher/teacherStorage';
import {
  ActiveCheckpointState,
  HudSnapshot,
  PlayOutcome,
  QuizQuestion,
} from '../types/gameTypes';

interface CheckpointNode {
  id: string;
  name: string;
  x: number;
  y: number;
  activated: boolean;
  marker: Phaser.GameObjects.Image;
  obelisk?: Phaser.GameObjects.Image;
  pulseTween?: Phaser.Tweens.Tween;
}

export class WorldScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private player!: Player;
  private inputSystem!: InputSystem;

  private platformsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private gemsGroup!: Phaser.Physics.Arcade.Group;
  private checkpoints: CheckpointNode[] = [];
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private animatedBg?: AnimatedGifBackground;
  private savannaBackdrop?: SavannaBackdropLayers;
  private waterLayer?: PixelArtWaterLayer;
  private fallingWoodManager?: FallingWoodPlatformManager;
  private questionBoxManager?: QuestionBoxManager;
  private monkeyManager?: ForestMonkeyManager;
  private heartProjectileManager?: HeartProjectileManager;
  private twilightSky?: Phaser.GameObjects.TileSprite;

  private score = 0;
  private lives = 3;
  private readonly maxLives = 3;
  private gemsCollected = 0;
  private questionsAnswered = 0;
  private checkpointsReached = 0;
  private currentAreaName = 'Forest Entrance';
  private respawnPoint = { x: 140, y: 580 };
  private outcome: PlayOutcome = 'ACTIVE';
  private goalZone?: Phaser.GameObjects.Zone;
  private examAllocator?: ExamSessionAllocator;
  private activeCheckpoint: ActiveCheckpointState | null = null;
  private activeQuestionMeta?: { boxId: string; question: QuizQuestion };

  private unsubs: Array<() => void> = [];

  constructor() {
    super({ key: 'WorldScene' });
  }

  public init(data?: { levelId?: string; clearCheckpoint?: boolean }): void {
    const levelId = data?.levelId ?? 'level-01';
    this.level = getLevelById(levelId);
    if (data?.clearCheckpoint) {
      StorageSystem.clearLevelCheckpoint(this.level.id);
    }

    const savedCheckpoint = StorageSystem.loadLevelCheckpoint(this.level.id);
    this.activeCheckpoint = savedCheckpoint;
    this.score = 0;
    this.lives = this.maxLives;
    this.gemsCollected = 0;
    this.questionsAnswered = 0;
    this.checkpointsReached = savedCheckpoint ? savedCheckpoint.activatedIds.length : 0;
    this.respawnPoint = savedCheckpoint
      ? { x: savedCheckpoint.x, y: savedCheckpoint.y }
      : { ...this.level.spawn };
    const startArea = this.level.areas.find(
      (a) => this.respawnPoint.x >= a.startX && this.respawnPoint.x < a.endX
    );
    this.currentAreaName =
      startArea?.name ?? this.level.areas[0]?.name ?? this.level.name;
    this.outcome = 'ACTIVE';
    this.checkpoints = [];
  }

  public create(): void {
    this.physics.world.setBounds(0, 0, this.level.worldWidth, this.level.worldHeight + 180);
    this.physics.world.setBoundsCollision(true, true, false, false);

    const settings = StorageSystem.loadSettings();
    this.cameras.main.setRoundPixels(settings.pixelSnapCamera);
    this.cameras.main.setBounds(0, 0, this.level.worldWidth, this.level.worldHeight);

    // 1. BACKGROUND LAYER
    ensureRetroBackdropTextures(this);
    this.animatedBg?.destroy();
    this.animatedBg = undefined;
    this.waterLayer?.destroy();
    this.waterLayer = undefined;
    this.savannaBackdrop = undefined;
    this.twilightSky = undefined;

    if (this.level.skyTheme === 'savanna') {
      this.savannaBackdrop = addSavannaParallaxBackdrop(this);
    } else {
      // Stage 1: Twilight margin fill at depth -1, full uncropped background2.gif at depth 0
      this.twilightSky = this.add
        .tileSprite(0, 0, GAME_WIDTH / 4, GAME_HEIGHT / 4, 'px_sky_twilight')
        .setOrigin(0, 0)
        .setScale(4)
        .setScrollFactor(0)
        .setDepth(-1);

      this.animatedBg = new AnimatedGifBackground(this);
    }

    ensureLevel01EntityTextures(this);

    // 2. RETRO PIXEL-ART WATER LAYER (Meadow only — dry canyon chasms in Savanna)
    if (this.level.skyTheme !== 'savanna') {
      this.waterLayer = new PixelArtWaterLayer(this, detectGroundWaterGaps(this.level));
    }

    // 3. MIDGROUND LAYER (Non-colliding background props)
    this.buildDecorLayer(this.level.midgroundDecorations, 5);

    // 4. GAMEPLAY LAYER (Ground, Platforms, Falling Wood, Obstacles, Decor, Gems, Question Boxes, Monkeys, Checkpoints)
    this.platformsGroup = this.physics.add.staticGroup();
    this.buildTerrain();
    this.buildObstacles();
    this.buildDecorLayer(this.level.decorations, 8);
    this.buildCollectibles();
    this.buildCheckpoints();
    this.buildGoalPortal();

    // Dust emitter for jump, landing, crate, & projectile feedback
    if (this.textures.exists('px_dust')) {
      this.dustEmitter = this.add.particles(0, 0, 'px_dust', {
        speed: { min: 25, max: 90 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 180, max: 320 },
        scale: { start: 1.5, end: 0.5 },
        alpha: { start: 0.9, end: 0 },
        emitting: false,
      });
      this.dustEmitter.setDepth(21);
    }

    this.fallingWoodManager?.destroy();
    this.fallingWoodManager = new FallingWoodPlatformManager(
      this,
      this.level.fallingPlatforms ?? [],
      this.dustEmitter
    );

    const playerProfile = StorageSystem.loadPlayerProfile();
    this.examAllocator = createExamSessionAllocator(
      this.level.id,
      playerProfile.name,
      playerProfile.school
    );
    this.activeQuestionMeta = undefined;

    const boxSpriteConfig =
      this.level.questionBoxTheme === 'savanna'
        ? {
            sheetKey: ASSET_KEYS.STAGE2_PROPS,
            idleFrame: 's2_qbox_idle',
            activeFrame: 's2_qbox_active',
            usedFrame: 's2_qbox_used',
          }
        : undefined;

    this.questionBoxManager?.destroy();
    this.questionBoxManager = new QuestionBoxManager(
      this,
      this.level.questionBoxes ?? [],
      this.dustEmitter,
      (boxId, defaultQuestionId) =>
        this.examAllocator?.assignQuestionForBox(boxId, defaultQuestionId) ?? null,
      boxSpriteConfig
    );

    const enemyProfile =
      this.level.enemyProfile === 'scorpion' ? STAGE2_SCORPION_PROFILE : undefined;

    this.monkeyManager?.destroy();
    this.monkeyManager = new ForestMonkeyManager(
      this,
      this.level.worldWidth,
      this.level.monkeys ?? [],
      this.dustEmitter,
      enemyProfile
    );

    // Deni player & Heart Projectile combat system
    this.player = new Player(this, this.respawnPoint.x, this.respawnPoint.y);
    this.inputSystem = new InputSystem(this);
    this.heartProjectileManager?.destroy();
    this.heartProjectileManager = new HeartProjectileManager(
      this,
      this.level.worldWidth,
      this.dustEmitter
    );

    // 5. FOREGROUND LAYER (Non-colliding framing vegetation)
    this.buildDecorLayer(this.level.foregroundDecorations, 25);

    // Colliders & Overlaps
    this.physics.add.collider(this.player, this.platformsGroup);
    this.fallingWoodManager.registerPlayerCollider(this.player);
    this.player.setOverheadObstacles([
      { group: this.platformsGroup },
      {
        group: this.fallingWoodManager.getGroup(),
        processCallback: (_sensor, platObj) =>
          this.fallingWoodManager?.isSolidPlatform(
            platObj as Phaser.GameObjects.GameObject
          ) ?? false,
      },
    ]);

    this.physics.add.overlap(
      this.player,
      this.gemsGroup,
      (_player, gemObj) => {
        this.handleCollectGem(gemObj as Phaser.Physics.Arcade.Sprite);
      },
      undefined,
      this
    );

    this.physics.add.overlap(
      this.player,
      this.questionBoxManager.getGroup(),
      (_player, boxObj) => {
        this.handleActivateQuestionBox(boxObj as Phaser.Physics.Arcade.Sprite);
      },
      undefined,
      this
    );

    const handleEnemyDefeated = (x: number, y: number, bonus: number) => {
      this.score += bonus;
      this.showFloatingScore(x, y, `+${bonus}`);
      this.emitHud();
    };

    this.monkeyManager.registerColliders(
      this.player,
      this.platformsGroup,
      (sourceX) => this.handleEnemyDamage(sourceX),
      handleEnemyDefeated,
      () => ({ lives: this.lives, maxLives: this.maxLives })
    );

    this.monkeyManager.registerHeartProjectileCollider(
      this.heartProjectileManager.getGroup(),
      handleEnemyDefeated,
      (hitX, hitY) => this.heartProjectileManager?.spawnHitBurst(hitX, hitY)
    );

    if (this.goalZone) {
      this.physics.add.overlap(
        this.player,
        this.goalZone,
        () => {
          this.handleReachGoal();
        },
        undefined,
        this
      );
    }

    // Smooth side-scrolling camera centered & following Deni
    this.cameras.main.centerOn(this.respawnPoint.x, this.respawnPoint.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(140, 80);

    // Bridge subscriptions for Pause / Resume / Restart / Checkpoint Respawn / Exit / Question Resolution
    this.cleanupSubscriptions();
    this.unsubs.push(
      GameBridge.on('game:pause-requested', () => this.pauseGame()),
      GameBridge.on('game:resume-requested', () => this.resumeGame()),
      GameBridge.on('game:restart-requested', () => {
        StorageSystem.clearLevelCheckpoint(this.level.id);
        this.scene.restart({ levelId: this.level.id, clearCheckpoint: true });
      }),
      GameBridge.on('game:respawn-checkpoint', () => {
        this.handleRespawnFromCheckpoint();
      }),
      GameBridge.on('game:enter-menu', () => {
        this.scene.start('MainMenuScene');
      }),
      GameBridge.on('game:start-level', ({ levelId }) => {
        StorageSystem.clearLevelCheckpoint(levelId);
        this.scene.restart({ levelId, clearCheckpoint: true });
      }),
      GameBridge.on('question:resolved', ({ isCorrect, rewardScore, answerPayload }) => {
        this.handleQuestionResolved(isCorrect, rewardScore, answerPayload);
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupSubscriptions();
      this.inputSystem?.destroy();
      this.animatedBg?.destroy();
      this.animatedBg = undefined;
      this.savannaBackdrop = undefined;
      this.waterLayer?.destroy();
      this.waterLayer = undefined;
      this.fallingWoodManager?.destroy();
      this.fallingWoodManager = undefined;
      this.questionBoxManager?.destroy();
      this.questionBoxManager = undefined;
      this.monkeyManager?.destroy();
      this.monkeyManager = undefined;
      this.heartProjectileManager?.destroy();
      this.heartProjectileManager = undefined;
      this.examAllocator = undefined;
      this.activeQuestionMeta = undefined;
    });

    this.emitHud();
    this.showAreaBanner(this.currentAreaName);
    GameBridge.emit('game:ready', { scene: 'WorldScene' });
  }

  private cleanupSubscriptions(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  private addStaticPlatform(placement: LevelPlatformPlacement, originY: number): void {
    if (!this.textures.exists(placement.sheetKey)) return;
    const spec = getFrameSpec(placement.sheetKey, placement.frame);
    if (!spec) return;

    const sprite = this.platformsGroup.create(
      placement.x,
      placement.y,
      placement.sheetKey,
      placement.frame
    ) as Phaser.Physics.Arcade.Sprite;

    const s = (placement.scale ?? 1) * WORLD_SPRITE_SCALE;
    sprite.setScale(s);
    sprite.setOrigin(0.5, originY);
    sprite.setDepth(placement.depth ?? 10);
    sprite.refreshBody();

    // Adjust static physics body to match actual grass/plank surface rather than overhanging blades/roots
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    const inset = spec.collider ?? {
      topInset: 16,
      bottomInset: 8,
      leftInset: 8,
      rightInset: 8,
    };

    const w = Math.max(16, (spec.w - inset.leftInset - inset.rightInset) * s);
    const h = Math.max(12, (spec.h - inset.topInset - inset.bottomInset) * s);
    const topLeftX = placement.x - (spec.w * s) / 2 + inset.leftInset * s;
    const topLeftY =
      originY === 1
        ? placement.y - spec.h * s + inset.topInset * s
        : placement.y - (spec.h * s) / 2 + inset.topInset * s;

    body.setSize(w, h, false);
    body.position.set(topLeftX, topLeftY);
    body.updateCenter();
  }

  private buildTerrain(): void {
    for (const ground of this.level.groundSegments) {
      this.addStaticPlatform(ground, 1);
    }
    for (const plat of this.level.floatingPlatforms) {
      this.addStaticPlatform(plat, 0.5);
    }
  }

  private buildObstacles(): void {
    for (const obs of this.level.obstacles) {
      if (obs.kind === 'solid_block') {
        this.addSolidObstacle(obs);
      }
    }
  }

  private addSolidObstacle(obs: LevelObstaclePlacement): void {
    if (!this.textures.exists(obs.sheetKey)) return;
    const spec = getFrameSpec(obs.sheetKey, obs.frame);
    if (!spec) return;

    const sprite = this.platformsGroup.create(
      obs.x,
      obs.y,
      obs.sheetKey,
      obs.frame
    ) as Phaser.Physics.Arcade.Sprite;

    const s = (obs.scale ?? 1) * WORLD_SPRITE_SCALE;
    sprite.setScale(s);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(11);
    sprite.refreshBody();

    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    const inset = obs.colliderInset ?? {
      topInset: 14,
      bottomInset: 4,
      leftInset: 14,
      rightInset: 14,
    };
    const w = Math.max(16, (spec.w - inset.leftInset - inset.rightInset) * s);
    const h = Math.max(16, (spec.h - inset.topInset - inset.bottomInset) * s);
    const topLeftX = obs.x - (spec.w * s) / 2 + inset.leftInset * s;
    const topLeftY = obs.y - spec.h * s + inset.topInset * s;

    body.setSize(w, h, false);
    body.position.set(topLeftX, topLeftY);
    body.updateCenter();
  }

  private buildDecorLayer(items: LevelDecorPlacement[], defaultDepth: number): void {
    for (const decor of items) {
      if (!this.textures.exists(decor.sheetKey)) continue;
      const img = this.add.image(decor.x, decor.y, decor.sheetKey, decor.frame);
      img.setScale((decor.scale ?? 1) * WORLD_SPRITE_SCALE);
      img.setOrigin(0.5, 1);
      img.setDepth(decor.depth ?? defaultDepth);
      if (decor.flipX) img.setFlipX(true);
      if (typeof decor.alpha === 'number') img.setAlpha(decor.alpha);
    }
  }

  private buildCollectibles(): void {
    this.gemsGroup = this.physics.add.group({ allowGravity: false, immovable: true });

    this.level.gems.forEach((g, idx) => {
      const gem = this.gemsGroup.create(g.x, g.y, 'px_gem') as Phaser.Physics.Arcade.Sprite;
      gem.setScale(g.optional ? 2.2 : 2);
      if (g.optional) {
        gem.setTint(0x6ee7b7);
      }
      gem.setDepth(22);
      gem.setData('collected', false);

      this.tweens.add({
        targets: gem,
        y: g.y - 6,
        duration: 950,
        delay: idx * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private buildCheckpoints(): void {
    const activatedSet = new Set(this.activeCheckpoint?.activatedIds ?? []);

    this.level.checkpoints.forEach((cp) => {
      let obelisk: Phaser.GameObjects.Image | undefined;
      if (this.level.skyTheme === 'savanna' && this.textures.exists(ASSET_KEYS.STAGE2_PROPS)) {
        obelisk = this.add
          .image(cp.x, cp.y + 6, ASSET_KEYS.STAGE2_PROPS, 's2_rock_1')
          .setScale(WORLD_SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(9);
      } else if (this.textures.exists(ASSET_KEYS.ROCK_DECOR)) {
        obelisk = this.add
          .image(cp.x, cp.y + 4, ASSET_KEYS.ROCK_DECOR, 'rune_obelisk')
          .setScale(WORLD_SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(9);
      }

      const marker = this.add
        .image(cp.x, cp.y - 98, 'px_gem')
        .setScale(1.6)
        .setTint(0x94a3b8)
        .setDepth(15);

      const node: CheckpointNode = {
        id: cp.id,
        name: cp.name,
        x: cp.x,
        y: cp.y - 30,
        activated: activatedSet.has(cp.id),
        marker,
        obelisk,
      };

      if (node.activated) {
        this.applyCheckpointVisualActive(node);
      }

      this.checkpoints.push(node);
    });
  }

  private applyCheckpointVisualActive(cp: CheckpointNode): void {
    cp.marker.setTint(0x34d399);
    cp.marker.setScale(2.0);
    cp.obelisk?.setTint(0xa7f3d0);

    if (!cp.pulseTween) {
      cp.pulseTween = this.tweens.add({
        targets: cp.marker,
        y: cp.marker.y - 8,
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private buildGoalPortal(): void {
    const { x, y, label } = this.level.goal;
    this.goalZone = this.add.zone(x, y - 48, 84, 118);
    this.physics.add.existing(this.goalZone, true);

    const isSavanna = this.level.skyTheme === 'savanna';
    const beacon = this.add
      .image(x, y - 118, 'px_gem')
      .setScale(2.4)
      .setTint(isSavanna ? 0xfbbf24 : 0x34d399)
      .setDepth(16);

    if (isSavanna) {
      this.add
        .text(x, y - 156, label.toUpperCase(), {
          fontFamily: '"Silkscreen", monospace',
          fontSize: '11px',
          color: '#fef08a',
          backgroundColor: '#0b1322cc',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(16);
    }

    this.tweens.add({
      targets: beacon,
      y: y - 132,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private handleCollectGem(gem: Phaser.Physics.Arcade.Sprite): void {
    if (gem.getData('collected')) return;
    gem.setData('collected', true);
    gem.disableBody(true, true);

    this.gemsCollected += 1;
    this.score += 100;
    AudioSystem.playGem();

    if (this.dustEmitter) {
      this.dustEmitter.explode(8, gem.x, gem.y);
    }

    this.showFloatingScore(gem.x, gem.y - 12, '+100');
    this.emitHud();
  }

  private showFloatingScore(x: number, y: number, text: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#fde047',
        stroke: '#0f172a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: label,
      y: y - 28,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private showAreaBanner(areaName: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 74, areaName.toUpperCase(), {
        fontFamily: '"Silkscreen", monospace',
        fontSize: '15px',
        color: '#fef08a',
        stroke: '#0b1322',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(35)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      duration: 220,
      yoyo: true,
      hold: 1100,
      ease: 'Sine.easeInOut',
      onComplete: () => label.destroy(),
    });
  }

  private updateAreaZone(): void {
    if (this.level.areas.length === 0) return;
    const zone = this.level.areas.find(
      (a) => this.player.x >= a.startX && this.player.x < a.endX
    );
    if (zone && zone.name !== this.currentAreaName) {
      this.currentAreaName = zone.name;
      this.showAreaBanner(zone.name);
      this.emitHud();
    }
  }

  private checkCheckpoints(): void {
    for (const cp of this.checkpoints) {
      if (cp.activated) continue;
      if (Math.abs(this.player.x - cp.x) < 48 && Math.abs(this.player.y - cp.y) < 135) {
        cp.activated = true;

        const activatedIds = new Set(this.activeCheckpoint?.activatedIds ?? []);
        activatedIds.add(cp.id);

        this.checkpointsReached = activatedIds.size;
        this.respawnPoint = { x: cp.x, y: cp.y };
        this.activeCheckpoint = {
          levelId: this.level.id,
          checkpointId: cp.id,
          name: cp.name,
          x: cp.x,
          y: cp.y,
          activatedIds: Array.from(activatedIds),
        };
        StorageSystem.saveLevelCheckpoint(this.level.id, this.activeCheckpoint);

        this.score += 150;
        this.applyCheckpointVisualActive(cp);
        if (this.dustEmitter) {
          this.dustEmitter.explode(14, cp.x, cp.y - 36);
        }
        AudioSystem.playCheckpoint();
        this.showFloatingScore(cp.x, cp.y - 90, 'CHECKPOINT AKTIF!');
        this.emitHud();
      }
    }
  }

  private handleActivateQuestionBox(boxSprite: Phaser.Physics.Arcade.Sprite): void {
    if (this.outcome !== 'ACTIVE') return;
    const activated = this.questionBoxManager?.tryActivate(boxSprite);
    if (!activated) return;

    if (!activated.question) {
      this.score += 50;
      AudioSystem.playGem();
      this.showFloatingScore(this.player.x, this.player.y - 72, 'SOAL SELESAI! +50');
      this.emitHud();
      return;
    }

    this.activeQuestionMeta = {
      boxId: activated.boxId,
      question: activated.question,
    };

    this.outcome = 'QUESTION';
    this.physics.world.pause();
    this.animatedBg?.setPaused(true);
    this.waterLayer?.setPaused(true);
    this.fallingWoodManager?.setPaused(true);
    this.monkeyManager?.setPaused(true);
    this.heartProjectileManager?.setPaused(true);
    this.inputSystem.setTextInputMode(true);

    this.emitHud();
    GameBridge.emit('question:open', {
      boxId: activated.boxId,
      question: activated.question,
    });
  }

  private handleQuestionResolved(
    isCorrect: boolean,
    rewardScore: number,
    answerPayload?: string
  ): void {
    if (this.outcome !== 'QUESTION') return;

    const meta = this.activeQuestionMeta;
    this.activeQuestionMeta = undefined;

    this.questionsAnswered += 1;
    const actualReward = isCorrect ? rewardScore : 0;
    if (isCorrect) {
      this.score += actualReward;
      AudioSystem.playGem();
      this.showFloatingScore(this.player.x, this.player.y - 72, `+${actualReward}`);
    } else {
      AudioSystem.playHurt();
    }

    if (meta && this.examAllocator) {
      this.examAllocator.recordAnswer({
        boxId: meta.boxId,
        questionId: meta.question.id,
        modelType: meta.question.modelType ?? 'pilihan_ganda',
        answerPayload: answerPayload ?? '',
        isCorrect,
        scoreAwarded: actualReward,
      });
    }

    this.outcome = 'ACTIVE';
    this.physics.world.resume();
    this.animatedBg?.setPaused(false);
    this.waterLayer?.setPaused(false);
    this.fallingWoodManager?.setPaused(false);
    this.monkeyManager?.setPaused(false);
    this.heartProjectileManager?.setPaused(false);
    if (
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    ) {
      document.activeElement.blur();
    }
    this.inputSystem.setTextInputMode(false);
    this.emitHud();
  }

  private handleEnemyDamage(sourceX: number): void {
    if (this.outcome !== 'ACTIVE') return;
    if (!this.player.triggerDamage(1300, sourceX)) return;

    AudioSystem.playHurt();
    this.cameras.main.shake(140, 0.006);
    this.lives = Math.max(0, this.lives - 1);
    this.showFloatingScore(this.player.x, this.player.y - 74, '-1 HEART');

    if (this.lives <= 0) {
      this.outcome = 'GAME_OVER';
      this.physics.world.pause();
      this.animatedBg?.setPaused(true);
      this.waterLayer?.setPaused(true);
      this.fallingWoodManager?.setPaused(true);
      this.monkeyManager?.setPaused(true);
      this.heartProjectileManager?.setPaused(true);
      StorageSystem.saveLevelScore(this.level.id, this.score, false);
      this.examAllocator?.finalizeSession(this.score, 'game_over');
    }

    this.emitHud();
  }

  private handleReachGoal(): void {
    if (this.outcome !== 'ACTIVE') return;
    this.outcome = 'LEVEL_COMPLETE';
    this.score += 500;
    this.player.startCelebration();
    this.fallingWoodManager?.setPaused(true);
    this.monkeyManager?.setPaused(true);
    this.heartProjectileManager?.setPaused(true);
    AudioSystem.playVictory();
    StorageSystem.clearLevelCheckpoint(this.level.id);
    StorageSystem.saveLevelScore(this.level.id, this.score, true);
    this.examAllocator?.finalizeSession(this.score, 'completed');
    this.emitHud();
  }

  private respawnPlayerAtPoint(invulnMs = 2200): void {
    const saved =
      this.activeCheckpoint ?? StorageSystem.loadLevelCheckpoint(this.level.id);
    const spawnX = saved ? saved.x : this.level.spawn.x;
    const spawnY = saved ? saved.y : this.level.spawn.y;

    this.respawnPoint = { x: spawnX, y: spawnY };
    this.player.resetAt(spawnX, spawnY, invulnMs);
    this.monkeyManager?.resetProximityThreat(spawnX, 540, invulnMs);
    this.fallingWoodManager?.resetAll();
    this.heartProjectileManager?.resetAll();

    // Immediately re-center and lock camera onto Deni at the respawn location
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(spawnX, spawnY);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(140, 80);

    this.updateAreaZone();
  }

  private handleRespawnFromCheckpoint(): void {
    const saved =
      this.activeCheckpoint ?? StorageSystem.loadLevelCheckpoint(this.level.id);
    if (!saved) {
      this.scene.restart({ levelId: this.level.id, clearCheckpoint: true });
      return;
    }

    this.activeCheckpoint = saved;
    this.lives = this.maxLives;
    this.outcome = 'ACTIVE';

    this.physics.world.resume();
    this.animatedBg?.setPaused(false);
    this.waterLayer?.setPaused(false);
    this.fallingWoodManager?.setPaused(false);
    this.monkeyManager?.setPaused(false);
    this.heartProjectileManager?.setPaused(false);
    this.inputSystem.setTextInputMode(false);

    this.respawnPlayerAtPoint(2400);
    if (this.dustEmitter) {
      this.dustEmitter.explode(12, saved.x, saved.y - 20);
    }
    this.showFloatingScore(saved.x, saved.y - 84, `RESPAWN: ${saved.name.toUpperCase()}`);
    this.emitHud();
  }

  private handlePitfall(): void {
    if (this.outcome !== 'ACTIVE') return;
    AudioSystem.playHurt();
    this.cameras.main.shake(160, 0.008);
    this.lives = Math.max(0, this.lives - 1);

    if (this.lives <= 0) {
      this.outcome = 'GAME_OVER';
      this.physics.world.pause();
      this.animatedBg?.setPaused(true);
      this.waterLayer?.setPaused(true);
      this.fallingWoodManager?.setPaused(true);
      this.monkeyManager?.setPaused(true);
      this.heartProjectileManager?.setPaused(true);
      StorageSystem.saveLevelScore(this.level.id, this.score, false);
      this.examAllocator?.finalizeSession(this.score, 'game_over');
      this.emitHud();
      return;
    }

    this.respawnPlayerAtPoint(2200);
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.outcome !== 'ACTIVE') return;
    this.outcome = 'PAUSED';
    this.physics.world.pause();
    this.animatedBg?.setPaused(true);
    this.waterLayer?.setPaused(true);
    this.fallingWoodManager?.setPaused(true);
    this.monkeyManager?.setPaused(true);
    this.heartProjectileManager?.setPaused(true);
    this.inputSystem.resetAllInputs();
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.outcome !== 'PAUSED') return;
    const settings = StorageSystem.loadSettings();
    this.cameras.main.setRoundPixels(settings.pixelSnapCamera);
    this.outcome = 'ACTIVE';
    this.physics.world.resume();
    this.animatedBg?.setPaused(false);
    this.waterLayer?.setPaused(false);
    this.fallingWoodManager?.setPaused(false);
    this.monkeyManager?.setPaused(false);
    this.heartProjectileManager?.setPaused(false);
    this.inputSystem.setTextInputMode(false);
    this.emitHud();
  }

  private emitHud(): void {
    const snapshot: HudSnapshot = {
      score: this.score,
      lives: this.lives,
      maxLives: this.maxLives,
      levelId: this.level.id,
      levelNumber: this.level.number,
      levelName: this.level.name,
      areaName: this.currentAreaName,
      gemsCollected: this.gemsCollected,
      totalGems: this.level.gems.length,
      questionsAnswered: this.questionsAnswered,
      totalQuestions:
        this.examAllocator?.getTotalAvailableCount(this.level.questionBoxes?.length ?? 0) ??
        (this.level.questionBoxes?.length ?? 0),
      checkpointReached: this.checkpointsReached,
      totalCheckpoints: this.checkpoints.length,
      activeCheckpointName: this.activeCheckpoint?.name ?? null,
      outcome: this.outcome,
    };
    GameBridge.emit('hud:update', snapshot);
  }

  public update(_time: number, delta: number): void {
    if (this.outcome === 'QUESTION') return;

    const clampedDelta = Math.min(delta, 50);
    const input = this.inputSystem.sample(clampedDelta);

    if (input.pauseJustPressed) {
      if (this.outcome === 'ACTIVE') {
        AudioSystem.playMenuSelect();
        this.pauseGame();
        return;
      } else if (this.outcome === 'PAUSED') {
        AudioSystem.playMenuSelect();
        this.resumeGame();
        return;
      }
    }

    if (this.outcome === 'LEVEL_COMPLETE') {
      this.animatedBg?.update(
        clampedDelta,
        this.cameras.main.scrollX,
        this.cameras.main.scrollY
      );
      this.updateSavannaParallax(clampedDelta, this.cameras.main.scrollX);
      this.waterLayer?.update(clampedDelta);
      return;
    }
    if (this.outcome !== 'ACTIVE') return;

    const result = this.player.updatePlayer(clampedDelta, input, () => {
      this.inputSystem.consumeJumpBuffer();
    });

    if (result.jumped && this.dustEmitter) {
      this.dustEmitter.explode(6, this.player.x, this.player.y - 4);
    }
    if (result.landed && result.impactSpeed > 240 && this.dustEmitter) {
      this.dustEmitter.explode(7, this.player.x, this.player.y - 2);
      if (result.impactSpeed > 650) {
        this.cameras.main.shake(90, 0.004);
      }
    }

    if (input.shootHeld) {
      this.heartProjectileManager?.tryFire(this.player);
    }

    this.heartProjectileManager?.update(clampedDelta, this.cameras.main);
    this.fallingWoodManager?.update(clampedDelta);
    this.monkeyManager?.update(clampedDelta, this.player);

    // Parallax & animated background synced cleanly to camera scroll
    const camX = this.cameras.main.scrollX;
    const camY = this.cameras.main.scrollY;
    this.animatedBg?.update(clampedDelta, camX, camY);
    this.updateSavannaParallax(clampedDelta, camX);
    this.waterLayer?.update(clampedDelta);
    if (this.twilightSky) this.twilightSky.tilePositionX = camX * 0.01;

    this.updateAreaZone();
    this.checkCheckpoints();

    // Pitfall detection below viewport
    if (this.player.y > GAME_HEIGHT + 110) {
      this.handlePitfall();
    }
  }

  private updateSavannaParallax(deltaMs: number, camX: number): void {
    if (!this.savannaBackdrop) return;
    const dt = deltaMs / 1000;
    this.savannaBackdrop.sky.tilePositionX = camX * 0.004;
    this.savannaBackdrop.clouds.tilePositionX += 3 * dt;
    if (this.savannaBackdrop.landscape) {
      this.savannaBackdrop.landscape.tilePositionX = camX * 0.12;
    }
  }
}
