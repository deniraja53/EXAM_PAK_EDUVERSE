import { ArrowLeft, CheckCircle2, Lock, Play } from 'lucide-react';
import { LEVEL_REGISTRY } from '../game/levels/levelRegistry';
import { GameProgress } from '../game/types/gameTypes';

interface LevelSelectScreenProps {
  progress: GameProgress;
  onSelectLevel: (levelId: string) => void;
  onBack: () => void;
}

export function LevelSelectScreen({
  progress,
  onSelectLevel,
  onBack,
}: LevelSelectScreenProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Level Selection"
    >
      <div className="pixel-panel w-full max-w-2xl p-6">
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4 mb-5">
          <div>
            <h2 className="font-pixel-display text-base sm:text-lg text-amber-300">
              LEVEL SELECTION
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a stage to launch Deni&apos;s adventure
            </p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVEL_REGISTRY.map((level) => {
            const isUnlocked =
              level.unlockedByDefault || progress.unlockedLevelIds.includes(level.id);
            const isCompleted = progress.completedLevels.includes(level.id);
            const bestScore = progress.bestScores[level.id] ?? 0;

            return (
              <div
                key={level.id}
                className={`flex flex-col justify-between border-2 p-4 ${
                  isUnlocked
                    ? 'bg-[#091120] border-emerald-400/80'
                    : 'bg-[#0a0f1c] border-slate-700 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-pixel-ui text-xs text-amber-300">
                      STAGE 0{level.number}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center gap-1 font-pixel-ui text-[11px] text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        CLEARED
                      </span>
                    ) : !isUnlocked ? (
                      <span className="flex items-center gap-1 font-pixel-ui text-[11px] text-slate-400">
                        <Lock className="h-3.5 w-3.5" />
                        PHASE 02
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-pixel-display text-sm text-slate-100 mb-1.5">
                    {level.name}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-400 mb-4">
                    {level.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-700/80 pt-3">
                  <div className="text-xs">
                    <span className="text-slate-400">BEST </span>
                    <span className="font-mono-num font-bold text-amber-300">{bestScore}</span>
                  </div>

                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectLevel(level.id)}
                      className="pixel-btn flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-2 border-slate-100 px-4 py-2 text-xs shadow-[0_3px_0_#064e3b]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>PLAY</span>
                    </button>
                  ) : (
                    <span className="font-pixel-ui text-[11px] text-slate-500">
                      COMING NEXT
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
