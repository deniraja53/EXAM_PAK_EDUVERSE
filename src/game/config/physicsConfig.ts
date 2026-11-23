/**
 * Centralized tunable platformer physics & jump parameters for EXAM EDUVERSE.
 * Single source of truth consumed by gameConfig, InputSystem, and Player.
 */
export interface PlayerPhysicsConfig {
  /** World downward acceleration in px/s^2 */
  gravityY: number;
  /** Initial upward velocity on jump takeoff in px/s (negative = upward) */
  jumpVelocity: number;
  /** Maximum horizontal speed in px/s when walking */
  walkSpeed: number;
  /** Maximum horizontal speed in px/s when holding Shift (running) */
  runSpeed: number;
  /** Horizontal acceleration on solid ground in px/s^2 */
  groundAcceleration: number;
  /** Horizontal deceleration on solid ground in px/s^2 */
  groundDeceleration: number;
  /** Horizontal steering acceleration while airborne in px/s^2 */
  airControlAcceleration: number;
  /** Horizontal drag deceleration while airborne with no input in px/s^2 */
  airDragDeceleration: number;
  /** Maximum horizontal speed cap in px/s */
  maxHorizontalVelocity: number;
  /** Maximum downward fall speed cap in px/s */
  maxFallVelocity: number;
  /** Grace period after leaving a ledge where jump is still allowed (ms) */
  coyoteTimeDurationMs: number;
  /** Duration a jump press before landing is buffered (ms) */
  jumpBufferDurationMs: number;
  /** Minimum upward speed threshold for variable jump height cut (px/s, negative) */
  jumpCutVelocityThreshold: number;
  /** Extra gravity multiplier applied when releasing jump early while rising */
  jumpReleaseGravityMultiplier: number;
  /** Vertical speed band around jump apex that receives lighter hang-time gravity */
  apexHangVelocityThreshold: number;
  /** Gravity multiplier near jump apex when jump is held */
  apexHangGravityMultiplier: number;
}

export const PLAYER_PHYSICS: PlayerPhysicsConfig = {
  gravityY: 1320,
  jumpVelocity: -640,
  walkSpeed: 275,
  runSpeed: 390,
  groundAcceleration: 2100,
  groundDeceleration: 2400,
  airControlAcceleration: 1650,
  airDragDeceleration: 950,
  maxHorizontalVelocity: 430,
  maxFallVelocity: 880,
  coyoteTimeDurationMs: 120,
  jumpBufferDurationMs: 140,
  jumpCutVelocityThreshold: -180,
  jumpReleaseGravityMultiplier: 2.15,
  apexHangVelocityThreshold: 85,
  apexHangGravityMultiplier: 0.82,
};
