import { MatchingPair, QuestionModelType } from '../game/types/gameTypes';

export const QUESTION_MODEL_ORDER: QuestionModelType[] = [
  'pilihan_ganda',
  'pilihan_ganda_kompleks',
  'benar_salah',
  'menjodohkan',
  'isian_singkat',
  'uraian',
];

export const QUESTION_MODEL_LABELS: Record<QuestionModelType, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  pilihan_ganda_kompleks: 'Pilihan Ganda Kompleks',
  benar_salah: 'Benar/Salah',
  menjodohkan: 'Menjodohkan',
  isian_singkat: 'Isian Singkat',
  uraian: 'Uraian',
};

export type AnswerKeyStatus = 'terbaca' | 'perlu_diperiksa' | 'belum_ditemukan';

export interface TeacherBankQuestion {
  id: string;
  originalNumber: string;
  type: QuestionModelType;
  prompt: string;
  question?: string;
  questionType?: QuestionModelType;
  options: string[];
  correctAnswer: string | string[] | null;
  answerKeyStatus?: AnswerKeyStatus;
  answerKeySource?: string | null;
  rubric?: string | null;
  explanation?: string | null;
  matchingPairs: MatchingPair[];
  weight: number | null;
  sourceDocument: string;
  enabled: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  imageFileId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type StageQuestionDistribution = Record<string, string[]>;

export interface StageDistributionValidation {
  valid: boolean;
  errors: string[];
  duplicateIds: string[];
  missingIds: string[];
}

export interface DistributionSummary {
  totalQuestions: number;
  enabledQuestions: number;
  distributedQuestions: number;
  undistributedQuestions: number;
  totalBoxCapacity: number;
  stage1Count: number;
  stage1Capacity: number;
  stage2Count: number;
  stage2Capacity: number;
  distributedIds: string[];
  undistributedIds: string[];
  boxQuestionMap: Record<string, Record<string, string>>;
}

export interface StageBoxDiagnosticMapping {
  levelId: 'level-01' | 'level-02';
  levelName: string;
  boxIndex: number;
  boxId: string;
  questionId: string | null;
  originalNumber: string | null;
  modelType: QuestionModelType | null;
  promptPreview: string;
  status: 'terhubung' | 'kosong';
}

export interface DocumentUploadMeta {
  docId: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSizeBytes: number;
  parsedAt: string;
  pageOrSectionCount: number;
}

export interface AnswerKeySummary {
  hasAnswerKeySection: boolean;
  extractedKeyCount: number;
  matchedCount: number;
  needsReviewCount: number;
  notFoundCount: number;
  unmatchedKeyNumbers: string[];
}

export interface ParsedDocumentPreview {
  meta: DocumentUploadMeta;
  rawText: string;
  questions: TeacherBankQuestion[];
  warnings: string[];
  answerKeySummary?: AnswerKeySummary;
}

export interface QuestionDistributionEntry {
  model: QuestionModelType;
  detectedCount: number;
  usedCount: number;
  enabled: boolean;
}

export type QuestionDistributionMap = Record<QuestionModelType, QuestionDistributionEntry>;

/** Entity 1: Konfigurasi Ujian */
export interface ExamConfigRecord {
  examId: string;
  title: string;
  levelId: string;
  allowRepeatQuestions: boolean;
  activeSourceDocument: string | null;
  confirmedAt: string | null;
  updatedAt: string;
  appsScriptUrl: string;
  spreadsheetId: string;
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastConnectionStatus?: 'untested' | 'connected' | 'error';
  lastSyncStatus: 'not_configured' | 'local_only' | 'synced' | 'error';
  lastSyncMessage: string;
}

/** Entity 4: Data Siswa */
export interface StudentRecord {
  studentId: string;
  name: string;
  school: string;
  createdAt: string;
  lastPlayedAt: string;
}

/** Entity 5: Jawaban Siswa */
export interface StudentAnswerRecord {
  answerId: string;
  sessionId: string;
  examId: string;
  studentId: string;
  boxId: string;
  questionId: string;
  modelType: QuestionModelType;
  answerPayload: string;
  isCorrect: boolean;
  scoreAwarded: number;
  answeredAt: string;
}

/** Entity 6: Hasil Ujian */
export interface ExamResultRecord {
  sessionId: string;
  examId: string;
  studentId: string;
  levelId: string;
  totalScore: number;
  questionsAnswered: number;
  correctCount: number;
  startedAt: string;
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'game_over';
  boxQuestionMap: Record<string, string>;
}

/** Entity 7: Log Aktivitas */
export interface ActivityLogRecord {
  logId: string;
  timestamp: string;
  actorRole: 'teacher' | 'student' | 'system';
  action: string;
  details: string;
}

export interface TeacherPinConfig {
  saltHex: string;
  hashHex: string;
  updatedAt: string;
}

export type SyncQueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type SyncEntityAction =
  | 'initializeSheets'
  | 'saveConfig'
  | 'saveQuestions'
  | 'saveDistribution'
  | 'saveStudent'
  | 'saveAnswer'
  | 'saveExamResult';

export type SyncSheetEntityType =
  | 'KONFIGURASI'
  | 'BANK_SOAL'
  | 'DISTRIBUSI_SOAL'
  | 'DATA_SISWA'
  | 'JAWABAN_SISWA'
  | 'HASIL_UJIAN';

export interface SyncQueueItem {
  operationId: string;
  dedupKey: string;
  action: SyncEntityAction;
  entityType: SyncSheetEntityType;
  entityId: string;
  payload: unknown;
  status: SyncQueueStatus;
  attempts: number;
  lastAttemptAt: string | null;
  syncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueStats {
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  totalCount: number;
  items: SyncQueueItem[];
}

export interface SheetsBackendResponse {
  success: boolean;
  action: string;
  saved?: number;
  updated?: number;
  skipped?: number;
  deduplicated?: boolean;
  errors?: string[];
  spreadsheetName?: string;
  spreadsheetId?: string;
  availableSheets?: string[];
  timestamp?: string;
}

export interface TeacherStoreSnapshot {
  examConfig: ExamConfigRecord;
  questionBank: TeacherBankQuestion[];
  distribution: QuestionDistributionMap;
  stageDistribution: StageQuestionDistribution;
  students: StudentRecord[];
  studentAnswers: StudentAnswerRecord[];
  examResults: ExamResultRecord[];
  activityLogs: ActivityLogRecord[];
}
