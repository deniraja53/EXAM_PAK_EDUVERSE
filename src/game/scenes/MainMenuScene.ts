import Phaser from 'phaser';
import {
  ASSET_KEYS,
  ASSET_MANIFEST,
  registerDeniAnimations,
  registerManifestFrames,
  START_MENU_ASSET_KEYS,
} from '../config/assetManifest';
import { GAME_HEIGHT, GAME_WIDTH, WORLD_SPRITE_SCALE } from '../config/constants';
import { GameBridge } from '../GameBridge';
import { ensureRetroBackdropTextures } from '../systems/PixelArtBackdrop';

type DeniShowcaseState =
  | 'WALK_RIGHT'
  | 'PAUSE_RIGHT'
  | 'WALK_LEFT_TO_JUMP'
  | 'JUMP_TO_BOX'
  | 'LAND_AFTER_JUMP'
  | 'WALK_LEFT_FINISH'
  | 'PAUSE_LEFT';

const GROUND_SURFACE_Y = 626;
const SHOWCASE_MIN_X = 735;
const SHOWCASE_MAX_X = 1045;
const JUMP_TAKEOFF_X = 900;
const JUMP_LAND_X = 810;
const QBOX_X = 855;
const QBOX_BASE_Y = 478;
const JUMP_DURATION_SEC = 0.72;
const JUMP_PEAK_HEIGHT = 108;

/**
 * Live atmospheric 16-bit showcase scene behind the EXAM EDUVERSE Start Screen.
 * Features multi-layer parallax scrolling and a purely decorative, continuous
 * Deni walk -> pause -> turn -> walk -> jump-for-Question-Box -> land loop.
 */
const BCK_VIEWPORT_SCALE = GAME_WIDTH / 1920; // 2/3 exact 16:9 ratio preservation
const CLOUDS_MIN_X = 36;
const CLOUDS_MAX_X = 335; // 335 + 922*(2/3) = 950, clear of Sun (left edge ~986)
const CITY_LOOP_WIDTH = Math.round(1920 * BCK_VIEWPORT_SCALE); // 1280px seamless width
const CITY_SCROLL_SPEED_PX = 28; // Main city right-to-left px/sec
const SHADOW_SCROLL_SPEED_PX = 16; // Silhouette shadow right-to-left parallax px/sec
const CITY_BASE_Y = 678;
const SHADOW_BASE_Y = 770;

export class MainMenuScene extends Phaser.Scene {
  private bgClouds?: Phaser.GameObjects.Image;
  private bgSun?: Phaser.GameObjects.Image;
  private kotaA?: Phaser.GameObjects.Image;
  private kotaB?: Phaser.GameObjects.Image;
  private bayanganA?: Phaser.GameObjects.Image;
  private bayanganB?: Phaser.GameObjects.Image;
  private cloudsElapsedSec = 0;
  private sunElapsedSec = 0;
  private cityScrollOffset = 0;
  private shadowScrollOffset = 0;

  private deni?: Phaser.GameObjects.Sprite;
  private qbox?: Phaser.GameObjects.Image;
  private qboxIdleTween?: Phaser.Tweens.Tween;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private showcaseState: DeniShowcaseState = 'WALK_RIGHT';
  private stateTimerSec = 0;
  private jumpElapsedSec = 0;
  private qboxHitThisJump = false;

  private unsubStart?: () => void;

  private failedKeys = new Set<string>();
  private loadErrors = new Map<string, string>();

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  public preload(): void {
    this.cameras.main.setBackgroundColor('#8fd3f4');
    this.failedKeys.clear();
    this.loadErrors.clear();

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      const msg = `Missing or unreadable asset: ${file.src}`;
      this.failedKeys.add(file.key);
      this.loadErrors.set(file.key, msg);
    });

    for (const sheet of ASSET_MANIFEST) {
      if (!START_MENU_ASSET_KEYS.has(sheet.key)) continue;
      if (!this.textures.exists(sheet.key)) {
        this.load.image(sheet.key, encodeURI(sheet.path));
      }
    }
  }

  public create(): void {
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#8fd3f4');
    ensureRetroBackdropTextures(this);

    const report = registerManifestFrames(this, this.failedKeys, this.loadErrors);
    registerDeniAnimations(this);
    this.registry.set('assetReport', report);
    GameBridge.emit('assets:report', report);

    if (this.textures.exists(ASSET_KEYS.START_MENU_BG)) {
      this.textures
        .get(ASSET_KEYS.START_MENU_BG)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);

      const s = BCK_VIEWPORT_SCALE;

      // Matahari (upper-right sky, anchored at exact asset composition position)
      this.sunElapsedSec = 0;
      this.bgSun = this.add
        .image(
          Math.round((1479 + 371 / 2) * s),
          Math.round((58 + 371 / 2) * s),
          ASSET_KEYS.START_MENU_BG,
          'bck_sun'
        )
        .setOrigin(0.5, 0.5)
        .setScale(s)
        .setScrollFactor(0)
        .setDepth(0);

      // Awan (drifts slowly horizontally without leaving viewport or overlapping the sun)
      this.cloudsElapsedSec = 0;
      this.bgClouds = this.add
        .image(
          Math.round(106 * s),
          Math.round(100 * s),
          ASSET_KEYS.START_MENU_BG,
          'bck_clouds'
        )
        .setOrigin(0, 0)
        .setScale(s)
        .setScrollFactor(0)
        .setDepth(1);
    }

    // Bayangan Kota (depth 2, tepat di belakang kota.png, seamless loop kanan ke kiri)
    this.shadowScrollOffset = 0;
    if (this.textures.exists(ASSET_KEYS.START_MENU_CITY_SHADOW)) {
      this.textures
        .get(ASSET_KEYS.START_MENU_CITY_SHADOW)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);

      this.bayanganA = this.add
        .image(0, SHADOW_BASE_Y, ASSET_KEYS.START_MENU_CITY_SHADOW)
        .setOrigin(0, 1)
        .setScale(BCK_VIEWPORT_SCALE)
        .setTint(0x3b6378)
        .setAlpha(0.62)
        .setScrollFactor(0)
        .setDepth(2);

      this.bayanganB = this.add
        .image(CITY_LOOP_WIDTH, SHADOW_BASE_Y, ASSET_KEYS.START_MENU_CITY_SHADOW)
        .setOrigin(0, 1)
        .setScale(BCK_VIEWPORT_SCALE)
        .setFlipX(true)
        .setTint(0x3b6378)
        .setAlpha(0.62)
        .setScrollFactor(0)
        .setDepth(2);
    }

    // Kota Utama (depth 3, menggunakan kota.png asli dengan 2 salinan seamless kanan ke kiri)
    this.cityScrollOffset = 0;
    if (this.textures.exists(ASSET_KEYS.START_MENU_CITY)) {
      this.textures
        .get(ASSET_KEYS.START_MENU_CITY)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);

      this.kotaA = this.add
        .image(0, CITY_BASE_Y, ASSET_KEYS.START_MENU_CITY)
        .setOrigin(0, 1)
        .setScale(BCK_VIEWPORT_SCALE)
        .setScrollFactor(0)
        .setDepth(3);

      this.kotaB = this.add
        .image(CITY_LOOP_WIDTH, CITY_BASE_Y, ASSET_KEYS.START_MENU_CITY)
        .setOrigin(0, 1)
        .setScale(BCK_VIEWPORT_SCALE)
        .setScrollFactor(0)
        .setDepth(3);
    }

    // Scenic grassy ground foreground across full viewport width
    if (this.textures.exists(ASSET_KEYS.GROUND_TILESET)) {
      const groundXs = [102, 306, 510, 714, 918, 1122, 1280];
      groundXs.forEach((gx) => {
        this.add
          .image(gx, GAME_HEIGHT, ASSET_KEYS.GROUND_TILESET, 'ground_wide')
          .setScale(WORLD_SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(10);
      });
    }

    // Floating platforms framing the right-hand showcase stage cleanly without blocking Deni's jump
    if (this.textures.exists(ASSET_KEYS.FLOATING_PLATFORMS)) {
      const leftIsland = this.add
        .image(670, 390, ASSET_KEYS.FLOATING_PLATFORMS, 'island_roots_sm')
        .setScale(WORLD_SPRITE_SCALE)
        .setOrigin(0.5, 0.5)
        .setDepth(12);

      const rightIsland = this.add
        .image(1115, 425, ASSET_KEYS.FLOATING_PLATFORMS, 'plat_grass_md')
        .setScale(WORLD_SPRITE_SCALE)
        .setOrigin(0.5, 0.5)
        .setDepth(12);

      this.tweens.add({
        targets: leftIsland,
        y: 382,
        duration: 2100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.tweens.add({
        targets: rightIsland,
        y: 417,
        duration: 2400,
        delay: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Terrain & island pixel-art decorations
    if (this.textures.exists(ASSET_KEYS.NATURE_DECOR)) {
      const props: Array<[string, number, number, number]> = [
        ['fern_tall', 92, GROUND_SURFACE_Y, 11],
        ['flower_patch', 205, GROUND_SURFACE_Y, 11],
        ['bush_md', 560, GROUND_SURFACE_Y, 9],
        ['bush_flowers', 675, GROUND_SURFACE_Y, 11],
        ['flower_yellow', 960, GROUND_SURFACE_Y, 11],
        ['mushroom_cluster', 1125, GROUND_SURFACE_Y, 12],
        ['grass_tuft_lg', 1210, GROUND_SURFACE_Y, 11],
      ];
      props.forEach(([frame, x, y, depth]) => {
        this.add
          .image(x, y, ASSET_KEYS.NATURE_DECOR, frame)
          .setScale(WORLD_SPRITE_SCALE)
          .setOrigin(0.5, 1)
          .setDepth(depth);
      });
    }

    if (this.textures.exists(ASSET_KEYS.ROCK_DECOR)) {
      this.add
        .image(1080, GROUND_SURFACE_Y, ASSET_KEYS.ROCK_DECOR, 'megalith_spiral_ruin')
        .setScale(WORLD_SPRITE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(9);
      this.add
        .image(1185, GROUND_SURFACE_Y, ASSET_KEYS.ROCK_DECOR, 'crystal_cluster')
        .setScale(WORLD_SPRITE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(12);
    }

    // Dust / sparkle emitter for landing & Question Box hit feedback
    if (this.textures.exists('px_dust')) {
      this.dustEmitter = this.add.particles(0, 0, 'px_dust', {
        speed: { min: 30, max: 95 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 200, max: 360 },
        scale: { start: 1.6, end: 0.4 },
        alpha: { start: 0.95, end: 0 },
        emitting: false,
      });
      this.dustEmitter.setDepth(23);
    }

    // Question Box floating above Deni's showcase runway
    if (this.textures.exists(ASSET_KEYS.QUESTION_BOX)) {
      this.qbox = this.add
        .image(QBOX_X, QBOX_BASE_Y, ASSET_KEYS.QUESTION_BOX, 'qbox_idle')
        .setScale(0.28)
        .setOrigin(0.5, 1)
        .setDepth(18);

      this.qboxIdleTween = this.tweens.add({
        targets: this.qbox,
        y: QBOX_BASE_Y - 6,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Automated decorative Deni showcase sprite (non-interactive)
    if (this.textures.exists(ASSET_KEYS.DENI)) {
      this.deni = this.add
        .sprite(760, GROUND_SURFACE_Y, ASSET_KEYS.DENI, 'walk_0')
        .setScale(WORLD_SPRITE_SCALE)
        .setOrigin(0.5, 1)
        .setFlipX(false)
        .setDepth(20);

      this.showcaseState = 'WALK_RIGHT';
      this.stateTimerSec = 0;
      this.jumpElapsedSec = 0;
      this.qboxHitThisJump = false;
      this.playDeniAnim('deni-walk');
    }

    // Listen for Play navigation -> transition to dedicated PreloadScene loading stage
    this.unsubStart?.();
    this.unsubStart = GameBridge.on('game:start-level', ({ levelId }) => {
      this.scene.start('PreloadScene', { levelId });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubStart?.();
      this.unsubStart = undefined;
      this.qboxIdleTween?.stop();
    });

    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cachedReport = this.registry.get('assetReport');
    if (Array.isArray(cachedReport)) {
      GameBridge.emit('assets:report', cachedReport);
    }
    GameBridge.emit('game:ready', { scene: 'MainMenuScene' });
  }

  private playDeniAnim(key: string): void {
    if (!this.deni || !this.anims.exists(key)) return;
    if (this.deni.anims.currentAnim?.key === key && this.deni.anims.isPlaying) {
      return;
    }
    this.deni.play(key, true);
  }

  private triggerQuestionBoxBounce(): void {
    if (!this.qbox || !this.qbox.scene) return;
    this.qboxIdleTween?.pause();
    this.qbox.setY(QBOX_BASE_Y);
    this.qbox.setFrame('qbox_active');

    if (this.dustEmitter) {
      this.dustEmitter.explode(10, QBOX_X, QBOX_BASE_Y - 18);
    }

    this.tweens.add({
      targets: this.qbox,
      y: QBOX_BASE_Y - 15,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.qbox || !this.qbox.scene) return;
        this.qbox.setY(QBOX_BASE_Y);
        this.qbox.setFrame('qbox_idle');
        this.qboxIdleTween?.resume();
      },
    });
  }

  private updateDeniShowcase(dt: number): void {
    const deni = this.deni;
    if (!deni) return;

    switch (this.showcaseState) {
      case 'WALK_RIGHT': {
        deni.setFlipX(false);
        this.playDeniAnim('deni-walk');
        deni.x += 150 * dt;
        if (deni.x >= SHOWCASE_MAX_X) {
          deni.x = SHOWCASE_MAX_X;
          this.showcaseState = 'PAUSE_RIGHT';
          this.stateTimerSec = 0.75;
          this.playDeniAnim('deni-idle');
        }
        break;
      }

      case 'PAUSE_RIGHT': {
        this.playDeniAnim('deni-idle');
        this.stateTimerSec -= dt;
        if (this.stateTimerSec <= 0) {
          deni.setFlipX(true);
          this.showcaseState = 'WALK_LEFT_TO_JUMP';
          this.playDeniAnim('deni-walk');
        }
        break;
      }

      case 'WALK_LEFT_TO_JUMP': {
        deni.setFlipX(true);
        this.playDeniAnim('deni-walk');
        deni.x -= 150 * dt;
        if (deni.x <= JUMP_TAKEOFF_X) {
          deni.x = JUMP_TAKEOFF_X;
          this.showcaseState = 'JUMP_TO_BOX';
          this.jumpElapsedSec = 0;
          this.qboxHitThisJump = false;
          this.playDeniAnim('deni-jump');
        }
        break;
      }

      case 'JUMP_TO_BOX': {
        this.jumpElapsedSec += dt;
        const u = Math.min(1, this.jumpElapsedSec / JUMP_DURATION_SEC);
        deni.x = Phaser.Math.Linear(JUMP_TAKEOFF_X, JUMP_LAND_X, u);
        deni.y = GROUND_SURFACE_Y - 4 * JUMP_PEAK_HEIGHT * u * (1 - u);

        if (u >= 0.45 && !this.qboxHitThisJump) {
          this.qboxHitThisJump = true;
          this.triggerQuestionBoxBounce();
        }

        if (u >= 0.52) {
          this.playDeniAnim('deni-fall');
        }

        if (u >= 1) {
          deni.x = JUMP_LAND_X;
          deni.y = GROUND_SURFACE_Y;
          this.showcaseState = 'LAND_AFTER_JUMP';
          this.stateTimerSec = 0.22;
          this.playDeniAnim('deni-land');
          if (this.dustEmitter) {
            this.dustEmitter.explode(6, deni.x, GROUND_SURFACE_Y - 2);
          }
        }
        break;
      }

      case 'LAND_AFTER_JUMP': {
        this.stateTimerSec -= dt;
        if (this.stateTimerSec <= 0) {
          this.showcaseState = 'WALK_LEFT_FINISH';
          this.playDeniAnim('deni-walk');
        }
        break;
      }

      case 'WALK_LEFT_FINISH': {
        deni.setFlipX(true);
        this.playDeniAnim('deni-walk');
        deni.x -= 140 * dt;
        if (deni.x <= SHOWCASE_MIN_X) {
          deni.x = SHOWCASE_MIN_X;
          this.showcaseState = 'PAUSE_LEFT';
          this.stateTimerSec = 0.7;
          this.playDeniAnim('deni-idle');
        }
        break;
      }

      case 'PAUSE_LEFT': {
        this.playDeniAnim('deni-idle');
        this.stateTimerSec -= dt;
        if (this.stateTimerSec <= 0) {
          deni.setFlipX(false);
          this.showcaseState = 'WALK_RIGHT';
          this.playDeniAnim('deni-walk');
        }
        break;
      }
    }
  }

  public update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;

    // Awan & Matahari dipertahankan tetap sama
    if (this.bgClouds) {
      this.cloudsElapsedSec += dt;
      const t = (1 - Math.cos(this.cloudsElapsedSec * 0.14)) * 0.5;
      this.bgClouds.x = Phaser.Math.Linear(CLOUDS_MIN_X, CLOUDS_MAX_X, t);
    }
    this.sunElapsedSec += dt;
    if (this.bgSun) {
      const pulse = BCK_VIEWPORT_SCALE * (1 + Math.sin(this.sunElapsedSec * 1.1) * 0.015);
      this.bgSun.setScale(pulse);
    }

    // Seamless looping Bayangan Kota (kanan ke kiri dengan parallax halus)
    if (this.bayanganA && this.bayanganB) {
      const w = CITY_LOOP_WIDTH;
      const period = w * 2;
      this.shadowScrollOffset = (this.shadowScrollOffset + SHADOW_SCROLL_SPEED_PX * dt) % period;
      if (this.shadowScrollOffset < w) {
        const xA = Math.round(-this.shadowScrollOffset);
        this.bayanganA.x = xA;
        this.bayanganB.x = xA + w;
      } else {
        const xB = Math.round(-(this.shadowScrollOffset - w));
        this.bayanganB.x = xB;
        this.bayanganA.x = xB + w;
      }
    }

    // Seamless looping Kota Utama kota.png (2 salinan identik bergerak kanan ke kiri tanpa jeda/celah)
    if (this.kotaA && this.kotaB) {
      const w = CITY_LOOP_WIDTH;
      this.cityScrollOffset = (this.cityScrollOffset + CITY_SCROLL_SPEED_PX * dt) % w;
      const leadX = Math.round(-this.cityScrollOffset);
      this.kotaA.x = leadX;
      this.kotaB.x = leadX + w;
    }

    // Automated decorative character loop
    this.updateDeniShowcase(dt);
  }
}
