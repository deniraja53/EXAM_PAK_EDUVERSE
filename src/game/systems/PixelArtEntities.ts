import Phaser from 'phaser';

export const ENTITY_TEXTURE_KEYS = {
  QBOX_IDLE: 'px_qbox_idle',
  QBOX_ACTIVE: 'px_qbox_active',
  QBOX_USED: 'px_qbox_used',
  MONKEY_IDLE_0: 'px_monkey_idle_0',
  MONKEY_IDLE_1: 'px_monkey_idle_1',
  MONKEY_WALK_0: 'px_monkey_walk_0',
  MONKEY_WALK_1: 'px_monkey_walk_1',
  MONKEY_PREPARE: 'px_monkey_prepare',
  MONKEY_THROW: 'px_monkey_throw',
  MONKEY_HIT: 'px_monkey_hit',
  MONKEY_PROJECTILE: 'px_monkey_projectile',
  HEART_PROJECTILE: 'px_heart_projectile',
  FALLING_WOOD_FALLBACK: 'px_falling_wood_fallback',
} as const;

type RectFn = (x: number, y: number, w: number, h: number, color: string) => void;

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (px: RectFn, ctx: CanvasRenderingContext2D) => void
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, width, height);

  const px: RectFn = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  draw(px, ctx);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function drawQuestionBoxTexture(
  px: RectFn,
  variant: 'idle' | 'active' | 'used'
): void {
  const border = variant === 'used' ? '#1e293b' : '#451a03';
  const base =
    variant === 'active'
      ? '#fde047'
      : variant === 'used'
        ? '#475569'
        : '#f59e0b';
  const highlight =
    variant === 'active'
      ? '#fef9c3'
      : variant === 'used'
        ? '#64748b'
        : '#fbbf24';
  const shadow =
    variant === 'active'
      ? '#eab308'
      : variant === 'used'
        ? '#334155'
        : '#b45309';
  const rivet = variant === 'used' ? '#1e293b' : '#78350f';

  // Outer pixel frame (24x24)
  px(2, 0, 20, 1, border);
  px(1, 1, 22, 1, border);
  px(0, 2, 1, 20, border);
  px(23, 2, 1, 20, border);
  px(1, 22, 22, 1, border);
  px(2, 23, 20, 1, border);

  // Inner box body
  px(1, 2, 22, 20, base);

  // Bevel highlight & shadow
  px(2, 2, 20, 2, highlight);
  px(2, 2, 2, 20, highlight);
  px(2, 20, 20, 2, shadow);
  px(20, 2, 2, 20, shadow);

  // 4 corner bolts/rivets
  px(3, 3, 2, 2, rivet);
  px(19, 3, 2, 2, rivet);
  px(3, 19, 2, 2, rivet);
  px(19, 19, 2, 2, rivet);

  if (variant === 'used') {
    // Subtle checkmark / completed dash for spent box
    px(8, 12, 2, 2, '#94a3b8');
    px(10, 14, 2, 2, '#94a3b8');
    px(12, 12, 2, 2, '#94a3b8');
    px(14, 10, 2, 2, '#94a3b8');
    return;
  }

  // Crisp '?' symbol (shadow first, then white fill)
  const drawMark = (ox: number, oy: number, color: string) => {
    px(ox + 9, oy + 5, 6, 2, color);
    px(ox + 8, oy + 6, 2, 3, color);
    px(ox + 14, oy + 6, 2, 4, color);
    px(ox + 12, oy + 10, 3, 2, color);
    px(ox + 11, oy + 11, 2, 3, color);
    px(ox + 11, oy + 16, 2, 2, color);
  };

  drawMark(1, 1, '#451a03');
  drawMark(0, 0, '#ffffff');
}

function drawMonkeyFrame(
  px: RectFn,
  pose: 'idle_0' | 'idle_1' | 'walk_0' | 'walk_1' | 'prepare' | 'throw' | 'hit'
): void {
  const isHit = pose === 'hit';
  const outline = isHit ? '#7f1d1d' : '#3b1d0a';
  const furDark = isHit ? '#fca5a5' : '#6b3516';
  const fur = isHit ? '#fecaca' : '#8d4920';
  const tan = isHit ? '#fee2e2' : '#eab685';
  const tanShade = isHit ? '#fca5a5' : '#d1925c';

  const bob = pose === 'idle_1' || pose === 'walk_1' ? 1 : 0;

  // Curved long tail on left side (curls up and hooks gracefully)
  const tailY = pose === 'idle_1' ? 1 : 0;
  px(6, 21 + tailY, 6, 2, outline);
  px(4, 19 + tailY, 4, 3, outline);
  px(3, 14 + tailY, 3, 6, outline);
  px(4, 11 + tailY, 4, 4, outline);
  px(6, 10 + tailY, 3, 2, outline);
  // Tail fill
  px(7, 21 + tailY, 5, 1, furDark);
  px(5, 19 + tailY, 3, 2, fur);
  px(4, 14 + tailY, 2, 5, fur);
  px(5, 12 + tailY, 2, 2, fur);
  px(6, 11 + tailY, 2, 1, fur);

  // Back leg
  const backLegX = pose === 'walk_0' ? 12 : pose === 'walk_1' ? 15 : 13;
  const frontLegX = pose === 'walk_0' ? 19 : pose === 'walk_1' ? 17 : 18;
  px(backLegX - 1, 24, 5, 6, outline);
  px(backLegX, 24, 3, 4, furDark);
  px(backLegX, 28, 4, 2, tanShade);

  // Front leg
  px(frontLegX - 1, 24, 5, 6, outline);
  px(frontLegX, 24, 3, 4, fur);
  px(frontLegX, 28, 4, 2, tan);

  // Torso outline + brown fur + light-brown belly
  px(11, 15 + bob, 12, 10, outline);
  px(12, 16 + bob, 10, 8, fur);
  px(15, 17 + bob, 6, 6, tan);
  px(16, 17 + bob, 4, 1, tanShade);

  // Left (rear) arm
  if (pose === 'throw') {
    px(10, 17 + bob, 4, 5, outline);
    px(11, 18 + bob, 2, 3, furDark);
  } else {
    px(10, 17 + bob, 3, 6, outline);
    px(11, 18 + bob, 1, 4, furDark);
  }

  // Head + ears (brown fur + light-brown face)
  px(10, 7 + bob, 4, 5, outline); // left ear
  px(11, 8 + bob, 2, 3, tan);
  px(12, 4 + bob, 13, 12, outline); // head outer
  px(13, 5 + bob, 11, 10, fur);
  px(15, 3 + bob, 5, 2, furDark); // tuft on crown

  // Light brown face mask & muzzle
  px(16, 7 + bob, 9, 7, tan);
  px(17, 6 + bob, 4, 2, tan);
  px(21, 6 + bob, 3, 2, tan);
  px(18, 11 + bob, 7, 3, tan);
  px(18, 13 + bob, 6, 1, tanShade);

  // Eyes & smile
  px(18, 8 + bob, 2, 2, '#1e1b18');
  px(22, 8 + bob, 2, 2, '#1e1b18');
  px(18, 8 + bob, 1, 1, '#ffffff');
  px(22, 8 + bob, 1, 1, '#ffffff');
  px(21, 11 + bob, 2, 1, '#3b1d0a');
  px(20, 12 + bob, 3, 1, '#5c280a');

  // Front arm + banana state
  if (pose === 'prepare') {
    // Raised arm holding yellow banana ready to throw
    px(21, 12 + bob, 4, 6, outline);
    px(22, 13 + bob, 2, 4, fur);
    // Banana in raised hand
    px(22, 7 + bob, 6, 6, '#713f12');
    px(23, 8 + bob, 4, 4, '#facc15');
    px(24, 9 + bob, 2, 2, '#fef08a');
  } else if (pose === 'throw') {
    // Extended forward throwing arm
    px(21, 16 + bob, 8, 4, outline);
    px(22, 17 + bob, 6, 2, fur);
    px(27, 17 + bob, 2, 2, tan);
  } else {
    // Standard arm resting / swinging
    const armOffset = pose === 'walk_0' ? 1 : pose === 'walk_1' ? -1 : 0;
    px(20 + armOffset, 17 + bob, 4, 6, outline);
    px(21 + armOffset, 18 + bob, 2, 3, fur);
    px(21 + armOffset, 21 + bob, 2, 2, tan);
  }
}

/**
 * Registers crisp 16-bit procedural pixel-art textures for entities without external sprite sheets
 * (Question Boxes, Forest Monkey enemy frames, and Banana Projectile).
 */
export function ensureLevel01EntityTextures(scene: Phaser.Scene): void {
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.QBOX_IDLE, 24, 24, (px) =>
    drawQuestionBoxTexture(px, 'idle')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.QBOX_ACTIVE, 24, 24, (px) =>
    drawQuestionBoxTexture(px, 'active')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.QBOX_USED, 24, 24, (px) =>
    drawQuestionBoxTexture(px, 'used')
  );

  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_IDLE_0, 32, 32, (px) =>
    drawMonkeyFrame(px, 'idle_0')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_IDLE_1, 32, 32, (px) =>
    drawMonkeyFrame(px, 'idle_1')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_WALK_0, 32, 32, (px) =>
    drawMonkeyFrame(px, 'walk_0')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_WALK_1, 32, 32, (px) =>
    drawMonkeyFrame(px, 'walk_1')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_PREPARE, 32, 32, (px) =>
    drawMonkeyFrame(px, 'prepare')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_THROW, 32, 32, (px) =>
    drawMonkeyFrame(px, 'throw')
  );
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_HIT, 32, 32, (px) =>
    drawMonkeyFrame(px, 'hit')
  );

  // 14x14 crisp pixel-art Banana Projectile
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.MONKEY_PROJECTILE, 14, 14, (px) => {
    px(5, 1, 4, 2, '#713f12');
    px(7, 2, 4, 3, '#713f12');
    px(8, 4, 4, 5, '#713f12');
    px(6, 8, 4, 3, '#713f12');
    px(3, 10, 4, 2, '#713f12');

    px(5, 2, 3, 1, '#a16207');
    px(7, 3, 3, 2, '#facc15');
    px(9, 4, 2, 4, '#facc15');
    px(8, 5, 2, 3, '#fef08a');
    px(7, 8, 2, 2, '#facc15');
    px(4, 10, 3, 1, '#eab308');
  });

  // 22x20 crisp pixel-art Heart Projectile (11x10 grid @ 2x2 pixel blocks)
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.HEART_PROJECTILE, 22, 20, (px) => {
    const P = (gx: number, gy: number, gw: number, gh: number, color: string) =>
      px(gx * 2, gy * 2, gw * 2, gh * 2, color);
    const outline = '#4c0519';
    const baseRed = '#f43f5e';
    const shadeRed = '#be123c';
    const glint = '#fecdd3';

    // Crisp pixel outline
    P(2, 0, 3, 1, outline);
    P(6, 0, 3, 1, outline);
    P(1, 1, 1, 1, outline);
    P(5, 1, 1, 1, outline);
    P(9, 1, 1, 1, outline);
    P(0, 2, 1, 3, outline);
    P(10, 2, 1, 3, outline);
    P(1, 5, 1, 1, outline);
    P(9, 5, 1, 1, outline);
    P(2, 6, 1, 1, outline);
    P(8, 6, 1, 1, outline);
    P(3, 7, 1, 1, outline);
    P(7, 7, 1, 1, outline);
    P(4, 8, 1, 1, outline);
    P(6, 8, 1, 1, outline);
    P(5, 9, 1, 1, outline);

    // Vibrant rose-red inner body
    P(2, 1, 3, 1, baseRed);
    P(6, 1, 3, 1, baseRed);
    P(1, 2, 9, 3, baseRed);
    P(2, 5, 7, 1, baseRed);
    P(3, 6, 5, 1, baseRed);
    P(4, 7, 3, 1, baseRed);
    P(5, 8, 1, 1, baseRed);

    // Bottom-right depth shading
    P(8, 3, 2, 2, shadeRed);
    P(7, 5, 2, 1, shadeRed);
    P(6, 6, 2, 1, shadeRed);
    P(5, 7, 2, 1, shadeRed);
    P(5, 8, 1, 1, shadeRed);

    // Specular pixel highlight on top-left lobe
    P(2, 2, 2, 1, glint);
    P(2, 3, 1, 1, glint);
  });

  // Fallback wooden plank texture if FLOATING_PLATFORMS sheet fails to load
  makeCanvas(scene, ENTITY_TEXTURE_KEYS.FALLING_WOOD_FALLBACK, 130, 34, (px) => {
    px(0, 0, 130, 34, '#3f1d0b');
    px(2, 2, 126, 26, '#8b4513');
    px(2, 2, 126, 5, '#b4692e');
    px(2, 24, 126, 4, '#5c2d0c');
    px(42, 4, 2, 24, '#3f1d0b');
    px(86, 4, 2, 24, '#3f1d0b');
    px(10, 8, 4, 4, '#d6d3d1');
    px(116, 8, 4, 4, '#d6d3d1');
  });

  // Register lightweight monkey frame animations
  if (!scene.anims.exists('monkey-idle')) {
    scene.anims.create({
      key: 'monkey-idle',
      frames: [
        { key: ENTITY_TEXTURE_KEYS.MONKEY_IDLE_0 },
        { key: ENTITY_TEXTURE_KEYS.MONKEY_IDLE_1 },
      ],
      frameRate: 3,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('monkey-walk')) {
    scene.anims.create({
      key: 'monkey-walk',
      frames: [
        { key: ENTITY_TEXTURE_KEYS.MONKEY_WALK_0 },
        { key: ENTITY_TEXTURE_KEYS.MONKEY_IDLE_0 },
        { key: ENTITY_TEXTURE_KEYS.MONKEY_WALK_1 },
        { key: ENTITY_TEXTURE_KEYS.MONKEY_IDLE_0 },
      ],
      frameRate: 6,
      repeat: -1,
    });
  }
}
