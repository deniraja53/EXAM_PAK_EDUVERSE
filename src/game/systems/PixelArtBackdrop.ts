import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assetManifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';

/**
 * Generates crisp pixel-stepped background textures (sky, clouds, hills, collectibles, dust)
 * using nearest-neighbor integer-pixel drawing so background atmosphere matches the 16-bit sprites.
 */
export function ensureRetroBackdropTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('px_sky_meadow')) {
    const tex = scene.textures.createCanvas('px_sky_meadow', 320, 180);
    if (tex) {
      const ctx = tex.getContext();
      // 4-band classic 16-bit stepped sky gradient
      const bands = [
        { y: 0, h: 48, color: '#2b6cb0' },
        { y: 48, h: 44, color: '#4299e1' },
        { y: 92, h: 46, color: '#63b3ed' },
        { y: 138, h: 42, color: '#90cdf4' },
      ];
      bands.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.fillRect(0, b.y, 320, b.h);
      });
      // Crisp pixel sun
      ctx.fillStyle = '#fefcbf';
      ctx.fillRect(256, 22, 22, 22);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(258, 24, 18, 18);
      // Pixel clouds
      const drawCloud = (cx: number, cy: number, w: number) => {
        ctx.fillStyle = '#e2f1ff';
        ctx.fillRect(cx, cy + 4, w, 8);
        ctx.fillRect(cx + 6, cy, w - 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 4, cy + 2, w - 8, 6);
      };
      drawCloud(28, 32, 42);
      drawCloud(118, 20, 54);
      drawCloud(196, 46, 36);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_clouds_drift')) {
    const tex = scene.textures.createCanvas('px_clouds_drift', 320, 72);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 320, 72);
      const drawDriftCloud = (cx: number, cy: number, w: number) => {
        ctx.fillStyle = 'rgba(226, 241, 255, 0.85)';
        ctx.fillRect(cx, cy + 5, w, 9);
        ctx.fillRect(cx + 6, cy + 1, w - 12, 13);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(cx + 4, cy + 3, w - 8, 6);
        ctx.fillRect(cx + 10, cy, w - 20, 4);
      };
      drawDriftCloud(14, 14, 46);
      drawDriftCloud(102, 32, 38);
      drawDriftCloud(186, 10, 56);
      drawDriftCloud(266, 28, 40);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_hills_far')) {
    const tex = scene.textures.createCanvas('px_hills_far', 320, 90);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 320, 90);
      ctx.fillStyle = '#3b7a9e';
      for (let x = 0; x < 320; x += 2) {
        const h = Math.floor(24 + Math.sin(x * 0.04) * 14 + Math.cos(x * 0.09) * 8);
        ctx.fillRect(x, 90 - h, 2, h);
      }
      ctx.fillStyle = '#2d6a87';
      for (let x = 0; x < 320; x += 2) {
        const h = Math.floor(16 + Math.cos(x * 0.05 + 1.2) * 10);
        ctx.fillRect(x, 90 - h, 2, h);
      }
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_forest_silhouette')) {
    const tex = scene.textures.createCanvas('px_forest_silhouette', 320, 84);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 320, 84);
      // Stepped pixel-art distant pine & canopy silhouettes
      for (let x = 0; x < 320; x += 16) {
        const treeH = 28 + ((x * 7) % 26);
        const topY = 84 - treeH;
        ctx.fillStyle = '#1e4d4f';
        ctx.fillRect(x + 6, topY, 4, 6);
        ctx.fillRect(x + 4, topY + 6, 8, 8);
        ctx.fillRect(x + 2, topY + 14, 12, 10);
        ctx.fillRect(x, topY + 24, 16, treeH - 24);
      }
      ctx.fillStyle = '#173e42';
      ctx.fillRect(0, 68, 320, 16);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_hills_near')) {
    const tex = scene.textures.createCanvas('px_hills_near', 320, 72);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 320, 72);
      ctx.fillStyle = '#276749';
      for (let x = 0; x < 320; x += 2) {
        const h = Math.floor(22 + Math.sin(x * 0.065 + 0.5) * 12);
        ctx.fillRect(x, 72 - h, 2, h);
      }
      ctx.fillStyle = '#2f855a';
      for (let x = 0; x < 320; x += 2) {
        const h = Math.floor(14 + Math.sin(x * 0.065 + 0.5) * 10);
        ctx.fillRect(x, 72 - h, 2, h);
      }
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_sky_twilight')) {
    const tex = scene.textures.createCanvas('px_sky_twilight', 320, 180);
    if (tex) {
      const ctx = tex.getContext();
      // Matches public/background/background2.gif outer canopy & horizon palette (#0c151c -> #0c363f)
      const bands = [
        { y: 0, h: 46, color: '#0c151c' },
        { y: 46, h: 46, color: '#0f1013' },
        { y: 92, h: 44, color: '#13262e' },
        { y: 136, h: 44, color: '#0c363f' },
      ];
      bands.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.fillRect(0, b.y, 320, b.h);
      });
      // Subtle pixel dither rows between twilight bands
      ctx.fillStyle = '#0f1013';
      for (let x = 0; x < 320; x += 4) ctx.fillRect(x, 45, 2, 1);
      ctx.fillStyle = '#13262e';
      for (let x = 2; x < 320; x += 4) ctx.fillRect(x, 91, 2, 1);
      ctx.fillStyle = '#0c363f';
      for (let x = 0; x < 320; x += 4) ctx.fillRect(x, 135, 2, 1);

      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_sky_savanna')) {
    const tex = scene.textures.createCanvas('px_sky_savanna', 320, 180);
    if (tex) {
      const ctx = tex.getContext();
      // Warm Savanna Sunland 5-band stepped daytime-amber sky
      const bands = [
        { y: 0, h: 36, color: '#3888b8' },
        { y: 36, h: 36, color: '#56a6cf' },
        { y: 72, h: 36, color: '#8ac9d9' },
        { y: 108, h: 36, color: '#f3d28a' },
        { y: 144, h: 36, color: '#f5b963' },
      ];
      bands.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.fillRect(0, b.y, 320, b.h);
      });
      // Pixel dither seams between sky bands
      ctx.fillStyle = '#56a6cf';
      for (let x = 0; x < 320; x += 4) ctx.fillRect(x, 35, 2, 1);
      ctx.fillStyle = '#8ac9d9';
      for (let x = 2; x < 320; x += 4) ctx.fillRect(x, 71, 2, 1);
      ctx.fillStyle = '#f3d28a';
      for (let x = 0; x < 320; x += 4) ctx.fillRect(x, 107, 2, 1);
      ctx.fillStyle = '#f5b963';
      for (let x = 2; x < 320; x += 4) ctx.fillRect(x, 143, 2, 1);

      // Large golden Savanna Sun with soft halo ring
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(236, 28, 36, 36);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(240, 24, 28, 44);
      ctx.fillRect(232, 32, 44, 28);
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(244, 34, 20, 20);

      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_clouds_savanna')) {
    const tex = scene.textures.createCanvas('px_clouds_savanna', 320, 64);
    if (tex) {
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, 320, 64);
      const drawWarmCloud = (cx: number, cy: number, w: number) => {
        ctx.fillStyle = 'rgba(253, 230, 180, 0.85)';
        ctx.fillRect(cx, cy + 6, w, 7);
        ctx.fillStyle = 'rgba(255, 248, 230, 0.94)';
        ctx.fillRect(cx + 4, cy + 2, w - 8, 8);
        ctx.fillRect(cx + 10, cy, w - 20, 4);
      };
      drawWarmCloud(18, 12, 48);
      drawWarmCloud(112, 26, 40);
      drawWarmCloud(194, 10, 58);
      drawWarmCloud(274, 30, 36);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  // Landscape silhouettes for Stage 2 Savanna are provided by bck-savana_c2b55a5c.png (ASSET_KEYS.STAGE2_BG)

  if (!scene.textures.exists('px_gem')) {
    const tex = scene.textures.createCanvas('px_gem', 16, 16);
    if (tex) {
      const ctx = tex.getContext();
      // 16x16 pixel-art Knowledge Gem (gold/amber outline + bright core)
      const px = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };
      px(6, 1, 4, 1, '#1e293b');
      px(4, 2, 2, 1, '#1e293b');
      px(10, 2, 2, 1, '#1e293b');
      px(3, 3, 1, 2, '#1e293b');
      px(12, 3, 1, 2, '#1e293b');
      px(2, 5, 1, 6, '#1e293b');
      px(13, 5, 1, 6, '#1e293b');
      px(3, 11, 1, 2, '#1e293b');
      px(12, 11, 1, 2, '#1e293b');
      px(4, 13, 2, 1, '#1e293b');
      px(10, 13, 2, 1, '#1e293b');
      px(6, 14, 4, 1, '#1e293b');

      px(6, 2, 4, 12, '#f59e0b');
      px(4, 3, 8, 10, '#f59e0b');
      px(3, 5, 10, 6, '#fbbf24');
      px(5, 4, 6, 8, '#fde047');
      px(5, 4, 2, 4, '#ffffff');
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (!scene.textures.exists('px_dust')) {
    const tex = scene.textures.createCanvas('px_dust', 4, 4);
    if (tex) {
      const ctx = tex.getContext();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 4, 4);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}

export function addParallaxBackdrop(
  scene: Phaser.Scene,
  options?: { skyTheme?: 'meadow' | 'twilight' }
): {
  sky: Phaser.GameObjects.TileSprite;
  hillsFar: Phaser.GameObjects.TileSprite;
  forestSilhouette: Phaser.GameObjects.TileSprite;
  hillsNear: Phaser.GameObjects.TileSprite;
} {
  ensureRetroBackdropTextures(scene);

  const skyKey =
    options?.skyTheme === 'twilight' ? 'px_sky_twilight' : 'px_sky_meadow';

  const sky = scene.add
    .tileSprite(0, 0, GAME_WIDTH / 4, GAME_HEIGHT / 4, skyKey)
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(-1);

  const hillsFar = scene.add
    .tileSprite(0, GAME_HEIGHT - 360, GAME_WIDTH / 4, 90, 'px_hills_far')
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(1);

  const forestSilhouette = scene.add
    .tileSprite(0, GAME_HEIGHT - 336, GAME_WIDTH / 4, 84, 'px_forest_silhouette')
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(2);

  const hillsNear = scene.add
    .tileSprite(0, GAME_HEIGHT - 288, GAME_WIDTH / 4, 72, 'px_hills_near')
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(3);

  return { sky, hillsFar, forestSilhouette, hillsNear };
}

export interface SavannaBackdropLayers {
  sky: Phaser.GameObjects.TileSprite;
  clouds: Phaser.GameObjects.TileSprite;
  landscape?: Phaser.GameObjects.TileSprite;
}

export function addSavannaParallaxBackdrop(scene: Phaser.Scene): SavannaBackdropLayers {
  ensureRetroBackdropTextures(scene);

  const sky = scene.add
    .tileSprite(0, 0, GAME_WIDTH / 4, GAME_HEIGHT / 4, 'px_sky_savanna')
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(-1);

  const clouds = scene.add
    .tileSprite(0, 38, GAME_WIDTH / 4, 64, 'px_clouds_savanna')
    .setOrigin(0, 0)
    .setScale(4)
    .setScrollFactor(0)
    .setDepth(0);

  let landscape: Phaser.GameObjects.TileSprite | undefined;
  if (scene.textures.exists(ASSET_KEYS.STAGE2_BG)) {
    const tex = scene.textures.get(ASSET_KEYS.STAGE2_BG);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const natW = src?.width || 1920;
    const natH = src?.height || 1080;
    const exactRatioScale = GAME_WIDTH / natW; // 1280 / 1920 = 2/3, exact 16:9 without distortion or crop
    // Painted grass edge sits at row 997/1080 (bottom 82px are transparent), so y = 55 places grass flush on bottom edge (720px)
    const visibleBottomOffsetY = GAME_HEIGHT - Math.round(997 * exactRatioScale);

    landscape = scene.add
      .tileSprite(0, visibleBottomOffsetY, natW, natH, ASSET_KEYS.STAGE2_BG)
      .setOrigin(0, 0)
      .setScale(exactRatioScale)
      .setScrollFactor(0)
      .setDepth(1);
  }

  return { sky, clouds, landscape };
}
