import { StorageSystem } from './StorageSystem';

/**
 * Lightweight 8-bit/16-bit procedural Web Audio API synthesizer.
 * Zero external audio assets needed; respects localStorage mute/volume settings.
 */
class RetroAudioSynth {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.7;

  constructor() {
    const settings = StorageSystem.loadSettings();
    this.enabled = settings.soundEnabled;
    this.volume = settings.sfxVolume;
  }

  public syncFromSettings(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.volume <= 0) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    gainScale = 0.2,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
    }

    const peak = Math.max(0.001, gainScale * this.volume);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }

  public playJump(): void {
    this.playTone(260, 560, 0.13, 'square', 0.12);
  }

  public playLand(): void {
    this.playTone(130, 75, 0.06, 'triangle', 0.14);
  }

  public playGem(): void {
    this.playTone(660, 660, 0.07, 'square', 0.12, 0);
    this.playTone(990, 990, 0.11, 'square', 0.12, 0.06);
  }

  public playCheckpoint(): void {
    this.playTone(523.25, 523.25, 0.09, 'square', 0.12, 0);
    this.playTone(659.25, 659.25, 0.09, 'square', 0.12, 0.08);
    this.playTone(783.99, 783.99, 0.14, 'square', 0.14, 0.16);
  }

  public playHurt(): void {
    this.playTone(240, 95, 0.22, 'sawtooth', 0.16);
  }

  public playHeartShoot(): void {
    this.playTone(520, 780, 0.08, 'triangle', 0.13);
  }

  public playMenuSelect(): void {
    this.playTone(440, 580, 0.06, 'square', 0.09);
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.14, 'square', 0.14, idx * 0.09);
    });
  }
}

export const AudioSystem = new RetroAudioSynth();
