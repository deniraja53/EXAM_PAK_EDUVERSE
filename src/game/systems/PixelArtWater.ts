import Phaser from 'phaser';
import { GROUND_FRAMES } from '../config/assetManifest';
import { GAME_HEIGHT, WORLD_SPRITE_SCALE } from '../config/constants';
import { LevelDefinition } from '../levels/level01';

export interface WaterGapSpan {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelWaterConfig {
  /** Y coordinate of the pixel-art water surface line */
  waterSurfaceY: number;
  /** Bottom Y boundary of the water fill */
  worldBottomY: number;
  /** Horizontal tuck behind flanking ground tiles to guarantee zero 1px seams */
  edgeOverlapX: number;
  /** Base Phaser depth (must sit behind midground decor 5, ground 10, and Deni 20) */
  depth: number;
  /** Horizontal scroll speeds (px/sec) for multi-layer retro parallax shimmer */
  bodyScrollSpeed: number;
  crestScrollSpeed: number;
  glintScrollSpeed: number;
}

export const DEFAULT_PIXEL_WATER_CONFIG: PixelWaterConfig = {
  waterSurfaceY: 648,
  worldBottomY: GAME_HEIGHT,
  edgeOverlapX: 16,
  depth: 4,
  bodyScrollSpeed: 10,
  crestScrollSpeed: -22,
  glintScrollSpeed: 16,
};

const WATER_BODY_KEY = 'px_water_body';
const WATER_CREST_KEY = 'px_water_crest';
const WATER_GLINT_KEY = 'px_water_glint';

/**
 * Creates crisp power-of-two pixel-art water textures once per game session
 * using 2x2 integer pixel blocks and NEAREST filtering (zero blur or per-frame canvas allocation).
 */
export function ensurePixelWaterTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(WATER_BODY_KEY)) {
    // 64 x 128 exact POT so TileSprite wraps cleanly without WebGL POT distortion
    const tex = scene.textures.createCanvas(WATER_BODY_KEY, 64, 128);
    if (tex) {
      const ctx = tex.getContext();
      const fillBand = (y: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, y, 64, h);
      };

      // Stepped turquoise -> ocean teal -> deep abyss gradient
      fillBand(0, 10, '#0891b2');
      fillBand(10, 16, '#0e7490');
      fillBand(26, 20, '#155e75');
      fillBand(46, 20, '#164e63');
      fillBand(66, 62, '#0c363f');

      // Pixel-art dither transition rows (2x2 stepped blocks)
      ctx.fillStyle = '#0e7490';
      for (let x = 0; x < 64; x += 4) {
        ctx.fillRect(x, 8, 2, 2);
      }
      ctx.fillStyle = '#155e75';
      for (let x = 2; x < 64; x += 4) {
        ctx.fillRect(x, 24, 2, 2);
      }
      ctx.fillStyle = '#164e63';
      for (let x = 0; x < 64; x += 4) {
        ctx.fillRect(x, 44, 2, 2);
      }
      ctx.fillStyle = '#0c363f';
      for (let x = 2; x < 64; x += 4) {
        ctx.fillRect(x, 64, 2, 2);
      }

      // Subtle horizontal turquoise wave streaks & deep water pixel flecks
      const streaks: Array<[number, number, number, string]> = [
        [4, 4, 8, '#22d3ee'],
        [24, 6, 10, '#2dd4bf'],
        [48, 4, 6, '#22d3ee'],
        [10, 14, 10, '#14b8a6'],
        [36, 18, 12, '#0891b2'],
        [54, 14, 8, '#14b8a6'],
        [6, 32, 8, '#0891b2'],
        [28, 36, 10, '#0e7490'],
        [46, 30, 8, '#0e7490'],
        [14, 52, 8, '#0e7490'],
        [42, 56, 6, '#155e75'],
      ];
      for (const [sx, sy, sw, color] of streaks) {
        ctx.fillStyle = color;
        ctx.fillRect(sx, sy, sw, 2);
      }

      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists(WATER_CREST_KEY)) {
    // 64 x 16 exact POT seamlessly tiling wave crest silhouette
    const tex = scene.textures.createCanvas(WATER_CREST_KEY, 64, 16);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 64, 16);

      // Periodic 32-px pixel wave pattern repeated twice across 64px width
      const waveOffsets = [2, 2, 1, 1, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 2, 2];
      for (let i = 0; i < 32; i++) {
        const x = i * 2;
        const crestY = waveOffsets[i % waveOffsets.length] * 2;

        // Bright pixel foam cap
        ctx.fillStyle = i % 4 === 2 ? '#ecfeff' : '#cffafe';
        ctx.fillRect(x, crestY, 2, 2);

        // Light cyan crest step
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(x, crestY + 2, 2, 2);

        // Turquoise body bridge
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(x, crestY + 4, 2, 2);

        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(x, crestY + 6, 2, Math.max(2, 16 - (crestY + 6)));
      }

      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists(WATER_GLINT_KEY)) {
    // 64 x 32 exact POT pixel light sparkles
    const tex = scene.textures.createCanvas(WATER_GLINT_KEY, 64, 32);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 64, 32);

      const glints: Array<[number, number, number, string]> = [
        [4, 4, 6, '#ecfeff'],
        [20, 8, 4, '#a5f3fc'],
        [38, 4, 8, '#cffafe'],
        [54, 10, 4, '#ecfeff'],
        [12, 14, 6, '#67e8f9'],
        [30, 18, 4, '#a5f3fc'],
        [48, 16, 6, '#67e8f9'],
        [6, 24, 4, '#38bdf8'],
        [24, 26, 6, '#67e8f9'],
      ];
      for (const [gx, gy, gw, color] of glints) {
        ctx.fillStyle = color;
        ctx.fillRect(gx, gy, gw, 2);
      }

      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}

/**
 * Automatically detects all open chasms between ground segments in a level
 * so water fills every gap continuously regardless of gap width.
 */
export function detectGroundWaterGaps(
  level: LevelDefinition,
  overrides?: Partial<PixelWaterConfig>
): WaterGapSpan[] {
  const cfg = { ...DEFAULT_PIXEL_WATER_CONFIG, ...overrides };
  const frameMap = new Map(GROUND_FRAMES.map((f) => [f.name, f]));

  const bounds = level.groundSegments
    .map((seg) => {
      const spec = frameMap.get(seg.frame);
      if (!spec) return null;
      const w = spec.w * WORLD_SPRITE_SCALE;
      return {
        leftX: seg.x - w * 0.5,
        rightX: seg.x + w * 0.5,
      };
    })
    .filter((b): b is { leftX: number; rightX: number } => b !== null)
    .sort((a, b) => a.leftX - b.leftX);

  const gaps: WaterGapSpan[] = [];
  const height = Math.max(24, cfg.worldBottomY - cfg.waterSurfaceY);

  for (let i = 1; i < bounds.length; i++) {
    const prev = bounds[i - 1];
    const curr = bounds[i];
    const rawGap = curr.leftX - prev.rightX;
    if (rawGap > 4) {
      const startX = Math.floor(prev.rightX - cfg.edgeOverlapX);
      const endX = Math.ceil(curr.leftX + cfg.edgeOverlapX);
      gaps.push({
        id: `water-gap-${gaps.length + 1}`,
        x: startX,
        y: cfg.waterSurfaceY,
        width: endX - startX,
        height,
      });
    }
  }

  return gaps;
}

interface WaterSpanSprites {
  body: Phaser.GameObjects.TileSprite;
  crest: Phaser.GameObjects.TileSprite;
  glint: Phaser.GameObjects.TileSprite;
  baseY: number;
  phaseOffset: number;
}

/**
 * Renders animated pixel-art water in ground chasms as an independent environment layer.
 * Purely visual (no physics or hazard colliders) and strictly behind terrain, decor, and Deni.
 */
export class PixelArtWaterLayer {
  private readonly config: PixelWaterConfig;
  private readonly spans: WaterSpanSprites[] = [];
  private elapsedSec = 0;
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    gaps: WaterGapSpan[],
    overrides?: Partial<PixelWaterConfig>
  ) {
    this.config = { ...DEFAULT_PIXEL_WATER_CONFIG, ...overrides };
    ensurePixelWaterTextures(scene);

    gaps.forEach((gap, idx) => {
      const bodyTop = gap.y + 4;
      const bodyHeight = Math.max(16, gap.height - 4);

      const body = scene.add
        .tileSprite(gap.x, bodyTop, gap.width, bodyHeight, WATER_BODY_KEY)
        .setOrigin(0, 0)
        .setDepth(this.config.depth);

      const crest = scene.add
        .tileSprite(gap.x, gap.y - 4, gap.width, 16, WATER_CREST_KEY)
        .setOrigin(0, 0)
        .setDepth(this.config.depth + 0.1);

      const glint = scene.add
        .tileSprite(gap.x, gap.y + 10, gap.width, 32, WATER_GLINT_KEY)
        .setOrigin(0, 0)
        .setDepth(this.config.depth + 0.2);

      // Offset tile phase across gaps for organic variety while keeping contiguous spans seamless
      body.tilePositionX = idx * 17;
      crest.tilePositionX = idx * 11;
      glint.tilePositionX = idx * 23;

      this.spans.push({
        body,
        crest,
        glint,
        baseY: gap.y - 4,
        phaseOffset: idx * 0.9,
      });
    });
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getSpanCount(): number {
    return this.spans.length;
  }

  public update(deltaMs: number): void {
    if (this.paused || this.spans.length === 0) return;

    const dt = Math.min(deltaMs, 50) / 1000;
    this.elapsedSec += dt;

    for (const span of this.spans) {
      span.body.tilePositionX += this.config.bodyScrollSpeed * dt;
      span.crest.tilePositionX += this.config.crestScrollSpeed * dt;
      span.glint.tilePositionX += this.config.glintScrollSpeed * dt;

      // Crisp 2-px stepped vertical wave bob (never sub-pixel blurred)
      const bobStep = Math.round(Math.sin(this.elapsedSec * 2.4 + span.phaseOffset)) * 2;
      span.crest.y = span.baseY + bobStep;
    }
  }

  public destroy(): void {
    for (const span of this.spans) {
      span.body.destroy();
      span.crest.destroy();
      span.glint.destroy();
    }
    this.spans.length = 0;
  }
}
