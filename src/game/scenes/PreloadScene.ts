import Phaser from 'phaser';
import {
  ASSET_KEYS,
  ASSET_MANIFEST,
  registerDeniAnimations,
  registerManifestFrames,
  registerMonkeyAnimations,
  registerScorpionAnimations,
} from '../config/assetManifest';
import { GAME_HEIGHT, GAME_WIDTH, WORLD_SPRITE_SCALE } from '../config/constants';
import { GameBridge } from '../GameBridge';
import { getLevelById } from '../levels/levelRegistry';
import { preloadAnimatedBackgroundGifAsync } from '../systems/AnimatedGifBackground';
import { ensureRetroBackdropTextures } from '../systems/PixelArtBackdrop';
import { ensureLevel01EntityTextures } from '../systems/PixelArtEntities';

/**
 * Dedicated gameplay loading scene triggered ONLY after the player passes Start Screen validation
 * and presses Play. Displays Deni running with his real sprite-sheet animation ('deni-run', 8 frames)
 * across a themed track while tracking real preload + animated GIF + scene readiness from 0% to 100%.
 */
export class PreloadScene extends Phaser.Scene {
  private targetLevelId = 'level-01';
  private failedKeys = new Set<string>();
  private loadErrors = new Map<string, string>();

  private targetProgress = 0;
  private displayedProgress = 0;
  private prepCompleted = false;
  private transitionTriggered = false;
  private hasError = false;
  private statusMessage = 'Mempersiapkan petualangan...';

  private barX = 0;
  private barY = 0;
  private barWidth = 520;
  private barHeight = 22;

  private fillGraphics?: Phaser.GameObjects.Graphics;
  private pctText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private runnerSprite?: Phaser.GameObjects.Sprite;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustAccumMs = 0;

  private unsubs: Array<() => void> = [];

  constructor() {
    super({ key: 'PreloadScene' });
  }

  public init(data?: { levelId?: string }): void {
    this.targetLevelId = data?.levelId ?? 'level-01';
    this.failedKeys.clear();
    this.loadErrors.clear();
    this.targetProgress = 0;
    this.displayedProgress = 0;
    this.prepCompleted = false;
    this.transitionTriggered = false;
    this.hasError = false;
    this.statusMessage = 'Memuat aset dunia permainan...';
    this.dustAccumMs = 0;
  }

  public preload(): void {
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#0b1628');
    ensureRetroBackdropTextures(this);
    this.buildLoadingStage();

    this.cleanupSubscriptions();
    this.unsubs.push(
      GameBridge.on('game:retry-load', ({ levelId }) => {
        this.scene.restart({ levelId });
      }),
      GameBridge.on('game:enter-menu', () => {
        this.scene.start('MainMenuScene');
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupSubscriptions();
      this.runnerSprite = undefined;
      this.fillGraphics = undefined;
      this.pctText = undefined;
      this.statusText = undefined;
      this.dustEmitter = undefined;
    });

    this.load.on('progress', (value: number) => {
      this.setTargetProgress(value * 0.45);
    });

    this.load.on('filecomplete', (key: string) => {
      this.statusMessage = `Memuat sprite: ${key}`;
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      const msg = `Gagal memuat aset: ${file.src}`;
      this.failedKeys.add(file.key);
      this.loadErrors.set(file.key, msg);
      GameBridge.emit('assets:error', {
        key: file.key,
        path: String(file.src),
        message: msg,
      });
    });

    let queuedCount = 0;
    for (const sheet of ASSET_MANIFEST) {
      if (!this.textures.exists(sheet.key)) {
        this.load.image(sheet.key, encodeURI(sheet.path));
        queuedCount += 1;
      }
    }

    if (queuedCount === 0) {
      this.setTargetProgress(0.45);
    }
  }

  public create(): void {
    // Ensure Deni runner exists if DENI just finished loading inside PreloadScene
    if (!this.runnerSprite && this.textures.exists(ASSET_KEYS.DENI)) {
      registerManifestFrames(this, this.failedKeys, this.loadErrors);
      registerDeniAnimations(this);
      this.mountRunnerSprite();
    }

    void this.runGameplayPreparation();
  }

  private cleanupSubscriptions(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  private setTargetProgress(next: number, message?: string): void {
    const clamped = Math.max(0, Math.min(1, next));
    if (clamped > this.targetProgress) {
      this.targetProgress = clamped;
    }
    if (message) {
      this.statusMessage = message;
    }
  }

  private buildLoadingStage(): void {
    if (this.textures.exists('px_sky_twilight')) {
      this.add
        .tileSprite(0, 0, GAME_WIDTH / 4, GAME_HEIGHT / 4, 'px_sky_twilight')
        .setOrigin(0, 0)
        .setScale(4)
        .setDepth(0);
    }
    if (this.textures.exists('px_hills_far')) {
      this.add
        .tileSprite(0, GAME_HEIGHT - 340, GAME_WIDTH / 4, 90, 'px_hills_far')
        .setOrigin(0, 0)
        .setScale(4)
        .setAlpha(0.35)
        .setDepth(1);
    }
    if (this.textures.exists('px_forest_silhouette')) {
      this.add
        .tileSprite(0, GAME_HEIGHT - 295, GAME_WIDTH / 4, 84, 'px_forest_silhouette')
        .setOrigin(0, 0)
        .setScale(4)
        .setAlpha(0.45)
        .setDepth(2);
    }

    // Scenic grassy strip at the bottom
    if (this.textures.exists(ASSET_KEYS.GROUND_TILESET)) {
      const groundXs = [102, 306, 510, 714, 918, 1122, 1280];
      groundXs.forEach((gx) => {
        this.add
          .image(gx, GAME_HEIGHT, ASSET_KEYS.GROUND_TILESET, 'ground_wide')
          .setScale(WORLD_SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(4);
      });
    }

    // Centered Loading Card
    const cardW = 680;
    const cardH = 310;
    const cardX = (GAME_WIDTH - cardW) / 2;
    const cardY = (GAME_HEIGHT - cardH) / 2 - 20;

    const card = this.add.graphics().setDepth(5);
    card.fillStyle(0x0b1322, 0.92);
    card.fillRect(cardX, cardY, cardW, cardH);
    card.lineStyle(3, 0xe2e8f0, 1);
    card.strokeRect(cardX, cardY, cardW, cardH);
    card.lineStyle(2, 0x1d3557, 1);
    card.strokeRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8);

    this.add
      .text(GAME_WIDTH / 2, cardY + 34, 'MEMPERSIAPKAN PETUALANGAN...', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '15px',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.barWidth = 520;
    this.barHeight = 22;
    this.barX = (GAME_WIDTH - this.barWidth) / 2;
    this.barY = cardY + 210;

    // Grass runway line right under Deni's running boots
    const runway = this.add.graphics().setDepth(6);
    runway.fillStyle(0x14532d, 1);
    runway.fillRect(this.barX - 8, this.barY - 12, this.barWidth + 16, 4);
    runway.fillStyle(0x22c55e, 1);
    runway.fillRect(this.barX - 8, this.barY - 14, this.barWidth + 16, 2);

    // Goal Question Box waiting at 100% finish line
    if (this.textures.exists(ASSET_KEYS.QUESTION_BOX)) {
      this.add
        .image(this.barX + this.barWidth + 24, this.barY - 12, ASSET_KEYS.QUESTION_BOX, 'qbox_idle')
        .setScale(0.24)
        .setOrigin(0.5, 1)
        .setDepth(7);
    }

    // Progress bar outer frame
    const frame = this.add.graphics().setDepth(7);
    frame.fillStyle(0x091120, 1);
    frame.fillRect(this.barX, this.barY, this.barWidth, this.barHeight);
    frame.lineStyle(3, 0xe2e8f0, 1);
    frame.strokeRect(this.barX - 3, this.barY - 3, this.barWidth + 6, this.barHeight + 6);

    this.fillGraphics = this.add.graphics().setDepth(8);

    this.pctText = this.add
      .text(this.barX + this.barWidth, this.barY + 34, '0%', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '13px',
        color: '#34d399',
      })
      .setOrigin(1, 0)
      .setDepth(8);

    this.statusText = this.add
      .text(this.barX, this.barY + 36, this.statusMessage, {
        fontFamily: '"Silkscreen", monospace',
        fontSize: '12px',
        color: '#cbd5e1',
      })
      .setOrigin(0, 0)
      .setDepth(8);

    if (this.textures.exists('px_dust')) {
      this.dustEmitter = this.add.particles(0, 0, 'px_dust', {
        speedX: { min: -70, max: -25 },
        speedY: { min: -35, max: -5 },
        lifespan: { min: 180, max: 320 },
        scale: { start: 1.4, end: 0.4 },
        alpha: { start: 0.85, end: 0 },
        emitting: false,
      });
      this.dustEmitter.setDepth(7);
    }

    this.mountRunnerSprite();
  }

  private mountRunnerSprite(): void {
    if (this.runnerSprite || !this.textures.exists(ASSET_KEYS.DENI)) return;
    registerDeniAnimations(this);
    this.runnerSprite = this.add
      .sprite(this.barX, this.barY - 12, ASSET_KEYS.DENI, 'run_0')
      .setScale(WORLD_SPRITE_SCALE * 0.92)
      .setOrigin(0.5, 1)
      .setDepth(9);

    if (this.anims.exists('deni-run')) {
      this.runnerSprite.play('deni-run', true);
    }
  }

  private async runGameplayPreparation(): Promise<void> {
    try {
      const report = registerManifestFrames(this, this.failedKeys, this.loadErrors);
      this.registry.set('assetReport', report);
      GameBridge.emit('assets:report', report);

      if (this.failedKeys.size > 0) {
        const firstErr =
          Array.from(this.loadErrors.values())[0] ?? 'Sebagian aset permainan gagal dimuat.';
        throw new Error(firstErr);
      }

      registerDeniAnimations(this);
      registerMonkeyAnimations(this);
      registerScorpionAnimations(this);

      const level = getLevelById(this.targetLevelId);
      if (!level) {
        throw new Error(`Data level "${this.targetLevelId}" tidak ditemukan.`);
      }

      if (level.skyTheme === 'savanna') {
        this.setTargetProgress(0.65, `Memuat latar ${level.name}...`);
      } else {
        this.setTargetProgress(0.5, 'Memuat latar animasi Emerald Meadow...');
        await preloadAnimatedBackgroundGifAsync(undefined, (ratio) => {
          this.setTargetProgress(0.5 + ratio * 0.35);
        });
      }

      if (!this.scene || !this.sys.isActive()) return;

      this.setTargetProgress(0.9, 'Mempersiapkan objek & lingkungan level...');
      ensureRetroBackdropTextures(this);
      ensureLevel01EntityTextures(this);

      this.setTargetProgress(1, `Dunia permainan siap! Masuk ke Stage ${level.number}: ${level.name}...`);
      this.prepCompleted = true;
    } catch (err) {
      if (!this.scene || !this.sys.isActive()) return;
      this.hasError = true;
      const msg =
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mempersiapkan permainan.';
      this.statusMessage = msg;
      this.statusText?.setText(msg).setColor('#fda4af');
      this.runnerSprite?.stop();
      GameBridge.emit('loading:error', {
        message: msg,
        levelId: this.targetLevelId,
      });
    }
  }

  public update(_time: number, delta: number): void {
    if (this.hasError) return;

    const dt = Math.min(delta, 50) / 1000;
    const step = this.prepCompleted ? dt * 1.65 : dt * 1.25;
    if (this.displayedProgress < this.targetProgress) {
      this.displayedProgress = Math.min(
        this.targetProgress,
        this.displayedProgress + step
      );
    }

    const p = Math.max(0, Math.min(1, this.displayedProgress));
    const fillW = Math.floor(this.barWidth * p);

    if (this.fillGraphics) {
      this.fillGraphics.clear();
      if (fillW > 0) {
        this.fillGraphics.fillStyle(0x10b981, 1);
        this.fillGraphics.fillRect(this.barX, this.barY, fillW, this.barHeight);
        this.fillGraphics.fillStyle(0x6ee7b7, 1);
        this.fillGraphics.fillRect(this.barX, this.barY + 2, fillW, 4);
      }
    }

    if (this.runnerSprite) {
      const runnerX = Math.round(this.barX + this.barWidth * p);
      this.runnerSprite.x = runnerX;
      this.dustAccumMs += delta;
      if (this.dustEmitter && this.dustAccumMs >= 140) {
        this.dustAccumMs = 0;
        this.dustEmitter.explode(2, runnerX - 18, this.barY - 14);
      }
    }

    this.pctText?.setText(`${Math.round(p * 100)}%`);
    this.statusText?.setText(this.statusMessage);

    if (this.prepCompleted && !this.transitionTriggered && p >= 0.999) {
      this.transitionTriggered = true;
      this.pctText?.setText('100%');
      this.time.delayedCall(180, () => {
        if (!this.scene || !this.sys.isActive()) return;
        this.scene.start('WorldScene', { levelId: this.targetLevelId });
      });
    }
  }
}
