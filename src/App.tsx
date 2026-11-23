import { useCallback, useEffect, useState } from 'react';
import { AssetInspectorModal } from './components/AssetInspectorModal';
import { GameContainer } from './components/GameContainer';
import { GameHUD } from './components/GameHUD';
import { LevelSelectScreen } from './components/LevelSelectScreen';
import { MainMenu } from './components/MainMenu';
import { PauseMenu } from './components/PauseMenu';
import { QuestionModal } from './components/QuestionModal';
import { SettingsScreen } from './components/SettingsScreen';
import { TeacherModeDashboard } from './components/TeacherModeDashboard';
import { GameBridge } from './game/GameBridge';
import { AudioSystem } from './game/systems/AudioSystem';
import { StorageSystem } from './game/systems/StorageSystem';
import { GoogleSheetsSyncService } from './teacher/googleSheetsSyncService';
import { hydrateTeacherMediaCache } from './teacher/questionMediaStorage';
import {
  AppScreen,
  AssetLoadEntry,
  GameProgress,
  GameSettings,
  HudSnapshot,
  QuizQuestion,
} from './game/types/gameTypes';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  lives: 3,
  maxLives: 3,
  levelId: 'level-01',
  levelNumber: 1,
  levelName: 'Emerald Meadow',
  areaName: 'Forest Entrance',
  gemsCollected: 0,
  totalGems: 0,
  questionsAnswered: 0,
  totalQuestions: 14,
  checkpointReached: 0,
  totalCheckpoints: 2,
  outcome: 'ACTIVE',
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('MAIN_MENU');
  const [returnScreen, setReturnScreen] = useState<AppScreen>('MAIN_MENU');
  const [gameReady, setGameReady] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [assetReport, setAssetReport] = useState<AssetLoadEntry[]>([]);
  const [settings, setSettings] = useState<GameSettings>(() => StorageSystem.loadSettings());
  const [progress, setProgress] = useState<GameProgress>(() => StorageSystem.loadProgress());
  const [activeQuestion, setActiveQuestion] = useState<{
    boxId: string;
    question: QuizQuestion;
  } | null>(null);
  const [loadingError, setLoadingError] = useState<{
    message: string;
    levelId: string;
  } | null>(null);

  useEffect(() => {
    void hydrateTeacherMediaCache();
    GoogleSheetsSyncService.attachAutoOnlineFlush();
  }, []);

  useEffect(() => {
    AudioSystem.syncFromSettings(settings.soundEnabled, settings.sfxVolume);
  }, [settings]);

  useEffect(() => {
    const unsubReady = GameBridge.on('game:ready', ({ scene }) => {
      setGameReady(true);
      if (scene === 'MainMenuScene') {
        setProgress(StorageSystem.loadProgress());
        setActiveQuestion(null);
        setLoadingError(null);
      } else if (scene === 'WorldScene') {
        setLoadingError(null);
        setScreen((curr) => (curr === 'LOADING' ? 'PLAYING' : curr));
      }
    });

    const unsubReport = GameBridge.on('assets:report', (report) => {
      setAssetReport(report);
    });

    const unsubLoadingError = GameBridge.on('loading:error', (payload) => {
      setLoadingError(payload);
    });

    const unsubHud = GameBridge.on('hud:update', (snapshot) => {
      setHud(snapshot);
      if (snapshot.outcome === 'PAUSED') {
        setScreen((curr) => (curr === 'SETTINGS' ? curr : 'PAUSED'));
      } else if (snapshot.outcome === 'ACTIVE') {
        setScreen((curr) => (curr === 'PAUSED' ? 'PLAYING' : curr));
      } else if (snapshot.outcome === 'LEVEL_COMPLETE' || snapshot.outcome === 'GAME_OVER') {
        setActiveQuestion(null);
        setProgress(StorageSystem.loadProgress());
      }
    });

    const unsubQuestion = GameBridge.on('question:open', (payload) => {
      setActiveQuestion(payload);
    });

    return () => {
      unsubReady();
      unsubReport();
      unsubLoadingError();
      unsubHud();
      unsubQuestion();
    };
  }, []);

  const startLevel = useCallback((levelId: string) => {
    AudioSystem.playMenuSelect();
    StorageSystem.clearLevelCheckpoint(levelId);
    setActiveQuestion(null);
    setLoadingError(null);
    setHud({
      ...INITIAL_HUD,
      levelId,
      activeCheckpointName: null,
      outcome: 'ACTIVE',
    });
    setScreen('LOADING');
    GameBridge.emit('game:start-level', { levelId });
  }, []);

  const handlePlay = useCallback(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const requestedStage = params?.get('level') ?? params?.get('stage');
    const targetLevel =
      requestedStage === '2' || requestedStage === 'level-02' ? 'level-02' : 'level-01';
    startLevel(targetLevel);
  }, [startLevel]);

  const handlePause = useCallback(() => {
    if (activeQuestion) return;
    AudioSystem.playMenuSelect();
    GameBridge.emit('game:pause-requested');
    setScreen('PAUSED');
  }, [activeQuestion]);

  const handleResume = useCallback(() => {
    AudioSystem.playMenuSelect();
    GameBridge.emit('game:resume-requested');
    setScreen('PLAYING');
  }, []);

  const handleRespawnAtCheckpoint = useCallback(() => {
    AudioSystem.playMenuSelect();
    setActiveQuestion(null);
    setScreen('PLAYING');
    GameBridge.emit('game:respawn-checkpoint');
  }, []);

  const handleRestart = useCallback(() => {
    AudioSystem.playMenuSelect();
    setActiveQuestion(null);
    setScreen('PLAYING');
    GameBridge.emit('game:restart-requested');
  }, []);

  const handleExitToMenu = useCallback(() => {
    AudioSystem.playMenuSelect();
    StorageSystem.clearLevelCheckpoint(hud.levelId);
    setActiveQuestion(null);
    setScreen('MAIN_MENU');
    GameBridge.emit('game:enter-menu');
  }, [hud.levelId]);

  const handleQuestionComplete = useCallback(
    (isCorrect: boolean, answerPayload?: string) => {
      if (!activeQuestion) return;
      const { boxId, question } = activeQuestion;
      setActiveQuestion(null);
      GameBridge.emit('question:resolved', {
        boxId,
        questionId: question.id,
        isCorrect,
        rewardScore: isCorrect ? question.rewardScore : 0,
        answerPayload,
      });
    },
    [activeQuestion]
  );

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    StorageSystem.saveSettings(next);
    AudioSystem.syncFromSettings(next.soundEnabled, next.sfxVolume);
  }, []);

  const handleToggleSound = useCallback(() => {
    handleUpdateSettings({
      ...settings,
      soundEnabled: !settings.soundEnabled,
    });
  }, [handleUpdateSettings, settings]);

  const handleResetProgress = useCallback(() => {
    AudioSystem.playMenuSelect();
    const fresh = StorageSystem.resetProgress();
    setProgress(fresh);
  }, []);

  const openSettingsFrom = useCallback((origin: AppScreen) => {
    AudioSystem.playMenuSelect();
    setReturnScreen(origin);
    setScreen('SETTINGS');
  }, []);

  const showPlayingHud =
    screen === 'PLAYING' ||
    screen === 'PAUSED' ||
    (screen === 'SETTINGS' && returnScreen === 'PAUSED') ||
    (screen === 'LEVEL_SELECT' && returnScreen === 'PAUSED');

  const showPauseModal =
    screen === 'PAUSED' ||
    (screen === 'PLAYING' &&
      (hud.outcome === 'LEVEL_COMPLETE' || hud.outcome === 'GAME_OVER'));

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#070d18]">
      {/* Centered 16:9 Game Viewport Shell */}
      <div className="relative aspect-video w-full max-h-screen max-w-[calc(100vh*16/9)] overflow-hidden border-y-2 sm:border-2 border-slate-700/80 bg-[#0b1322] shadow-2xl">
        <GameContainer />

        {screen === 'MAIN_MENU' && (
          <MainMenu
            ready={gameReady}
            onPlay={handlePlay}
            onOpenTeacherMode={() => {
              AudioSystem.playMenuSelect();
              setScreen('TEACHER_MODE');
            }}
          />
        )}

        {screen === 'TEACHER_MODE' && (
          <TeacherModeDashboard
            onBack={() => {
              AudioSystem.playMenuSelect();
              setScreen('MAIN_MENU');
            }}
          />
        )}

        {screen === 'LOADING' && loadingError && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Kesalahan Memuat Permainan"
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
          >
            <div className="pixel-panel w-full max-w-md p-5 text-left space-y-3 border-2 border-rose-400">
              <h2 className="font-pixel-display text-sm text-rose-300">
                GAGAL MEMUAT PERMAINAN
              </h2>
              <p className="text-xs leading-relaxed text-slate-200">
                {loadingError.message}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const lvl = loadingError.levelId;
                    setLoadingError(null);
                    GameBridge.emit('game:retry-load', { levelId: lvl });
                  }}
                  className="flex-1 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold border-2 border-white px-3 py-2 text-xs cursor-pointer"
                >
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingError(null);
                    setScreen('MAIN_MENU');
                    GameBridge.emit('game:enter-menu');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold border-2 border-slate-400 px-3 py-2 text-xs cursor-pointer"
                >
                  Kembali ke Halaman Awal
                </button>
              </div>
            </div>
          </div>
        )}

        {showPlayingHud && (
          <GameHUD
            hud={hud}
            soundEnabled={settings.soundEnabled}
            showControlHints={settings.showControlHints}
            onToggleSound={handleToggleSound}
            onPause={handlePause}
          />
        )}

        {showPauseModal && (
          <PauseMenu
            hud={hud}
            onResume={handleResume}
            onRespawnAtCheckpoint={handleRespawnAtCheckpoint}
            onRestart={handleRestart}
            onNextStage={
              hud.levelId === 'level-01' ? () => startLevel('level-02') : undefined
            }
            onOpenLevelSelect={() => {
              AudioSystem.playMenuSelect();
              setReturnScreen(
                hud.outcome === 'LEVEL_COMPLETE' || hud.outcome === 'GAME_OVER'
                  ? 'PLAYING'
                  : 'PAUSED'
              );
              setScreen('LEVEL_SELECT');
            }}
            onOpenSettings={() => openSettingsFrom('PAUSED')}
            onExitToMenu={handleExitToMenu}
          />
        )}

        {screen === 'PLAYING' && activeQuestion && (
          <QuestionModal
            question={activeQuestion.question}
            onComplete={handleQuestionComplete}
          />
        )}

        {screen === 'LEVEL_SELECT' && (
          <LevelSelectScreen
            progress={progress}
            onSelectLevel={startLevel}
            onBack={() => {
              AudioSystem.playMenuSelect();
              setScreen(returnScreen);
            }}
          />
        )}

        {screen === 'SETTINGS' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetProgress={handleResetProgress}
            onBack={() => {
              AudioSystem.playMenuSelect();
              setScreen(returnScreen);
            }}
          />
        )}

        {screen === 'ASSET_INSPECTOR' && (
          <AssetInspectorModal
            report={assetReport}
            onClose={() => {
              AudioSystem.playMenuSelect();
              setScreen('MAIN_MENU');
            }}
          />
        )}
      </div>
    </main>
  );
}
