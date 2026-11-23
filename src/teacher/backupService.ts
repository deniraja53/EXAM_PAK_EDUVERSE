import { QuestionModelType } from '../game/types/gameTypes';
import {
  computeDetectedDistribution,
  evaluateQuestionAnswerKey,
} from './questionClassifier';
import { IDB_IMAGE_PREFIX, resolveQuestionImage } from './questionMediaStorage';
import {
  createEmptyStageDistribution,
  getStageBoxIds,
  sanitizeStageDistribution,
  TeacherStorage,
} from './teacherStorage';
import {
  ExamConfigRecord,
  ExamResultRecord,
  QUESTION_MODEL_ORDER,
  QuestionDistributionMap,
  StageQuestionDistribution,
  StudentAnswerRecord,
  StudentRecord,
  TeacherBankQuestion,
  TeacherStoreSnapshot,
} from './teacherTypes';

export const BACKUP_FORMAT_VERSION = '1.0';
export const SUPPORTED_BACKUP_VERSIONS = new Set(['1.0']);
export const BACKUP_APP_ID = 'EXAM_EDUVERSE';
export const PRE_RESTORE_BACKUP_KEY = 'exam_eduverse_teacher_pre_restore_backup_v1';

const TSV_HEADERS = ['DATASET', 'ID', 'TYPE', 'DATA', 'UPDATED_AT'] as const;

const KNOWN_DATASETS = new Set([
  'BACKUP_META',
  'KONFIGURASI',
  'DISTRIBUSI_STAGE',
  'DISTRIBUSI_MODEL',
  'BANK_SOAL',
  'SISWA',
  'JAWABAN_SISWA',
  'HASIL',
]);

export type SafeBackupExamConfig = Pick<
  ExamConfigRecord,
  | 'examId'
  | 'title'
  | 'levelId'
  | 'allowRepeatQuestions'
  | 'activeSourceDocument'
  | 'confirmedAt'
  | 'updatedAt'
  | 'spreadsheetId'
>;

export interface SafeBackupQuestion extends Omit<TeacherBankQuestion, 'image'> {
  hasLocalImage?: boolean;
  image?: string | null;
}

export interface StageDistributionBackupEntry {
  levelId: string;
  questionIds: string[];
  boxQuestionMap: Record<string, string>;
}

export interface TeacherBackupPackage {
  backupVersion: string;
  app: typeof BACKUP_APP_ID;
  createdAt: string;
  examConfig: SafeBackupExamConfig;
  questionBank: SafeBackupQuestion[];
  distribution: QuestionDistributionMap;
  stageDistribution: StageQuestionDistribution;
  boxQuestionMap: Record<string, Record<string, string>>;
  students: StudentRecord[];
  studentAnswers: StudentAnswerRecord[];
  examResults: ExamResultRecord[];
}

export interface GeneratedBackupOutput {
  pkg: TeacherBackupPackage;
  tsvText: string;
  jsonText: string;
  defaultFileName: string;
  summary: BackupValidationSummary;
}

export interface BackupValidationSummary {
  questionBankCount: number;
  answerKeyCount: number;
  distributedBoxCount: number;
  studentCount: number;
  studentAnswerCount: number;
  examResultCount: number;
}

export interface BackupConflictSummary {
  conflictingQuestionIds: string[];
  conflictingStudentIds: string[];
  conflictingAnswerIds: string[];
  conflictingResultIds: string[];
  hasStageDistributionConflict: boolean;
  hasConfigConflict: boolean;
  totalConflicts: number;
}

export interface BackupValidationResult {
  valid: boolean;
  format: 'tsv' | 'json' | 'unknown';
  backupVersion: string | null;
  createdAt: string | null;
  errors: string[];
  warnings: string[];
  summary: BackupValidationSummary | null;
  pkg: TeacherBackupPackage | null;
  conflicts: BackupConflictSummary | null;
}

export type RestoreConflictResolution = 'use_backup' | 'keep_current';

export interface RestoreExecutionResult {
  ok: boolean;
  message: string;
  preRestoreSavedAt: string;
  restoredCounts: {
    questionsAdded: number;
    questionsUpdated: number;
    questionsKept: number;
    distributedBoxes: number;
    studentsAdded: number;
    studentsUpdated: number;
    answersAdded: number;
    resultsAdded: number;
  };
  store: TeacherStoreSnapshot;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildBackupFileName(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `EXAM-EDUVERSE-BACKUP-${yyyy}-${mm}-${dd}-${hh}-${min}.json`;
}

function sanitizeTsvScalar(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .trim();
}

function sanitizeSafeExamConfig(cfg: ExamConfigRecord): SafeBackupExamConfig {
  return {
    examId: cfg.examId,
    title: cfg.title,
    levelId: cfg.levelId,
    allowRepeatQuestions: Boolean(cfg.allowRepeatQuestions),
    activeSourceDocument: cfg.activeSourceDocument ?? null,
    confirmedAt: cfg.confirmedAt ?? null,
    updatedAt: cfg.updatedAt,
    spreadsheetId: cfg.spreadsheetId ?? '',
  };
}

function buildStageBoxQuestionMap(
  stageDistribution: StageQuestionDistribution
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const levelId of ['level-01', 'level-02']) {
    const boxIds = getStageBoxIds(levelId);
    const assigned = Array.isArray(stageDistribution?.[levelId])
      ? stageDistribution[levelId]
      : [];
    const map: Record<string, string> = {};
    assigned.forEach((qId, idx) => {
      const boxId = boxIds[idx] ?? `box-${idx + 1}`;
      if (qId) map[boxId] = qId;
    });
    out[levelId] = map;
  }
  return out;
}

function hasUsableAnswerKey(q: Pick<TeacherBankQuestion, 'type' | 'correctAnswer' | 'matchingPairs' | 'rubric'>): boolean {
  if (q.type === 'menjodohkan') {
    return Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0;
  }
  if (q.type === 'uraian') {
    return Boolean(
      (typeof q.rubric === 'string' && q.rubric.trim()) ||
        (typeof q.correctAnswer === 'string' && q.correctAnswer.trim())
    );
  }
  if (Array.isArray(q.correctAnswer)) {
    return q.correctAnswer.length > 0;
  }
  return typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0;
}

function computeSummaryFromPackage(pkg: TeacherBackupPackage): BackupValidationSummary {
  const distributedBoxCount =
    (pkg.stageDistribution['level-01']?.filter(Boolean).length ?? 0) +
    (pkg.stageDistribution['level-02']?.filter(Boolean).length ?? 0);
  const answerKeyCount = pkg.questionBank.filter((q) => hasUsableAnswerKey(q)).length;
  return {
    questionBankCount: pkg.questionBank.length,
    answerKeyCount,
    distributedBoxCount,
    studentCount: pkg.students.length,
    studentAnswerCount: pkg.studentAnswers.length,
    examResultCount: pkg.examResults.length,
  };
}

function toSafeTsvQuestion(q: TeacherBankQuestion): SafeBackupQuestion {
  const resolved = resolveQuestionImage(q.id, q.image);
  const hasInline = Boolean(resolved && (resolved.startsWith('data:image/') || resolved.startsWith(IDB_IMAGE_PREFIX)));
  return {
    id: q.id,
    originalNumber: q.originalNumber,
    type: q.type,
    questionType: q.questionType ?? q.type,
    prompt: q.prompt,
    question: q.question ?? q.prompt,
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer ?? null,
    answerKeyStatus: q.answerKeyStatus,
    answerKeySource: q.answerKeySource ?? null,
    rubric: q.rubric ?? null,
    explanation: q.explanation ?? null,
    matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : [],
    weight: q.weight ?? null,
    sourceDocument: q.sourceDocument ?? '',
    enabled: Boolean(q.enabled),
    needsReview: Boolean(q.needsReview),
    reviewReason: q.reviewReason ?? null,
    imageAlt: q.imageAlt ?? null,
    imageUrl: q.imageUrl ?? null,
    imageFileId: q.imageFileId ?? null,
    hasLocalImage: hasInline,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

function toSafeJsonQuestion(q: TeacherBankQuestion): SafeBackupQuestion {
  const base = toSafeTsvQuestion(q);
  const resolved = resolveQuestionImage(q.id, q.image);
  if (resolved && resolved.startsWith('data:image/')) {
    base.image = resolved;
  }
  return base;
}

/**
 * Generates a complete, secret-free backup directly from the latest persisted TeacherStorage.
 * Produces both Google-Sheets-friendly TSV tabular text and downloadable JSON package.
 */
export function createBackupFromStorage(nowDate = new Date()): GeneratedBackupOutput {
  const store = TeacherStorage.loadStore();
  const createdAt = nowDate.toISOString();
  const safeConfig = sanitizeSafeExamConfig(store.examConfig);
  const boxQuestionMap = buildStageBoxQuestionMap(store.stageDistribution);

  const jsonQuestions = store.questionBank.map(toSafeJsonQuestion);
  const tsvQuestions = store.questionBank.map(toSafeTsvQuestion);

  const pkg: TeacherBackupPackage = {
    backupVersion: BACKUP_FORMAT_VERSION,
    app: BACKUP_APP_ID,
    createdAt,
    examConfig: safeConfig,
    questionBank: jsonQuestions,
    distribution: store.distribution,
    stageDistribution: store.stageDistribution,
    boxQuestionMap,
    students: store.students,
    studentAnswers: store.studentAnswers,
    examResults: store.examResults,
  };

  const summary = computeSummaryFromPackage(pkg);

  const rows: string[] = [TSV_HEADERS.join('\t')];
  const pushRow = (
    dataset: string,
    id: string,
    type: string,
    payload: unknown,
    updatedAt: string
  ) => {
    const jsonData = JSON.stringify(payload);
    rows.push(
      [
        sanitizeTsvScalar(dataset),
        sanitizeTsvScalar(id),
        sanitizeTsvScalar(type),
        jsonData,
        sanitizeTsvScalar(updatedAt),
      ].join('\t')
    );
  };

  pushRow(
    'BACKUP_META',
    'META_001',
    BACKUP_APP_ID,
    {
      backupVersion: BACKUP_FORMAT_VERSION,
      app: BACKUP_APP_ID,
      createdAt,
      summary,
    },
    createdAt
  );

  pushRow(
    'KONFIGURASI',
    safeConfig.examId || 'exam-level-01',
    'EXAM_CONFIG',
    safeConfig,
    safeConfig.updatedAt || createdAt
  );

  for (const levelId of ['level-01', 'level-02']) {
    const entry: StageDistributionBackupEntry = {
      levelId,
      questionIds: Array.isArray(store.stageDistribution?.[levelId])
        ? store.stageDistribution[levelId]
        : [],
      boxQuestionMap: boxQuestionMap[levelId] ?? {},
    };
    pushRow(
      'DISTRIBUSI_STAGE',
      levelId,
      'STAGE_DISTRIBUTION',
      entry,
      safeConfig.updatedAt || createdAt
    );
  }

  pushRow(
    'DISTRIBUSI_MODEL',
    'MODEL_CONFIG',
    'QUESTION_DISTRIBUTION',
    store.distribution,
    safeConfig.updatedAt || createdAt
  );

  for (const q of tsvQuestions) {
    pushRow(
      'BANK_SOAL',
      q.id,
      q.type.toUpperCase(),
      q,
      q.updatedAt || q.createdAt || createdAt
    );
  }

  for (const stu of store.students) {
    pushRow(
      'SISWA',
      stu.studentId,
      'DATA_SISWA',
      stu,
      stu.lastPlayedAt || stu.createdAt || createdAt
    );
  }

  for (const ans of store.studentAnswers) {
    pushRow(
      'JAWABAN_SISWA',
      ans.answerId,
      ans.modelType.toUpperCase(),
      ans,
      ans.answeredAt || createdAt
    );
  }

  for (const res of store.examResults) {
    pushRow(
      'HASIL',
      res.sessionId,
      'HASIL_UJIAN',
      res,
      res.completedAt || res.startedAt || createdAt
    );
  }

  return {
    pkg,
    tsvText: rows.join('\n'),
    jsonText: JSON.stringify(pkg, null, 2),
    defaultFileName: buildBackupFileName(nowDate),
    summary,
  };
}

/**
 * RFC-4180 aware TSV parser so data pasted directly OR copied back out of Google Sheets
 * (where cells containing quotes are wrapped as `"{""id"":""Q001""}"`) parses cleanly.
 */
export function parseTsvTable(input: string): string[][] {
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (atFieldStart && ch === '"') {
      inQuotes = true;
      atFieldStart = false;
      continue;
    }

    if (ch === '\t') {
      row.push(field);
      field = '';
      atFieldStart = true;
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
      continue;
    }

    field += ch;
    atFieldStart = false;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((r) => {
      const trimmedEnd = [...r];
      while (trimmedEnd.length > 0 && trimmedEnd[trimmedEnd.length - 1].trim() === '') {
        trimmedEnd.pop();
      }
      return trimmedEnd;
    })
    .filter((r) => r.some((cell) => cell.trim().length > 0));
}

function normalizeRestoredQuestion(raw: Partial<SafeBackupQuestion>): TeacherBankQuestion | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const model = (raw.type ?? raw.questionType ?? 'pilihan_ganda') as QuestionModelType;
  const validType: QuestionModelType = QUESTION_MODEL_ORDER.includes(model)
    ? model
    : 'pilihan_ganda';
  const prompt = typeof raw.prompt === 'string'
    ? raw.prompt
    : typeof raw.question === 'string'
      ? raw.question
      : '';

  const options =
    validType === 'benar_salah' && (!Array.isArray(raw.options) || raw.options.length < 2)
      ? ['Benar', 'Salah']
      : Array.isArray(raw.options)
        ? raw.options.map((o) => String(o ?? ''))
        : [];

  let correctAnswer: string | string[] | null = null;
  if (typeof (raw.correctAnswer as unknown) === 'boolean') {
    correctAnswer = (raw.correctAnswer as unknown as boolean) ? 'Benar' : 'Salah';
  } else if (Array.isArray(raw.correctAnswer)) {
    correctAnswer = raw.correctAnswer.map((v) => String(v));
  } else if (typeof raw.correctAnswer === 'string') {
    correctAnswer = raw.correctAnswer;
  }

  const candidate: TeacherBankQuestion = {
    id,
    originalNumber: String(raw.originalNumber ?? id.replace(/^Q0*/i, '') ?? '1'),
    type: validType,
    questionType: validType,
    prompt,
    question: prompt,
    options,
    correctAnswer,
    answerKeyStatus: raw.answerKeyStatus,
    answerKeySource: raw.answerKeySource ?? null,
    rubric: typeof raw.rubric === 'string' ? raw.rubric : null,
    explanation: typeof raw.explanation === 'string' ? raw.explanation : null,
    matchingPairs: Array.isArray(raw.matchingPairs) ? raw.matchingPairs : [],
    weight: typeof raw.weight === 'number' ? raw.weight : null,
    sourceDocument: typeof raw.sourceDocument === 'string' ? raw.sourceDocument : 'Backup Restore',
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    needsReview: Boolean(raw.needsReview),
    reviewReason: typeof raw.reviewReason === 'string' ? raw.reviewReason : null,
    image: typeof raw.image === 'string' ? raw.image : null,
    imageAlt: typeof raw.imageAlt === 'string' ? raw.imageAlt : null,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    imageFileId: typeof raw.imageFileId === 'string' ? raw.imageFileId : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (!candidate.answerKeyStatus) {
    const evaluated = evaluateQuestionAnswerKey(candidate);
    candidate.answerKeyStatus = evaluated.answerKeyStatus;
    candidate.needsReview = evaluated.needsReview;
    candidate.reviewReason = evaluated.reviewReason;
  }

  return candidate;
}

function reconstructStageQuestionIds(entry: Partial<StageDistributionBackupEntry>): string[] {
  if (Array.isArray(entry.questionIds) && entry.questionIds.length > 0) {
    return entry.questionIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }
  if (entry.boxQuestionMap && typeof entry.boxQuestionMap === 'object' && entry.levelId) {
    const boxIds = getStageBoxIds(entry.levelId);
    const out: string[] = [];
    for (const boxId of boxIds) {
      const qId = entry.boxQuestionMap[boxId];
      if (typeof qId === 'string' && qId.trim()) {
        out.push(qId.trim());
      }
    }
    if (out.length > 0) return out;
    return Object.values(entry.boxQuestionMap).filter(
      (qId): qId is string => typeof qId === 'string' && qId.trim().length > 0
    );
  }
  return [];
}

function parseJsonBackupObject(
  parsed: Partial<TeacherBackupPackage>
): { pkg: TeacherBackupPackage | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    return { pkg: null, errors: ['Format JSON tidak valid.'], warnings };
  }

  const backupVersion =
    typeof parsed.backupVersion === 'string' ? parsed.backupVersion.trim() : null;
  if (!backupVersion) {
    errors.push('Versi backup (backupVersion) tidak ditemukan pada file JSON.');
  } else if (!SUPPORTED_BACKUP_VERSIONS.has(backupVersion)) {
    errors.push(`Versi backup "${backupVersion}" tidak didukung (versi didukung: 1.0).`);
  }

  if (parsed.app && parsed.app !== BACKUP_APP_ID) {
    errors.push(`Data backup bukan milik ${BACKUP_APP_ID}.`);
  }

  if (!Array.isArray(parsed.questionBank)) {
    errors.push('Dataset questionBank tidak ditemukan atau bukan array.');
  }

  if (errors.length > 0) {
    return { pkg: null, errors, warnings };
  }

  const seenQ = new Set<string>();
  const questionBank: SafeBackupQuestion[] = [];
  for (const rawQ of parsed.questionBank ?? []) {
    const norm = normalizeRestoredQuestion(rawQ);
    if (!norm) {
      warnings.push('Ada baris soal tanpa ID yang valid dan dilewati.');
      continue;
    }
    if (seenQ.has(norm.id)) {
      warnings.push(`Duplikasi ID soal "${norm.id}" dalam backup; entri pertama dipertahankan.`);
      continue;
    }
    seenQ.add(norm.id);
    questionBank.push(norm);
  }

  const stageDist: StageQuestionDistribution = {
    'level-01': Array.isArray(parsed.stageDistribution?.['level-01'])
      ? parsed.stageDistribution['level-01']
      : [],
    'level-02': Array.isArray(parsed.stageDistribution?.['level-02'])
      ? parsed.stageDistribution['level-02']
      : [],
  };

  const baseConfig: SafeBackupExamConfig = {
    examId: parsed.examConfig?.examId ?? 'exam-level-01',
    title: parsed.examConfig?.title ?? 'Evaluasi EXAM EDUVERSE (Stage 1 & Stage 2)',
    levelId: parsed.examConfig?.levelId ?? 'level-01',
    allowRepeatQuestions: Boolean(parsed.examConfig?.allowRepeatQuestions),
    activeSourceDocument: parsed.examConfig?.activeSourceDocument ?? null,
    confirmedAt: parsed.examConfig?.confirmedAt ?? null,
    updatedAt: parsed.examConfig?.updatedAt ?? parsed.createdAt ?? new Date().toISOString(),
    spreadsheetId: parsed.examConfig?.spreadsheetId ?? '',
  };

  const pkg: TeacherBackupPackage = {
    backupVersion: backupVersion ?? BACKUP_FORMAT_VERSION,
    app: BACKUP_APP_ID,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    examConfig: baseConfig,
    questionBank,
    distribution: computeDetectedDistribution(
      questionBank as TeacherBankQuestion[],
      parsed.distribution
    ),
    stageDistribution: sanitizeStageDistribution(
      stageDist,
      questionBank as TeacherBankQuestion[]
    ),
    boxQuestionMap:
      parsed.boxQuestionMap && typeof parsed.boxQuestionMap === 'object'
        ? parsed.boxQuestionMap
        : buildStageBoxQuestionMap(stageDist),
    students: Array.isArray(parsed.students) ? parsed.students : [],
    studentAnswers: Array.isArray(parsed.studentAnswers) ? parsed.studentAnswers : [],
    examResults: Array.isArray(parsed.examResults) ? parsed.examResults : [],
  };

  return { pkg, errors, warnings };
}

function stableCompareQuestion(a: TeacherBankQuestion, b: TeacherBankQuestion): boolean {
  return (
    a.type === b.type &&
    a.prompt === b.prompt &&
    JSON.stringify(a.options) === JSON.stringify(b.options) &&
    JSON.stringify(a.correctAnswer) === JSON.stringify(b.correctAnswer) &&
    (a.answerKeySource ?? null) === (b.answerKeySource ?? null) &&
    (a.rubric ?? null) === (b.rubric ?? null) &&
    (a.explanation ?? null) === (b.explanation ?? null) &&
    JSON.stringify(a.matchingPairs) === JSON.stringify(b.matchingPairs) &&
    a.enabled === b.enabled &&
    (a.sourceDocument ?? '') === (b.sourceDocument ?? '')
  );
}

export function detectBackupConflicts(
  pkg: TeacherBackupPackage,
  current: TeacherStoreSnapshot
): BackupConflictSummary {
  const currQuestions = new Map(current.questionBank.map((q) => [q.id, q]));
  const currStudents = new Map(current.students.map((s) => [s.studentId, s]));
  const currAnswers = new Map(current.studentAnswers.map((a) => [a.answerId, a]));
  const currResults = new Map(current.examResults.map((r) => [r.sessionId, r]));

  const conflictingQuestionIds: string[] = [];
  for (const bq of pkg.questionBank) {
    const cq = currQuestions.get(bq.id);
    if (cq && !stableCompareQuestion(cq, bq as TeacherBankQuestion)) {
      conflictingQuestionIds.push(bq.id);
    }
  }

  const conflictingStudentIds: string[] = [];
  for (const bs of pkg.students) {
    const cs = currStudents.get(bs.studentId);
    if (cs && (cs.name !== bs.name || cs.school !== bs.school)) {
      conflictingStudentIds.push(bs.studentId);
    }
  }

  const conflictingAnswerIds: string[] = [];
  for (const ba of pkg.studentAnswers) {
    const ca = currAnswers.get(ba.answerId);
    if (
      ca &&
      (ca.answerPayload !== ba.answerPayload ||
        ca.isCorrect !== ba.isCorrect ||
        ca.scoreAwarded !== ba.scoreAwarded)
    ) {
      conflictingAnswerIds.push(ba.answerId);
    }
  }

  const conflictingResultIds: string[] = [];
  for (const br of pkg.examResults) {
    const cr = currResults.get(br.sessionId);
    if (
      cr &&
      (cr.totalScore !== br.totalScore ||
        cr.status !== br.status ||
        cr.questionsAnswered !== br.questionsAnswered)
    ) {
      conflictingResultIds.push(br.sessionId);
    }
  }

  const currTotalDist =
    (current.stageDistribution['level-01']?.length ?? 0) +
    (current.stageDistribution['level-02']?.length ?? 0);
  const backupTotalDist =
    (pkg.stageDistribution['level-01']?.length ?? 0) +
    (pkg.stageDistribution['level-02']?.length ?? 0);
  const hasStageDistributionConflict =
    currTotalDist > 0 &&
    backupTotalDist > 0 &&
    JSON.stringify(current.stageDistribution) !== JSON.stringify(pkg.stageDistribution);

  const hasConfigConflict =
    Boolean(current.examConfig.confirmedAt) &&
    Boolean(pkg.examConfig.confirmedAt) &&
    ((current.examConfig.activeSourceDocument ?? '') !==
      (pkg.examConfig.activeSourceDocument ?? '') ||
      current.examConfig.allowRepeatQuestions !== pkg.examConfig.allowRepeatQuestions);

  const totalConflicts =
    conflictingQuestionIds.length +
    conflictingStudentIds.length +
    conflictingAnswerIds.length +
    conflictingResultIds.length +
    (hasStageDistributionConflict ? 1 : 0) +
    (hasConfigConflict ? 1 : 0);

  return {
    conflictingQuestionIds,
    conflictingStudentIds,
    conflictingAnswerIds,
    conflictingResultIds,
    hasStageDistributionConflict,
    hasConfigConflict,
    totalConflicts,
  };
}

/**
 * Validates pasted backup text (Google Sheets TSV OR .json backup file)
 * without mutating any active application storage.
 */
export function validateBackupText(rawInput: string): BackupValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      format: 'unknown',
      backupVersion: null,
      createdAt: null,
      errors: ['Kotak Restore masih kosong. Tempel data backup dari Google Sheets terlebih dahulu.'],
      warnings: [],
      summary: null,
      pkg: null,
      conflicts: null,
    };
  }

  // 1. JSON format detection
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<TeacherBackupPackage>;
      const { pkg, errors, warnings } = parseJsonBackupObject(parsed);
      if (!pkg || errors.length > 0) {
        return {
          valid: false,
          format: 'json',
          backupVersion: typeof parsed?.backupVersion === 'string' ? parsed.backupVersion : null,
          createdAt: typeof parsed?.createdAt === 'string' ? parsed.createdAt : null,
          errors,
          warnings,
          summary: null,
          pkg: null,
          conflicts: null,
        };
      }
      const currentStore = TeacherStorage.loadStore();
      return {
        valid: true,
        format: 'json',
        backupVersion: pkg.backupVersion,
        createdAt: pkg.createdAt,
        errors: [],
        warnings,
        summary: computeSummaryFromPackage(pkg),
        pkg,
        conflicts: detectBackupConflicts(pkg, currentStore),
      };
    } catch {
      return {
        valid: false,
        format: 'json',
        backupVersion: null,
        createdAt: null,
        errors: ['Format teks JSON rusak atau tidak lengkap. Pastikan seluruh isi file tercopy.'],
        warnings: [],
        summary: null,
        pkg: null,
        conflicts: null,
      };
    }
  }

  // 2. Google Sheets TSV Tabular format
  const rows = parseTsvTable(trimmed);
  if (rows.length === 0) {
    return {
      valid: false,
      format: 'unknown',
      backupVersion: null,
      createdAt: null,
      errors: ['Data tidak dikenali sebagai tabel backup Google Sheets.'],
      warnings: [],
      summary: null,
      pkg: null,
      conflicts: null,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const firstRowUpper = rows[0].map((c) => c.trim().toUpperCase());
  const hasHeader =
    firstRowUpper[0] === 'DATASET' &&
    firstRowUpper[1] === 'ID' &&
    firstRowUpper[2] === 'TYPE' &&
    firstRowUpper[3] === 'DATA';

  if (!hasHeader) {
    errors.push(
      'Header tabel tidak sesuai. Baris pertama harus memuat kolom: DATASET, ID, TYPE, DATA, UPDATED_AT.'
    );
    return {
      valid: false,
      format: 'tsv',
      backupVersion: null,
      createdAt: null,
      errors,
      warnings,
      summary: null,
      pkg: null,
      conflicts: null,
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return {
      valid: false,
      format: 'tsv',
      backupVersion: null,
      createdAt: null,
      errors: ['Tabel backup hanya berisi header tanpa baris data.'],
      warnings: [],
      summary: null,
      pkg: null,
      conflicts: null,
    };
  }

  let backupVersion: string | null = null;
  let createdAt: string | null = null;
  let appId: string | null = null;
  let examConfig: SafeBackupExamConfig | null = null;
  let distribution: QuestionDistributionMap | undefined;
  const stageDistribution: StageQuestionDistribution = createEmptyStageDistribution();
  const boxQuestionMap: Record<string, Record<string, string>> = {};
  const questionBank: SafeBackupQuestion[] = [];
  const students: StudentRecord[] = [];
  const studentAnswers: StudentAnswerRecord[] = [];
  const examResults: ExamResultRecord[] = [];

  const seenQIds = new Set<string>();
  const seenStuIds = new Set<string>();
  const seenAnsIds = new Set<string>();
  const seenResIds = new Set<string>();

  dataRows.forEach((cols, idx) => {
    const rowNum = idx + 2;
    const dataset = (cols[0] ?? '').trim().toUpperCase();
    const rowId = (cols[1] ?? '').trim();
    const rawJson = (cols[3] ?? '').trim();

    if (!dataset || !KNOWN_DATASETS.has(dataset)) {
      errors.push(`Baris ${rowNum}: DATASET "${dataset || '(kosong)'}" tidak dikenal.`);
      return;
    }
    if (!rowId) {
      errors.push(`Baris ${rowNum} (${dataset}): kolom ID kosong.`);
      return;
    }
    if (!rawJson) {
      errors.push(`Baris ${rowNum} (${dataset} / ${rowId}): kolom DATA kosong.`);
      return;
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawJson);
    } catch {
      errors.push(
        `Baris ${rowNum} (${dataset} / ${rowId}): kolom DATA rusak atau terpotong saat copy/paste.`
      );
      return;
    }

    if (!parsedData || typeof parsedData !== 'object') {
      errors.push(`Baris ${rowNum} (${dataset} / ${rowId}): struktur DATA tidak valid.`);
      return;
    }

    if (dataset === 'BACKUP_META') {
      const meta = parsedData as { backupVersion?: string; app?: string; createdAt?: string };
      backupVersion = typeof meta.backupVersion === 'string' ? meta.backupVersion.trim() : null;
      appId = typeof meta.app === 'string' ? meta.app.trim() : null;
      createdAt = typeof meta.createdAt === 'string' ? meta.createdAt.trim() : null;
      return;
    }

    if (dataset === 'KONFIGURASI') {
      const cfg = parsedData as Partial<SafeBackupExamConfig>;
      examConfig = {
        examId: cfg.examId ?? rowId,
        title: cfg.title ?? 'Evaluasi EXAM EDUVERSE (Stage 1 & Stage 2)',
        levelId: cfg.levelId ?? 'level-01',
        allowRepeatQuestions: Boolean(cfg.allowRepeatQuestions),
        activeSourceDocument: cfg.activeSourceDocument ?? null,
        confirmedAt: cfg.confirmedAt ?? null,
        updatedAt: cfg.updatedAt ?? new Date().toISOString(),
        spreadsheetId: cfg.spreadsheetId ?? '',
      };
      return;
    }

    if (dataset === 'DISTRIBUSI_STAGE') {
      const entry = parsedData as Partial<StageDistributionBackupEntry>;
      const levelId = entry.levelId || rowId;
      if (levelId === 'level-01' || levelId === 'level-02') {
        stageDistribution[levelId] = reconstructStageQuestionIds({
          ...entry,
          levelId,
        });
        if (entry.boxQuestionMap && typeof entry.boxQuestionMap === 'object') {
          boxQuestionMap[levelId] = entry.boxQuestionMap;
        }
      }
      return;
    }

    if (dataset === 'DISTRIBUSI_MODEL') {
      distribution = parsedData as QuestionDistributionMap;
      return;
    }

    if (dataset === 'BANK_SOAL') {
      const qObj = parsedData as Partial<SafeBackupQuestion>;
      const normalized = normalizeRestoredQuestion({ ...qObj, id: qObj.id ?? rowId });
      if (!normalized) {
        errors.push(`Baris ${rowNum} (BANK_SOAL): ID soal tidak valid.`);
        return;
      }
      if (seenQIds.has(normalized.id)) {
        warnings.push(`Baris ${rowNum}: ID soal "${normalized.id}" duplikat dan diabaikan.`);
        return;
      }
      seenQIds.add(normalized.id);
      questionBank.push(normalized);
      return;
    }

    if (dataset === 'SISWA') {
      const stu = parsedData as Partial<StudentRecord>;
      const stuId = stu.studentId || rowId;
      if (seenStuIds.has(stuId)) {
        warnings.push(`Baris ${rowNum}: ID siswa "${stuId}" duplikat dan diabaikan.`);
        return;
      }
      seenStuIds.add(stuId);
      students.push({
        studentId: stuId,
        name: stu.name ?? 'Siswa',
        school: stu.school ?? '-',
        createdAt: stu.createdAt ?? new Date().toISOString(),
        lastPlayedAt: stu.lastPlayedAt ?? stu.createdAt ?? new Date().toISOString(),
      });
      return;
    }

    if (dataset === 'JAWABAN_SISWA') {
      const ans = parsedData as Partial<StudentAnswerRecord>;
      const ansId = ans.answerId || rowId;
      if (!ans.sessionId || !ans.questionId) {
        errors.push(`Baris ${rowNum} (JAWABAN_SISWA / ${ansId}): sessionId atau questionId kosong.`);
        return;
      }
      if (seenAnsIds.has(ansId)) return;
      seenAnsIds.add(ansId);
      studentAnswers.push({
        answerId: ansId,
        sessionId: ans.sessionId,
        examId: ans.examId ?? 'exam-level-01',
        studentId: ans.studentId ?? '',
        boxId: ans.boxId ?? '',
        questionId: ans.questionId,
        modelType: (ans.modelType ?? 'pilihan_ganda') as QuestionModelType,
        answerPayload: String(ans.answerPayload ?? ''),
        isCorrect: Boolean(ans.isCorrect),
        scoreAwarded: Number(ans.scoreAwarded ?? 0),
        answeredAt: ans.answeredAt ?? new Date().toISOString(),
      });
      return;
    }

    if (dataset === 'HASIL') {
      const res = parsedData as Partial<ExamResultRecord>;
      const sesId = res.sessionId || rowId;
      if (seenResIds.has(sesId)) return;
      seenResIds.add(sesId);
      examResults.push({
        sessionId: sesId,
        examId: res.examId ?? 'exam-level-01',
        studentId: res.studentId ?? '',
        levelId: res.levelId ?? 'level-01',
        totalScore: Number(res.totalScore ?? 0),
        questionsAnswered: Number(res.questionsAnswered ?? 0),
        correctCount: Number(res.correctCount ?? 0),
        startedAt: res.startedAt ?? new Date().toISOString(),
        completedAt: res.completedAt ?? null,
        status: res.status ?? 'completed',
        boxQuestionMap:
          res.boxQuestionMap && typeof res.boxQuestionMap === 'object'
            ? res.boxQuestionMap
            : {},
      });
    }
  });

  if (!backupVersion) {
    errors.push('Baris BACKUP_META tidak ditemukan atau versi backup kosong.');
  } else if (!SUPPORTED_BACKUP_VERSIONS.has(backupVersion)) {
    errors.push(`Versi backup "${backupVersion}" tidak didukung.`);
  }

  if (appId && appId !== BACKUP_APP_ID) {
    errors.push(`Data backup bukan berasal dari aplikasi ${BACKUP_APP_ID}.`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      format: 'tsv',
      backupVersion,
      createdAt,
      errors,
      warnings,
      summary: null,
      pkg: null,
      conflicts: null,
    };
  }

  const finalConfig: SafeBackupExamConfig = examConfig ?? {
    examId: 'exam-level-01',
    title: 'Evaluasi EXAM EDUVERSE (Stage 1 & Stage 2)',
    levelId: 'level-01',
    allowRepeatQuestions: false,
    activeSourceDocument: questionBank[0]?.sourceDocument ?? null,
    confirmedAt: questionBank.length > 0 ? createdAt ?? new Date().toISOString() : null,
    updatedAt: createdAt ?? new Date().toISOString(),
    spreadsheetId: '',
  };

  const sanitizedStageDist = sanitizeStageDistribution(
    stageDistribution,
    questionBank as TeacherBankQuestion[]
  );

  const pkg: TeacherBackupPackage = {
    backupVersion: backupVersion ?? BACKUP_FORMAT_VERSION,
    app: BACKUP_APP_ID,
    createdAt: createdAt ?? new Date().toISOString(),
    examConfig: finalConfig,
    questionBank,
    distribution: computeDetectedDistribution(
      questionBank as TeacherBankQuestion[],
      distribution
    ),
    stageDistribution: sanitizedStageDist,
    boxQuestionMap:
      Object.keys(boxQuestionMap).length > 0
        ? boxQuestionMap
        : buildStageBoxQuestionMap(sanitizedStageDist),
    students,
    studentAnswers,
    examResults,
  };

  const currentStore = TeacherStorage.loadStore();
  return {
    valid: true,
    format: 'tsv',
    backupVersion: pkg.backupVersion,
    createdAt: pkg.createdAt,
    errors: [],
    warnings,
    summary: computeSummaryFromPackage(pkg),
    pkg,
    conflicts: detectBackupConflicts(pkg, currentStore),
  };
}

function savePreRestoreLocalBackup(currentStore: TeacherStoreSnapshot): string {
  const savedAt = new Date().toISOString();
  try {
    const safeSnapshot = {
      savedAt,
      store: {
        ...currentStore,
        examConfig: sanitizeSafeExamConfig(currentStore.examConfig),
      },
    };
    window.localStorage.setItem(PRE_RESTORE_BACKUP_KEY, JSON.stringify(safeSnapshot));
  } catch {
    // Ignore storage quota issues for safety snapshot
  }
  return savedAt;
}

export function getPreRestoreBackupInfo(): { savedAt: string; questionCount: number } | null {
  try {
    const raw = window.localStorage.getItem(PRE_RESTORE_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: string;
      store?: { questionBank?: unknown[] };
    };
    if (!parsed.savedAt) return null;
    return {
      savedAt: parsed.savedAt,
      questionCount: Array.isArray(parsed.store?.questionBank)
        ? parsed.store.questionBank.length
        : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Restores a validated backup package non-destructively:
 * - Saves a local safety snapshot before making changes
 * - Deduplicates all records by their canonical ID
 * - Never auto-deletes local records absent from the backup
 * - Applies explicit conflict resolution ('use_backup' vs 'keep_current')
 */
export function executeBackupRestore(
  pkg: TeacherBackupPackage,
  resolution: RestoreConflictResolution
): RestoreExecutionResult {
  const current = TeacherStorage.loadStore();
  const preRestoreSavedAt = savePreRestoreLocalBackup(current);

  // 1. Merge Question Bank by ID without duplicates & without deleting local-only questions
  const mergedQuestionMap = new Map<string, TeacherBankQuestion>();
  for (const cq of current.questionBank) {
    mergedQuestionMap.set(cq.id, cq);
  }

  let questionsAdded = 0;
  let questionsUpdated = 0;
  let questionsKept = 0;

  for (const rawBackupQ of pkg.questionBank) {
    const existing = mergedQuestionMap.get(rawBackupQ.id);
    const preservedImage =
      rawBackupQ.image ??
      (existing ? resolveQuestionImage(existing.id, existing.image) ?? existing.image ?? null : null);

    const candidate: TeacherBankQuestion = {
      ...(rawBackupQ as TeacherBankQuestion),
      image: preservedImage,
    };

    if (!existing) {
      mergedQuestionMap.set(candidate.id, candidate);
      questionsAdded += 1;
    } else if (stableCompareQuestion(existing, candidate)) {
      questionsKept += 1;
    } else if (resolution === 'use_backup') {
      mergedQuestionMap.set(candidate.id, candidate);
      questionsUpdated += 1;
    } else {
      questionsKept += 1;
    }
  }

  // Keep canonical order: backup order followed by any local-only questions
  const orderedQuestions: TeacherBankQuestion[] = [];
  const emittedQ = new Set<string>();
  for (const bq of pkg.questionBank) {
    const resolved = mergedQuestionMap.get(bq.id);
    if (resolved && !emittedQ.has(resolved.id)) {
      orderedQuestions.push(resolved);
      emittedQ.add(resolved.id);
    }
  }
  for (const cq of current.questionBank) {
    const resolved = mergedQuestionMap.get(cq.id);
    if (resolved && !emittedQ.has(resolved.id)) {
      orderedQuestions.push(resolved);
      emittedQ.add(resolved.id);
    }
  }

  // 2. Merge Students by studentId
  const studentMap = new Map(current.students.map((s) => [s.studentId, s]));
  let studentsAdded = 0;
  let studentsUpdated = 0;
  for (const bs of pkg.students) {
    const existing = studentMap.get(bs.studentId);
    if (!existing) {
      studentMap.set(bs.studentId, bs);
      studentsAdded += 1;
    } else if (
      resolution === 'use_backup' &&
      (existing.name !== bs.name || existing.school !== bs.school)
    ) {
      studentMap.set(bs.studentId, bs);
      studentsUpdated += 1;
    }
  }

  // 3. Merge Student Answers by answerId
  const answerMap = new Map(current.studentAnswers.map((a) => [a.answerId, a]));
  let answersAdded = 0;
  for (const ba of pkg.studentAnswers) {
    const existing = answerMap.get(ba.answerId);
    if (!existing) {
      answerMap.set(ba.answerId, ba);
      answersAdded += 1;
    } else if (resolution === 'use_backup') {
      answerMap.set(ba.answerId, ba);
    }
  }

  // 4. Merge Exam Results by sessionId (retaining boxQuestionMap)
  const resultMap = new Map(current.examResults.map((r) => [r.sessionId, r]));
  let resultsAdded = 0;
  for (const br of pkg.examResults) {
    const existing = resultMap.get(br.sessionId);
    if (!existing) {
      resultMap.set(br.sessionId, br);
      resultsAdded += 1;
    } else if (resolution === 'use_backup') {
      resultMap.set(br.sessionId, br);
    }
  }

  // 5. Merge Stage Distribution & Exam Config
  const currentDistTotal =
    (current.stageDistribution['level-01']?.length ?? 0) +
    (current.stageDistribution['level-02']?.length ?? 0);
  const backupDistTotal =
    (pkg.stageDistribution['level-01']?.length ?? 0) +
    (pkg.stageDistribution['level-02']?.length ?? 0);

  const chosenStageDist =
    currentDistTotal === 0 || (resolution === 'use_backup' && backupDistTotal > 0)
      ? pkg.stageDistribution
      : current.stageDistribution;

  const cleanStageDist = sanitizeStageDistribution(chosenStageDist, orderedQuestions);
  const distributedBoxes =
    (cleanStageDist['level-01']?.length ?? 0) + (cleanStageDist['level-02']?.length ?? 0);

  const mergedConfig: ExamConfigRecord =
    !current.examConfig.confirmedAt || resolution === 'use_backup'
      ? {
          ...current.examConfig,
          examId: pkg.examConfig.examId || current.examConfig.examId,
          title: pkg.examConfig.title || current.examConfig.title,
          levelId: pkg.examConfig.levelId || current.examConfig.levelId,
          allowRepeatQuestions: pkg.examConfig.allowRepeatQuestions,
          activeSourceDocument:
            pkg.examConfig.activeSourceDocument ?? current.examConfig.activeSourceDocument,
          confirmedAt:
            pkg.examConfig.confirmedAt ??
            current.examConfig.confirmedAt ??
            (orderedQuestions.length > 0 ? new Date().toISOString() : null),
          spreadsheetId: pkg.examConfig.spreadsheetId || current.examConfig.spreadsheetId,
        }
      : current.examConfig;

  const mergedDistribution = computeDetectedDistribution(
    orderedQuestions,
    resolution === 'use_backup' ? pkg.distribution : current.distribution
  );

  const logDetails = `Restore backup (${pkg.createdAt}): +${questionsAdded} soal baru, ${questionsUpdated} soal diperbarui, ${questionsKept} soal dipertahankan, ${distributedBoxes} slot distribusi box, +${studentsAdded} siswa, +${resultsAdded} hasil ujian.`;

  const savedStore = TeacherStorage.restoreBackupStore(
    {
      examConfig: mergedConfig,
      questionBank: orderedQuestions,
      distribution: mergedDistribution,
      stageDistribution: cleanStageDist,
      students: Array.from(studentMap.values()),
      studentAnswers: Array.from(answerMap.values()),
      examResults: Array.from(resultMap.values()),
      activityLogs: current.activityLogs,
    },
    logDetails
  );

  return {
    ok: true,
    message: `Berhasil memulihkan data: ${orderedQuestions.length} Bank Soal (${questionsAdded} baru, ${questionsUpdated} diperbarui), ${distributedBoxes} distribusi box, ${savedStore.students.length} siswa, ${savedStore.examResults.length} hasil ujian.`,
    preRestoreSavedAt,
    restoredCounts: {
      questionsAdded,
      questionsUpdated,
      questionsKept,
      distributedBoxes,
      studentsAdded,
      studentsUpdated,
      answersAdded,
      resultsAdded,
    },
    store: savedStore,
  };
}
