import Phaser from 'phaser';
import { PLAYER_PHYSICS } from '../config/physicsConfig';

export type InputMode = 'GAMEPLAY' | 'TEXT_INPUT';

export interface InputSnapshot {
  moveX: number; // -1 | 0 | 1
  running: boolean;
  crouchHeld: boolean;
  shootHeld: boolean;
  jumpHeld: boolean;
  jumpBuffered: boolean;
  pauseJustPressed: boolean;
}

const NEUTRAL_INPUT_SNAPSHOT: InputSnapshot = {
  moveX: 0,
  running: false,
  crouchHeld: false,
  shootHeld: false,
  jumpHeld: false,
  jumpBuffered: false,
  pauseJustPressed: false,
};

const GAMEPLAY_CAPTURE_KEYCODES: number[] = [
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.A,
  Phaser.Input.Keyboard.KeyCodes.D,
  Phaser.Input.Keyboard.KeyCodes.S,
  Phaser.Input.Keyboard.KeyCodes.W,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
  Phaser.Input.Keyboard.KeyCodes.SHIFT,
  Phaser.Input.Keyboard.KeyCodes.ESC,
  Phaser.Input.Keyboard.KeyCodes.P,
];

export function isEditableDomElement(el: Element | null | undefined): boolean {
  if (!el || typeof el !== 'object') return false;
  const htmlEl = el as HTMLElement;
  const tag = typeof htmlEl.tagName === 'string' ? htmlEl.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const inputType = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(
      inputType
    );
  }
  return Boolean(htmlEl.isContentEditable);
}

export class InputSystem {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keys: {
    a?: Phaser.Input.Keyboard.Key;
    d?: Phaser.Input.Keyboard.Key;
    s?: Phaser.Input.Keyboard.Key;
    w?: Phaser.Input.Keyboard.Key;
    space?: Phaser.Input.Keyboard.Key;
    shift?: Phaser.Input.Keyboard.Key;
    esc?: Phaser.Input.Keyboard.Key;
    p?: Phaser.Input.Keyboard.Key;
  } = {};

  private mode: InputMode = 'GAMEPLAY';
  private phaserKeyboardSuspended = false;

  private jumpBufferTimerMs = 0;
  private readonly jumpBufferDurationMs = PLAYER_PHYSICS.jumpBufferDurationMs;

  // Optional virtual touch state for mobile/tablet play
  private virtualLeft = false;
  private virtualRight = false;
  private virtualCrouch = false;
  private virtualShoot = false;
  private virtualJumpHeld = false;
  private virtualJumpQueued = false;

  private onBlurHandler: () => void;
  private onFocusInHandler: (event: FocusEvent) => void;
  private onFocusOutHandler: (event: FocusEvent) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys = {
        a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
        esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
        p: kb.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      };
    }

    this.onBlurHandler = () => {
      this.resetAllInputs();
    };
    this.onFocusInHandler = (event: FocusEvent) => {
      const target = (event.target as Element | null) ?? document.activeElement;
      if (isEditableDomElement(target)) {
        this.applyInputMode();
      }
    };
    this.onFocusOutHandler = (event: FocusEvent) => {
      if (this.mode === 'GAMEPLAY' && !isEditableDomElement(event.relatedTarget as Element | null)) {
        this.applyInputMode();
      }
    };

    window.addEventListener('blur', this.onBlurHandler);
    if (typeof document !== 'undefined') {
      document.addEventListener('focusin', this.onFocusInHandler);
      document.addEventListener('focusout', this.onFocusOutHandler);
    }

    this.applyInputMode();
  }

  public getMode(): InputMode {
    if (this.mode === 'TEXT_INPUT') return 'TEXT_INPUT';
    if (typeof document !== 'undefined' && isEditableDomElement(document.activeElement)) {
      return 'TEXT_INPUT';
    }
    return 'GAMEPLAY';
  }

  public setTextInputMode(active: boolean): void {
    this.mode = active ? 'TEXT_INPUT' : 'GAMEPLAY';
    this.applyInputMode();
  }

  private applyInputMode(): void {
    const effectiveMode = this.getMode();
    const kb = this.scene.input?.keyboard;

    if (effectiveMode === 'TEXT_INPUT') {
      if (!this.phaserKeyboardSuspended) {
        this.resetAllInputs();
        this.phaserKeyboardSuspended = true;
      }
      if (kb) {
        kb.enabled = false;
        kb.disableGlobalCapture();
        kb.clearCaptures();
        if (kb.manager) {
          kb.manager.enabled = false;
          kb.manager.preventDefault = false;
          const mgr = kb.manager as Phaser.Input.Keyboard.KeyboardManager & {
            queue?: KeyboardEvent[];
          };
          if (Array.isArray(mgr.queue)) {
            mgr.queue = [];
          }
        }
      }
      return;
    }

    if (this.phaserKeyboardSuspended) {
      this.resetAllInputs();
      this.phaserKeyboardSuspended = false;
    }

    if (kb) {
      if (kb.manager) {
        kb.manager.enabled = true;
      }
      kb.enabled = true;
      kb.addCapture(GAMEPLAY_CAPTURE_KEYCODES);
      kb.enableGlobalCapture();
    }
  }

  public setVirtualInput(
    control: 'left' | 'right' | 'jump' | 'crouch' | 'shoot',
    pressed: boolean
  ): void {
    if (this.getMode() === 'TEXT_INPUT') return;
    if (control === 'left') this.virtualLeft = pressed;
    if (control === 'right') this.virtualRight = pressed;
    if (control === 'crouch') this.virtualCrouch = pressed;
    if (control === 'shoot') this.virtualShoot = pressed;
    if (control === 'jump') {
      if (pressed && !this.virtualJumpHeld) {
        this.virtualJumpQueued = true;
      }
      this.virtualJumpHeld = pressed;
    }
  }

  public resetAllInputs(): void {
    this.virtualLeft = false;
    this.virtualRight = false;
    this.virtualCrouch = false;
    this.virtualShoot = false;
    this.virtualJumpHeld = false;
    this.virtualJumpQueued = false;
    this.jumpBufferTimerMs = 0;
    this.scene.input?.keyboard?.resetKeys();
  }

  public consumeJumpBuffer(): void {
    this.jumpBufferTimerMs = 0;
  }

  public sample(deltaMs: number): InputSnapshot {
    if (this.getMode() === 'TEXT_INPUT') {
      if (!this.phaserKeyboardSuspended) {
        this.applyInputMode();
      }
      return NEUTRAL_INPUT_SNAPSHOT;
    }

    if (this.phaserKeyboardSuspended) {
      this.applyInputMode();
    }

    const leftHeld =
      Boolean(this.cursors?.left.isDown) ||
      Boolean(this.keys.a?.isDown) ||
      this.virtualLeft;
    const rightHeld =
      Boolean(this.cursors?.right.isDown) ||
      Boolean(this.keys.d?.isDown) ||
      this.virtualRight;

    let moveX = 0;
    if (leftHeld && !rightHeld) moveX = -1;
    else if (rightHeld && !leftHeld) moveX = 1;

    const running = Boolean(this.keys.shift?.isDown);
    const crouchHeld =
      Boolean(this.cursors?.down.isDown) ||
      Boolean(this.keys.s?.isDown) ||
      this.virtualCrouch;
    const shootHeld = Boolean(this.keys.space?.isDown) || this.virtualShoot;

    const jumpJustPressed =
      (this.cursors?.up ? Phaser.Input.Keyboard.JustDown(this.cursors.up) : false) ||
      (this.keys.w ? Phaser.Input.Keyboard.JustDown(this.keys.w) : false) ||
      this.virtualJumpQueued;

    this.virtualJumpQueued = false;

    if (jumpJustPressed) {
      this.jumpBufferTimerMs = this.jumpBufferDurationMs;
    } else if (this.jumpBufferTimerMs > 0) {
      this.jumpBufferTimerMs = Math.max(0, this.jumpBufferTimerMs - deltaMs);
    }

    const jumpHeld =
      Boolean(this.cursors?.up.isDown) ||
      Boolean(this.keys.w?.isDown) ||
      this.virtualJumpHeld;

    const pauseJustPressed =
      (this.keys.esc ? Phaser.Input.Keyboard.JustDown(this.keys.esc) : false) ||
      (this.keys.p ? Phaser.Input.Keyboard.JustDown(this.keys.p) : false);

    return {
      moveX,
      running,
      crouchHeld,
      shootHeld,
      jumpHeld,
      jumpBuffered: this.jumpBufferTimerMs > 0,
      pauseJustPressed,
    };
  }

  public destroy(): void {
    window.removeEventListener('blur', this.onBlurHandler);
    if (typeof document !== 'undefined') {
      document.removeEventListener('focusin', this.onFocusInHandler);
      document.removeEventListener('focusout', this.onFocusOutHandler);
    }

    const kb = this.scene.input?.keyboard;
    if (kb) {
      kb.removeAllKeys(true, true);
      kb.clearCaptures();
      kb.disableGlobalCapture();
      kb.enabled = true;
      if (kb.manager) {
        kb.manager.enabled = true;
        kb.manager.preventDefault = false;
        const mgr = kb.manager as Phaser.Input.Keyboard.KeyboardManager & {
          queue?: KeyboardEvent[];
        };
        if (Array.isArray(mgr.queue)) {
          mgr.queue = [];
        }
      }
    }
  }
}
