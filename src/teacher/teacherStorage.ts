import { LEVEL_01_QUESTIONS } from '../game/data/level01Questions';
import { LEVEL_02_QUESTIONS } from '../game/data/level02Questions';
import { getLevelById } from '../game/levels/levelRegistry';
import { QuestionModelType, QuizQuestion } from '../game/types/gameTypes';
import {
  computeDetectedDistribution,
  evaluateQuestionAnswerKey,
  formatCanonicalQuestionId,
} from './questionClassifier';
import {
  clearAllQuestionImagesFromMediaStore,
  IDB_IMAGE_PREFIX,
  removeQuestionImageFromMediaStore,
  resolveQuestionImage,
  saveQuestionImageToMediaStore,
  setCachedQuestionImage,
} from './questionMediaStorage';
import {
  GoogleSheetsSyncService,
  SyncOperationOutcome,
} from './googleSheetsSyncService';
import {
  ActivityLogRecord,
  DistributionSummary,
  ExamConfigRecord,
  ExamResultRecord,
  QUESTION_MODEL_LABELS,
  QUESTION_MODEL_ORDER,
  QuestionDistributionMap,
  StageBoxDiagnosticMapping,
  StageDistributionValidation,
  StageQuestionDistribution,
  StudentAnswerRecord,
  StudentRecord,
  TeacherBankQuestion,
  TeacherPinConfig,
  TeacherStoreSnapshot,
} from './teacherTypes';

const TEACHER_PIN_KEY = 'exam_eduverse_teacher_pin_v1';
const TEACHER_STORE_KEY = 'exam_eduverse_teacher_store_v1';
export const STAGE_IDS = ['level-01', 'level-02'] as const;

export function getStageBoxIds(levelId: string): string[] {
  const level = getLevelById(levelId);
  if (level.id !== levelId) return [];
  return (level.questionBoxes ?? []).map((box) => box.id);
}

export function createEmptyStageDistribution(): StageQuestionDistribution {
  return {
    'level-01': [],
    'level-02': [],
  };
}

function normalizeBankQuestion(q: TeacherBankQuestion): TeacherBankQuestion {
  const prompt = (q.prompt ?? q.question ?? '').trim();
  const type = q.type ?? q.questionType ?? 'pilihan_ganda';
  const resolvedImage = resolveQuestionImage(q.id, q.image);
  const imageValue =
    resolvedImage ??
    (typeof q.image === 'string' && q.image.startsWith(IDB_IMAGE_PREFIX)
      ? q.image
      : null);
  if (resolvedImage) {
    setCachedQuestionImage(q.id, resolvedImage);
  }
  const normalizedCorrectAnswer =
    type === 'benar_salah' && typeof (q.correctAnswer as unknown) === 'boolean'
      ? (q.correctAnswer as unknown as boolean)
        ? 'Benar'
        : 'Salah'
      : q.correctAnswer;
  const base: TeacherBankQuestion = {
    ...q,
    type,
    prompt,
    question: prompt,
    questionType: type,
    correctAnswer: normalizedCorrectAnswer,
    explanation: q.explanation ?? null,
    rubric: q.rubric ?? (type === 'uraian' && typeof q.correctAnswer === 'string' ? q.correctAnswer : null),
    answerKeySource: q.answerKeySource ?? null,
    options: Array.isArray(q.options) ? q.options : [],
    matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : [],
    image: imageValue,
    imageAlt: q.imageAlt ?? null,
    imageUrl: q.imageUrl ?? null,
    imageFileId: q.imageFileId ?? null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
  if (!base.answerKeyStatus) {
    base.answerKeyStatus = evaluateQuestionAnswerKey(base).answerKeyStatus;
  }
  return base;
}

export function generateNextBankQuestionId(
  questions: TeacherBankQuestion[]
): string {
  let maxNum = 0;
  for (const q of questions) {
    const match = q.id.match(/^Q(\d+)$/i);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return formatCanonicalQuestionId(maxNum + 1);
}

function trimTrailingEmptySlots(ids: string[]): string[] {
  let end = ids.length;
  while (end > 0 && !ids[end - 1]) {
    end -= 1;
  }
  return ids.slice(0, end);
}

export function validateStageDistribution(
  stageDistribution: StageQuestionDistribution | undefined,
  questionBank: TeacherBankQuestion[]
): StageDistributionValidation {
  const errors: string[] = [];
  const duplicateIds = new Set<string>();
  const missingIds = new Set<string>();
  const bankById = new Map(questionBank.map((q) => [q.id, q]));
  const globalSeen = new Set<string>();

  for (const stageId of STAGE_IDS) {
    const ids = Array.isArray(stageDistribution?.[stageId]) ? stageDistribution[stageId] : [];
    const capacity = getStageBoxIds(stageId).length;
    if (ids.length > capacity) {
      errors.push(
        `Distribusi ${stageId} (${ids.length} slot) melebihi kapasitas ${capacity} Question Box.`
      );
    }

    const stageSeen = new Set<string>();
    for (const rawId of ids) {
      const qId = typeof rawId === 'string' ? rawId.trim() : '';
      if (!qId) continue;

      if (stageSeen.has(qId)) {
        duplicateIds.add(qId);
        errors.push(`Duplikasi ID soal "${qId}" di dalam ${stageId}.`);
      }
      stageSeen.add(qId);

      if (globalSeen.has(qId)) {
        duplicateIds.add(qId);
        errors.push(`ID soal "${qId}" dipakai di lebih dari satu stage.`);
      }
      globalSeen.add(qId);

      const item = bankById.get(qId);
      if (!item) {
        missingIds.add(qId);
        errors.push(`ID soal "${qId}" pada ${stageId} tidak ditemukan di questionBank.`);
      } else if (!item.enabled) {
        missingIds.add(qId);
        errors.push(`ID soal "${qId}" pada ${stageId} berstatus nonaktif.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    duplicateIds: Array.from(duplicateIds),
    missingIds: Array.from(missingIds),
  };
}

export function sanitizeStageDistribution(
  stageDistribution: StageQuestionDistribution | undefined,
  questionBank: TeacherBankQuestion[]
): StageQuestionDistribution {
  const result = createEmptyStageDistribution();
  const bankById = new Map(questionBank.map((q) => [q.id, q]));
  const seen = new Set<string>();

  for (const stageId of STAGE_IDS) {
    const rawIds = Array.isArray(stageDistribution?.[stageId]) ? stageDistribution[stageId] : [];
    const capacity = getStageBoxIds(stageId).length;
    const cleanSlots: string[] = [];

    for (let i = 0; i < rawIds.length && i < capacity; i++) {
      const rawId = rawIds[i];
      const qId = typeof rawId === 'string' ? rawId.trim() : '';
      if (!qId || seen.has(qId)) {
        cleanSlots.push('');
        continue;
      }
      const bankItem = bankById.get(qId);
      if (!bankItem || !bankItem.enabled) {
        cleanSlots.push('');
        continue;
      }
      seen.add(qId);
      cleanSlots.push(qId);
    }

    result[stageId] = trimTrailingEmptySlots(cleanSlots);
  }

  return result;
}

export function autoDistributeStageDistribution(
  questionBank: TeacherBankQuestion[],
  modelDistribution?: QuestionDistributionMap
): StageQuestionDistribution {
  const eligibleIds: string[] = [];
  const usedByModel: Record<QuestionModelType, number> = {
    pilihan_ganda: 0,
    pilihan_ganda_kompleks: 0,
    benar_salah: 0,
    menjodohkan: 0,
    isian_singkat: 0,
    uraian: 0,
  };
  const seenIds = new Set<string>();

  for (const q of questionBank) {
    if (!q.enabled || !q.id || seenIds.has(q.id)) continue;
    const modelDist = modelDistribution?.[q.type];
    if (modelDist) {
      if (!modelDist.enabled) continue;
      if (usedByModel[q.type] >= modelDist.usedCount) continue;
    }
    usedByModel[q.type] += 1;
    seenIds.add(q.id);
    eligibleIds.push(q.id);
  }

  const stage1Cap = getStageBoxIds('level-01').length;
  const stage2Cap = getStageBoxIds('level-02').length;

  return {
    'level-01': eligibleIds.slice(0, stage1Cap),
    'level-02': eligibleIds.slice(stage1Cap, stage1Cap + stage2Cap),
  };
}

export function getDistributionSummary(
  storeSnapshot?: TeacherStoreSnapshot
): DistributionSummary {
  const store = storeSnapshot ?? TeacherStorage.loadStore();
  const cleanDist = sanitizeStageDistribution(store.stageDistribution, store.questionBank);
  const stage1BoxIds = getStageBoxIds('level-01');
  const stage2BoxIds = getStageBoxIds('level-02');
  const stage1Ids = cleanDist['level-01'] ?? [];
  const stage2Ids = cleanDist['level-02'] ?? [];

  const distributedIds: string[] = [];
  const distributedSet = new Set<string>();
  const boxQuestionMap: Record<string, Record<string, string>> = {
    'level-01': {},
    'level-02': {},
  };

  stage1BoxIds.forEach((boxId, idx) => {
    const qId = stage1Ids[idx];
    if (qId) {
      boxQuestionMap['level-01'][boxId] = qId;
      if (!distributedSet.has(qId)) {
        distributedSet.add(qId);
        distributedIds.push(qId);
      }
    }
  });

  stage2BoxIds.forEach((boxId, idx) => {
    const qId = stage2Ids[idx];
    if (qId) {
      boxQuestionMap['level-02'][boxId] = qId;
      if (!distributedSet.has(qId)) {
        distributedSet.add(qId);
        distributedIds.push(qId);
      }
    }
  });

  const undistributedIds = store.questionBank
    .filter((q) => !distributedSet.has(q.id))
    .map((q) => q.id);

  const stage1Count = Object.keys(boxQuestionMap['level-01']).length;
  const stage2Count = Object.keys(boxQuestionMap['level-02']).length;
  const totalQuestions = store.questionBank.length;
  const enabledQuestions = store.questionBank.filter((q) => q.enabled).length;
  const distributedQuestions = distributedIds.length;
  const undistributedQuestions = Math.max(0, totalQuestions - distributedQuestions);

  return {
    totalQuestions,
    enabledQuestions,
    distributedQuestions,
    undistributedQuestions,
    totalBoxCapacity: stage1BoxIds.length + stage2BoxIds.length,
    stage1Count,
    stage1Capacity: stage1BoxIds.length,
    stage2Count,
    stage2Capacity: stage2BoxIds.length,
    distributedIds,
    undistributedIds,
    boxQuestionMap,
  };
}

export function getStageBoxDiagnosticMappings(
  storeSnapshot?: TeacherStoreSnapshot
): StageBoxDiagnosticMapping[] {
  const store = storeSnapshot ?? TeacherStorage.loadStore();
  const cleanDist = sanitizeStageDistribution(store.stageDistribution, store.questionBank);
  const bankById = new Map(store.questionBank.map((q) => [q.id, q]));
  const rows: StageBoxDiagnosticMapping[] = [];

  for (const levelId of STAGE_IDS) {
    const levelName = levelId === 'level-01' ? 'Stage 1 (Emerald Meadow)' : 'Stage 2 (Savanna Sunland)';
    const boxIds = getStageBoxIds(levelId);
    const assigned = cleanDist[levelId] ?? [];

    for (let idx = 0; idx < boxIds.length; idx++) {
      const boxId = boxIds[idx];
      const qId = assigned[idx] || null;
      const bankItem = qId ? bankById.get(qId) : undefined;
      rows.push({
        levelId,
        levelName,
        boxIndex: idx + 1,
        boxId,
        questionId: bankItem ? bankItem.id : null,
        originalNumber: bankItem ? bankItem.originalNumber : null,
        modelType: bankItem ? bankItem.type : null,
        promptPreview: bankItem ? bankItem.prompt : 'Belum terhubung ke soal Bank Soal',
        status: bankItem ? 'terhubung' : 'kosong',
      });
    }
  }

  return rows;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushActivity(
  logs: ActivityLogRecord[],
  actorRole: ActivityLogRecord['actorRole'],
  action: string,
  details: string,
  timestamp = new Date().toISOString()
): ActivityLogRecord[] {
  const entry: ActivityLogRecord = {
    logId: makeId('log'),
    timestamp,
    actorRole,
    action,
    details,
  };
  return [entry, ...logs].slice(0, 150);
}

function createDefaultStore(): TeacherStoreSnapshot {
  const now = new Date().toISOString();
  const emptyBank: TeacherBankQuestion[] = [];
  return {
    examConfig: {
      examId: 'exam-level-01',
      title: 'Evaluasi EXAM EDUVERSE (Stage 1 & Stage 2)',
      levelId: 'level-01',
      allowRepeatQuestions: false,
      activeSourceDocument: null,
      confirmedAt: null,
      updatedAt: now,
      appsScriptUrl: '',
      spreadsheetId: '',
      lastSyncAttemptAt: null,
      lastSuccessfulSyncAt: null,
      lastConnectionStatus: 'untested',
      lastSyncStatus: 'not_configured',
      lastSyncMessage: 'Endpoint Google Apps Script belum dikonfigurasi.',
    },
    questionBank: emptyBank,
    distribution: computeDetectedDistribution(emptyBank),
    stageDistribution: createEmptyStageDistribution(),
    students: [],
    studentAnswers: [],
    examResults: [],
    activityLogs: [],
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return toHex(new Uint8Array(digest));
  }
  // Minimal deterministic fallback hash only if WebCrypto subtle is unavailable (e.g. non-HTTPS test context)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toHex(bytes);
}

export const TeacherStorage = {
  hasConfiguredPin(): boolean {
    try {
      const raw = window.localStorage.getItem(TEACHER_PIN_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<TeacherPinConfig>;
      return Boolean(parsed.saltHex && parsed.hashHex);
    } catch {
      return false;
    }
  },

  async configurePin(pin: string): Promise<void> {
    const clean = pin.trim();
    if (!/^\d{4,8}$/.test(clean)) {
      throw new Error('PIN guru harus berupa 4 hingga 8 digit angka.');
    }
    const saltHex = generateSaltHex();
    const hashHex = await sha256Hex(`${saltHex}:${clean}`);
    const payload: TeacherPinConfig = {
      saltHex,
      hashHex,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(TEACHER_PIN_KEY, JSON.stringify(payload));
    this.appendActivityLog('teacher', 'configure_pin', 'PIN Mode Guru diperbarui.');
  },

  async verifyPin(pin: string): Promise<boolean> {
    try {
      const raw = window.localStorage.getItem(TEACHER_PIN_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<TeacherPinConfig>;
      if (!parsed.saltHex || !parsed.hashHex) return false;
      const candidateHash = await sha256Hex(`${parsed.saltHex}:${pin.trim()}`);
      return candidateHash === parsed.hashHex;
    } catch {
      return false;
    }
  },

  loadStore(): TeacherStoreSnapshot {
    try {
      const raw = window.localStorage.getItem(TEACHER_STORE_KEY);
      if (!raw) return createDefaultStore();
      const parsed = JSON.parse(raw) as Partial<TeacherStoreSnapshot>;
      const base = createDefaultStore();
      const rawBank = Array.isArray(parsed.questionBank) ? parsed.questionBank : [];
      const questionBank = rawBank.map(normalizeBankQuestion);
      const distribution = computeDetectedDistribution(
        questionBank,
        parsed.distribution
      );
      const examConfig = { ...base.examConfig, ...(parsed.examConfig ?? {}) };
      const hasLegacyConfirmedWithoutStageDist =
        parsed.stageDistribution === undefined &&
        Boolean(examConfig.confirmedAt) &&
        questionBank.length > 0;
      const stageDistribution = hasLegacyConfirmedWithoutStageDist
        ? autoDistributeStageDistribution(questionBank, distribution)
        : sanitizeStageDistribution(parsed.stageDistribution, questionBank);

      return {
        examConfig,
        questionBank,
        distribution,
        stageDistribution,
        students: Array.isArray(parsed.students) ? parsed.students : [],
        studentAnswers: Array.isArray(parsed.studentAnswers) ? parsed.studentAnswers : [],
        examResults: Array.isArray(parsed.examResults) ? parsed.examResults : [],
        activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
      };
    } catch {
      return createDefaultStore();
    }
  },

  saveStore(store: TeacherStoreSnapshot): void {
    // Mirror image payloads into IndexedDB media store & cache
    for (const q of store.questionBank) {
      const img = resolveQuestionImage(q.id, q.image);
      if (img && img.startsWith('data:image/')) {
        setCachedQuestionImage(q.id, img);
        void saveQuestionImageToMediaStore(q.id, img);
      } else if (!q.image) {
        void removeQuestionImageFromMediaStore(q.id);
      }
    }

    try {
      const rawJson = JSON.stringify(store);
      if (rawJson.length <= 1_800_000) {
        window.localStorage.setItem(TEACHER_STORE_KEY, rawJson);
        return;
      }
      // Offload large inline images to IndexedDB reference markers to stay well within localStorage quota
      const compactStore: TeacherStoreSnapshot = {
        ...store,
        questionBank: store.questionBank.map((q) =>
          q.image && q.image.startsWith('data:image/')
            ? { ...q, image: `${IDB_IMAGE_PREFIX}${q.id}` }
            : q
        ),
      };
      window.localStorage.setItem(TEACHER_STORE_KEY, JSON.stringify(compactStore));
    } catch {
      try {
        const compactStore: TeacherStoreSnapshot = {
          ...store,
          questionBank: store.questionBank.map((q) =>
            q.image && q.image.startsWith('data:image/')
              ? { ...q, image: `${IDB_IMAGE_PREFIX}${q.id}` }
              : q
          ),
        };
        window.localStorage.setItem(TEACHER_STORE_KEY, JSON.stringify(compactStore));
      } catch {
        // Ignore unrecoverable storage quota errors
      }
    }
  },

  appendActivityLog(
    actorRole: ActivityLogRecord['actorRole'],
    action: string,
    details: string
  ): void {
    const store = this.loadStore();
    const entry: ActivityLogRecord = {
      logId: makeId('log'),
      timestamp: new Date().toISOString(),
      actorRole,
      action,
      details,
    };
    store.activityLogs = [entry, ...store.activityLogs].slice(0, 150);
    this.saveStore(store);
  },

  saveConfirmedBank(
    questions: TeacherBankQuestion[],
    distribution: QuestionDistributionMap,
    sourceDocument: string,
    allowRepeatQuestions: boolean
  ): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const prevBankLength = store.questionBank.length;
    const normalizedQuestions = questions.map(normalizeBankQuestion);
    const sourceDocumentChanged =
      (store.examConfig.activeSourceDocument ?? '') !== sourceDocument;
    const normalizedDist = computeDetectedDistribution(
      normalizedQuestions,
      sourceDocumentChanged ? undefined : distribution
    );

    const existingTotal =
      (store.stageDistribution['level-01']?.filter(Boolean).length ?? 0) +
      (store.stageDistribution['level-02']?.filter(Boolean).length ?? 0);
    const hadConfirmedBefore = Boolean(store.examConfig.confirmedAt);
    const shouldAutoDistribute =
      !hadConfirmedBefore ||
      existingTotal === 0 ||
      sourceDocumentChanged ||
      normalizedQuestions.length !== prevBankLength;

    const nextStageDistribution = shouldAutoDistribute
      ? autoDistributeStageDistribution(normalizedQuestions, normalizedDist)
      : sanitizeStageDistribution(store.stageDistribution, normalizedQuestions);

    store.questionBank = normalizedQuestions;
    store.distribution = normalizedDist;
    store.stageDistribution = nextStageDistribution;
    store.examConfig = {
      ...store.examConfig,
      allowRepeatQuestions,
      activeSourceDocument: sourceDocument,
      confirmedAt: now,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'confirm_question_bank',
      `Menyimpan ${normalizedQuestions.length} soal dari "${sourceDocument}" (Stage 1: ${nextStageDistribution['level-01'].filter(Boolean).length} box, Stage 2: ${nextStageDistribution['level-02'].filter(Boolean).length} box).`,
      now
    );

    this.saveStore(store);
    GoogleSheetsSyncService.enqueueQuestions(normalizedQuestions);
    GoogleSheetsSyncService.enqueueDistribution(nextStageDistribution, getStageBoxIds);
    return store;
  },

  updateSavedDistributionAndConfig(
    questions: TeacherBankQuestion[],
    distribution: QuestionDistributionMap,
    examConfigPatch: Partial<ExamConfigRecord>
  ): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const normalizedQuestions = questions.map(normalizeBankQuestion);
    store.questionBank = normalizedQuestions;
    store.distribution = computeDetectedDistribution(normalizedQuestions, distribution);
    store.stageDistribution = sanitizeStageDistribution(
      store.stageDistribution,
      normalizedQuestions
    );
    store.examConfig = {
      ...store.examConfig,
      ...examConfigPatch,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'update_distribution',
      `Memperbarui konfigurasi distribusi soal (total model aktif: ${Object.values(store.distribution).reduce((s, d) => s + d.usedCount, 0)}).`,
      now
    );
    this.saveStore(store);
    return store;
  },

  autoDistributeToStages(): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    // Refresh distribution limits cleanly without dropping newly added enabled models
    const refreshedDist = computeDetectedDistribution(
      store.questionBank,
      store.distribution
    );
    // Distribusi hanya mengubah stageDistribution, tidak mengubah isi questionBank
    const nextStageDist = autoDistributeStageDistribution(
      store.questionBank,
      refreshedDist
    );
    store.distribution = refreshedDist;
    store.stageDistribution = nextStageDist;
    store.examConfig = {
      ...store.examConfig,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'auto_distribute_stages',
      `Membagi soal otomatis dari Bank Soal (${store.questionBank.length} soal) ke Stage 1 (${nextStageDist['level-01'].filter(Boolean).length} box) dan Stage 2 (${nextStageDist['level-02'].filter(Boolean).length} box).`,
      now
    );
    this.saveStore(store);
    GoogleSheetsSyncService.enqueueDistribution(nextStageDist, getStageBoxIds);
    return store;
  },

  updateManualStageDistribution(
    nextStageDistribution: StageQuestionDistribution
  ): { ok: boolean; errors: string[]; store: TeacherStoreSnapshot } {
    const store = this.loadStore();
    const normalized: StageQuestionDistribution = {
      'level-01': trimTrailingEmptySlots(
        (nextStageDistribution['level-01'] ?? [])
          .slice(0, getStageBoxIds('level-01').length)
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
      ),
      'level-02': trimTrailingEmptySlots(
        (nextStageDistribution['level-02'] ?? [])
          .slice(0, getStageBoxIds('level-02').length)
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
      ),
    };

    const validation = validateStageDistribution(normalized, store.questionBank);
    if (!validation.valid) {
      return {
        ok: false,
        errors: validation.errors,
        store,
      };
    }

    const now = new Date().toISOString();
    store.stageDistribution = normalized;
    store.examConfig = {
      ...store.examConfig,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'manual_distribute_stages',
      `Memperbarui distribusi manual Question Box (Stage 1: ${normalized['level-01'].filter(Boolean).length}/${getStageBoxIds('level-01').length}, Stage 2: ${normalized['level-02'].filter(Boolean).length}/${getStageBoxIds('level-02').length}). Bank Soal (${store.questionBank.length} soal) tetap utuh.`,
      now
    );
    this.saveStore(store);
    GoogleSheetsSyncService.enqueueDistribution(normalized, getStageBoxIds);
    return {
      ok: true,
      errors: [],
      store,
    };
  },

  resetStageDistribution(): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    // Reset distribusi hanya mengosongkan stageDistribution, bank soal tetap utuh
    store.stageDistribution = createEmptyStageDistribution();
    store.examConfig = {
      ...store.examConfig,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'reset_stage_distribution',
      'Distribusi Stage 1 & Stage 2 direset (Bank Soal tetap utuh).',
      now
    );
    this.saveStore(store);
    return store;
  },

  saveEditedBankQuestions(
    questions: TeacherBankQuestion[],
    distribution?: QuestionDistributionMap
  ): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const prevIds = new Set(store.questionBank.map((q) => q.id));
    const prevById = new Map(store.questionBank.map((q) => [q.id, q]));
    const normalizedQuestions = questions.map((raw) => {
      const prev = prevById.get(raw.id);
      return normalizeBankQuestion({
        ...raw,
        createdAt: raw.createdAt ?? prev?.createdAt ?? now,
        updatedAt: now,
      });
    });
    const nextIds = new Set(normalizedQuestions.map((q) => q.id));
    for (const oldId of prevIds) {
      if (!nextIds.has(oldId)) {
        void removeQuestionImageFromMediaStore(oldId);
      }
    }

    store.questionBank = normalizedQuestions;
    store.distribution = computeDetectedDistribution(
      normalizedQuestions,
      distribution ?? store.distribution
    );
    store.stageDistribution = sanitizeStageDistribution(
      store.stageDistribution,
      normalizedQuestions
    );
    store.examConfig = {
      ...store.examConfig,
      activeSourceDocument: store.examConfig.activeSourceDocument ?? 'Editor Bank Soal Guru',
      confirmedAt: store.examConfig.confirmedAt ?? now,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'edit_question_bank',
      `Memperbarui isi Bank Soal (${normalizedQuestions.length} soal) tanpa mengubah ID soal.`,
      now
    );
    this.saveStore(store);
    GoogleSheetsSyncService.enqueueQuestions(normalizedQuestions);
    GoogleSheetsSyncService.enqueueDistribution(store.stageDistribution, getStageBoxIds);
    if (this.isGoogleSheetsConfigured(store.examConfig)) {
      void GoogleSheetsSyncService.flushQueue({
        filterActions: ['saveQuestions', 'saveDistribution'],
      });
    }
    return store;
  },

  saveSingleBankQuestion(updatedQuestion: TeacherBankQuestion): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const existingIdx = store.questionBank.findIndex((q) => q.id === updatedQuestion.id);
    if (existingIdx < 0) {
      return store;
    }

    const prev = store.questionBank[existingIdx];
    const normalized = normalizeBankQuestion({
      ...updatedQuestion,
      id: prev.id,
      createdAt: prev.createdAt ?? updatedQuestion.createdAt ?? now,
      updatedAt: now,
    });

    const nextBank = [...store.questionBank];
    nextBank[existingIdx] = normalized;
    store.questionBank = nextBank;
    store.distribution = computeDetectedDistribution(nextBank, store.distribution);
    store.stageDistribution = sanitizeStageDistribution(store.stageDistribution, nextBank);
    store.examConfig = {
      ...store.examConfig,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'edit_question_key',
      `Menyimpan kunci/isi soal ${normalized.id} (status kunci: ${normalized.answerKeyStatus ?? 'terbaca'}) tanpa mengubah ID.`,
      now
    );

    this.saveStore(store);
    GoogleSheetsSyncService.enqueueQuestions([normalized]);
    if (this.isGoogleSheetsConfigured(store.examConfig)) {
      void GoogleSheetsSyncService.flushQueue({ filterActions: ['saveQuestions'] });
    }
    return store;
  },

  clearConfirmedBank(): TeacherStoreSnapshot {
    const store = this.loadStore();
    const now = new Date().toISOString();
    store.questionBank = [];
    store.distribution = computeDetectedDistribution([]);
    store.stageDistribution = createEmptyStageDistribution();
    store.examConfig = {
      ...store.examConfig,
      activeSourceDocument: null,
      confirmedAt: null,
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'clear_question_bank',
      'Bank soal guru dinonaktifkan; game kembali memakai soal bawaan Stage 1 & Stage 2.',
      now
    );
    void clearAllQuestionImagesFromMediaStore();
    this.saveStore(store);
    return store;
  },

  restoreBackupStore(
    snapshot: TeacherStoreSnapshot,
    logDetails: string
  ): TeacherStoreSnapshot {
    const now = new Date().toISOString();
    const current = this.loadStore();
    const normalizedQuestions = snapshot.questionBank.map(normalizeBankQuestion);
    const normalizedDistribution = computeDetectedDistribution(
      normalizedQuestions,
      snapshot.distribution
    );
    const normalizedStageDist = sanitizeStageDistribution(
      snapshot.stageDistribution,
      normalizedQuestions
    );
    const resolvedConfirmedAt =
      snapshot.examConfig.confirmedAt ??
      current.examConfig.confirmedAt ??
      (normalizedQuestions.length > 0 ? now : null);

    const nextStore: TeacherStoreSnapshot = {
      examConfig: {
        ...current.examConfig,
        ...snapshot.examConfig,
        confirmedAt: resolvedConfirmedAt,
        // Keep local endpoint/sync credentials untouched
        appsScriptUrl: current.examConfig.appsScriptUrl,
        lastConnectionStatus: current.examConfig.lastConnectionStatus,
        lastSyncAttemptAt: current.examConfig.lastSyncAttemptAt,
        lastSuccessfulSyncAt: current.examConfig.lastSuccessfulSyncAt,
        lastSyncStatus: current.examConfig.lastSyncStatus,
        lastSyncMessage: current.examConfig.lastSyncMessage,
        updatedAt: now,
      },
      questionBank: normalizedQuestions,
      distribution: normalizedDistribution,
      stageDistribution: normalizedStageDist,
      students: Array.isArray(snapshot.students) ? snapshot.students : current.students,
      studentAnswers: Array.isArray(snapshot.studentAnswers)
        ? snapshot.studentAnswers
        : current.studentAnswers,
      examResults: Array.isArray(snapshot.examResults)
        ? snapshot.examResults
        : current.examResults,
      activityLogs: pushActivity(
        current.activityLogs,
        'teacher',
        'restore_backup',
        logDetails,
        now
      ),
    };
    this.saveStore(nextStore);
    return nextStore;
  },

  upsertStudent(name: string, school: string): StudentRecord {
    const store = this.loadStore();
    const cleanName = name.trim() || 'Siswa';
    const cleanSchool = school.trim() || '-';
    const now = new Date().toISOString();

    const existing = store.students.find(
      (s) =>
        s.name.toLowerCase() === cleanName.toLowerCase() &&
        s.school.toLowerCase() === cleanSchool.toLowerCase()
    );

    if (existing) {
      existing.lastPlayedAt = now;
      this.saveStore(store);
      GoogleSheetsSyncService.enqueueStudent(existing);
      if (this.isGoogleSheetsConfigured(store.examConfig)) {
        void GoogleSheetsSyncService.flushQueue({ filterActions: ['saveStudent'] });
      }
      return existing;
    }

    const record: StudentRecord = {
      studentId: makeId('stu'),
      name: cleanName,
      school: cleanSchool,
      createdAt: now,
      lastPlayedAt: now,
    };
    store.students.push(record);
    this.saveStore(store);
    GoogleSheetsSyncService.enqueueStudent(record);
    if (this.isGoogleSheetsConfigured(store.examConfig)) {
      void GoogleSheetsSyncService.flushQueue({ filterActions: ['saveStudent'] });
    }
    return record;
  },

  startExamSession(
    levelId: string,
    studentName: string,
    studentSchool: string,
    initialBoxQuestionMap: Record<string, string> = {}
  ): ExamResultRecord {
    const student = this.upsertStudent(studentName, studentSchool);
    const store = this.loadStore();
    const now = new Date().toISOString();
    const session: ExamResultRecord = {
      sessionId: makeId('ses'),
      examId: store.examConfig.examId,
      studentId: student.studentId,
      levelId,
      totalScore: 0,
      questionsAnswered: 0,
      correctCount: 0,
      startedAt: now,
      completedAt: null,
      status: 'in_progress',
      boxQuestionMap: { ...initialBoxQuestionMap },
    };
    store.examResults = [session, ...store.examResults].slice(0, 100);
    store.activityLogs = pushActivity(
      store.activityLogs,
      'student',
      'start_session',
      `${student.name} (${student.school}) memulai ${levelId} [sesi ${session.sessionId}].`,
      now
    );
    this.saveStore(store);
    return session;
  },

  recordBoxQuestionMapping(sessionId: string, boxId: string, questionId: string): void {
    const store = this.loadStore();
    const ses = store.examResults.find((r) => r.sessionId === sessionId);
    if (ses) {
      ses.boxQuestionMap[boxId] = questionId;
      this.saveStore(store);
    }
  },

  recordStudentAnswer(params: {
    sessionId: string;
    boxId: string;
    questionId: string;
    modelType: QuestionModelType;
    answerPayload: string;
    isCorrect: boolean;
    scoreAwarded: number;
  }): void {
    const store = this.loadStore();
    const ses = store.examResults.find((r) => r.sessionId === params.sessionId);
    if (!ses) return;

    const now = new Date().toISOString();
    const answerRecord: StudentAnswerRecord = {
      answerId: makeId('ans'),
      sessionId: ses.sessionId,
      examId: ses.examId,
      studentId: ses.studentId,
      boxId: params.boxId,
      questionId: params.questionId,
      modelType: params.modelType,
      answerPayload: params.answerPayload,
      isCorrect: params.isCorrect,
      scoreAwarded: params.scoreAwarded,
      answeredAt: now,
    };

    ses.questionsAnswered += 1;
    if (params.isCorrect) ses.correctCount += 1;
    ses.totalScore += params.scoreAwarded;

    store.studentAnswers = [answerRecord, ...store.studentAnswers].slice(0, 500);
    store.activityLogs = pushActivity(
      store.activityLogs,
      'student',
      'answer_question',
      `Box ${params.boxId} -> Soal ${params.questionId} (${QUESTION_MODEL_LABELS[params.modelType]}): ${params.isCorrect ? 'Benar' : 'Salah'} (+${params.scoreAwarded}).`,
      now
    );

    this.saveStore(store);
    GoogleSheetsSyncService.enqueueAnswer(answerRecord, ses.levelId);
    if (this.isGoogleSheetsConfigured(store.examConfig)) {
      void GoogleSheetsSyncService.flushQueue({ filterActions: ['saveAnswer'] });
    }
  },

  finalizeExamSession(
    sessionId: string,
    finalScore: number,
    status: 'completed' | 'game_over'
  ): void {
    const store = this.loadStore();
    const ses = store.examResults.find((r) => r.sessionId === sessionId);
    if (!ses) return;
    const now = new Date().toISOString();
    ses.totalScore = finalScore;
    ses.completedAt = now;
    ses.status = status;
    store.activityLogs = pushActivity(
      store.activityLogs,
      'student',
      status === 'completed' ? 'complete_exam' : 'game_over',
      `Sesi ${sessionId} selesai (${status}) dengan skor ${finalScore}.`,
      now
    );
    this.saveStore(store);

    const student = store.students.find((s) => s.studentId === ses.studentId);
    GoogleSheetsSyncService.enqueueExamResult(ses, student);
    if (this.isGoogleSheetsConfigured(store.examConfig)) {
      void GoogleSheetsSyncService.flushQueue({ filterActions: ['saveExamResult'] });
    }
  },

  isGoogleSheetsConfigured(config?: ExamConfigRecord): boolean {
    const cfg = config ?? this.loadStore().examConfig;
    if (!cfg.appsScriptUrl.trim()) return false;
    return GoogleSheetsSyncService.setEndpointConfig(cfg.appsScriptUrl, cfg.spreadsheetId).valid;
  },

  buildGoogleSheetsPayload(): TeacherStoreSnapshot {
    return this.loadStore();
  },

  saveSheetsEndpointConfig(
    appsScriptUrl: string,
    spreadsheetId: string
  ): { ok: boolean; message: string; store: TeacherStoreSnapshot } {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const cleanUrl = appsScriptUrl.trim();
    const cleanId = spreadsheetId.trim();

    if (!cleanUrl && !cleanId) {
      GoogleSheetsSyncService.setEndpointConfig('', '');
      store.examConfig = {
        ...store.examConfig,
        appsScriptUrl: '',
        spreadsheetId: '',
        lastConnectionStatus: 'untested',
        lastSyncStatus: 'not_configured',
        lastSyncMessage: 'Endpoint Google Apps Script dikosongkan. Sistem berjalan dalam mode lokal.',
        updatedAt: now,
      };
      this.saveStore(store);
      return {
        ok: true,
        message: 'Konfigurasi endpoint dikosongkan. Data tetap disimpan secara lokal.',
        store,
      };
    }

    const validation = GoogleSheetsSyncService.setEndpointConfig(cleanUrl, cleanId);
    if (!validation.valid) {
      return {
        ok: false,
        message: validation.error ?? 'URL Google Apps Script atau Spreadsheet ID tidak valid.',
        store,
      };
    }

    store.examConfig = {
      ...store.examConfig,
      appsScriptUrl: validation.normalizedUrl,
      spreadsheetId: validation.normalizedSpreadsheetId,
      lastConnectionStatus: 'untested',
      lastSyncStatus: 'local_only',
      lastSyncMessage:
        'Konfigurasi Apps Script valid dan tersimpan. Klik "Uji Koneksi" untuk memverifikasi endpoint.',
      updatedAt: now,
    };
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'save_sheets_config',
      `Menyimpan konfigurasi endpoint Google Apps Script${validation.normalizedSpreadsheetId ? ` (Spreadsheet ID: ${validation.normalizedSpreadsheetId})` : ''}.`,
      now
    );
    this.saveStore(store);
    return {
      ok: true,
      message: 'Konfigurasi endpoint Google Apps Script berhasil disimpan.',
      store,
    };
  },

  async testSheetsConnection(
    overrideUrl?: string,
    overrideSpreadsheetId?: string
  ): Promise<{ ok: boolean; message: string; store: TeacherStoreSnapshot; outcome: SyncOperationOutcome }> {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const targetUrl = overrideUrl !== undefined ? overrideUrl.trim() : store.examConfig.appsScriptUrl;
    const targetId =
      overrideSpreadsheetId !== undefined
        ? overrideSpreadsheetId.trim()
        : store.examConfig.spreadsheetId;

    const outcome = await GoogleSheetsSyncService.testConnection({
      appsScriptUrl: targetUrl,
      spreadsheetId: targetId,
    });

    store.examConfig.lastConnectionStatus = outcome.ok ? 'connected' : 'error';
    store.examConfig.lastSyncAttemptAt = now;
    store.examConfig.lastSyncMessage = outcome.message;
    if (!outcome.ok && store.examConfig.lastSyncStatus !== 'not_configured') {
      store.examConfig.lastSyncStatus = 'error';
    }
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'test_sheets_connection',
      outcome.message,
      now
    );
    this.saveStore(store);
    return { ok: outcome.ok, message: outcome.message, store, outcome };
  },

  async initializeSheetsSchema(
    overrideUrl?: string,
    overrideSpreadsheetId?: string
  ): Promise<{ ok: boolean; message: string; store: TeacherStoreSnapshot; outcome: SyncOperationOutcome }> {
    const store = this.loadStore();
    const now = new Date().toISOString();
    const outcome = await GoogleSheetsSyncService.initializeRemoteSheets({
      appsScriptUrl: overrideUrl !== undefined ? overrideUrl.trim() : store.examConfig.appsScriptUrl,
      spreadsheetId:
        overrideSpreadsheetId !== undefined
          ? overrideSpreadsheetId.trim()
          : store.examConfig.spreadsheetId,
    });

    store.examConfig.lastSyncAttemptAt = now;
    store.examConfig.lastSyncMessage = outcome.message;
    store.examConfig.lastConnectionStatus = outcome.ok ? 'connected' : 'error';
    if (outcome.ok) {
      store.examConfig.lastSuccessfulSyncAt = now;
      store.examConfig.lastSyncStatus = 'synced';
    } else if (store.examConfig.appsScriptUrl.trim()) {
      store.examConfig.lastSyncStatus = 'error';
    }
    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'initialize_sheets',
      outcome.message,
      now
    );
    this.saveStore(store);
    return { ok: outcome.ok, message: outcome.message, store, outcome };
  },

  async syncBankQuestionsToSheets(): Promise<{
    ok: boolean;
    message: string;
    store: TeacherStoreSnapshot;
    outcome: SyncOperationOutcome;
  }> {
    const store = this.loadStore();
    if (store.questionBank.length === 0) {
      const outcome: SyncOperationOutcome = {
        ok: false,
        action: 'saveQuestions',
        message: 'Bank Soal masih kosong. Belum ada soal untuk disinkronkan.',
        stats: GoogleSheetsSyncService.getQueueStats(),
      };
      return { ok: false, message: outcome.message, store, outcome };
    }
    GoogleSheetsSyncService.enqueueQuestions(store.questionBank);
    return this.flushPendingSyncQueue(['saveQuestions'], 'Sinkronisasi Bank Soal');
  },

  async syncDistributionToSheets(): Promise<{
    ok: boolean;
    message: string;
    store: TeacherStoreSnapshot;
    outcome: SyncOperationOutcome;
  }> {
    const store = this.loadStore();
    const totalAssigned =
      (store.stageDistribution['level-01']?.length ?? 0) +
      (store.stageDistribution['level-02']?.length ?? 0);
    if (totalAssigned === 0) {
      const outcome: SyncOperationOutcome = {
        ok: false,
        action: 'saveDistribution',
        message:
          'Distribusi Stage 1 & Stage 2 masih kosong. Bagi soal ke Stage 1 & 2 terlebih dahulu.',
        stats: GoogleSheetsSyncService.getQueueStats(),
      };
      return { ok: false, message: outcome.message, store, outcome };
    }
    GoogleSheetsSyncService.enqueueDistribution(store.stageDistribution, getStageBoxIds);
    return this.flushPendingSyncQueue(['saveDistribution'], 'Sinkronisasi Distribusi Stage');
  },

  async syncStudentsToSheets(): Promise<{
    ok: boolean;
    message: string;
    store: TeacherStoreSnapshot;
    outcome: SyncOperationOutcome;
  }> {
    const store = this.loadStore();
    if (store.students.length === 0) {
      const outcome: SyncOperationOutcome = {
        ok: false,
        action: 'saveStudent',
        message: 'Belum ada data siswa yang tersimpan secara lokal.',
        stats: GoogleSheetsSyncService.getQueueStats(),
      };
      return { ok: false, message: outcome.message, store, outcome };
    }
    for (const student of store.students) {
      GoogleSheetsSyncService.enqueueStudent(student);
    }
    return this.flushPendingSyncQueue(['saveStudent'], 'Sinkronisasi Data Siswa');
  },

  async syncExamResultsToSheets(): Promise<{
    ok: boolean;
    message: string;
    store: TeacherStoreSnapshot;
    outcome: SyncOperationOutcome;
  }> {
    const store = this.loadStore();
    if (store.examResults.length === 0 && store.studentAnswers.length === 0) {
      const outcome: SyncOperationOutcome = {
        ok: false,
        action: 'saveExamResult',
        message: 'Belum ada hasil ujian atau jawaban siswa untuk disinkronkan.',
        stats: GoogleSheetsSyncService.getQueueStats(),
      };
      return { ok: false, message: outcome.message, store, outcome };
    }

    const sessionLevelMap = new Map(store.examResults.map((r) => [r.sessionId, r.levelId]));
    const studentById = new Map(store.students.map((s) => [s.studentId, s]));

    for (const ans of store.studentAnswers) {
      GoogleSheetsSyncService.enqueueAnswer(
        ans,
        sessionLevelMap.get(ans.sessionId) ?? 'level-01'
      );
    }
    for (const ses of store.examResults) {
      GoogleSheetsSyncService.enqueueExamResult(ses, studentById.get(ses.studentId));
    }

    return this.flushPendingSyncQueue(
      ['saveAnswer', 'saveExamResult'],
      'Sinkronisasi Jawaban & Hasil Ujian'
    );
  },

  async flushPendingSyncQueue(
    filterActions?: Array<'saveQuestions' | 'saveDistribution' | 'saveStudent' | 'saveAnswer' | 'saveExamResult'>,
    label = 'Sinkronisasi Antrean Google Sheets'
  ): Promise<{
    ok: boolean;
    message: string;
    store: TeacherStoreSnapshot;
    outcome: SyncOperationOutcome;
  }> {
    const store = this.loadStore();
    const now = new Date().toISOString();
    GoogleSheetsSyncService.syncEndpointFromExamConfig(store.examConfig);

    const outcome = await GoogleSheetsSyncService.flushQueue({
      filterActions,
      overrideConfig: {
        appsScriptUrl: store.examConfig.appsScriptUrl,
        spreadsheetId: store.examConfig.spreadsheetId,
      },
      includeFailed: true,
    });

    store.examConfig.lastSyncAttemptAt = now;
    store.examConfig.lastSyncMessage = outcome.message;
    if (outcome.ok) {
      store.examConfig.lastSuccessfulSyncAt = now;
      store.examConfig.lastConnectionStatus = 'connected';
      store.examConfig.lastSyncStatus = 'synced';
    } else if (!store.examConfig.appsScriptUrl.trim()) {
      store.examConfig.lastSyncStatus = 'not_configured';
    } else {
      store.examConfig.lastSyncStatus = 'error';
      store.examConfig.lastConnectionStatus = 'error';
    }

    store.activityLogs = pushActivity(
      store.activityLogs,
      'teacher',
      'sync_google_sheets',
      `${label}: ${outcome.message}`,
      now
    );
    this.saveStore(store);
    return { ok: outcome.ok, message: outcome.message, store, outcome };
  },

  async syncToGoogleSheets(): Promise<{ ok: boolean; message: string; store: TeacherStoreSnapshot }> {
    const store = this.loadStore();
    GoogleSheetsSyncService.syncEndpointFromExamConfig(store.examConfig);
    if (store.questionBank.length > 0) {
      GoogleSheetsSyncService.enqueueQuestions(store.questionBank);
    }
    const distCount =
      (store.stageDistribution['level-01']?.length ?? 0) +
      (store.stageDistribution['level-02']?.length ?? 0);
    if (distCount > 0) {
      GoogleSheetsSyncService.enqueueDistribution(store.stageDistribution, getStageBoxIds);
    }
    const studentById = new Map(store.students.map((s) => [s.studentId, s]));
    for (const s of store.students) {
      GoogleSheetsSyncService.enqueueStudent(s);
    }
    const sessionLevelMap = new Map(store.examResults.map((r) => [r.sessionId, r.levelId]));
    for (const ans of store.studentAnswers) {
      GoogleSheetsSyncService.enqueueAnswer(
        ans,
        sessionLevelMap.get(ans.sessionId) ?? 'level-01'
      );
    }
    for (const r of store.examResults) {
      GoogleSheetsSyncService.enqueueExamResult(r, studentById.get(r.studentId));
    }

    const res = await this.flushPendingSyncQueue(undefined, 'Sinkronisasi Penuh');
    return { ok: res.ok, message: res.message, store: res.store };
  },
};

function convertBankQuestionToQuizQuestion(q: TeacherBankQuestion): QuizQuestion {
  const model = q.type ?? q.questionType ?? 'pilihan_ganda';
  const promptText = q.prompt || q.question || '';
  const customExplanation = q.explanation?.trim() ? q.explanation.trim() : null;
  const rewardScore = q.weight && q.weight > 0 ? Math.round(q.weight) : 150;
  const regionLabel = `${QUESTION_MODEL_LABELS[model]} · ${q.id}`;
  const image = resolveQuestionImage(q.id, q.image);
  const imageAlt = q.imageAlt ?? null;

  if (model === 'benar_salah') {
    const options = q.options.length >= 2 ? q.options : ['Benar', 'Salah'];
    const trueIdx = options.findIndex((o) => /^(benar|true)$/i.test(o.trim()));
    const falseIdx = options.findIndex((o) => /^(salah|false)$/i.test(o.trim()));
    let correctIndex = -1;
    if (typeof q.correctAnswer === 'string') {
      const keyLower = q.correctAnswer.trim().toLowerCase();
      if (/^(benar|true)$/i.test(keyLower)) {
        correctIndex = trueIdx >= 0 ? trueIdx : 0;
      } else if (/^(salah|false|s)$/i.test(keyLower)) {
        correctIndex = falseIdx >= 0 ? falseIdx : 1;
      } else if (/^a$/i.test(keyLower)) {
        correctIndex = 0;
      } else if (/^b$/i.test(keyLower)) {
        correctIndex =
          options[1]?.trim().toLowerCase() === 'salah'
            ? 1
            : trueIdx >= 0
              ? trueIdx
              : 1;
      } else {
        correctIndex = options.findIndex((o) => o.toLowerCase() === keyLower);
      }
    }
    return {
      id: q.id,
      region: regionLabel,
      prompt: promptText,
      options,
      correctIndex,
      explanation:
        customExplanation ??
        (correctIndex >= 0
          ? `Jawaban benar: ${options[correctIndex]}.`
          : 'Jawaban telah dicatat untuk pemeriksaan guru.'),
      rewardScore,
      modelType: model,
      sourceBankQuestionId: q.id,
      originalNumber: q.originalNumber,
      sourceDocument: q.sourceDocument,
      needsReview: q.needsReview,
      image,
      imageAlt,
    };
  }

  if (model === 'pilihan_ganda_kompleks') {
    const letters = Array.isArray(q.correctAnswer)
      ? q.correctAnswer
      : typeof q.correctAnswer === 'string'
        ? q.correctAnswer
            .toUpperCase()
            .split(/\s*(?:,|;|DAN|&|\+)\s*/i)
            .filter((x) => /^[A-E]$/.test(x))
        : [];
    const correctIndices = letters
      .map((l) => l.charCodeAt(0) - 65)
      .filter((idx) => idx >= 0 && idx < q.options.length);

    return {
      id: q.id,
      region: regionLabel,
      prompt: promptText,
      options: q.options,
      correctIndex: correctIndices[0] ?? -1,
      correctIndices,
      explanation:
        customExplanation ??
        (correctIndices.length > 0
          ? `Jawaban benar: ${correctIndices.map((i) => q.options[i]).join(', ')}.`
          : 'Jawaban pilihan ganda kompleks telah dicatat untuk guru.'),
      rewardScore,
      modelType: model,
      sourceBankQuestionId: q.id,
      originalNumber: q.originalNumber,
      sourceDocument: q.sourceDocument,
      needsReview: q.needsReview,
      image,
      imageAlt,
    };
  }

  if (model === 'menjodohkan') {
    return {
      id: q.id,
      region: regionLabel,
      prompt: promptText,
      options: [],
      correctIndex: 0,
      matchingPairs: q.matchingPairs,
      explanation:
        customExplanation ??
        (q.matchingPairs.length > 0
          ? q.matchingPairs.map((p) => `${p.left} -> ${p.right}`).join(' · ')
          : 'Jawaban menjodohkan telah dicatat.'),
      rewardScore,
      modelType: model,
      sourceBankQuestionId: q.id,
      originalNumber: q.originalNumber,
      sourceDocument: q.sourceDocument,
      needsReview: q.needsReview,
      image,
      imageAlt,
    };
  }

  if (model === 'uraian') {
    const teacherRubric =
      q.rubric?.trim() ||
      (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()
        ? q.correctAnswer.trim()
        : null);
    return {
      id: q.id,
      region: regionLabel,
      prompt: promptText,
      options: [],
      correctIndex: 0,
      correctText: null,
      rubric: teacherRubric,
      explanation:
        customExplanation ??
        'Jawaban uraian Anda telah disimpan dalam log siswa untuk diperiksa oleh guru.',
      rewardScore,
      modelType: model,
      sourceBankQuestionId: q.id,
      originalNumber: q.originalNumber,
      sourceDocument: q.sourceDocument,
      needsReview: q.needsReview,
      image,
      imageAlt,
    };
  }

  if (model === 'isian_singkat') {
    const correctText =
      typeof q.correctAnswer === 'string'
        ? q.correctAnswer
        : Array.isArray(q.correctAnswer)
          ? q.correctAnswer.join(' | ')
          : null;
    const displayExample = correctText
      ? correctText
          .split(/\s*(?:\||\/|;)\s*/)
          .map((s) => s.trim())
          .filter(Boolean)[0]
      : null;
    return {
      id: q.id,
      region: regionLabel,
      prompt: promptText,
      options: [],
      correctIndex: 0,
      correctText,
      explanation:
        customExplanation ??
        (displayExample
          ? `Jawaban referensi: ${displayExample}`
          : 'Jawaban telah disimpan dalam log siswa untuk diperiksa guru.'),
      rewardScore,
      modelType: model,
      sourceBankQuestionId: q.id,
      originalNumber: q.originalNumber,
      sourceDocument: q.sourceDocument,
      needsReview: q.needsReview,
      image,
      imageAlt,
    };
  }

  // Default: Pilihan Ganda
  let correctIndex = -1;
  if (typeof q.correctAnswer === 'string') {
    const clean = q.correctAnswer.trim();
    if (/^[A-E]$/i.test(clean)) {
      const idx = clean.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < q.options.length) correctIndex = idx;
    } else {
      const idx = q.options.findIndex((o) => o.toLowerCase() === clean.toLowerCase());
      if (idx >= 0) correctIndex = idx;
    }
  }
  return {
    id: q.id,
    region: regionLabel,
    prompt: promptText,
    options: q.options,
    correctIndex,
    explanation:
      customExplanation ??
      (correctIndex >= 0
        ? `Jawaban benar: ${q.options[correctIndex]}.`
        : 'Jawaban telah dicatat untuk pemeriksaan guru.'),
    rewardScore,
    modelType: 'pilihan_ganda',
    sourceBankQuestionId: q.id,
    originalNumber: q.originalNumber,
    sourceDocument: q.sourceDocument,
    needsReview: q.needsReview,
    image,
    imageAlt,
  };
}

export function buildDistributedTeacherQuestions(
  store: TeacherStoreSnapshot,
  levelId?: string
): QuizQuestion[] {
  if (!store.examConfig.confirmedAt || store.questionBank.length === 0) {
    return [];
  }

  if (levelId) {
    const cleanStageDist = sanitizeStageDistribution(
      store.stageDistribution,
      store.questionBank
    );
    const stageIds = cleanStageDist[levelId] ?? [];
    const bankById = new Map(store.questionBank.map((q) => [q.id, q]));
    const resolved: QuizQuestion[] = [];
    for (const qId of stageIds) {
      const item = bankById.get(qId);
      if (item && item.enabled) {
        resolved.push(convertBankQuestionToQuizQuestion(item));
      }
    }
    return resolved;
  }

  const selected: TeacherBankQuestion[] = [];
  for (const model of QUESTION_MODEL_ORDER) {
    const dist = store.distribution[model];
    if (!dist || !dist.enabled || dist.usedCount <= 0) continue;

    const candidates = store.questionBank.filter(
      (q) => q.enabled && q.type === model
    );
    const take = Math.min(dist.usedCount, candidates.length);
    selected.push(...candidates.slice(0, take));
  }

  return selected.map(convertBankQuestionToQuizQuestion);
}

export interface ExamSessionAllocator {
  usingTeacherBank: boolean;
  sessionId: string;
  getTotalAvailableCount: (levelBoxCount: number) => number;
  assignQuestionForBox: (boxId: string, defaultQuestionId: string) => QuizQuestion | null;
  recordAnswer: (params: {
    boxId: string;
    questionId: string;
    modelType: QuestionModelType;
    answerPayload: string;
    isCorrect: boolean;
    scoreAwarded: number;
  }) => void;
  finalizeSession: (finalScore: number, status: 'completed' | 'game_over') => void;
}

export function createExamSessionAllocator(
  levelId: string,
  studentName: string,
  studentSchool: string
): ExamSessionAllocator {
  const store = TeacherStorage.loadStore();
  const usingTeacherBank = Boolean(
    store.examConfig.confirmedAt && store.questionBank.length > 0
  );

  const boxToQuestion = new Map<string, QuizQuestion>();
  const initialBoxQuestionMap: Record<string, string> = {};

  if (usingTeacherBank) {
    const cleanStageDist = sanitizeStageDistribution(
      store.stageDistribution,
      store.questionBank
    );
    const stageIds = cleanStageDist[levelId] ?? [];
    const boxIds = getStageBoxIds(levelId);
    const bankById = new Map(store.questionBank.map((q) => [q.id, q]));

    for (let i = 0; i < boxIds.length; i++) {
      const boxId = boxIds[i];
      const questionId = stageIds[i];
      if (!questionId) continue;

      const bankQuestion = bankById.get(questionId);
      if (!bankQuestion || !bankQuestion.enabled) continue;

      boxToQuestion.set(boxId, convertBankQuestionToQuizQuestion(bankQuestion));
      initialBoxQuestionMap[boxId] = bankQuestion.id;
    }
  }

  const session = TeacherStorage.startExamSession(
    levelId,
    studentName,
    studentSchool,
    initialBoxQuestionMap
  );

  const assignedMap = new Map<string, QuizQuestion>();

  return {
    usingTeacherBank,
    sessionId: session.sessionId,

    getTotalAvailableCount(levelBoxCount: number): number {
      if (!usingTeacherBank) return levelBoxCount;
      return Math.min(boxToQuestion.size, levelBoxCount);
    },

    assignQuestionForBox(boxId: string, defaultQuestionId: string): QuizQuestion | null {
      if (!usingTeacherBank) {
        const existing = assignedMap.get(boxId);
        if (existing) return existing;
        const builtIn =
          levelId === 'level-02'
            ? (LEVEL_02_QUESTIONS[defaultQuestionId] ?? LEVEL_02_QUESTIONS['s2-q-1'])
            : (LEVEL_01_QUESTIONS[defaultQuestionId] ?? LEVEL_01_QUESTIONS['q-1']);
        assignedMap.set(boxId, builtIn);
        TeacherStorage.recordBoxQuestionMapping(session.sessionId, boxId, builtIn.id);
        return builtIn;
      }

      // Single Source of Truth: always resolve boxId -> questionId -> LIVE questionBank[questionId]
      const liveStore = TeacherStorage.loadStore();
      const boxIndex = getStageBoxIds(levelId).indexOf(boxId);
      const liveCleanDist = sanitizeStageDistribution(
        liveStore.stageDistribution,
        liveStore.questionBank
      );
      const liveMappedId =
        boxIndex >= 0 ? (liveCleanDist[levelId]?.[boxIndex] ?? '') : '';
      const targetQuestionId = liveMappedId || initialBoxQuestionMap[boxId] || '';

      let resolvedQuestion: QuizQuestion | null = null;
      if (targetQuestionId) {
        const liveBankQuestion = liveStore.questionBank.find(
          (q) => q.id === targetQuestionId
        );
        if (liveBankQuestion && liveBankQuestion.enabled) {
          resolvedQuestion = convertBankQuestionToQuizQuestion(liveBankQuestion);
        }
      }

      if (!resolvedQuestion) {
        resolvedQuestion = boxToQuestion.get(boxId) ?? null;
      }

      if (!resolvedQuestion) {
        return null;
      }

      assignedMap.set(boxId, resolvedQuestion);
      TeacherStorage.recordBoxQuestionMapping(
        session.sessionId,
        boxId,
        resolvedQuestion.id
      );
      return resolvedQuestion;
    },

    recordAnswer(params): void {
      TeacherStorage.recordStudentAnswer({
        sessionId: session.sessionId,
        ...params,
      });
    },

    finalizeSession(finalScore: number, status: 'completed' | 'game_over'): void {
      TeacherStorage.finalizeExamSession(session.sessionId, finalScore, status);
    },
  };
}
