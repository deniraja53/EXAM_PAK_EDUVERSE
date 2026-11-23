import { ArrowRight, Flag, Home, Map, Play, RotateCcw, Settings, Trophy } from 'lucide-react';
import { HudSnapshot } from '../game/types/gameTypes';

interface PauseMenuProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRespawnAtCheckpoint?: () => void;
  onRestart: () => void;
  onNextStage?: () => void;
  onOpenLevelSelect?: () => void;
  onOpenSettings: () => void;
  onExitToMenu: () => void;
}

export function PauseMenu({
  hud,
  onResume,
  onRespawnAtCheckpoint,
  onRestart,
  onNextStage,
  onOpenLevelSelect,
  onOpenSettings,
  onExitToMenu,
}: PauseMenuProps) {
  const isVictory = hud.outcome === 'LEVEL_COMPLETE';
  const isGameOver = hud.outcome === 'GAME_OVER';
  const isStage2 = hud.levelId === 'level-02';
  const hasActiveCheckpoint = Boolean(hud.activeCheckpointName);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Level Complete' : isGameOver ? 'Game Over' : 'Game Paused'}
    >
      <div className="pixel-panel w-full max-w-md p-6 text-center">
        <div className="mb-4">
          {isVictory ? (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-emerald-500/20 border-2 border-emerald-400">
              <Trophy className="h-6 w-6 text-amber-300" />
            </div>
          ) : null}

          <h2 className="font-pixel-display text-lg sm:text-xl text-amber-300 tracking-wide">
            {isVictory
              ? isStage2
                ? 'SAVANNA SUNLAND CLEARED!'
                : 'EMERALD GATE CLEARED!'
              : isGameOver
                ? 'TRY AGAIN!'
                : 'PAUSED'}
          </h2>
          <p className="mt-2 font-pixel-ui text-xs text-slate-300">
            STAGE 0{hud.levelNumber} · {hud.levelName}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 bg-[#091120] border-2 border-slate-600 p-3 text-left">
          <div>
            <p className="font-pixel-ui text-[11px] text-slate-400">SCORE</p>
            <p className="font-mono-num text-base font-bold text-emerald-300">{hud.score}</p>
          </div>
          {hud.totalGems > 0 ? (
            <div>
              <p className="font-pixel-ui text-[11px] text-slate-400">GEMS</p>
              <p className="font-mono-num text-base font-bold text-amber-300">
                {hud.gemsCollected}/{hud.totalGems}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-pixel-ui text-[11px] text-slate-400">QUESTION BOXES</p>
              <p className="font-mono-num text-base font-bold text-amber-300">
                {hud.questionsAnswered}/{hud.totalQuestions}
              </p>
            </div>
          )}
        </div>

        {isGameOver && hasActiveCheckpoint && (
          <div className="mb-4 flex items-center justify-center gap-2 bg-emerald-950/80 border-2 border-emerald-400 px-3 py-2 text-xs text-emerald-200">
            <Flag className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>
              Checkpoint aktif: <strong>{hud.activeCheckpointName}</strong>
            </span>
          </div>
        )}

        {isVictory && (
          <p className="mb-5 text-xs leading-relaxed text-slate-300">
            {isStage2
              ? 'Stage 2 Savanna Sunland selesai! Gerbang menuju Stage 3 telah terbuka.'
              : hud.totalGems > 0
                ? `Stage 1 selesai! Lanjut ke Stage 2: Savanna Sunland atau ulangi untuk mengumpulkan semua ${hud.totalGems} gem.`
                : `Stage 1 selesai! Lanjut ke Stage 2: Savanna Sunland atau ulangi untuk menjawab semua ${hud.totalQuestions} Question Box.`}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {isVictory && !isStage2 && onNextStage && (
            <button
              type="button"
              onClick={onNextStage}
              className="pixel-btn flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold border-2 border-white px-5 py-3 text-xs shadow-[0_3px_0_#064e3b] cursor-pointer"
            >
              <span>LANJUT KE STAGE 2: SAVANNA SUNLAND</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {!isVictory && !isGameOver && (
            <button
              type="button"
              onClick={onResume}
              className="pixel-btn flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-2 border-slate-100 px-5 py-3 text-xs shadow-[0_3px_0_#064e3b]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>RESUME GAME (ESC)</span>
            </button>
          )}

          {isGameOver && hasActiveCheckpoint && onRespawnAtCheckpoint && (
            <button
              type="button"
              onClick={onRespawnAtCheckpoint}
              className="pixel-btn flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold border-2 border-white px-5 py-3 text-xs shadow-[0_3px_0_#064e3b] cursor-pointer"
            >
              <Flag className="h-4 w-4" />
              <span>LANJUT DARI CHECKPOINT</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="pixel-btn flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold border-2 border-slate-100 px-5 py-3 text-xs shadow-[0_3px_0_#78350f] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>
              {isVictory
                ? 'PLAY AGAIN'
                : isGameOver && hasActiveCheckpoint
                  ? 'ULANG DARI AWAL'
                  : isGameOver
                    ? 'PLAY AGAIN'
                    : 'RESTART LEVEL'}
            </span>
          </button>

          {onOpenLevelSelect && (
            <button
              type="button"
              onClick={onOpenLevelSelect}
              className="pixel-btn flex items-center justify-center gap-2 bg-[#16233d] hover:bg-[#1e3054] text-amber-200 border-2 border-amber-300/70 px-5 py-3 text-xs cursor-pointer"
            >
              <Map className="h-4 w-4 text-amber-300" />
              <span>PILIH STAGE (STAGE 1 / 2)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="pixel-btn flex items-center justify-center gap-2 bg-[#16233d] hover:bg-[#1e3054] text-slate-100 border-2 border-slate-300 px-5 py-3 text-xs cursor-pointer"
          >
            <Settings className="h-4 w-4 text-sky-300" />
            <span>SETTINGS</span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="pixel-btn flex items-center justify-center gap-2 bg-[#101829] hover:bg-[#1b2740] text-slate-300 border-2 border-slate-500 px-5 py-3 text-xs cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
}
