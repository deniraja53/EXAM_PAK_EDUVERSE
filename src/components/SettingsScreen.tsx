import { ArrowLeft, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { GameSettings } from '../game/types/gameTypes';

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  onUpdateSettings,
  onResetProgress,
  onBack,
}: SettingsScreenProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="pixel-panel w-full max-w-lg p-6">
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4 mb-5">
          <div>
            <h2 className="font-pixel-display text-base sm:text-lg text-amber-300">SETTINGS</h2>
            <p className="mt-1 text-xs text-slate-400">Saved automatically to Local Storage</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="pixel-btn flex items-center gap-1.5 bg-[#16233d] hover:bg-[#1e3054] border-2 border-slate-300 px-3 py-2 text-xs text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>BACK</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between gap-4 bg-[#091120] border-2 border-slate-700 p-3.5">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? (
                <Volume2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <VolumeX className="h-5 w-5 text-rose-400" />
              )}
              <div>
                <p className="font-pixel-ui text-xs text-slate-100">SOUND EFFECTS</p>
                <p className="text-xs text-slate-400">Retro chiptune jumps, pickups & chimes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className={`pixel-btn px-4 py-2 text-xs font-bold border-2 ${
                settings.soundEnabled
                  ? 'bg-emerald-500 text-slate-950 border-slate-100'
                  : 'bg-slate-800 text-slate-300 border-slate-500'
              }`}
            >
              {settings.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="bg-[#091120] border-2 border-slate-700 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sfx-volume" className="font-pixel-ui text-xs text-slate-100">
                SFX VOLUME
              </label>
              <span className="font-mono-num text-xs font-bold text-amber-300">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              id="sfx-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.sfxVolume * 100)}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  sfxVolume: Number(e.target.value) / 100,
                })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Control Hints Toggle */}
          <div className="flex items-center justify-between gap-4 bg-[#091120] border-2 border-slate-700 p-3.5">
            <div>
              <p className="font-pixel-ui text-xs text-slate-100">HUD CONTROL HINTS</p>
              <p className="text-xs text-slate-400">Display movement keys along bottom border</p>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  showControlHints: !settings.showControlHints,
                })
              }
              className={`pixel-btn px-4 py-2 text-xs font-bold border-2 ${
                settings.showControlHints
                  ? 'bg-emerald-500 text-slate-950 border-slate-100'
                  : 'bg-slate-800 text-slate-300 border-slate-500'
              }`}
            >
              {settings.showControlHints ? 'SHOWN' : 'HIDDEN'}
            </button>
          </div>

          {/* Pixel Snap Camera Toggle */}
          <div className="flex items-center justify-between gap-4 bg-[#091120] border-2 border-slate-700 p-3.5">
            <div>
              <p className="font-pixel-ui text-xs text-slate-100">PIXEL-SNAP CAMERA</p>
              <p className="text-xs text-slate-400">Round camera coordinates to crisp pixels</p>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  pixelSnapCamera: !settings.pixelSnapCamera,
                })
              }
              className={`pixel-btn px-4 py-2 text-xs font-bold border-2 ${
                settings.pixelSnapCamera
                  ? 'bg-emerald-500 text-slate-950 border-slate-100'
                  : 'bg-slate-800 text-slate-300 border-slate-500'
              }`}
            >
              {settings.pixelSnapCamera ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Reset Progress */}
          <div className="flex items-center justify-between gap-4 border-t-2 border-slate-700 pt-4">
            <div>
              <p className="font-pixel-ui text-xs text-rose-300">LOCAL PROGRESS DATA</p>
              <p className="text-xs text-slate-400">Clear saved high scores and level records</p>
            </div>
            <button
              type="button"
              onClick={onResetProgress}
              className="pixel-btn flex items-center gap-1.5 bg-rose-950 hover:bg-rose-900 border-2 border-rose-400 px-3.5 py-2 text-xs text-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>RESET</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
