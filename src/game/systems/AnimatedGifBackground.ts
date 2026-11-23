import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';

export interface AnimatedBackgroundConfig {
  /** Browser-accessible public URL for the animated GIF */
  assetUrl: string;
  /** Shared Phaser CanvasTexture key */
  textureKey: string;
  /** Depth order (0 sits behind distant hills 1..3 and water 4) */
  depth: number;
  /** 'contain' preserves the full GIF composition without cropping; 'cover' fills edge-to-edge */
  fitMode: 'contain' | 'cover';
  /** Uniform scale multiplier; null auto-computes based on fitMode */
  scale: number | null;
  /** Base horizontal screen position (px); null auto-centers horizontally */
  positionX: number | null;
  /** Vertical screen position (px); null auto-aligns vertically */
  verticalPosition: number | null;
  /** Clamped horizontal parallax travel factor relative to camera scrollX */
  horizontalParallaxFactor: number;
  /** Vertical parallax factor relative to camera scrollY */
  verticalParallaxFactor: number;
  /** Animation playback refresh speed multiplier (1.0 = native GIF cadence) */
  animationSpeed: number;
}

export interface ContainBackgroundLayout {
  imageWidth: number;
  imageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  renderWidth: number;
  renderHeight: number;
  x: number;
  y: number;
}

/**
 * Pure CONTAIN background layout math:
 * - Preserves original GIF aspect ratio without stretching or cropping
 * - Ensures renderWidth <= viewportWidth and renderHeight <= viewportHeight
 * - Centers the image inside the viewport
 */
export function computeContainBackgroundLayout(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number
): ContainBackgroundLayout {
  const safeImgW = Math.max(1, imageWidth);
  const safeImgH = Math.max(1, imageHeight);
  const safeViewW = Math.max(1, viewportWidth);
  const safeViewH = Math.max(1, viewportHeight);

  const scale = Math.min(safeViewW / safeImgW, safeViewH / safeImgH);
  const renderWidth = safeImgW * scale;
  const renderHeight = safeImgH * scale;
  const x = (safeViewW - renderWidth) / 2;
  const y = (safeViewH - renderHeight) / 2;

  return {
    imageWidth: safeImgW,
    imageHeight: safeImgH,
    viewportWidth: safeViewW,
    viewportHeight: safeViewH,
    scale,
    renderWidth,
    renderHeight,
    x,
    y,
  };
}

export const EMERALD_MEADOW_GIF_BG_CONFIG: AnimatedBackgroundConfig = {
  assetUrl: '/background/background2.gif',
  textureKey: 'bg_animated_meadow_gif',
  depth: 0,
  fitMode: 'contain',
  scale: null,
  positionX: null,
  verticalPosition: null,
  horizontalParallaxFactor: 0.006,
  verticalParallaxFactor: 0,
  animationSpeed: 1.0,
};

interface SharedGifCache {
  url: string;
  img: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
  activeMounts: number;
  listeners: Set<() => void>;
}

let sharedCache: SharedGifCache | null = null;

function getOrCreateSharedGif(assetUrl: string): SharedGifCache {
  if (sharedCache && sharedCache.url === assetUrl) {
    return sharedCache;
  }

  if (sharedCache?.img.parentNode) {
    sharedCache.img.parentNode.removeChild(sharedCache.img);
  }

  const img = new Image();
  img.decoding = 'async';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.style.position = 'fixed';
  img.style.left = '0px';
  img.style.top = '0px';
  img.style.width = '1px';
  img.style.height = '1px';
  img.style.opacity = '0.001';
  img.style.pointerEvents = 'none';
  img.style.zIndex = '-1';

  const entry: SharedGifCache = {
    url: assetUrl,
    img,
    loaded: false,
    failed: false,
    activeMounts: 0,
    listeners: new Set(),
  };

  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      entry.loaded = true;
      entry.failed = false;
    } else {
      entry.failed = true;
    }
    entry.listeners.forEach((cb) => cb());
    entry.listeners.clear();
  };

  img.onerror = () => {
    entry.failed = true;
    entry.loaded = false;
    console.warn(`[AnimatedGifBackground] Failed to load animated GIF: ${assetUrl}`);
    entry.listeners.forEach((cb) => cb());
    entry.listeners.clear();
  };

  img.src = assetUrl;
  sharedCache = entry;
  return entry;
}

/**
 * Starts loading and decoding the background GIF early without blocking Phaser's loader.
 */
export function preloadAnimatedBackgroundGif(
  assetUrl: string = EMERALD_MEADOW_GIF_BG_CONFIG.assetUrl
): void {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return;
  getOrCreateSharedGif(assetUrl);
}

/**
 * Downloads and decodes the background GIF with real fetch progress reporting.
 * Resolves only when naturalWidth > 0, and rejects with an informative message on failure.
 */
export async function preloadAnimatedBackgroundGifAsync(
  assetUrl: string = EMERALD_MEADOW_GIF_BG_CONFIG.assetUrl,
  onProgress?: (ratio: number) => void
): Promise<void> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return;

  if (sharedCache && sharedCache.url === assetUrl && sharedCache.loaded) {
    onProgress?.(1);
    return;
  }

  // If a prior attempt failed, clear cache so retry fetches fresh
  if (sharedCache && sharedCache.url === assetUrl && sharedCache.failed) {
    if (sharedCache.img.parentNode) {
      sharedCache.img.parentNode.removeChild(sharedCache.img);
    }
    sharedCache = null;
  }

  onProgress?.(0.05);
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Gagal memuat background level (${assetUrl}: HTTP ${response.status}).`);
  }

  const totalBytes = Number(response.headers.get('content-length') ?? 0);
  if (response.body && totalBytes > 0) {
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        onProgress?.(Math.min(0.85, (received / totalBytes) * 0.85));
      }
    }
  } else {
    await response.arrayBuffer();
    onProgress?.(0.8);
  }

  const entry = getOrCreateSharedGif(assetUrl);
  if (entry.loaded) {
    onProgress?.(1);
    return;
  }
  if (entry.failed) {
    throw new Error(`Gagal mendekode gambar latar ${assetUrl}.`);
  }

  await new Promise<void>((resolve, reject) => {
    entry.listeners.add(() => {
      if (entry.loaded) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`Gagal memuat background level (${assetUrl}).`));
      }
    });
  });
}

/**
 * Renders an animated GIF via a reused HTMLImageElement into a single shared Phaser CanvasTexture.
 * Strictly enforces aspect-preserving CONTAIN scaling and viewport-clamped parallax so 100% of
 * every GIF frame remains visible inside the game viewport without cropping or stretching.
 */
export class AnimatedGifBackground {
  private readonly scene: Phaser.Scene;
  private readonly config: AnimatedBackgroundConfig;
  private readonly cache: SharedGifCache;
  private readonly onFirstFrame?: () => void;

  private canvasTexture: Phaser.Textures.CanvasTexture | null = null;
  private bgFill: Phaser.GameObjects.Rectangle | null = null;
  private bgSprite: Phaser.GameObjects.Image | null = null;

  private gifWidth = 0;
  private gifHeight = 0;
  private viewportWidth = GAME_WIDTH;
  private viewportHeight = GAME_HEIGHT;
  private resolvedScale = 1;
  private resolvedWidth = GAME_WIDTH;
  private resolvedHeight = GAME_HEIGHT;
  private resolvedBaseX = 0;
  private resolvedBaseY = 0;
  private currentX = 0;
  private currentY = 0;

  private paused = false;
  private destroyed = false;
  private hasDrawnFirstFrame = false;
  private sampleAccumulatorMs = 0;
  private lastCamX = Number.NaN;
  private lastCamY = Number.NaN;
  private lastLoggedLayoutSig = '';

  private pendingReadyListener: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    overrides?: Partial<AnimatedBackgroundConfig>,
    onFirstFrame?: () => void
  ) {
    this.scene = scene;
    this.config = { ...EMERALD_MEADOW_GIF_BG_CONFIG, ...overrides };
    this.onFirstFrame = onFirstFrame;
    this.cache = getOrCreateSharedGif(this.config.assetUrl);
    this.mountDomProbe();

    this.scene.scale?.on?.(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);

    if (this.cache.loaded) {
      this.initializeSprites();
    } else if (!this.cache.failed) {
      this.pendingReadyListener = () => {
        if (!this.destroyed && this.cache.loaded) {
          this.initializeSprites();
        }
      };
      this.cache.listeners.add(this.pendingReadyListener);
    }
  }

  private handleScaleResize(gameSize: Phaser.Structs.Size): void {
    if (this.destroyed) return;
    this.resizeBackground(gameSize?.width, gameSize?.height);
  }

  private mountDomProbe(): void {
    this.cache.activeMounts += 1;
    if (typeof document !== 'undefined' && document.body && !this.cache.img.parentNode) {
      // Attaching inside the viewport at 0.001 opacity keeps Chromium's animated GIF timer active
      document.body.appendChild(this.cache.img);
    }
  }

  private initializeSprites(): void {
    if (this.destroyed || !this.cache.loaded || this.bgSprite) return;

    const w = this.cache.img.naturalWidth;
    const h = this.cache.img.naturalHeight;
    if (w <= 0 || h <= 0) return;

    this.gifWidth = w;
    this.gifHeight = h;

    const key = this.config.textureKey;
    if (this.scene.textures.exists(key)) {
      const existing = this.scene.textures.get(key) as Phaser.Textures.CanvasTexture;
      if (existing.width === w && existing.height === h) {
        this.canvasTexture = existing;
      } else {
        this.scene.textures.remove(key);
        this.canvasTexture = this.scene.textures.createCanvas(key, w, h);
      }
    } else {
      this.canvasTexture = this.scene.textures.createCanvas(key, w, h);
    }

    if (!this.canvasTexture) return;
    this.canvasTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.drawCurrentGifFrame();

    // Solid fallback fill behind both px_sky_twilight (-1) and GIF (0) so any viewport aspect is covered
    this.bgFill = this.scene.add
      .rectangle(0, 0, this.viewportWidth, this.viewportHeight, 0x0c151c, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.config.depth - 2);

    this.bgSprite = this.scene.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.config.depth);

    this.resizeBackground();
  }

  /**
   * Centralized responsive background layout calculation.
   * Recomputes CONTAIN scale, centered origin, backdrop fill size, and camera-clamped position.
   */
  public resizeBackground(viewportWidth?: number, viewportHeight?: number): void {
    const viewW = Math.max(
      1,
      viewportWidth ?? this.scene.scale?.width ?? this.scene.cameras?.main?.width ?? GAME_WIDTH
    );
    const viewH = Math.max(
      1,
      viewportHeight ?? this.scene.scale?.height ?? this.scene.cameras?.main?.height ?? GAME_HEIGHT
    );

    this.viewportWidth = viewW;
    this.viewportHeight = viewH;

    if (this.bgFill) {
      this.bgFill.setPosition(0, 0);
      this.bgFill.setSize(viewW, viewH);
    }

    if (!this.bgSprite || this.gifWidth <= 0 || this.gifHeight <= 0) return;

    const layout = computeContainBackgroundLayout(
      this.gifWidth,
      this.gifHeight,
      viewW,
      viewH
    );

    // Strictly cap scale to CONTAIN so the GIF never exceeds the viewport when fitMode === 'contain'
    const requestedScale =
      this.config.scale !== null
        ? this.config.fitMode === 'contain'
          ? Math.min(this.config.scale, layout.scale)
          : this.config.scale
        : layout.scale;

    this.resolvedScale = requestedScale;
    this.resolvedWidth = this.gifWidth * this.resolvedScale;
    this.resolvedHeight = this.gifHeight * this.resolvedScale;

    const maxX = Math.max(0, Math.floor(viewW - this.resolvedWidth));
    const maxY = Math.max(0, Math.floor(viewH - this.resolvedHeight));

    const defaultX = (viewW - this.resolvedWidth) / 2;
    const defaultY = (viewH - this.resolvedHeight) / 2;

    this.resolvedBaseX = Phaser.Math.Clamp(
      this.config.positionX ?? defaultX,
      0,
      maxX
    );
    this.resolvedBaseY = Phaser.Math.Clamp(
      this.config.verticalPosition ?? defaultY,
      0,
      maxY
    );

    this.bgSprite.setScale(this.resolvedScale);
    this.syncCamera(
      this.scene.cameras?.main?.scrollX ?? 0,
      this.scene.cameras?.main?.scrollY ?? 0
    );

    const metrics = this.getLayoutMetrics();
    const sig = `${metrics.originalWidth}x${metrics.originalHeight}|${metrics.viewportWidth}x${metrics.viewportHeight}|${metrics.scale.toFixed(6)}`;
    if (sig !== this.lastLoggedLayoutSig) {
      this.lastLoggedLayoutSig = sig;
      const camW = this.scene.cameras?.main?.width ?? metrics.viewportWidth;
      const camH = this.scene.cameras?.main?.height ?? metrics.viewportHeight;
      console.info(
        `[AnimatedGifBackground] original=${metrics.originalWidth}x${metrics.originalHeight}, canvas=${metrics.viewportWidth}x${metrics.viewportHeight}, display=${metrics.renderedWidth.toFixed(2)}x${metrics.renderedHeight.toFixed(2)}, scale=${metrics.scale.toFixed(6)}, cameraViewport=${camW}x${camH}, pos=(${metrics.x}, ${metrics.y}), withinViewport=${metrics.withinViewport}`
      );
    }
  }

  private drawCurrentGifFrame(): void {
    if (!this.canvasTexture || !this.cache.loaded) return;
    const ctx = this.canvasTexture.getContext();
    ctx.clearRect(0, 0, this.gifWidth, this.gifHeight);
    ctx.drawImage(this.cache.img, 0, 0, this.gifWidth, this.gifHeight);
    this.canvasTexture.refresh();

    if (!this.hasDrawnFirstFrame) {
      this.hasDrawnFirstFrame = true;
      this.onFirstFrame?.();
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getLayoutMetrics(): {
    originalWidth: number;
    originalHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    scale: number;
    renderedWidth: number;
    renderedHeight: number;
    x: number;
    y: number;
    withinViewport: boolean;
  } {
    const withinViewport =
      this.resolvedWidth <= this.viewportWidth + 0.01 &&
      this.resolvedHeight <= this.viewportHeight + 0.01 &&
      this.currentX >= 0 &&
      this.currentY >= 0 &&
      this.currentX + this.resolvedWidth <= this.viewportWidth + 0.5 &&
      this.currentY + this.resolvedHeight <= this.viewportHeight + 0.5;

    return {
      originalWidth: this.gifWidth,
      originalHeight: this.gifHeight,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      scale: this.resolvedScale,
      renderedWidth: this.resolvedWidth,
      renderedHeight: this.resolvedHeight,
      x: this.currentX,
      y: this.currentY,
      withinViewport,
    };
  }

  public update(deltaMs: number, camX: number, camY = 0): void {
    if (this.destroyed || !this.canvasTexture) return;

    if (!this.paused && this.config.animationSpeed > 0) {
      const sampleIntervalMs = Math.max(
        16,
        Math.round(50 / Math.max(0.1, this.config.animationSpeed))
      );
      this.sampleAccumulatorMs += deltaMs;
      if (this.sampleAccumulatorMs >= sampleIntervalMs) {
        this.sampleAccumulatorMs %= sampleIntervalMs;
        this.drawCurrentGifFrame();
      }
    }

    if (camX !== this.lastCamX || camY !== this.lastCamY) {
      this.syncCamera(camX, camY);
    }
  }

  public syncCamera(camX: number, camY = 0): void {
    if (!this.bgSprite || this.gifWidth <= 0) return;

    this.lastCamX = camX;
    this.lastCamY = camY;

    const maxX = Math.max(0, Math.floor(this.viewportWidth - this.resolvedWidth));
    const maxY = Math.max(0, Math.floor(this.viewportHeight - this.resolvedHeight));

    let x: number;
    if (maxX <= 0) {
      x = 0;
    } else {
      const worldWidth = this.scene.cameras?.main?.getBounds?.().width ?? this.viewportWidth;
      const worldSpan = Math.max(1, worldWidth - this.viewportWidth);
      const maxParallaxTravel = Math.min(
        maxX,
        worldSpan * this.config.horizontalParallaxFactor
      );
      const progress = Phaser.Math.Clamp(camX / worldSpan, 0, 1);
      const centeredOffset = (0.5 - progress) * maxParallaxTravel;
      x = Phaser.Math.Clamp(Math.round(this.resolvedBaseX + centeredOffset), 0, maxX);
    }

    const rawY = this.resolvedBaseY - camY * this.config.verticalParallaxFactor;
    const y = Phaser.Math.Clamp(Math.round(rawY), 0, maxY);

    this.currentX = x;
    this.currentY = y;
    this.bgSprite.setPosition(x, y);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.scene.scale?.off?.(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);

    if (this.pendingReadyListener) {
      this.cache.listeners.delete(this.pendingReadyListener);
      this.pendingReadyListener = null;
    }

    this.bgSprite?.destroy();
    this.bgSprite = null;
    this.bgFill?.destroy();
    this.bgFill = null;
    this.canvasTexture = null;

    this.cache.activeMounts = Math.max(0, this.cache.activeMounts - 1);
    if (this.cache.activeMounts === 0 && this.cache.img.parentNode) {
      this.cache.img.parentNode.removeChild(this.cache.img);
    }
  }
}
