import {
  ExamConfigRecord,
  ExamResultRecord,
  SheetsBackendResponse,
  StageQuestionDistribution,
  StudentAnswerRecord,
  StudentRecord,
  SyncEntityAction,
  SyncQueueItem,
  SyncQueueStats,
  TeacherBankQuestion,
} from './teacherTypes';

const SYNC_QUEUE_STORAGE_KEY = 'exam_eduverse_sync_queue_v1';
const ENDPOINT_STORAGE_KEY = 'exam_eduverse_sheets_endpoint_v1';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_QUEUE_ITEMS = 400;

export interface EndpointValidationResult {
  valid: boolean;
  normalizedUrl: string;
  normalizedSpreadsheetId: string;
  error?: string;
}

export interface SyncOperationOutcome {
  ok: boolean;
  action: string;
  message: string;
  response?: SheetsBackendResponse;
  stats: SyncQueueStats;
}

export interface SheetsEndpointConfig {
  appsScriptUrl: string;
  spreadsheetId: string;
}

type QueueListener = (stats: SyncQueueStats) => void;

const listeners = new Set<QueueListener>();
let onlineListenerAttached = false;
let activeFlushPromise: Promise<SyncOperationOutcome> | null = null;

function makeOperationId(prefix = 'op'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

export function validateAppsScriptUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'URL Google Apps Script Web App belum diisi.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error:
        'Format URL tidak valid. Gunakan URL Web App Google Apps Script berawalan https://script.google.com/macros/s/.../exec',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error: 'URL Apps Script harus menggunakan protokol HTTPS.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.')
  ) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error: 'Host lokal/privat tidak diizinkan untuk endpoint Google Apps Script.',
    };
  }

  const isGoogleScriptHost =
    host === 'script.google.com' || host.endsWith('.googleusercontent.com');
  if (!isGoogleScriptHost) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error:
        'Domain harus berupa endpoint Web App Google Apps Script (script.google.com/macros/s/.../exec).',
    };
  }

  if (parsed.pathname.includes('/edit')) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error:
        'URL yang dimasukkan adalah halaman editor (/edit), bukan URL Web App deployment (/exec).',
    };
  }

  if (!parsed.pathname.includes('/macros/')) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error:
        'Path URL Apps Script harus mengarah ke deployment Web App (/macros/s/.../exec).',
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

export function validateSpreadsheetId(rawId: string): {
  valid: boolean;
  normalizedId: string;
  error?: string;
} {
  const trimmed = rawId.trim();
  if (!trimmed) {
    // Opsional apabila Apps Script terikat langsung ke Google Spreadsheet (bound script)
    return { valid: true, normalizedId: '' };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      valid: false,
      normalizedId: trimmed,
      error:
        'Masukkan hanya Spreadsheet ID (bagian setelah /d/ dan sebelum /edit), bukan URL Spreadsheet lengkap.',
    };
  }

  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(trimmed)) {
    return {
      valid: false,
      normalizedId: trimmed,
      error:
        'Format Spreadsheet ID tidak valid (hanya huruf, angka, "-" atau "_", minimal 12 karakter).',
    };
  }

  return { valid: true, normalizedId: trimmed };
}

export function validateEndpointConfig(
  rawUrl: string,
  rawSpreadsheetId: string
): EndpointValidationResult {
  const urlCheck = validateAppsScriptUrl(rawUrl);
  if (!urlCheck.valid) {
    return {
      valid: false,
      normalizedUrl: urlCheck.normalizedUrl,
      normalizedSpreadsheetId: rawSpreadsheetId.trim(),
      error: urlCheck.error,
    };
  }

  const idCheck = validateSpreadsheetId(rawSpreadsheetId);
  if (!idCheck.valid) {
    return {
      valid: false,
      normalizedUrl: urlCheck.normalizedUrl,
      normalizedSpreadsheetId: idCheck.normalizedId,
      error: idCheck.error,
    };
  }

  return {
    valid: true,
    normalizedUrl: urlCheck.normalizedUrl,
    normalizedSpreadsheetId: idCheck.normalizedId,
  };
}

function readQueueFromStorage(): SyncQueueItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Recover any stale "syncing" items left behind by a page refresh
    return parsed
      .filter((item): item is SyncQueueItem => Boolean(item && typeof item === 'object' && 'operationId' in item))
      .map((item) =>
        item.status === 'syncing' ? { ...item, status: 'pending' as const } : item
      );
  } catch {
    return [];
  }
}

function writeQueueToStorage(items: SyncQueueItem[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const bounded = items.slice(-MAX_QUEUE_ITEMS);
    window.localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function computeStats(items: SyncQueueItem[]): SyncQueueStats {
  let pendingCount = 0;
  let syncingCount = 0;
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    if (item.status === 'pending') pendingCount += 1;
    else if (item.status === 'syncing') syncingCount += 1;
    else if (item.status === 'synced') syncedCount += 1;
    else if (item.status === 'failed') failedCount += 1;
  }

  return {
    pendingCount,
    syncingCount,
    syncedCount,
    failedCount,
    totalCount: items.length,
    items,
  };
}

function notifyListeners(items: SyncQueueItem[]): SyncQueueStats {
  const stats = computeStats(items);
  listeners.forEach((cb) => {
    try {
      cb(stats);
    } catch {
      // Ignore subscriber errors
    }
  });
  return stats;
}

function readStoredEndpoint(): SheetsEndpointConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { appsScriptUrl: '', spreadsheetId: '' };
    }
    const raw = window.localStorage.getItem(ENDPOINT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SheetsEndpointConfig>;
      return {
        appsScriptUrl: typeof parsed.appsScriptUrl === 'string' ? parsed.appsScriptUrl : '',
        spreadsheetId: typeof parsed.spreadsheetId === 'string' ? parsed.spreadsheetId : '',
      };
    }
    // Fallback read from main teacher store examConfig if present
    const storeRaw = window.localStorage.getItem('exam_eduverse_teacher_store_v1');
    if (storeRaw) {
      const parsedStore = JSON.parse(storeRaw) as {
        examConfig?: { appsScriptUrl?: string; spreadsheetId?: string };
      };
      return {
        appsScriptUrl: parsedStore.examConfig?.appsScriptUrl ?? '',
        spreadsheetId: parsedStore.examConfig?.spreadsheetId ?? '',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { appsScriptUrl: '', spreadsheetId: '' };
}

function saveStoredEndpoint(config: SheetsEndpointConfig): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(ENDPOINT_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export function mapQuestionToSheetRow(q: TeacherBankQuestion): Record<string, unknown> {
  const now = new Date().toISOString();
  const safeRemoteImageUrl =
    q.imageUrl &&
    !q.imageUrl.startsWith('data:image/') &&
    !q.imageUrl.startsWith('blob:')
      ? q.imageUrl
      : q.image &&
          !q.image.startsWith('data:image/') &&
          !q.image.startsWith('blob:') &&
          !q.image.startsWith('idb://')
        ? q.image
        : '';

  return {
    questionId: q.id,
    questionType: q.type,
    questionText: q.prompt,
    options: JSON.stringify({
      options: q.options ?? [],
      matchingPairs: q.matchingPairs ?? [],
      weight: q.weight ?? 150,
      enabled: q.enabled,
      originalNumber: q.originalNumber,
      needsReview: q.needsReview,
      answerKeyStatus: q.answerKeyStatus ?? null,
      answerKeySource: q.answerKeySource ?? null,
      rubric: q.rubric ?? null,
      hasLocalImage: Boolean(q.image),
      imageAlt: q.imageAlt ?? null,
    }),
    correctAnswer: Array.isArray(q.correctAnswer)
      ? q.correctAnswer.join(', ')
      : q.correctAnswer ?? '',
    explanation: q.explanation ?? '',
    imageUrl: safeRemoteImageUrl,
    imageFileId: q.imageFileId ?? '',
    sourceDocument: q.sourceDocument ?? '',
    createdAt: q.createdAt ?? now,
    updatedAt: q.updatedAt ?? now,
    originalNumber: q.originalNumber ?? '',
  };
}

export function mapStageDistributionToSheetRows(
  stageDistribution: StageQuestionDistribution,
  getBoxIds: (levelId: string) => string[]
): Array<Record<string, unknown>> {
  const now = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];

  for (const levelId of ['level-01', 'level-02']) {
    const boxIds = getBoxIds(levelId);
    const assigned = stageDistribution[levelId] ?? [];
    for (let idx = 0; idx < assigned.length; idx++) {
      const boxId = boxIds[idx] ?? `box-${idx + 1}`;
      const questionId = assigned[idx];
      if (!questionId) continue;
      rows.push({
        distributionId: `${levelId}:${boxId}`,
        levelId,
        boxId,
        questionId,
        orderIndex: idx + 1,
        updatedAt: now,
      });
    }
  }

  return rows;
}

export function mapStudentToSheetRow(student: StudentRecord): Record<string, unknown> {
  return {
    studentId: student.studentId,
    studentName: student.name,
    className: student.school,
    createdAt: student.createdAt,
    updatedAt: student.lastPlayedAt,
  };
}

export function mapAnswerToSheetRow(
  answer: StudentAnswerRecord,
  levelId: string
): Record<string, unknown> {
  return {
    answerId: answer.answerId,
    sessionId: answer.sessionId,
    studentId: answer.studentId,
    levelId,
    boxId: answer.boxId,
    questionId: answer.questionId,
    studentAnswer: answer.answerPayload,
    isCorrect: answer.isCorrect,
    answeredAt: answer.answeredAt,
  };
}

export function mapExamResultToSheetRow(
  session: ExamResultRecord,
  student: StudentRecord | undefined,
  totalQuestionsOverride?: number
): Record<string, unknown> {
  const totalQuestions =
    totalQuestionsOverride ??
    Math.max(session.questionsAnswered, Object.keys(session.boxQuestionMap ?? {}).length);
  const incorrectCount = Math.max(0, session.questionsAnswered - session.correctCount);

  return {
    resultId: session.sessionId,
    sessionId: session.sessionId,
    studentId: session.studentId,
    studentName: student?.name ?? session.studentId,
    className: student?.school ?? '-',
    totalQuestions,
    correctCount: session.correctCount,
    incorrectCount,
    score: session.totalScore,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? '',
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseAndValidateResponse(
  response: Response,
  expectedAction: string
): Promise<SheetsBackendResponse> {
  if (!response.ok) {
    throw new Error(`Endpoint mengembalikan HTTP ${response.status} (${response.statusText || 'Error'}).`);
  }

  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    throw new Error('Respons dari Google Apps Script kosong.');
  }

  let parsed: SheetsBackendResponse;
  try {
    parsed = JSON.parse(rawText) as SheetsBackendResponse;
  } catch {
    throw new Error(
      'Respons dari URL bukan JSON valid. Pastikan Apps Script di-deploy sebagai Web App dengan akses "Anyone" dan URL berakhiran /exec.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || parsed.success !== true) {
    const errList =
      Array.isArray(parsed?.errors) && parsed.errors.length > 0
        ? parsed.errors.join('; ')
        : `Operasi "${expectedAction}" ditolak oleh backend Apps Script.`;
    throw new Error(errList);
  }

  return parsed;
}

export const GoogleSheetsSyncService = {
  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    listener(this.getQueueStats());
    return () => {
      listeners.delete(listener);
    };
  },

  attachAutoOnlineFlush(): void {
    if (onlineListenerAttached || typeof window === 'undefined') return;
    onlineListenerAttached = true;
    window.addEventListener('online', () => {
      const stats = this.getQueueStats();
      if (stats.pendingCount > 0 || stats.failedCount > 0) {
        void this.flushQueue();
      }
    });
  },

  getEndpointConfig(): SheetsEndpointConfig {
    return readStoredEndpoint();
  },

  setEndpointConfig(appsScriptUrl: string, spreadsheetId: string): EndpointValidationResult {
    const trimmedUrl = appsScriptUrl.trim();
    const trimmedId = spreadsheetId.trim();

    if (!trimmedUrl && !trimmedId) {
      saveStoredEndpoint({ appsScriptUrl: '', spreadsheetId: '' });
      return { valid: true, normalizedUrl: '', normalizedSpreadsheetId: '' };
    }

    const validation = validateEndpointConfig(trimmedUrl, trimmedId);
    if (!validation.valid) {
      return validation;
    }

    saveStoredEndpoint({
      appsScriptUrl: validation.normalizedUrl,
      spreadsheetId: validation.normalizedSpreadsheetId,
    });
    return validation;
  },

  syncEndpointFromExamConfig(examConfig: ExamConfigRecord): void {
    const curr = readStoredEndpoint();
    if (
      curr.appsScriptUrl !== examConfig.appsScriptUrl ||
      curr.spreadsheetId !== examConfig.spreadsheetId
    ) {
      saveStoredEndpoint({
        appsScriptUrl: examConfig.appsScriptUrl.trim(),
        spreadsheetId: examConfig.spreadsheetId.trim(),
      });
    }
  },

  getQueueStats(): SyncQueueStats {
    return computeStats(readQueueFromStorage());
  },

  clearSyncedFromQueue(): SyncQueueStats {
    const remaining = readQueueFromStorage().filter((item) => item.status !== 'synced');
    writeQueueToStorage(remaining);
    return notifyListeners(remaining);
  },

  enqueueOperation(params: {
    dedupKey: string;
    action: SyncEntityAction;
    entityType: SyncQueueItem['entityType'];
    entityId: string;
    payload: unknown;
  }): { item: SyncQueueItem; stats: SyncQueueStats; deduplicated: boolean } {
    const now = new Date().toISOString();
    const items = readQueueFromStorage();
    const existingPendingIdx = items.findIndex(
      (x) =>
        x.dedupKey === params.dedupKey &&
        (x.status === 'pending' || x.status === 'failed' || x.status === 'syncing')
    );

    if (existingPendingIdx >= 0) {
      const existing = items[existingPendingIdx];
      const updatedItem: SyncQueueItem = {
        ...existing,
        operationId: makeOperationId('op'),
        payload: params.payload,
        status: 'pending',
        errorMessage: null,
        updatedAt: now,
      };
      items[existingPendingIdx] = updatedItem;
      writeQueueToStorage(items);
      const stats = notifyListeners(items);
      return { item: updatedItem, stats, deduplicated: true };
    }

    const newItem: SyncQueueItem = {
      operationId: makeOperationId('op'),
      dedupKey: params.dedupKey,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      syncedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextItems = [...items, newItem].slice(-MAX_QUEUE_ITEMS);
    writeQueueToStorage(nextItems);
    const stats = notifyListeners(nextItems);
    return { item: newItem, stats, deduplicated: false };
  },

  async testConnection(
    overrideConfig?: Partial<SheetsEndpointConfig>
  ): Promise<SyncOperationOutcome> {
    const stored = readStoredEndpoint();
    const rawUrl = overrideConfig?.appsScriptUrl ?? stored.appsScriptUrl;
    const rawId = overrideConfig?.spreadsheetId ?? stored.spreadsheetId;
    const validation = validateEndpointConfig(rawUrl, rawId);

    if (!validation.valid) {
      return {
        ok: false,
        action: 'ping',
        message: validation.error ?? 'Konfigurasi endpoint Google Apps Script tidak valid.',
        stats: this.getQueueStats(),
      };
    }

    if (!isBrowserOnline()) {
      return {
        ok: false,
        action: 'ping',
        message: 'Koneksi internet sedang offline. Uji koneksi membutuhkan jaringan internet.',
        stats: this.getQueueStats(),
      };
    }

    try {
      const url = new URL(validation.normalizedUrl);
      url.searchParams.set('action', 'ping');
      if (validation.normalizedSpreadsheetId) {
        url.searchParams.set('spreadsheetId', validation.normalizedSpreadsheetId);
      }
      const res = await fetchWithTimeout(url.toString(), { method: 'GET' });
      const data = await parseAndValidateResponse(res, 'ping');
      const sheetCount = Array.isArray(data.availableSheets)
        ? data.availableSheets.length
        : 0;
      const targetName = data.spreadsheetName
        ? `"${data.spreadsheetName}"`
        : 'Spreadsheet target';
      return {
        ok: true,
        action: 'ping',
        message: `Terhubung ke ${targetName} (${sheetCount} sheet terdeteksi).`,
        response: data,
        stats: this.getQueueStats(),
      };
    } catch (err) {
      const detail =
        err instanceof Error && err.name === 'AbortError'
          ? 'Permintaan timeout (>15 detik) saat menghubungi Apps Script.'
          : err instanceof Error
            ? err.message
            : 'Gagal menghubungi endpoint Google Apps Script.';
      return {
        ok: false,
        action: 'ping',
        message: `Uji koneksi gagal: ${detail}`,
        stats: this.getQueueStats(),
      };
    }
  },

  async executePostAction(
    action: string,
    payloadData: unknown,
    operationId: string,
    overrideConfig?: Partial<SheetsEndpointConfig>
  ): Promise<SheetsBackendResponse> {
    const stored = readStoredEndpoint();
    const rawUrl = overrideConfig?.appsScriptUrl ?? stored.appsScriptUrl;
    const rawId = overrideConfig?.spreadsheetId ?? stored.spreadsheetId;
    const validation = validateEndpointConfig(rawUrl, rawId);

    if (!validation.valid) {
      throw new Error(validation.error ?? 'Endpoint Google Apps Script belum valid.');
    }

    if (!isBrowserOnline()) {
      throw new Error('Tidak ada koneksi internet (offline). Data disimpan di antrean lokal.');
    }

    // Menggunakan text/plain agar Google Apps Script Web App tidak terblokir CORS preflight
    const res = await fetchWithTimeout(validation.normalizedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        spreadsheetId: validation.normalizedSpreadsheetId,
        operationId,
        data: payloadData,
      }),
    });

    return parseAndValidateResponse(res, action);
  },

  async initializeRemoteSheets(
    overrideConfig?: Partial<SheetsEndpointConfig>
  ): Promise<SyncOperationOutcome> {
    const opId = makeOperationId('init');
    try {
      const data = await this.executePostAction('initializeSheets', {}, opId, overrideConfig);
      return {
        ok: true,
        action: 'initializeSheets',
        message: `7 sheet Google Sheets siap digunakan di "${data.spreadsheetName ?? 'Spreadsheet'}".`,
        response: data,
        stats: this.getQueueStats(),
      };
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Timeout saat menginisialisasi 7 sheet.'
          : err instanceof Error
            ? err.message
            : 'Gagal menginisialisasi sheet.';
      return {
        ok: false,
        action: 'initializeSheets',
        message: msg,
        stats: this.getQueueStats(),
      };
    }
  },

  enqueueQuestions(questions: TeacherBankQuestion[]): SyncQueueStats {
    let stats = this.getQueueStats();
    for (const q of questions) {
      const res = this.enqueueOperation({
        dedupKey: `saveQuestions:${q.id}`,
        action: 'saveQuestions',
        entityType: 'BANK_SOAL',
        entityId: q.id,
        payload: mapQuestionToSheetRow(q),
      });
      stats = res.stats;
    }
    return stats;
  },

  enqueueDistribution(
    stageDistribution: StageQuestionDistribution,
    getBoxIds: (levelId: string) => string[]
  ): SyncQueueStats {
    const rows = mapStageDistributionToSheetRows(stageDistribution, getBoxIds);
    if (rows.length === 0) {
      return this.getQueueStats();
    }
    const res = this.enqueueOperation({
      dedupKey: 'saveDistribution:stages',
      action: 'saveDistribution',
      entityType: 'DISTRIBUSI_SOAL',
      entityId: 'stages-1-2',
      payload: rows,
    });
    return res.stats;
  },

  enqueueStudent(student: StudentRecord): SyncQueueStats {
    return this.enqueueOperation({
      dedupKey: `saveStudent:${student.studentId}`,
      action: 'saveStudent',
      entityType: 'DATA_SISWA',
      entityId: student.studentId,
      payload: mapStudentToSheetRow(student),
    }).stats;
  },

  enqueueAnswer(answer: StudentAnswerRecord, levelId: string): SyncQueueStats {
    return this.enqueueOperation({
      dedupKey: `saveAnswer:${answer.answerId}`,
      action: 'saveAnswer',
      entityType: 'JAWABAN_SISWA',
      entityId: answer.answerId,
      payload: mapAnswerToSheetRow(answer, levelId),
    }).stats;
  },

  enqueueExamResult(
    session: ExamResultRecord,
    student: StudentRecord | undefined,
    totalQuestionsOverride?: number
  ): SyncQueueStats {
    return this.enqueueOperation({
      dedupKey: `saveExamResult:${session.sessionId}`,
      action: 'saveExamResult',
      entityType: 'HASIL_UJIAN',
      entityId: session.sessionId,
      payload: mapExamResultToSheetRow(session, student, totalQuestionsOverride),
    }).stats;
  },

  async flushQueue(options?: {
    filterActions?: SyncEntityAction[];
    overrideConfig?: Partial<SheetsEndpointConfig>;
    includeFailed?: boolean;
  }): Promise<SyncOperationOutcome> {
    if (activeFlushPromise) {
      await activeFlushPromise;
      return this.flushQueue(options);
    }

    const runner = (async (): Promise<SyncOperationOutcome> => {
      const includeFailed = options?.includeFailed ?? true;
      const filterSet = options?.filterActions ? new Set(options.filterActions) : null;
      const currentItems = readQueueFromStorage();

      const targetIndices: number[] = [];
      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        const statusEligible =
          item.status === 'pending' || (includeFailed && item.status === 'failed');
        const actionEligible = !filterSet || filterSet.has(item.action);
        if (statusEligible && actionEligible) {
          targetIndices.push(i);
        }
      }

      if (targetIndices.length === 0) {
        const stats = notifyListeners(currentItems);
        return {
          ok: true,
          action: 'flushQueue',
          message: 'Tidak ada item antrean pending/gagal untuk dikirim.',
          stats,
        };
      }

      const stored = readStoredEndpoint();
      const validation = validateEndpointConfig(
        options?.overrideConfig?.appsScriptUrl ?? stored.appsScriptUrl,
        options?.overrideConfig?.spreadsheetId ?? stored.spreadsheetId
      );

      if (!validation.valid) {
        const errMsg = validation.error ?? 'Endpoint Apps Script belum valid.';
        const now = new Date().toISOString();
        for (const idx of targetIndices) {
          currentItems[idx] = {
            ...currentItems[idx],
            status: 'pending',
            errorMessage: errMsg,
            updatedAt: now,
          };
        }
        writeQueueToStorage(currentItems);
        const stats = notifyListeners(currentItems);
        return {
          ok: false,
          action: 'flushQueue',
          message: `${errMsg} (${targetIndices.length} item tetap aman di antrean lokal).`,
          stats,
        };
      }

      if (!isBrowserOnline()) {
        const now = new Date().toISOString();
        for (const idx of targetIndices) {
          currentItems[idx] = {
            ...currentItems[idx],
            status: 'pending',
            errorMessage: 'Menunggu koneksi internet kembali online.',
            updatedAt: now,
          };
        }
        writeQueueToStorage(currentItems);
        const stats = notifyListeners(currentItems);
        return {
          ok: false,
          action: 'flushQueue',
          message: `Koneksi internet sedang offline. ${targetIndices.length} item tersimpan aman di antrean pending.`,
          stats,
        };
      }

      // Group saveQuestions / saveStudent / saveAnswer / saveExamResult items for efficient batching
      const groups = new Map<SyncEntityAction, number[]>();
      for (const idx of targetIndices) {
        const act = currentItems[idx].action;
        const arr = groups.get(act) ?? [];
        arr.push(idx);
        groups.set(act, arr);
      }

      let syncedBatchCount = 0;
      let failedBatchCount = 0;
      let lastErrorMessage: string | null = null;
      let lastResponse: SheetsBackendResponse | undefined;

      const patchByOpIds = (
        opIds: Set<string>,
        updater: (item: SyncQueueItem) => SyncQueueItem
      ): SyncQueueItem[] => {
        const latest = readQueueFromStorage();
        const patched = latest.map((item) =>
          opIds.has(item.operationId) ? updater(item) : item
        );
        writeQueueToStorage(patched);
        notifyListeners(patched);
        return patched;
      };

      for (const [action, indices] of groups.entries()) {
        const batchItems = indices.map((idx) => currentItems[idx]);
        const batchOpIdSet = new Set(batchItems.map((it) => it.operationId));
        const nowAttempt = new Date().toISOString();

        patchByOpIds(batchOpIdSet, (item) => ({
          ...item,
          status: 'syncing',
          attempts: item.attempts + 1,
          lastAttemptAt: nowAttempt,
          updatedAt: nowAttempt,
        }));

        const batchOpId =
          batchItems.length === 1
            ? batchItems[0].operationId
            : makeOperationId(`batch-${action}`);

        const payloadToSend =
          action === 'saveDistribution' || action === 'saveConfig'
            ? batchItems.flatMap((it) => {
                const p = it.payload;
                return Array.isArray(p) ? p : [p];
              })
            : batchItems.map((it) => it.payload);

        try {
          const response = await this.executePostAction(
            action,
            payloadToSend,
            batchOpId,
            options?.overrideConfig
          );
          lastResponse = response;
          const nowDone = new Date().toISOString();
          patchByOpIds(batchOpIdSet, (item) => ({
            ...item,
            status: 'synced',
            syncedAt: nowDone,
            errorMessage: null,
            updatedAt: nowDone,
          }));
          syncedBatchCount += batchItems.length;
        } catch (err) {
          const msg =
            err instanceof Error && err.name === 'AbortError'
              ? 'Timeout (>15 detik) saat mengirim ke Apps Script.'
              : err instanceof Error
                ? err.message
                : 'Gagal mengirim data ke Google Sheets.';
          lastErrorMessage = msg;
          const nowFail = new Date().toISOString();
          patchByOpIds(batchOpIdSet, (item) => ({
            ...item,
            status: isBrowserOnline() ? 'failed' : 'pending',
            errorMessage: msg,
            updatedAt: nowFail,
          }));
          failedBatchCount += batchItems.length;
        }
      }

      const finalStats = notifyListeners(readQueueFromStorage());
      if (failedBatchCount === 0) {
        return {
          ok: true,
          action: 'flushQueue',
          message: `Sinkronisasi berhasil (${syncedBatchCount} item terkirim ke Google Sheets).`,
          response: lastResponse,
          stats: finalStats,
        };
      }

      return {
        ok: false,
        action: 'flushQueue',
        message:
          syncedBatchCount > 0
            ? `Sebagian tersinkron (${syncedBatchCount} berhasil, ${failedBatchCount} gagal): ${lastErrorMessage}`
            : `Sinkronisasi gagal (${failedBatchCount} item tetap di antrean): ${lastErrorMessage}`,
        response: lastResponse,
        stats: finalStats,
      };
    })();

    activeFlushPromise = runner;
    try {
      return await runner;
    } finally {
      activeFlushPromise = null;
    }
  },

  async fetchRemoteQuestionsAndDistribution(
    overrideConfig?: Partial<SheetsEndpointConfig>
  ): Promise<{
    ok: boolean;
    message: string;
    questions: Array<Record<string, unknown>>;
    distribution: Array<Record<string, unknown>>;
  }> {
    const stored = readStoredEndpoint();
    const validation = validateEndpointConfig(
      overrideConfig?.appsScriptUrl ?? stored.appsScriptUrl,
      overrideConfig?.spreadsheetId ?? stored.spreadsheetId
    );
    if (!validation.valid) {
      return {
        ok: false,
        message: validation.error ?? 'Endpoint Google Apps Script belum dikonfigurasi.',
        questions: [],
        distribution: [],
      };
    }
    if (!isBrowserOnline()) {
      return {
        ok: false,
        message: 'Koneksi internet sedang offline. Menggunakan Bank Soal lokal.',
        questions: [],
        distribution: [],
      };
    }
    try {
      const qUrl = new URL(validation.normalizedUrl);
      qUrl.searchParams.set('action', 'getQuestions');
      if (validation.normalizedSpreadsheetId) {
        qUrl.searchParams.set('spreadsheetId', validation.normalizedSpreadsheetId);
      }
      const dUrl = new URL(validation.normalizedUrl);
      dUrl.searchParams.set('action', 'getDistribution');
      if (validation.normalizedSpreadsheetId) {
        dUrl.searchParams.set('spreadsheetId', validation.normalizedSpreadsheetId);
      }

      const [qRes, dRes] = await Promise.all([
        fetchWithTimeout(qUrl.toString(), { method: 'GET' }),
        fetchWithTimeout(dUrl.toString(), { method: 'GET' }),
      ]);
      const qData = (await parseAndValidateResponse(qRes, 'getQuestions')) as SheetsBackendResponse & {
        questions?: Array<Record<string, unknown>>;
      };
      const dData = (await parseAndValidateResponse(dRes, 'getDistribution')) as SheetsBackendResponse & {
        distribution?: Array<Record<string, unknown>>;
      };
      const questions = Array.isArray(qData.questions) ? qData.questions : [];
      const distribution = Array.isArray(dData.distribution) ? dData.distribution : [];
      return {
        ok: true,
        message: `Berhasil membaca ${questions.length} soal dan ${distribution.length} distribusi box dari Google Sheets.`,
        questions,
        distribution,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Gagal membaca data dari Google Sheets.',
        questions: [],
        distribution: [],
      };
    }
  },
};
