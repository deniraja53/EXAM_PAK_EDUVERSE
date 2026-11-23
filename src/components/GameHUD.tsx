import { Heart, Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types/gameTypes';

interface GameHUDProps {
  hud: HudSnapshot;
  soundEnabled: boolean;
  showControlHints: boolean;
  onToggleSound: () => void;
  onPause: () => void;
}

export function GameHUD({
  hud,
  soundEnabled,
  showControlHints,
  onToggleSound,
  onPause,
}: GameHUDProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Perimeter HUD Bar — Low-occlusion, no backdrop-blur */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Lives & Level */}
        <div className="flex flex-wrap items-center gap-3 bg-[#0b1322]/90 border-2 border-slate-200 px-3 py-2 shadow-[0_3px_0_#040812]">
          <div className="flex items-center gap-1.5" aria-label={`Lives: ${hud.lives} of ${hud.maxLives}`}>
            {Array.from({ length: hud.maxLives }).map((_, idx) => {
              const filled = idx < hud.lives;
              return (
                <Heart
                  key={idx}
                  className={`h-4 w-4 ${
                    filled
                      ? 'fill-rose-500 text-rose-400'
                      : 'fill-slate-800 text-slate-600'
                  }`}
                />
              );
            })}
            <span className="ml-1 font-mono-num text-xs font-bold text-slate-100">
              x{hud.lives}
            </span>
          </div>

          <span className="text-slate-500" aria-hidden="true">
            |
          </span>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-pixel-ui text-amber-300 whitespace-nowrap">
              LVL 0{hud.levelNumber}
            </span>
            <span className="hidden sm:inline font-pixel-ui text-slate-200 whitespace-nowrap">
              {hud.areaName || hud.levelName}
            </span>
          </div>
        </div>

        {/* Top-Right: Score, Gems, Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3 bg-[#0b1322]/90 border-2 border-slate-200 px-3 py-2 shadow-[0_3px_0_#040812]">
            {hud.totalGems > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-pixel-ui text-[11px] text-slate-400">GEMS</span>
                <span className="font-mono-num text-xs font-bold text-amber-300">
                  {hud.gemsCollected}/{hud.totalGems}
                </span>
              </div>
            )}

            {hud.totalQuestions > 0 && (
              <>
                {hud.totalGems > 0 && (
                  <span className="text-slate-500" aria-hidden="true">
                    |
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="font-pixel-ui text-[11px] text-slate-400">QUIZ</span>
                  <span className="font-mono-num text-xs font-bold text-amber-300">
                    {hud.questionsAnswered}/{hud.totalQuestions}
                  </span>
                </div>
              </>
            )}

            <span className="text-slate-500" aria-hidden="true">
              |
            </span>

            <div className="flex items-center gap-1.5">
              <span className="font-pixel-ui text-[11px] text-slate-400">SCORE</span>
              <span className="font-mono-num text-xs font-bold text-emerald-300">
                {String(hud.score).padStart(5, '0')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute audio' : 'Unmute audio'}
            className="pointer-events-auto pixel-btn flex h-9 w-9 items-center justify-center bg-[#0b1322]/90 border-2 border-slate-200 text-slate-100 hover:border-amber-300 hover:text-amber-300 shadow-[0_3px_0_#040812] focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-400" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="pointer-events-auto pixel-btn flex h-9 items-center gap-1.5 bg-[#0b1322]/90 border-2 border-slate-200 px-3 text-xs text-slate-100 hover:border-amber-300 hover:text-amber-300 shadow-[0_3px_0_#040812] focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap"
          >
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PAUSE</span>
          </button>
        </div>
      </div>

      {/* Bottom Quiet Controls Hint */}
      {showControlHints && hud.outcome === 'ACTIVE' && (
        <div className="flex justify-center">
          <p className="bg-[#0b1322]/80 border border-slate-600/80 px-3 py-1 font-pixel-ui text-[11px] tracking-wide text-slate-200">
            A / D or Arrows Move · S / Down Crouch · W / Up Jump · Space Shoot · Shift Run · Esc Pause
          </p>
        </div>
      )}
    </div>
  );
}
