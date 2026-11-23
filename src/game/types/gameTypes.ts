export type AppScreen =
  | 'MAIN_MENU'
  | 'LOADING'
  | 'TEACHER_MODE'
  | 'PLAYING'
  | 'PAUSED'
  | 'SETTINGS'
  | 'LEVEL_SELECT'
  | 'ASSET_INSPECTOR';

export type PlayOutcome =
  | 'ACTIVE'
  | 'PAUSED'
  | 'QUESTION'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER';

export type QuestionModelType =
  | 'pilihan_ganda'
  | 'pilihan_ganda_kompleks'
  | 'benar_salah'
  | 'menjodohkan'
  | 'isian_singkat'
  | 'uraian';

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  region: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rewardScore: number;
  modelType?: QuestionModelType;
  correctIndices?: number[];
  correctText?: string | null;
  matchingPairs?: MatchingPair[];
  rubric?: string | null;
  sourceBankQuestionId?: string;
  originalNumber?: string;
  sourceDocument?: string;
  needsReview?: boolean;
  image?: string | null;
  imageAlt?: string | null;
}

export interface GameSettings {
  soundEnabled: boolean;
  sfxVolume: number; // 0 to 1
  showControlHints: boolean;
  pixelSnapCamera: boolean;
}

export interface GameProgress {
  unlockedLevelIds: string[];
  highScore: number;
  bestScores: Record<string, number>;
  completedLevels: string[];
}

export interface PlayerProfile {
  name: string;
  school: string;
}

export interface ActiveCheckpointState {
  levelId: string;
  checkpointId: string;
  name: string;
  x: number;
  y: number;
  activatedIds: string[];
}

export interface HudSnapshot {
  score: number;
  lives: number;
  maxLives: number;
  levelId: string;
  levelNumber: number;
  levelName: string;
  areaName: string;
  gemsCollected: number;
  totalGems: number;
  questionsAnswered: number;
  totalQuestions: number;
  checkpointReached: number;
  totalCheckpoints: number;
  activeCheckpointName?: string | null;
  outcome: PlayOutcome;
}

export interface AssetLoadEntry {
  key: string;
  label: string;
  category: 'characters' | 'tilesets' | 'platforms' | 'decorations';
  path: string;
  expectedWidth: number;
  expectedHeight: number;
  loaded: boolean;
  error: string | null;
  naturalWidth: number;
  naturalHeight: number;
  frameCount: number;
}

export interface SpriteFrameSpec {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional collision inset in source-PNG pixels */
  collider?: {
    topInset: number;
    bottomInset: number;
    leftInset: number;
    rightInset: number;
  };
}
