import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assetManifest';
import { WORLD_SPRITE_SCALE } from '../config/constants';
import { PLAYER_PHYSICS } from '../config/physicsConfig';
import { AudioSystem } from '../systems/AudioSystem';
import { InputSnapshot } from '../systems/InputSystem';

export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'crouch'
  | 'crouch-walk'
  | 'celebrate';

const ANIM_STATE_TO_KEY: Record<PlayerAnimState, string> = {
  idle: 'deni-idle',
  walk: 'deni-walk',
  run: 'deni-run',
  jump: 'deni-jump',
  fall: 'deni-fall',
  land: 'deni-land',
  crouch: 'deni-land',
  'crouch-walk': 'deni-walk',
  celebrate: 'deni-celebrate',
};

export interface OverheadObstacleSource {
  group: Phaser.Physics.Arcade.StaticGroup | Phaser.Physics.Arcade.Group;
  processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;
}

export interface PlayerUpdateResult {
  jumped: boolean;
  landed: boolean;
  impactSpeed: number;
  crouching: boolean;
}

/**
 * Standing vs Crouching collider specs in world pixels:
 * - Standing:  72 x 196 tex px at WORLD_SPRITE_SCALE (0.5)   -> 36 x 98 world px
 * - Crouching: 72 x 192 source px at CROUCH_SCALE_Y (0.28125) -> 36 x 54 world px
 *   (9/32 = 0.28125 and 192 * 9/32 = 54 are exact binary floats, keeping body.bottom invariant)
 */
export const PLAYER_COLLIDER_DIMENSIONS = {
  standingWidthTex: 72,
  standingHeightTex: 196,
  standingScaleX: WORLD_SPRITE_SCALE,
  standingScaleY: WORLD_SPRITE_SCALE,
  standingWorldWidth: 36,
  standingWorldHeight: 98,
  crouchScaleY: 0.28125,
  crouchHeightSourcePx: 192,
  crouchWorldWidth: 36,
  crouchWorldHeight: 54,
} as const;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly bodyWidthTex = PLAYER_COLLIDER_DIMENSIONS.standingWidthTex;
  private readonly standingBodyHeightTex = PLAYER_COLLIDER_DIMENSIONS.standingHeightTex;
  private readonly crouchBodyHeightSource = PLAYER_COLLIDER_DIMENSIONS.crouchHeightSourcePx;

  private coyoteTimerMs = 0;
  private jumpLockedUntilGrounded = false;
  private stompBounceActive = false;

  private wasGrounded = false;
  private airborneTimeMs = 0;
  private landTimerMs = 0;
  private celebrating = false;
  private hurtCooldownMs = 0;
  private stompGraceMs = 0;
  private crouching = false;

  private headroomSensor: Phaser.GameObjects.Zone;
  private overheadObstacles: OverheadObstacleSource[] = [];

  private animState: PlayerAnimState = 'idle';
  private lastSyncedFrameName = '';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ASSET_KEYS.DENI, 'idle_0');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(
      PLAYER_COLLIDER_DIMENSIONS.standingScaleX,
      PLAYER_COLLIDER_DIMENSIONS.standingScaleY
    );
    this.setOrigin(0.5, 1);
    this.setDepth(20);
    this.setVisible(true);
    this.setAlpha(1);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(
      PLAYER_PHYSICS.maxHorizontalVelocity,
      PLAYER_PHYSICS.maxFallVelocity
    );
    body.setSize(this.bodyWidthTex, this.standingBodyHeightTex, false);
    this.syncBodyHitbox(true);

    // Non-colliding Phaser Zone sensor used to test overhead headroom via scene.physics.overlap
    const headroomDiff =
      PLAYER_COLLIDER_DIMENSIONS.standingWorldHeight -
      PLAYER_COLLIDER_DIMENSIONS.crouchWorldHeight;
    this.headroomSensor = scene.add.zone(
      x,
      y - PLAYER_COLLIDER_DIMENSIONS.crouchWorldHeight - headroomDiff * 0.5,
      PLAYER_COLLIDER_DIMENSIONS.standingWorldWidth - 2,
      headroomDiff
    );
    scene.physics.add.existing(this.headroomSensor, false);
    const sensorBody = this.headroomSensor.body as Phaser.Physics.Arcade.Body;
    sensorBody.setAllowGravity(false);
    sensorBody.setImmovable(true);
    sensorBody.moves = false;
    sensorBody.setSize(
      PLAYER_COLLIDER_DIMENSIONS.standingWorldWidth - 2,
      headroomDiff,
      true
    );

    this.setAnimationState('idle', true);
  }

  public setOverheadObstacles(obstacles: OverheadObstacleSource[]): void {
    this.overheadObstacles = obstacles;
  }

  public isCrouching(): boolean {
    return this.crouching;
  }

  public getFacingDirection(): 1 | -1 {
    return this.flipX ? -1 : 1;
  }

  public isCelebrating(): boolean {
    return this.celebrating;
  }

  /**
   * Checks whether Deni has enough vertical clearance above his crouched collider
   * to return to full standing height (36 x 98 world px) using Phaser's overlap system.
   */
  public canStandUp(): boolean {
    if (!this.crouching) return true;
    if (this.overheadObstacles.length === 0) return true;

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    const sensorBody = this.headroomSensor?.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !sensorBody || !this.scene?.physics) return true;

    const deltaH =
      PLAYER_COLLIDER_DIMENSIONS.standingWorldHeight -
      PLAYER_COLLIDER_DIMENSIONS.crouchWorldHeight;
    const sensorW = Math.max(12, body.width - 2);
    const sensorH = deltaH;
    const sensorCenterX = body.center.x;
    const sensorCenterY = body.top - sensorH * 0.5;

    this.headroomSensor.setPosition(sensorCenterX, sensorCenterY);
    this.headroomSensor.setSize(sensorW, sensorH);
    sensorBody.setSize(sensorW, sensorH, true);
    sensorBody.updateFromGameObject();

    for (const source of this.overheadObstacles) {
      const blocked = this.scene.physics.overlap(
        this.headroomSensor,
        source.group,
        undefined,
        source.processCallback,
        this
      );
      if (blocked) {
        return false;
      }
    }

    return true;
  }

  private applyCrouchState(nextCrouching: boolean): void {
    if (this.crouching === nextCrouching) return;

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    const oldHeight = body ? body.height : 0;

    this.crouching = nextCrouching;

    const targetScaleY = nextCrouching
      ? PLAYER_COLLIDER_DIMENSIONS.crouchScaleY
      : PLAYER_COLLIDER_DIMENSIONS.standingScaleY;
    const targetHeightSource = nextCrouching
      ? this.crouchBodyHeightSource
      : this.standingBodyHeightTex;

    this.setScale(PLAYER_COLLIDER_DIMENSIONS.standingScaleX, targetScaleY);

    if (body) {
      // Sync cached body._sx / body._sy before setSize so world height matches exact target
      body.updateBounds();
      body.setSize(this.bodyWidthTex, targetHeightSource, false);
      this.syncBodyHitbox(true);

      // Anchor collider bottom (Deni's feet) so shrinking/expanding never floats or sinks
      const deltaH = oldHeight - body.height;
      if (deltaH !== 0) {
        body.position.y += deltaH;
        body.prev.y += deltaH;
        body.prevFrame.y += deltaH;
        body.updateCenter();
      }
    }
  }

  /**
   * Phaser runs Sprite.preUpdate (advancing AnimationState frames) during PRE_UPDATE,
   * before Physics.World.update runs body.updateFromGameObject() during UPDATE.
   * Syncing the body offset right after super.preUpdate ensures displayOriginY - offset.y
   * remains invariant across idle/walk/run frames with slightly different cut heights,
   * preventing 1px ground detachment and idle-to-fall animation flickering.
   */
  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncBodyHitbox();
  }

  private syncBodyHitbox(force = false): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.frame) return;
    if (!force && this.frame.name === this.lastSyncedFrameName) return;

    this.lastSyncedFrameName = this.frame.name;
    const activeHeightSource = this.crouching
      ? this.crouchBodyHeightSource
      : this.standingBodyHeightTex;
    const offsetX = (this.frame.width - this.bodyWidthTex) * 0.5;
    const offsetY = this.frame.height - activeHeightSource;
    body.setOffset(offsetX, offsetY);
  }

  private setAnimationState(next: PlayerAnimState, force = false): void {
    const animKey = ANIM_STATE_TO_KEY[next];
    if (!force && this.animState === next && this.anims.currentAnim?.key === animKey) {
      return;
    }
    this.animState = next;
    this.play(animKey, true);
    this.syncBodyHitbox(true);
  }

  public getAnimationState(): PlayerAnimState {
    return this.animState;
  }

  public startCelebration(): void {
    this.celebrating = true;
    this.applyCrouchState(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    body.setAccelerationX(0);
    body.setGravityY(0);
    this.setAnimationState('celebrate', true);
  }

  public isInvulnerable(): boolean {
    return this.hurtCooldownMs > 0 || this.stompGraceMs > 0 || this.celebrating;
  }

  public triggerDamage(invulnMs = 1300, sourceX?: number): boolean {
    if (this.isInvulnerable()) return false;

    this.hurtCooldownMs = invulnMs;
    this.setTint(0xfca5a5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(Math.min(body.velocity.y, -210));
    if (typeof sourceX === 'number') {
      const pushDir = this.x >= sourceX ? 1 : -1;
      body.setVelocityX(pushDir * 170);
    }

    return true;
  }

  public bounceFromStomp(bounceVelocity = -485): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || this.celebrating) return;

    // Prevent excessive upward bounce near the top edge of the viewport
    const clampedVelocity = this.y < 150 ? Math.max(bounceVelocity, -340) : bounceVelocity;
    body.setVelocityY(clampedVelocity);
    body.setGravityY(0);

    this.stompBounceActive = true;
    this.stompGraceMs = 220;
    this.coyoteTimerMs = 0;
    this.jumpLockedUntilGrounded = true;
    this.airborneTimeMs = 0;
    this.landTimerMs = 0;
    this.wasGrounded = false;
    this.setAnimationState(this.crouching ? 'crouch' : 'jump', true);
    AudioSystem.playJump();
  }

  public resetAt(x: number, y: number, invulnMs = 1500): void {
    this.celebrating = false;
    this.applyCrouchState(false);
    this.hurtCooldownMs = invulnMs;
    this.stompGraceMs = 0;
    this.coyoteTimerMs = 0;
    this.jumpLockedUntilGrounded = false;
    this.stompBounceActive = false;
    this.airborneTimeMs = 0;
    this.landTimerMs = 0;
    this.wasGrounded = false;
    this.clearTint();
    this.setVisible(true);
    this.setAlpha(1);
    this.setPosition(x, y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    body.setGravityY(0);
    this.setAnimationState('idle', true);
  }

  public updatePlayer(
    deltaMs: number,
    input: InputSnapshot,
    consumeJumpBuffer: () => void
  ): PlayerUpdateResult {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dt = Math.min(deltaMs, 50) / 1000;

    if (this.stompGraceMs > 0) {
      this.stompGraceMs = Math.max(0, this.stompGraceMs - deltaMs);
    }

    if (this.hurtCooldownMs > 0) {
      this.hurtCooldownMs = Math.max(0, this.hurtCooldownMs - deltaMs);
      this.setAlpha(Math.floor(this.hurtCooldownMs / 90) % 2 === 0 ? 0.55 : 1);
      if (this.hurtCooldownMs <= 950 && this.isTinted) {
        this.clearTint();
      }
    } else {
      if (this.alpha !== 1) this.setAlpha(1);
      if (this.isTinted) this.clearTint();
    }

    if (this.celebrating) {
      this.syncBodyHitbox();
      return { jumped: false, landed: false, impactSpeed: 0, crouching: false };
    }

    // Crouch state update: stay crouched while input is held OR overhead clearance is blocked
    const nextCrouching = input.crouchHeld
      ? true
      : this.crouching && !this.canStandUp();
    this.applyCrouchState(nextCrouching);

    const grounded = body.blocked.down || body.touching.down;
    const impactSpeed = !this.wasGrounded && grounded ? body.velocity.y : 0;
    const landed = !this.wasGrounded && grounded;

    if (grounded) {
      this.airborneTimeMs = 0;
    } else {
      this.airborneTimeMs += deltaMs;
    }

    if (landed) {
      this.landTimerMs = impactSpeed > 150 ? 85 : 0;
      this.jumpLockedUntilGrounded = false;
      if (impactSpeed > 180) {
        AudioSystem.playLand();
      }
    } else if (this.landTimerMs > 0) {
      this.landTimerMs = Math.max(0, this.landTimerMs - deltaMs);
    }

    if (grounded && body.velocity.y >= 0) {
      this.coyoteTimerMs = PLAYER_PHYSICS.coyoteTimeDurationMs;
      this.jumpLockedUntilGrounded = false;
    } else if (this.coyoteTimerMs > 0) {
      this.coyoteTimerMs = Math.max(0, this.coyoteTimerMs - deltaMs);
    }

    // Horizontal movement with distinct ground acceleration, crouch speed, & air control
    const targetMaxSpeed = this.crouching
      ? Math.round(PLAYER_PHYSICS.walkSpeed * 0.72)
      : input.running
        ? PLAYER_PHYSICS.runSpeed
        : PLAYER_PHYSICS.walkSpeed;
    const targetVx = input.moveX * targetMaxSpeed;
    const accel = grounded
      ? input.moveX !== 0
        ? PLAYER_PHYSICS.groundAcceleration
        : PLAYER_PHYSICS.groundDeceleration
      : input.moveX !== 0
        ? PLAYER_PHYSICS.airControlAcceleration
        : PLAYER_PHYSICS.airDragDeceleration;

    const currentVx = body.velocity.x;
    if (currentVx < targetVx) {
      body.setVelocityX(Math.min(targetVx, currentVx + accel * dt));
    } else if (currentVx > targetVx) {
      body.setVelocityX(Math.max(targetVx, currentVx - accel * dt));
    }

    if (input.moveX < 0) this.setFlipX(true);
    else if (input.moveX > 0) this.setFlipX(false);

    // Jump trigger with coyote time, input buffer, and overhead block check when crouched
    let jumped = false;
    const canJumpWithHeadroom = !this.crouching || this.canStandUp();
    if (
      canJumpWithHeadroom &&
      !this.jumpLockedUntilGrounded &&
      input.jumpBuffered &&
      this.coyoteTimerMs > 0
    ) {
      body.setVelocityY(PLAYER_PHYSICS.jumpVelocity);
      this.coyoteTimerMs = 0;
      this.jumpLockedUntilGrounded = true;
      this.stompBounceActive = false;
      this.airborneTimeMs = 0;
      this.landTimerMs = 0;
      consumeJumpBuffer();
      AudioSystem.playJump();
      jumped = true;
    }

    if (grounded || body.velocity.y >= 0) {
      this.stompBounceActive = false;
    }

    // Frame-rate independent variable jump height & apex hang-time
    if (grounded) {
      body.setGravityY(0);
    } else if (
      !this.stompBounceActive &&
      !input.jumpHeld &&
      body.velocity.y < PLAYER_PHYSICS.jumpCutVelocityThreshold
    ) {
      body.setGravityY(
        (PLAYER_PHYSICS.jumpReleaseGravityMultiplier - 1) * PLAYER_PHYSICS.gravityY
      );
    } else if (
      (input.jumpHeld || this.stompBounceActive) &&
      Math.abs(body.velocity.y) < PLAYER_PHYSICS.apexHangVelocityThreshold
    ) {
      body.setGravityY(
        (PLAYER_PHYSICS.apexHangGravityMultiplier - 1) * PLAYER_PHYSICS.gravityY
      );
    } else {
      body.setGravityY(0);
    }

    // Controlled animation state selection (never restarts active state)
    const nextState = this.resolveAnimationState(
      grounded,
      jumped,
      body.velocity.x,
      body.velocity.y,
      input.running
    );
    this.setAnimationState(nextState);

    this.wasGrounded = grounded;

    return { jumped, landed, impactSpeed, crouching: this.crouching };
  }

  private resolveAnimationState(
    grounded: boolean,
    jumped: boolean,
    vx: number,
    vy: number,
    running: boolean
  ): PlayerAnimState {
    if (this.crouching) {
      return Math.abs(vx) > 25 ? 'crouch-walk' : 'crouch';
    }

    if (jumped) {
      return 'jump';
    }

    if (!grounded) {
      if (vy < -40) {
        return 'jump';
      }
      if (this.animState === 'jump' || vy > 70 || this.airborneTimeMs > 55) {
        return 'fall';
      }
    }

    if (this.landTimerMs > 0 && Math.abs(vx) < 120) {
      return 'land';
    }

    if (Math.abs(vx) > 25) {
      if (running && Math.abs(vx) > PLAYER_PHYSICS.walkSpeed * 0.95) {
        return 'run';
      }
      return 'walk';
    }

    return 'idle';
  }

  public destroy(fromScene?: boolean): void {
    if (this.headroomSensor?.scene) {
      this.headroomSensor.destroy(fromScene);
    }
    this.overheadObstacles = [];
    super.destroy(fromScene);
  }
}
