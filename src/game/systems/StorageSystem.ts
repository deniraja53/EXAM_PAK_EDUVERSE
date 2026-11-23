import {
  ActiveCheckpointState,
  GameProgress,
  GameSettings,
  PlayerProfile,
} from '../types/gameTypes';

const SETTINGS_KEY = 'exam_eduverse_settings_v1';
const PROGRESS_KEY = 'exam_eduverse_progress_v1';
const PLAYER_PROFILE_KEY = 'exam_eduverse_player_v1';
const CHECKPOINTS_KEY = 'exam_eduverse_checkpoints_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  sfxVolume: 0.7,
  showControlHints: true,
  pixelSnapCamera: true,
};

export const DEFAULT_PROGRESS: GameProgress = {
  unlockedLevelIds: ['level-01'],
  highScore: 0,
  bestScores: {},
  completedLevels: [],
};

function readCheckpointMap(): Record<string, ActiveCheckpointState> {
  try {
    const raw = window.localStorage.getItem(CHECKPOINTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, ActiveCheckpointState>;
  } catch {
    return {};
  }
}

function writeCheckpointMap(map: Record<string, ActiveCheckpointState>): void {
  try {
    window.localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export const StorageSystem = {
  loadSettings(): GameSettings {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        soundEnabled:
          typeof parsed.soundEnabled === 'boolean'
            ? parsed.soundEnabled
            : DEFAULT_SETTINGS.soundEnabled,
        sfxVolume:
          typeof parsed.sfxVolume === 'number'
            ? Math.max(0, Math.min(1, parsed.sfxVolume))
            : DEFAULT_SETTINGS.sfxVolume,
        showControlHints:
          typeof parsed.showControlHints === 'boolean'
            ? parsed.showControlHints
            : DEFAULT_SETTINGS.showControlHints,
        pixelSnapCamera:
          typeof parsed.pixelSnapCamera === 'boolean'
            ? parsed.pixelSnapCamera
            : DEFAULT_SETTINGS.pixelSnapCamera,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings: GameSettings): void {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  },

  loadProgress(): GameProgress {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { ...DEFAULT_PROGRESS };
      const parsed = JSON.parse(raw) as Partial<GameProgress>;
      return {
        unlockedLevelIds: Array.isArray(parsed.unlockedLevelIds)
          ? parsed.unlockedLevelIds
          : [...DEFAULT_PROGRESS.unlockedLevelIds],
        highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
        bestScores:
          parsed.bestScores && typeof parsed.bestScores === 'object'
            ? parsed.bestScores
            : {},
        completedLevels: Array.isArray(parsed.completedLevels)
          ? parsed.completedLevels
          : [],
      };
    } catch {
      return { ...DEFAULT_PROGRESS };
    }
  },

  saveLevelScore(levelId: string, score: number, completed: boolean): GameProgress {
    const progress = this.loadProgress();
    const prevBest = progress.bestScores[levelId] ?? 0;
    if (score > prevBest) {
      progress.bestScores[levelId] = score;
    }
    if (score > progress.highScore) {
      progress.highScore = score;
    }
    if (completed && !progress.completedLevels.includes(levelId)) {
      progress.completedLevels.push(levelId);
    }
    if (completed && levelId === 'level-01' && !progress.unlockedLevelIds.includes('level-02')) {
      progress.unlockedLevelIds.push('level-02');
    }
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage errors
    }
    return progress;
  },

  resetProgress(): GameProgress {
    const fresh = { ...DEFAULT_PROGRESS, unlockedLevelIds: ['level-01'], bestScores: {}, completedLevels: [] };
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore storage errors
    }
    return fresh;
  },

  loadPlayerProfile(): PlayerProfile {
    try {
      const raw = window.localStorage.getItem(PLAYER_PROFILE_KEY);
      if (!raw) return { name: '', school: '' };
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        school: typeof parsed.school === 'string' ? parsed.school : '',
      };
    } catch {
      return { name: '', school: '' };
    }
  },

  savePlayerProfile(profile: PlayerProfile): void {
    try {
      window.localStorage.setItem(
        PLAYER_PROFILE_KEY,
        JSON.stringify({
          name: profile.name.trim(),
          school: profile.school.trim(),
        })
      );
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  },

  loadLevelCheckpoint(levelId: string): ActiveCheckpointState | null {
    const map = readCheckpointMap();
    const entry = map[levelId];
    if (
      !entry ||
      entry.levelId !== levelId ||
      typeof entry.checkpointId !== 'string' ||
      typeof entry.x !== 'number' ||
      typeof entry.y !== 'number'
    ) {
      return null;
    }
    return {
      levelId: entry.levelId,
      checkpointId: entry.checkpointId,
      name: typeof entry.name === 'string' ? entry.name : entry.checkpointId,
      x: entry.x,
      y: entry.y,
      activatedIds: Array.isArray(entry.activatedIds)
        ? entry.activatedIds.filter((id): id is string => typeof id === 'string')
        : [entry.checkpointId],
    };
  },

  saveLevelCheckpoint(levelId: string, state: ActiveCheckpointState): void {
    const map = readCheckpointMap();
    map[levelId] = {
      levelId,
      checkpointId: state.checkpointId,
      name: state.name,
      x: state.x,
      y: state.y,
      activatedIds: [...state.activatedIds],
    };
    writeCheckpointMap(map);
  },

  clearLevelCheckpoint(levelId: string): void {
    const map = readCheckpointMap();
    if (levelId in map) {
      delete map[levelId];
      writeCheckpointMap(map);
    }
  },
};
