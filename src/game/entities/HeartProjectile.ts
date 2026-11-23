import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { ENTITY_TEXTURE_KEYS } from '../systems/PixelArtEntities';
import { Player } from './Player';

export const HEART_PROJECTILE_CONFIG = {
  textureWidth: 22,
  textureHeight: 20,
  hitboxWidth: 16,
  hitboxHeight: 14,
  speed: 520,
  fireCooldownMs: 400,
  maxActiveProjectiles: 3,
} as const;

/**
 * Manages Deni's pixel-art Heart Projectiles:
 * - Spawns cleanly in front of Deni according to facing direction
 * - Enforces 400ms cooldown and max 3 active projectiles
 * - Plays subtle pulse & tilt animation in flight
 * - Cleans up on enemy hit, viewport exit, world bounds, pause, or scene shutdown
 */
export class HeartProjectileManager {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private cooldownRemainingMs = 0;
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.dustEmitter = dustEmitter;
    this.group = scene.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  public getCooldownRemainingMs(): number {
    return this.cooldownRemainingMs;
  }

  public getActiveCount(): number {
    if (!this.group?.children) return 0;
    let count = 0;
    for (const child of this.group.getChildren()) {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && sprite.scene && !sprite.getData('consumed')) {
        count += 1;
      }
    }
    return count;
  }

  public tryFire(player: Player): boolean {
    if (this.paused || player.isCelebrating()) return false;
    if (this.cooldownRemainingMs > 0) return false;
    if (this.getActiveCount() >= HEART_PROJECTILE_CONFIG.maxActiveProjectiles) {
      return false;
    }

    const pBody = player.body as Phaser.Physics.Arcade.Body | null;
    if (!pBody) return false;

    const facing = player.getFacingDirection();
    const spawnX = pBody.center.x + facing * (pBody.halfWidth + 13);
    const spawnY = player.isCrouching()
      ? pBody.center.y
      : pBody.top + pBody.height * 0.44;

    const proj = this.group.create(
      spawnX,
      spawnY,
      ENTITY_TEXTURE_KEYS.HEART_PROJECTILE
    ) as Phaser.Physics.Arcade.Sprite;

    proj.setDepth(22);
    proj.setFlipX(facing < 0);
    proj.setData('consumed', false);
    proj.setData('ageMs', 0);
    proj.setData('facing', facing);

    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(
      HEART_PROJECTILE_CONFIG.hitboxWidth,
      HEART_PROJECTILE_CONFIG.hitboxHeight,
      true
    );
    body.setVelocity(facing * HEART_PROJECTILE_CONFIG.speed, 0);

    this.cooldownRemainingMs = HEART_PROJECTILE_CONFIG.fireCooldownMs;

    if (this.dustEmitter) {
      this.dustEmitter.explode(4, spawnX, spawnY);
    }
    AudioSystem.playHeartShoot();
    return true;
  }

  public spawnHitBurst(x: number, y: number): void {
    if (this.dustEmitter) {
      this.dustEmitter.explode(10, x, y);
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.group?.children) return;

    this.group.getChildren().forEach((child) => {
      const proj = child as Phaser.Physics.Arcade.Sprite;
      const body = proj.body as Phaser.Physics.Arcade.Body | null;
      if (!body) return;

      if (paused) {
        proj.setData('savedVx', body.velocity.x);
        proj.setData('savedVy', body.velocity.y);
        body.setVelocity(0, 0);
      } else {
        const vx = proj.getData('savedVx') as number | undefined;
        const vy = proj.getData('savedVy') as number | undefined;
        if (typeof vx === 'number' && typeof vy === 'number') {
          body.setVelocity(vx, vy);
        }
      }
    });
  }

  public update(deltaMs: number, camera?: Phaser.Cameras.Scene2D.Camera): void {
    if (this.paused) return;

    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - deltaMs);
    }

    if (!this.group?.children) return;

    const children = [...this.group.getChildren()];
    for (const child of children) {
      const proj = child as Phaser.Physics.Arcade.Sprite;
      if (!proj.active || !proj.scene || proj.getData('consumed')) continue;

      const ageMs = ((proj.getData('ageMs') as number) || 0) + deltaMs;
      proj.setData('ageMs', ageMs);
      const facing = ((proj.getData('facing') as number) || 1) as 1 | -1;

      // Subtle living heart pulse & tilt in flight
      const pulse = 1 + Math.sin(ageMs * 0.018) * 0.08;
      proj.setScale(pulse);
      proj.setAngle(facing * Math.sin(ageMs * 0.014) * 6);

      const outOfWorld =
        proj.x < -40 ||
        proj.x > this.worldWidth + 40 ||
        proj.y < -80 ||
        proj.y > GAME_HEIGHT + 80;
      const offCamera = camera
        ? proj.x < camera.scrollX - 140 ||
          proj.x > camera.scrollX + camera.width + 140
        : false;

      if (outOfWorld || offCamera) {
        proj.setData('consumed', true);
        proj.destroy();
      }
    }
  }

  public resetAll(): void {
    this.cooldownRemainingMs = 0;
    if (this.group?.children) {
      this.group.clear(true, true);
    }
  }

  public destroy(): void {
    this.cooldownRemainingMs = 0;
    if (this.group?.children) {
      this.group.clear(true, true);
    }
  }
}
