import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Cloud,
  CloudOff,
  Code2,
  Database,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  ImagePlus,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { QuestionModelType } from '../game/types/gameTypes';
import {
  generateAppsScriptCode,
  GOOGLE_APPS_SCRIPT_CODE,
  validateAppsScriptSourceCode,
  validateBackupTsvSource,
} from '../teacher/appsScriptGenerator';
import {
  BackupValidationResult,
  createBackupFromStorage,
  executeBackupRestore,
  GeneratedBackupOutput,
  getPreRestoreBackupInfo,
  RestoreConflictResolution,
  RestoreExecutionResult,
  validateBackupText,
} from '../teacher/backupService';
import {
  formatFileSize,
  parseQuestionDocument,
  validateDocumentFile,
} from '../teacher/documentParser';
import {
  computeDetectedDistribution,
  evaluateQuestionAnswerKey,
} from '../teacher/questionClassifier';
import {
  hydrateTeacherMediaCache,
  processQuestionImageFile,
  resolveQuestionImage,
} from '../teacher/questionMediaStorage';
import {
  generateNextBankQuestionId,
  getDistributionSummary,
  TeacherStorage,
} from '../teacher/teacherStorage';
import {
  AnswerKeyStatus,
  ParsedDocumentPreview,
  QUESTION_MODEL_LABELS,
  QUESTION_MODEL_ORDER,
  QuestionDistributionMap,
  TeacherBankQuestion,
  TeacherStoreSnapshot,
} from '../teacher/teacherTypes';
import { validateEndpointConfig } from '../teacher/googleSheetsSyncService';

interface TeacherModeDashboardProps {
  onBack: () => void;
}

type DashboardStep = 'upload' | 'edit' | 'bank' | 'codegs' | 'sync';

interface StepDefinition {
  id: DashboardStep;
  number: string;
  label: string;
}

const FLOW_STEPS: StepDefinition[] = [
  { id: 'upload', number: '01', label: 'Upload' },
  { id: 'edit', number: '02', label: 'Edit' },
  { id: 'bank', number: '03', label: 'Bank Soal' },
  { id: 'codegs', number: '04', label: 'Code.gs' },
  { id: 'sync', number: '05', label: 'Sinkronisasi' },
];

interface SyncSuccessSummary {
  totalQuestions: number;
  syncedQuestions: number;
  connectedBoxes: number;
  totalBoxCapacity: number;
  sheetsSyncNote?: string;
  completedAt: string;
}

function resolveTrueFalseSelection(
  value: TeacherBankQuestion['correctAnswer'] | boolean | undefined
): 'Benar' | 'Salah' | null {
  if (typeof value === 'boolean') {
    return value ? 'Benar' : 'Salah';
  }
  if (typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase();
  if (/^(benar|true|ya|betul|t)$/.test(clean)) return 'Benar';
  if (/^(salah|false|tidak|keliru|f|s)$/.test(clean)) return 'Salah';
  return null;
}

function formatShortAnswerKey(q: TeacherBankQuestion): string {
  if (q.type === 'menjodohkan') {
    return q.matchingPairs.length > 0
      ? q.matchingPairs.map((p, i) => `${i + 1}. ${p.left} → ${p.right}`).join(' · ')
      : 'Belum diatur';
  }
  if (q.type === 'uraian') {
    const rubric =
      q.rubric || (typeof q.correctAnswer === 'string' ? q.correctAnswer : '');
    return rubric.trim() || 'Belum ada pedoman';
  }
  if (Array.isArray(q.correctAnswer)) {
    return q.correctAnswer.join(', ') || 'Belum dipilih';
  }
  return q.correctAnswer ? String(q.correctAnswer) : 'Belum diisi';
}

// Reusable Dark Glassmorphism surface tokens
const GLASS_CARD =
  'rounded-3xl border border-white/[0.14] bg-white/[0.06] backdrop-blur-xl shadow-[0_20px_50px_rgba(2,6,23,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]';
const GLASS_SUBPANEL =
  'rounded-2xl border border-white/[0.11] bg-[#09122b]/55 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
const GLASS_INPUT =
  'w-full rounded-xl border border-white/[0.15] bg-[#060d21]/75 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:border-pink-400/75 focus:outline-none focus:ring-2 focus:ring-pink-400/25';
const BTN_PINK_GLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-300/45 bg-gradient-to-r from-pink-500/85 via-rose-500/85 to-pink-600/85 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md shadow-[0_0_24px_rgba(236,72,153,0.32),inset_0_1px_0_rgba(255,255,255,0.28)] transition hover:brightness-110 hover:shadow-[0_0_30px_rgba(236,72,153,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 cursor-pointer whitespace-nowrap';
const BTN_DARK_GLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.16] bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-slate-100 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:bg-white/[0.13] hover:border-cyan-300/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 cursor-pointer whitespace-nowrap';
const BTN_BLUE_PINK_GLASS =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-300/40 bg-gradient-to-r from-[#0e1e49]/90 via-[#19285e]/90 to-pink-500/35 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md shadow-[0_0_20px_rgba(236,72,153,0.2),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-pink-300/65 hover:shadow-[0_0_26px_rgba(236,72,153,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 cursor-pointer whitespace-nowrap';
const BTN_RESET_GLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-300/35 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200 backdrop-blur-md shadow-[0_0_16px_rgba(244,63,94,0.16),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:bg-rose-500/25 hover:border-rose-300/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 cursor-pointer whitespace-nowrap';

export function TeacherModeDashboard({ onBack }: TeacherModeDashboardProps) {
  const [hasPin, setHasPin] = useState(() => TeacherStorage.hasConfiguredPin());
  const [authenticated, setAuthenticated] = useState(false);

  // PIN gate state
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  // 5-Step Guided Flow & Store State
  const [activeStep, setActiveStep] = useState<DashboardStep>('upload');
  const [store, setStore] = useState<TeacherStoreSnapshot>(() => TeacherStorage.loadStore());
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Step 01 & 02: Upload + Preview & Edit + Reset Dialog
  const [selectedFileInfo, setSelectedFileInfo] = useState<{
    name: string;
    sizeBytes: number;
  } | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ParsedDocumentPreview | null>(null);
  const [showRawDocPreview, setShowRawDocPreview] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState<TeacherBankQuestion[]>(
    () => store.questionBank
  );
  const [draftDistribution, setDraftDistribution] = useState<QuestionDistributionMap>(
    () => store.distribution
  );
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [keyStatusFilter, setKeyStatusFilter] = useState<'all' | AnswerKeyStatus>('all');
  const [isianVariantDrafts, setIsianVariantDrafts] = useState<Record<string, string>>({});
  const [manualKeyFocusedId, setManualKeyFocusedId] = useState<string | null>(null);
  const [uploadingImageForId, setUploadingImageForId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [hasSessionReset, setHasSessionReset] = useState(false);
  const benarButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Step 03: Bank Soal search
  const [bankSearch, setBankSearch] = useState('');

  // Step 04: Code.gs Generator
  const [generatedAppsScriptCode, setGeneratedAppsScriptCode] = useState<string>('');
  const [appsScriptCopied, setAppsScriptCopied] = useState(false);
  const appsScriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Step 05: Sinkronisasi ke Game + Optional Sheets/Backup Drawer
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncSuccessSummary, setSyncSuccessSummary] = useState<SyncSuccessSummary | null>(null);
  const [showOptionalSettings, setShowOptionalSettings] = useState(false);

  // Optional PIN change & Google Sheets Endpoint inputs
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState(store.examConfig.appsScriptUrl);
  const [spreadsheetId, setSpreadsheetId] = useState(store.examConfig.spreadsheetId);
  const [sheetsBusyAction, setSheetsBusyAction] = useState<string | null>(null);
  const [endpointValidationError, setEndpointValidationError] = useState<string | null>(null);

  // Optional Manual Backup & Restore (kept cleanly inside Optional Drawer)
  const [generatedBackup, setGeneratedBackup] = useState<GeneratedBackupOutput | null>(null);
  const [backupTSV, setBackupTSV] = useState<string>('');
  const [backupCopied, setBackupCopied] = useState(false);
  const backupTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [restoreInputText, setRestoreInputText] = useState('');
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreSuccessResult, setRestoreSuccessResult] = useState<RestoreExecutionResult | null>(null);
  const [preRestoreInfo, setPreRestoreInfo] = useState<{ savedAt: string; questionCount: number } | null>(
    () => getPreRestoreBackupInfo()
  );

  useEffect(() => {
    let active = true;
    void hydrateTeacherMediaCache().then(() => {
      if (!active) return;
      const latest = TeacherStorage.loadStore();
      setStore(latest);
      if (!previewDoc && latest.questionBank.length > 0) {
        setDraftQuestions(latest.questionBank);
      }
    });
    return () => {
      active = false;
    };
  }, [previewDoc]);

  // --------------------- AUTHENTICATION HANDLERS ---------------------
  const handlePinAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!hasPin) {
      if (!/^\d{4,8}$/.test(pinInput.trim())) {
        setPinError('PIN guru harus terdiri dari 4 hingga 8 digit angka.');
        return;
      }
      if (pinInput.trim() !== confirmPinInput.trim()) {
        setPinError('Konfirmasi PIN tidak cocok.');
        return;
      }
      setPinBusy(true);
      try {
        await TeacherStorage.configurePin(pinInput.trim());
        setHasPin(true);
        setAuthenticated(true);
        setPinInput('');
        setConfirmPinInput('');
        setStore(TeacherStorage.loadStore());
      } catch (err) {
        setPinError(err instanceof Error ? err.message : 'Gagal menyimpan PIN.');
      } finally {
        setPinBusy(false);
      }
      return;
    }

    setPinBusy(true);
    try {
      const ok = await TeacherStorage.verifyPin(pinInput);
      if (!ok) {
        setPinError('PIN salah. Periksa kembali PIN Mode Guru Anda.');
        return;
      }
      setAuthenticated(true);
      setPinInput('');
      const latest = TeacherStorage.loadStore();
      setStore(latest);
      if (!previewDoc && latest.questionBank.length > 0) {
        setDraftQuestions(latest.questionBank);
      }
      setDraftDistribution(latest.distribution);
      setAppsScriptUrl(latest.examConfig.appsScriptUrl);
      setSpreadsheetId(latest.examConfig.spreadsheetId);
    } finally {
      setPinBusy(false);
    }
  };

  const handleUpdateTeacherPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(newPin.trim())) {
      setToast({ kind: 'error', text: 'PIN baru harus 4 hingga 8 digit angka.' });
      return;
    }
    if (newPin.trim() !== confirmNewPin.trim()) {
      setToast({ kind: 'error', text: 'Konfirmasi PIN baru tidak cocok.' });
      return;
    }
    await TeacherStorage.configurePin(newPin.trim());
    setNewPin('');
    setConfirmNewPin('');
    setShowPinChange(false);
    setStore(TeacherStorage.loadStore());
    setToast({ kind: 'success', text: 'PIN Mode Guru berhasil diperbarui.' });
  };

  // --------------------- STEP 01: UPLOAD HANDLER ---------------------
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSelectedFileInfo({ name: file.name, sizeBytes: file.size });
    setUploadError(null);
    setToast(null);
    setSyncSuccessSummary(null);
    setHasSessionReset(false);

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setUploadError(validation.error ?? 'Dokumen tidak valid.');
      return;
    }

    setUploadLoading(true);
    try {
      const parsed = await parseQuestionDocument(file);
      setPreviewDoc(parsed);
      setShowRawDocPreview(false);
      setDraftQuestions(parsed.questions);
      setDraftDistribution(computeDetectedDistribution(parsed.questions));
      setKeyStatusFilter('all');
      setOnlyNeedsReview(false);
      setActiveStep('edit');
      const keyInfo = parsed.answerKeySummary;
      setToast({
        kind: 'success',
        text: keyInfo
          ? `Berhasil membaca ${parsed.questions.length} soal dari "${parsed.meta.fileName}" (${keyInfo.matchedCount} kunci terbaca, ${keyInfo.needsReviewCount} perlu diperiksa).`
          : `Berhasil membaca ${parsed.questions.length} soal dari "${parsed.meta.fileName}". Silakan periksa sebelum melanjutkan.`,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca dokumen soal. Bank soal yang ada tetap aman.'
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // --------------------- STEP 02: EDIT, RESET & KEY HANDLERS ---------------------
  const handleConfirmResetSession = () => {
    // 1. Bersihkan dataset soal aktif, bank soal sesi, & distribusi Question Box secara aman
    //    tanpa menghapus struktur aplikasi, konfigurasi game, Apps Script, maupun data siswa.
    const clearedStore = TeacherStorage.clearConfirmedBank();
    setStore(clearedStore);

    // 2. Kosongkan hasil parsing, preview dokumen, editor, filter, dan status sinkronisasi sesi
    setPreviewDoc(null);
    setSelectedFileInfo(null);
    setShowRawDocPreview(false);
    setUploadError(null);
    setDraftQuestions([]);
    setDraftDistribution(clearedStore.distribution);
    setIsianVariantDrafts({});
    setManualKeyFocusedId(null);
    setOnlyNeedsReview(false);
    setKeyStatusFilter('all');
    setBankSearch('');
    setSyncSuccessSummary(null);
    setResetConfirmOpen(false);
    setHasSessionReset(true);

    setToast({
      kind: 'success',
      text: 'Seluruh soal pada sesi ini telah direset. Silakan unggah dokumen soal baru.',
    });
  };

  const updateDraftQuestion = (id: string, patch: Partial<TeacherBankQuestion>) => {
    setSyncSuccessSummary(null);
    setHasSessionReset(false);
    setDraftQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== id) return q;
        const nextPrompt = patch.prompt ?? q.prompt;
        const nextType = patch.type ?? q.type;
        let nextOptions = patch.options ?? q.options;
        let nextPairs = patch.matchingPairs ?? q.matchingPairs;
        let nextAnswer =
          patch.correctAnswer !== undefined ? patch.correctAnswer : q.correctAnswer;
        let nextRubric = patch.rubric !== undefined ? patch.rubric : q.rubric;

        if (patch.type && patch.type !== q.type) {
          if (patch.type === 'benar_salah') {
            nextOptions = ['Benar', 'Salah'];
            nextAnswer = resolveTrueFalseSelection(nextAnswer);
          } else if (
            (patch.type === 'pilihan_ganda' || patch.type === 'pilihan_ganda_kompleks') &&
            nextOptions.length === 0
          ) {
            nextOptions = ['', '', '', ''];
          } else if (patch.type === 'menjodohkan' && nextPairs.length === 0) {
            nextPairs = [
              { left: '', right: '' },
              { left: '', right: '' },
            ];
          }
          if (patch.type === 'pilihan_ganda_kompleks' && !Array.isArray(nextAnswer)) {
            nextAnswer =
              typeof nextAnswer === 'string' && /^[A-E]$/i.test(nextAnswer.trim())
                ? [nextAnswer.trim().toUpperCase()]
                : [];
          } else if (patch.type !== 'pilihan_ganda_kompleks' && Array.isArray(nextAnswer)) {
            nextAnswer = nextAnswer[0] ?? null;
          }
        }

        const didModifyKeyFields =
          patch.correctAnswer !== undefined ||
          patch.rubric !== undefined ||
          patch.matchingPairs !== undefined ||
          patch.options !== undefined ||
          patch.type !== undefined;

        const nextKeySource =
          patch.answerKeySource !== undefined
            ? patch.answerKeySource
            : didModifyKeyFields
              ? 'manual_guru'
              : q.answerKeySource;

        if (nextType === 'uraian' && patch.rubric !== undefined && patch.correctAnswer === undefined) {
          nextAnswer = patch.rubric;
        }
        if (nextType === 'uraian' && patch.correctAnswer !== undefined && patch.rubric === undefined) {
          nextRubric = typeof patch.correctAnswer === 'string' ? patch.correctAnswer : null;
        }

        const candidate: TeacherBankQuestion = {
          ...q,
          ...patch,
          prompt: nextPrompt,
          question: nextPrompt,
          type: nextType,
          questionType: nextType,
          options: nextOptions,
          matchingPairs: nextPairs,
          correctAnswer: nextAnswer,
          rubric: nextRubric,
          answerKeySource: nextKeySource,
        };

        if (patch.needsReview === false && patch.answerKeyStatus === undefined) {
          candidate.answerKeyStatus = 'terbaca';
          candidate.reviewReason = null;
          return candidate;
        }

        const evalRes = evaluateQuestionAnswerKey(candidate);
        candidate.answerKeyStatus = evalRes.answerKeyStatus;
        candidate.needsReview = evalRes.needsReview;
        candidate.reviewReason = evalRes.reviewReason;
        return candidate;
      });
      setDraftDistribution((currDist) => computeDetectedDistribution(next, currDist));
      return next;
    });
  };

  const handleSaveSingleDraftQuestion = (id: string) => {
    const target = draftQuestions.find((q) => q.id === id);
    if (!target) return;

    const evalRes = evaluateQuestionAnswerKey(target);
    const updatedTarget: TeacherBankQuestion = {
      ...target,
      answerKeyStatus: evalRes.answerKeyStatus,
      needsReview: evalRes.needsReview,
      reviewReason: evalRes.reviewReason,
      updatedAt: new Date().toISOString(),
    };

    const nextDraft = draftQuestions.map((q) => (q.id === id ? updatedTarget : q));
    setDraftQuestions(nextDraft);

    if (!previewDoc && store.questionBank.some((q) => q.id === id)) {
      const savedStore = TeacherStorage.saveSingleBankQuestion(updatedTarget);
      setStore(savedStore);
      setDraftQuestions(savedStore.questionBank);
      setDraftDistribution(savedStore.distribution);
      setToast({
        kind: 'success',
        text: `Perubahan soal No. ${updatedTarget.originalNumber} berhasil disimpan ke Bank Soal.`,
      });
    } else {
      setToast({
        kind: 'success',
        text: `Soal No. ${updatedTarget.originalNumber} tersimpan di draf. Klik "Lanjut ke Bank Soal" untuk menyimpan semua.`,
      });
    }
  };

  const handleSelectTrueFalseKey = (id: string, choice: 'Benar' | 'Salah') => {
    const target = draftQuestions.find((q) => q.id === id);
    if (!target) return;

    const candidate: TeacherBankQuestion = {
      ...target,
      type: 'benar_salah',
      questionType: 'benar_salah',
      options: ['Benar', 'Salah'],
      correctAnswer: choice,
      answerKeySource: 'manual_guru',
      updatedAt: new Date().toISOString(),
    };
    const evalRes = evaluateQuestionAnswerKey(candidate);
    const updatedTarget: TeacherBankQuestion = {
      ...candidate,
      answerKeyStatus: evalRes.answerKeyStatus,
      needsReview: evalRes.needsReview,
      reviewReason: evalRes.reviewReason,
    };

    const nextDraft = draftQuestions.map((q) => (q.id === id ? updatedTarget : q));
    setDraftQuestions(nextDraft);
    setManualKeyFocusedId(id);

    if (!previewDoc && store.questionBank.some((q) => q.id === id)) {
      const savedStore = TeacherStorage.saveSingleBankQuestion(updatedTarget);
      setStore(savedStore);
      setDraftQuestions(savedStore.questionBank);
      setDraftDistribution(savedStore.distribution);
      setToast({
        kind: 'success',
        text: `Kunci Benar/Salah soal No. ${updatedTarget.originalNumber} disimpan sebagai ${choice.toUpperCase()}.`,
      });
    } else {
      setDraftDistribution((currDist) => computeDetectedDistribution(nextDraft, currDist));
    }
  };

  const handleActivateManualKeyEditor = (q: TeacherBankQuestion) => {
    setManualKeyFocusedId(q.id);
    if (q.type === 'benar_salah') {
      window.setTimeout(() => {
        const btn = benarButtonRefs.current[q.id];
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          btn.focus();
        }
      }, 0);
    }
  };

  const handleAddManualQuestion = () => {
    const newId = generateNextBankQuestionId(draftQuestions);
    const nextNum = String(draftQuestions.length + 1);
    const newQuestion: TeacherBankQuestion = {
      id: newId,
      originalNumber: nextNum,
      type: 'pilihan_ganda',
      prompt: '',
      question: '',
      questionType: 'pilihan_ganda',
      options: ['', '', '', ''],
      correctAnswer: null,
      explanation: null,
      matchingPairs: [],
      weight: 150,
      sourceDocument:
        previewDoc?.meta.fileName ??
        store.examConfig.activeSourceDocument ??
        'Input Manual Guru',
      enabled: true,
      needsReview: true,
      reviewReason: 'Soal baru ditambahkan manual; lengkapi pertanyaan dan kunci jawaban.',
      image: null,
      imageAlt: null,
    };

    const nextList = [...draftQuestions, newQuestion];
    setDraftQuestions(nextList);
    setDraftDistribution((currDist) => computeDetectedDistribution(nextList, currDist));
    setSyncSuccessSummary(null);
    setHasSessionReset(false);
    setToast({
      kind: 'success',
      text: `Soal baru No. ${nextNum} ditambahkan. Lengkapi isi soal lalu simpan.`,
    });
  };

  const handleDeleteDraftQuestion = (id: string) => {
    const nextList = draftQuestions.filter((q) => q.id !== id);
    setDraftQuestions(nextList);
    const nextDist = computeDetectedDistribution(nextList, draftDistribution);
    setDraftDistribution(nextDist);
    setSyncSuccessSummary(null);
    if (!previewDoc && store.questionBank.some((q) => q.id === id)) {
      const saved = TeacherStorage.saveEditedBankQuestions(nextList, nextDist);
      setStore(saved);
      setDraftDistribution(saved.distribution);
    }
    setToast({
      kind: 'success',
      text: `Soal berhasil dihapus tanpa mengubah soal lainnya.`,
    });
  };

  const handleQuestionImageUpload = async (
    id: string,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingImageForId(id);
    try {
      const dataUrl = await processQuestionImageFile(file);
      const nextList = draftQuestions.map((q) =>
        q.id === id
          ? {
              ...q,
              image: dataUrl,
              imageAlt: q.imageAlt || `Gambar soal ${q.id}`,
            }
          : q
      );
      setDraftQuestions(nextList);
      if (!previewDoc && store.questionBank.some((q) => q.id === id)) {
        const saved = TeacherStorage.saveEditedBankQuestions(nextList, draftDistribution);
        setStore(saved);
      }
      setToast({
        kind: 'success',
        text: `Gambar soal berhasil diunggah & disimpan.`,
      });
    } catch (err) {
      setToast({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Gagal memproses file gambar.',
      });
    } finally {
      setUploadingImageForId(null);
    }
  };

  const handleRemoveQuestionImage = (id: string) => {
    const nextList = draftQuestions.map((q) =>
      q.id === id ? { ...q, image: null, imageAlt: null } : q
    );
    setDraftQuestions(nextList);
    if (!previewDoc && store.questionBank.some((q) => q.id === id)) {
      const saved = TeacherStorage.saveEditedBankQuestions(nextList, draftDistribution);
      setStore(saved);
    }
    setToast({
      kind: 'success',
      text: `Gambar soal telah dihapus.`,
    });
  };

  const commitDraftToBank = (advanceToBank: boolean): TeacherStoreSnapshot => {
    if (draftQuestions.length === 0) return store;

    if (previewDoc) {
      const saved = TeacherStorage.saveConfirmedBank(
        draftQuestions,
        draftDistribution,
        previewDoc.meta.fileName,
        store.examConfig.allowRepeatQuestions
      );
      setStore(saved);
      setDraftQuestions(saved.questionBank);
      setDraftDistribution(saved.distribution);
      setPreviewDoc(null);
      if (advanceToBank) {
        setActiveStep('bank');
      }
      setToast({
        kind: 'success',
        text: `${saved.questionBank.length} soal dari "${previewDoc.meta.fileName}" berhasil disimpan ke Bank Soal.`,
      });
      return saved;
    }

    const saved = TeacherStorage.saveEditedBankQuestions(draftQuestions, draftDistribution);
    setStore(saved);
    setDraftQuestions(saved.questionBank);
    setDraftDistribution(saved.distribution);
    if (advanceToBank) {
      setActiveStep('bank');
    }
    setToast({
      kind: 'success',
      text: `Perubahan ${saved.questionBank.length} soal berhasil disimpan ke Bank Soal.`,
    });
    return saved;
  };

  // --------------------- STEP 03: BANK SOAL HANDLERS ---------------------
  const handleToggleBankItemEnabled = (id: string) => {
    setSyncSuccessSummary(null);
    const updatedBank = store.questionBank.map((q) =>
      q.id === id ? { ...q, enabled: !q.enabled } : q
    );
    const saved = TeacherStorage.updateSavedDistributionAndConfig(
      updatedBank,
      draftDistribution,
      {}
    );
    setStore(saved);
    setDraftDistribution(saved.distribution);
    if (!previewDoc) {
      setDraftQuestions(saved.questionBank);
    }
  };

  const handleResetToBuiltinBank = () => {
    setSyncSuccessSummary(null);
    const fresh = TeacherStorage.clearConfirmedBank();
    setStore(fresh);
    setDraftDistribution(fresh.distribution);
    setPreviewDoc(null);
    setSelectedFileInfo(null);
    setDraftQuestions([]);
    setToast({
      kind: 'success',
      text: 'Bank soal guru dinonaktifkan. Game kembali menggunakan soal bawaan Stage 1 & Stage 2.',
    });
  };

  // --------------------- STEP 04: GENERATOR CODE.GS HANDLERS ---------------------
  const handleGenerateCodeGs = () => {
    const result = generateAppsScriptCode();
    const check = validateAppsScriptSourceCode(result.code);
    if (!check.valid) {
      setToast({
        kind: 'error',
        text: check.error ?? 'Kode Code.gs gagal divalidasi.',
      });
      return;
    }
    setGeneratedAppsScriptCode(result.code);
    setAppsScriptCopied(false);
    setToast({
      kind: 'success',
      text: `Kode Google Apps Script (Code.gs) berhasil dibuat (${result.sheetCount} sheet).`,
    });
  };

  const handleCopyCodeGs = async () => {
    const appsScriptCodeToCopy = generatedAppsScriptCode || GOOGLE_APPS_SCRIPT_CODE;
    if (!generatedAppsScriptCode) {
      setGeneratedAppsScriptCode(appsScriptCodeToCopy);
    }

    const validation = validateAppsScriptSourceCode(appsScriptCodeToCopy);
    if (!validation.valid) {
      setAppsScriptCopied(false);
      setToast({
        kind: 'error',
        text: validation.error ?? 'Sumber bukan kode JavaScript Google Apps Script yang valid.',
      });
      return;
    }

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(appsScriptCodeToCopy);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (
      !copied &&
      appsScriptTextareaRef.current &&
      appsScriptTextareaRef.current.value === appsScriptCodeToCopy
    ) {
      try {
        appsScriptTextareaRef.current.focus();
        appsScriptTextareaRef.current.select();
        appsScriptTextareaRef.current.setSelectionRange(0, appsScriptCodeToCopy.length);
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
    }

    if (!copied && typeof document !== 'undefined') {
      const tempTextarea = document.createElement('textarea');
      tempTextarea.value = appsScriptCodeToCopy;
      tempTextarea.setAttribute('readonly', '');
      tempTextarea.style.position = 'fixed';
      tempTextarea.style.top = '0';
      tempTextarea.style.left = '0';
      tempTextarea.style.width = '1px';
      tempTextarea.style.height = '1px';
      tempTextarea.style.opacity = '0';
      document.body.appendChild(tempTextarea);
      try {
        tempTextarea.focus();
        tempTextarea.select();
        tempTextarea.setSelectionRange(0, appsScriptCodeToCopy.length);
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        tempTextarea.remove();
      }
    }

    if (copied) {
      setAppsScriptCopied(true);
      setToast({
        kind: 'success',
        text: 'Kode Code.gs berhasil disalin. Paste ke Google Apps Script lalu jalankan setupExamEduverse.',
      });
    } else {
      setAppsScriptCopied(false);
      setToast({
        kind: 'error',
        text: 'Browser memblokir salin otomatis. Klik DOWNLOAD CODE.GS atau salin manual dari kotak kode.',
      });
    }
  };

  const handleDownloadCodeGs = () => {
    const appsScriptCodeToDownload = generatedAppsScriptCode || GOOGLE_APPS_SCRIPT_CODE;
    if (!generatedAppsScriptCode) {
      setGeneratedAppsScriptCode(appsScriptCodeToDownload);
    }

    const validation = validateAppsScriptSourceCode(appsScriptCodeToDownload);
    if (!validation.valid) {
      setToast({
        kind: 'error',
        text: validation.error ?? 'Gagal mengunduh: kode Code.gs tidak valid.',
      });
      return;
    }

    const blob = new Blob([appsScriptCodeToDownload], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setToast({
      kind: 'success',
      text: 'File Code.gs berhasil diunduh.',
    });
  };

  // --------------------- STEP 05: SINKRONISASI KE GAME ---------------------
  const handleSyncToGame = async () => {
    setSyncBusy(true);
    setToast(null);
    try {
      let latestStore = TeacherStorage.loadStore();
      if (draftQuestions.length > 0) {
        if (previewDoc) {
          latestStore = TeacherStorage.saveConfirmedBank(
            draftQuestions,
            draftDistribution,
            previewDoc.meta.fileName,
            latestStore.examConfig.allowRepeatQuestions
          );
          setPreviewDoc(null);
        } else {
          latestStore = TeacherStorage.saveEditedBankQuestions(draftQuestions, draftDistribution);
        }
      }

      if (latestStore.questionBank.length === 0) {
        setToast({
          kind: 'error',
          text: 'Belum ada soal di Bank Soal. Unggah dokumen atau tambahkan soal di langkah 01–02 terlebih dahulu.',
        });
        return;
      }

      latestStore = TeacherStorage.autoDistributeToStages();
      setStore(latestStore);
      setDraftQuestions(latestStore.questionBank);
      setDraftDistribution(latestStore.distribution);

      let sheetsSyncNote: string | undefined;
      if (latestStore.examConfig.appsScriptUrl.trim()) {
        const sheetsRes = await TeacherStorage.syncToGoogleSheets();
        latestStore = sheetsRes.store;
        setStore(latestStore);
        sheetsSyncNote = sheetsRes.ok
          ? 'Data juga berhasil dikirim ke Google Sheets.'
          : 'Game sudah siap dimainkan. Pengiriman ke Google Sheets tertunda dan akan dicoba ulang saat online.';
      }

      const summary = getDistributionSummary(latestStore);
      setSyncSuccessSummary({
        totalQuestions: summary.totalQuestions,
        syncedQuestions: summary.enabledQuestions,
        connectedBoxes: summary.distributedQuestions,
        totalBoxCapacity: summary.totalBoxCapacity,
        sheetsSyncNote,
        completedAt: new Date().toISOString(),
      });

      setToast({
        kind: 'success',
        text: `Sinkronisasi selesai! ${summary.distributedQuestions} Question Box kini terhubung dengan Bank Soal (${summary.enabledQuestions} soal aktif).`,
      });
    } finally {
      setSyncBusy(false);
    }
  };

  // --------------------- OPTIONAL SHEETS & BACKUP HANDLERS ---------------------
  const ensureValidSavedEndpointBeforeAction = (): boolean => {
    const cleanUrl = appsScriptUrl.trim();
    const cleanId = spreadsheetId.trim();
    const check = validateEndpointConfig(cleanUrl, cleanId);
    if (!check.valid) {
      const msg = check.error ?? 'Konfigurasi URL Apps Script tidak valid.';
      setEndpointValidationError(msg);
      setToast({ kind: 'error', text: msg });
      return false;
    }
    setEndpointValidationError(null);
    if (
      cleanUrl !== store.examConfig.appsScriptUrl ||
      cleanId !== store.examConfig.spreadsheetId
    ) {
      const saved = TeacherStorage.saveSheetsEndpointConfig(cleanUrl, cleanId);
      setStore(saved.store);
    }
    return true;
  };

  const handleSaveSyncConfig = () => {
    const cleanUrl = appsScriptUrl.trim();
    const cleanId = spreadsheetId.trim();
    if (cleanUrl || cleanId) {
      const check = validateEndpointConfig(cleanUrl, cleanId);
      if (!check.valid) {
        const msg = check.error ?? 'Format URL Apps Script atau Spreadsheet ID tidak valid.';
        setEndpointValidationError(msg);
        setToast({ kind: 'error', text: msg });
        return;
      }
    }
    setEndpointValidationError(null);
    const res = TeacherStorage.saveSheetsEndpointConfig(cleanUrl, cleanId);
    setStore(res.store);
    setToast({
      kind: res.ok ? 'success' : 'error',
      text: res.message,
    });
  };

  const handleTestSheetsConnection = async () => {
    if (!ensureValidSavedEndpointBeforeAction()) return;
    setSheetsBusyAction('ping');
    try {
      const res = await TeacherStorage.testSheetsConnection(appsScriptUrl, spreadsheetId);
      setStore(res.store);
      setToast({ kind: res.ok ? 'success' : 'error', text: res.message });
    } finally {
      setSheetsBusyAction(null);
    }
  };

  const handleCreateManualBackup = () => {
    const freshStore = TeacherStorage.loadStore();
    setStore(freshStore);
    const backup = createBackupFromStorage();
    setGeneratedBackup(backup);
    setBackupTSV(backup.tsvText);
    setBackupCopied(false);
    setToast({
      kind: 'success',
      text: `Data cadangan siap (${backup.summary.questionBankCount} soal).`,
    });
  };

  const handleCopyBackupText = async () => {
    let tsvToCopy = backupTSV;
    if (!tsvToCopy) {
      const backup = generatedBackup ?? createBackupFromStorage();
      setGeneratedBackup(backup);
      tsvToCopy = backup.tsvText;
      setBackupTSV(tsvToCopy);
    }

    const tsvValidation = validateBackupTsvSource(tsvToCopy);
    if (!tsvValidation.valid) {
      setBackupCopied(false);
      setToast({
        kind: 'error',
        text: tsvValidation.error ?? 'Data backup tidak valid untuk disalin.',
      });
      return;
    }

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(tsvToCopy);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && backupTextareaRef.current && backupTextareaRef.current.value === tsvToCopy) {
      try {
        backupTextareaRef.current.focus();
        backupTextareaRef.current.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setBackupCopied(true);
      setToast({ kind: 'success', text: 'Data cadangan berhasil disalin.' });
    } else {
      setToast({ kind: 'error', text: 'Gagal menyalin otomatis. Silakan unduh file JSON.' });
    }
  };

  const handleDownloadBackupFile = () => {
    const backup = createBackupFromStorage();
    setGeneratedBackup(backup);
    setBackupTSV(backup.tsvText);
    const blob = new Blob([backup.jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.defaultFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast({ kind: 'success', text: `File "${backup.defaultFileName}" berhasil diunduh.` });
  };

  const handleLoadRestoreJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setRestoreInputText(text);
      setRestoreConfirmOpen(false);
      setRestoreSuccessResult(null);
      const res = validateBackupText(text);
      setRestoreValidation(res);
      setToast({
        kind: res.valid ? 'success' : 'error',
        text: res.valid
          ? `File "${file.name}" terbaca dan valid.`
          : res.errors[0] ?? 'File backup tidak valid.',
      });
    } catch {
      setToast({ kind: 'error', text: 'Gagal membaca file backup .json.' });
    }
  };

  const handleValidateRestoreInput = () => {
    setRestoreConfirmOpen(false);
    setRestoreSuccessResult(null);
    const res = validateBackupText(restoreInputText);
    setRestoreValidation(res);
    setToast({
      kind: res.valid ? 'success' : 'error',
      text: res.valid
        ? `Backup valid (${res.summary?.questionBankCount ?? 0} soal).`
        : res.errors[0] ?? 'Data backup tidak valid.',
    });
  };

  const handleExecuteRestore = (resolution: RestoreConflictResolution) => {
    if (!restoreValidation?.valid || !restoreValidation.pkg) return;
    const outcome = executeBackupRestore(restoreValidation.pkg, resolution);
    setRestoreConfirmOpen(false);
    setRestoreSuccessResult(outcome);
    setPreRestoreInfo(getPreRestoreBackupInfo());
    setStore(outcome.store);
    setDraftDistribution(outcome.store.distribution);
    if (!previewDoc) {
      setDraftQuestions(outcome.store.questionBank);
    }
    setHasSessionReset(false);
    setToast({ kind: 'success', text: outcome.message });
  };

  // --------------------- DERIVED METRICS ---------------------
  const keyCounts = useMemo(() => {
    let terbaca = 0;
    let perluDiperiksa = 0;
    let belumDitemukan = 0;
    for (const q of draftQuestions) {
      const st = q.answerKeyStatus ?? evaluateQuestionAnswerKey(q).answerKeyStatus;
      if (st === 'terbaca') terbaca += 1;
      else if (st === 'perlu_diperiksa') perluDiperiksa += 1;
      else belumDitemukan += 1;
    }
    return { terbaca, perluDiperiksa, belumDitemukan };
  }, [draftQuestions]);

  const needsReviewCount = draftQuestions.filter((q) => q.needsReview).length;
  const visibleDraftQuestions = draftQuestions.filter((q) => {
    if (onlyNeedsReview && !q.needsReview) return false;
    if (keyStatusFilter !== 'all') {
      const st = q.answerKeyStatus ?? evaluateQuestionAnswerKey(q).answerKeyStatus;
      if (st !== keyStatusFilter) return false;
    }
    return true;
  });

  const distSummary = useMemo(() => getDistributionSummary(store), [store]);

  const filteredBankQuestions = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    if (!query) return store.questionBank;
    return store.questionBank.filter(
      (q) =>
        q.prompt.toLowerCase().includes(query) ||
        q.id.toLowerCase().includes(query) ||
        String(q.originalNumber).toLowerCase().includes(query) ||
        QUESTION_MODEL_LABELS[q.type].toLowerCase().includes(query)
    );
  }, [store.questionBank, bankSearch]);

  const activeSourceLabel = useMemo(() => {
    if (previewDoc) return previewDoc.meta.fileName;
    if (store.examConfig.confirmedAt && store.questionBank.length > 0) {
      return store.examConfig.activeSourceDocument ?? 'Bank Soal Guru';
    }
    return hasSessionReset ? 'Belum ada soal aktif' : 'Soal Bawaan Game';
  }, [
    previewDoc,
    store.examConfig.confirmedAt,
    store.examConfig.activeSourceDocument,
    store.questionBank.length,
    hasSessionReset,
  ]);

  const activeStepIndex = FLOW_STEPS.findIndex((s) => s.id === activeStep);

  // Dark Glassmorphism Deep Navy / Midnight Blue / Indigo Backdrop
  const DarkGlassBackdrop = () => (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#050914]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 12% 10%, rgba(236, 72, 153, 0.16), transparent 60%), radial-gradient(ellipse 65% 55% at 88% 18%, rgba(56, 189, 248, 0.14), transparent 60%), radial-gradient(ellipse 70% 60% at 50% 95%, rgba(79, 70, 229, 0.22), transparent 65%), linear-gradient(145deg, #040814 0%, #09122b 45%, #0b1636 100%)',
        }}
      />
      <div className="absolute -top-36 -left-28 h-[28rem] w-[28rem] rounded-full bg-pink-500/[0.14] blur-[110px]" />
      <div className="absolute top-1/3 -right-28 h-[26rem] w-[26rem] rounded-full bg-cyan-400/[0.11] blur-[110px]" />
      <div className="absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/[0.18] blur-[120px]" />
    </div>
  );

  // ===================== 1. PIN AUTHENTICATION GATE =====================
  if (!authenticated) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto p-4 text-slate-100">
        <DarkGlassBackdrop />
        <div className={`relative z-10 w-full max-w-md p-7 sm:p-8 ${GLASS_CARD}`}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-300/45 bg-gradient-to-br from-pink-500/80 to-indigo-600/80 text-white shadow-[0_0_24px_rgba(236,72,153,0.35)]">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  Mode Guru
                </h1>
                <p className="text-xs text-cyan-200/80">
                  EXAM EDUVERSE · Pengelolaan Soal
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.16] bg-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/[0.14] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-cyan-300" />
              <span>Kembali</span>
            </button>
          </div>

          <form onSubmit={handlePinAuthSubmit} className="space-y-4">
            <div className={`${GLASS_SUBPANEL} p-3.5 text-xs leading-relaxed text-slate-200`}>
              {hasPin ? (
                <p className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>
                    Masukkan PIN Mode Guru untuk mengelola soal ujian dan menyinkronkan ke game.
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                  <span>
                    Belum ada PIN tersimpan. Buat PIN baru (4–8 digit angka) untuk membuka Mode Guru.
                  </span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="teacher-pin-input"
                className="mb-1.5 block text-xs font-semibold text-slate-200"
              >
                {hasPin ? 'PIN Mode Guru' : 'Buat PIN Baru (4–8 digit)'}
              </label>
              <input
                id="teacher-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan 4–8 digit angka"
                className={`${GLASS_INPUT} py-2.5 text-sm`}
              />
            </div>

            {!hasPin && (
              <div>
                <label
                  htmlFor="teacher-pin-confirm"
                  className="mb-1.5 block text-xs font-semibold text-slate-200"
                >
                  Konfirmasi PIN
                </label>
                <input
                  id="teacher-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="Ulangi PIN"
                  className={`${GLASS_INPUT} py-2.5 text-sm`}
                />
              </div>
            )}

            {pinError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-200 backdrop-blur-md"
              >
                {pinError}
              </p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onBack}
                className={`flex-1 ${BTN_DARK_GLASS}`}
              >
                Kembali ke Menu
              </button>
              <button
                type="submit"
                disabled={pinBusy}
                className={`flex-1 disabled:opacity-60 ${BTN_PINK_GLASS}`}
              >
                {pinBusy
                  ? 'Memeriksa...'
                  : hasPin
                    ? 'Masuk Mode Guru'
                    : 'Simpan PIN & Masuk'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ===================== 2. AUTHENTICATED DARK GLASSMORPHISM DASHBOARD =====================
  return (
    <div className="fixed inset-0 z-30 flex flex-col text-slate-100">
      <DarkGlassBackdrop />

      {/* Top Glass Header */}
      <header className="relative z-10 border-b border-white/[0.1] bg-[#070f24]/65 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-300/40 bg-gradient-to-br from-pink-500/80 to-indigo-600/80 text-white shadow-[0_0_18px_rgba(236,72,153,0.3)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-white sm:text-base">
              MODE GURU · EXAM EDUVERSE
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPinChange((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/[0.12] cursor-pointer whitespace-nowrap"
            >
              <KeyRound className="h-3.5 w-3.5 text-cyan-300" />
              <span>Ubah PIN</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-[#0d1d46]/80 px-3.5 py-2 text-xs font-bold text-cyan-100 backdrop-blur-md transition hover:border-pink-300/50 hover:bg-[#132657] cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-cyan-300" />
              <span>Kembali ke Halaman Awal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Optional Inline PIN Change Drawer */}
      {showPinChange && (
        <form
          onSubmit={handleUpdateTeacherPin}
          className="relative z-10 border-b border-white/[0.1] bg-[#0a1533]/85 px-4 py-2.5 text-xs backdrop-blur-xl sm:px-6"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="font-semibold text-cyan-200">PIN Baru:</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="4–8 digit"
              className="rounded-xl border border-white/15 bg-[#060d21] px-3 py-1.5 text-slate-100 placeholder:text-slate-400 focus:border-pink-400 focus:outline-none"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value)}
              placeholder="Konfirmasi PIN"
              className="rounded-xl border border-white/15 bg-[#060d21] px-3 py-1.5 text-slate-100 placeholder:text-slate-400 focus:border-pink-400 focus:outline-none"
            />
            <button type="submit" className={`${BTN_PINK_GLASS} py-1.5 px-3.5`}>
              Simpan PIN
            </button>
            <button
              type="button"
              onClick={() => setShowPinChange(false)}
              className={`${BTN_DARK_GLASS} py-1.5 px-3`}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Toast Notification Bar */}
      {toast && (
        <div
          role="status"
          className={`relative z-10 border-b px-4 py-2.5 text-xs font-medium backdrop-blur-xl sm:px-6 ${
            toast.kind === 'success'
              ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
              : 'border-rose-400/35 bg-rose-500/20 text-rose-100'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              {toast.kind === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
              )}
              <span>{toast.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 font-semibold text-slate-300 underline hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Main Scrollable Glass Workspace */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6 pb-14">
          {/* KARTU UTAMA + GLASS PROGRESS NAVIGATION (§5 & §6) */}
          <section className={`${GLASS_CARD} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-pink-300">
                  MODE GURU · EXAM EDUVERSE
                </p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white sm:text-xl">
                  Kelola soal ujian dan sinkronkan ke game
                </h2>
              </div>

              <div className="text-xs text-slate-300">
                Sumber aktif:{' '}
                <span className="font-semibold text-cyan-200">{activeSourceLabel}</span>
                {store.questionBank.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-mono-num text-pink-200">
                      {store.questionBank.length} soal
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Glass Progress Navigation */}
            <nav
              aria-label="Alur Mode Guru"
              className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.1] pt-4"
            >
              {FLOW_STEPS.map((step, idx) => {
                const active = activeStep === step.id;
                const passed = idx < activeStepIndex;
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep(step.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold backdrop-blur-md transition cursor-pointer whitespace-nowrap ${
                        active
                          ? 'border-pink-300/65 bg-gradient-to-r from-pink-500/80 via-rose-500/75 to-indigo-600/80 text-white shadow-[0_0_24px_rgba(236,72,153,0.38),inset_0_1px_0_rgba(255,255,255,0.28)]'
                          : passed
                            ? 'border-cyan-300/30 bg-white/[0.08] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/[0.13]'
                            : 'border-white/[0.12] bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full font-mono-num text-[10px] font-bold ${
                          active
                            ? 'bg-white/25 text-white'
                            : passed
                              ? 'bg-cyan-400/20 text-cyan-200'
                              : 'bg-white/[0.08] text-slate-300'
                        }`}
                      >
                        {passed ? <Check className="h-3 w-3" /> : step.number}
                      </span>
                      <span>{step.label}</span>
                      {step.id === 'edit' && draftQuestions.length > 0 && (
                        <span
                          className={`font-mono-num text-[11px] ${
                            active ? 'text-pink-100' : 'text-slate-400'
                          }`}
                        >
                          ({draftQuestions.length})
                        </span>
                      )}
                      {step.id === 'bank' && store.questionBank.length > 0 && (
                        <span
                          className={`font-mono-num text-[11px] ${
                            active ? 'text-pink-100' : 'text-slate-400'
                          }`}
                        >
                          ({store.questionBank.length})
                        </span>
                      )}
                    </button>

                    {idx < FLOW_STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="hidden text-xs text-slate-500 sm:inline"
                      >
                        →
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </section>

          {/* ==================== STEP 01: UPLOAD SOAL ==================== */}
          {activeStep === 'upload' && (
            <section className="mx-auto max-w-3xl space-y-5">
              <div className={`${GLASS_CARD} p-6 sm:p-8`}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold tracking-wide text-pink-300">
                      01 · Upload Soal
                    </div>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight text-white">
                      Upload Dokumen Soal
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Unggah file PDF atau DOCX (maks. 2 MB). Seluruh soal akan otomatis dibaca dan siap diperiksa.
                    </p>
                  </div>

                  {(draftQuestions.length > 0 || store.questionBank.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setActiveStep('edit')}
                      className={`${BTN_BLUE_PINK_GLASS} py-2 px-3.5`}
                    >
                      <span>Lanjut ke Edit ({draftQuestions.length || store.questionBank.length} soal)</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <label className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-pink-300/45 bg-gradient-to-br from-[#0b1636]/75 via-[#0f1d45]/65 to-pink-500/[0.08] p-10 text-center backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-pink-300/80 hover:shadow-[0_0_28px_rgba(236,72,153,0.2)] cursor-pointer">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-300/45 bg-gradient-to-br from-pink-500/85 to-indigo-500/85 text-white shadow-[0_0_24px_rgba(236,72,153,0.35)] transition group-hover:scale-105">
                    {uploadLoading ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <Upload className="h-7 w-7" />
                    )}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      {uploadLoading
                        ? 'Sedang membaca dokumen soal...'
                        : 'Klik di sini untuk memilih file soal'}
                    </p>
                    <p className="text-xs text-cyan-200/80">
                      Format .PDF dan .DOCX · Maksimal 2 MB
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    disabled={uploadLoading}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {selectedFileInfo && (
                  <div className={`${GLASS_SUBPANEL} mt-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-slate-200`}>
                    <span>
                      File dipilih:{' '}
                      <strong className="text-white">{selectedFileInfo.name}</strong>
                    </span>
                    <span className="font-mono-num text-cyan-200">
                      {formatFileSize(selectedFileInfo.sizeBytes)}
                    </span>
                  </div>
                )}

                {uploadError && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-400/45 bg-rose-500/15 p-3.5 text-xs text-rose-100 backdrop-blur-md"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <div>
                      <p className="font-bold">Gagal Membaca Dokumen</p>
                      <p className="mt-0.5 text-rose-200">{uploadError}</p>
                    </div>
                  </div>
                )}

                <div className="mt-6 border-t border-white/[0.1] pt-4 text-xs text-slate-300">
                  <p className="font-semibold text-cyan-200">Tips format dokumen agar terbaca akurat:</p>
                  <ul className="mt-1.5 space-y-1">
                    <li>• Gunakan penomoran jelas seperti <code className="text-pink-200">1.</code>, <code className="text-pink-200">2.</code>, atau <code className="text-pink-200">Soal 1:</code>.</li>
                    <li>• Cantumkan pilihan jawaban <code className="text-pink-200">A.</code>–<code className="text-pink-200">D.</code> atau kunci seperti <code className="text-pink-200">Kunci: A</code> / <code className="text-pink-200">Jawaban: ...</code>.</li>
                    <li>• Setelah file terbaca, Anda dapat langsung mengedit atau mereset soal di Langkah 02.</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* ==================== STEP 02: PRATINJAU & EDIT + RESET ==================== */}
          {activeStep === 'edit' && (
            <section className="space-y-4">
              {/* Top Glass Control Panel */}
              <div className={`${GLASS_CARD} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold tracking-wide text-pink-300">
                      02 · Pratinjau &amp; Edit
                    </div>
                    <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-white">
                      Pratinjau &amp; Edit Soal
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Dokumen:{' '}
                      <span className="font-semibold text-cyan-200">
                        {previewDoc
                          ? previewDoc.meta.fileName
                          : store.examConfig.activeSourceDocument ?? (draftQuestions.length > 0 ? 'Input Manual' : 'Belum ada dokumen')}
                      </span>
                      {' · '}Terdeteksi: <strong className="font-mono-num text-white">{draftQuestions.length}</strong> soal
                      {' · '}Aktif: <strong className="font-mono-num text-cyan-300">{draftQuestions.filter((q) => q.enabled).length}</strong>
                      {' · '}Perlu diperiksa: <strong className="font-mono-num text-pink-300">{needsReviewCount}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(true)}
                      disabled={draftQuestions.length === 0 && store.questionBank.length === 0 && !previewDoc}
                      className={`${BTN_RESET_GLASS} disabled:opacity-40`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>RESET / HAPUS SOAL</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddManualQuestion}
                      className={`${BTN_DARK_GLASS} py-2 px-3.5`}
                    >
                      <Plus className="h-3.5 w-3.5 text-cyan-300" />
                      <span>Tambah Soal</span>
                    </button>

                    {draftQuestions.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => commitDraftToBank(false)}
                          className={`${BTN_DARK_GLASS} border-cyan-300/35 text-cyan-100 py-2 px-3.5`}
                        >
                          <Save className="h-3.5 w-3.5 text-cyan-300" />
                          <span>Simpan Perubahan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => commitDraftToBank(true)}
                          className={`${BTN_PINK_GLASS} py-2 px-4`}
                        >
                          <span>LANJUT KE BANK SOAL</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Warnings or Optional Raw Extracted Text Toggle */}
                {previewDoc && (
                  <div className="mt-4 space-y-2 border-t border-white/[0.1] pt-3">
                    {previewDoc.warnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-0.5">
                        {previewDoc.warnings.map((w, i) => (
                          <p key={i}>• {w}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300">
                        {previewDoc.meta.fileType.toUpperCase()} · {formatFileSize(previewDoc.meta.fileSizeBytes)} · {previewDoc.meta.pageOrSectionCount} bagian
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRawDocPreview((v) => !v)}
                        className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{showRawDocPreview ? 'Sembunyikan Teks Asli' : 'Lihat Teks Asli Dokumen'}</span>
                      </button>
                    </div>
                    {showRawDocPreview && (
                      <pre className="max-h-52 overflow-auto rounded-2xl border border-white/[0.12] bg-[#040918]/80 p-3 font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">
                        {previewDoc.rawText}
                      </pre>
                    )}
                  </div>
                )}

                {/* Filter Controls */}
                {draftQuestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.1] pt-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 font-semibold text-slate-300">Filter Kunci:</span>
                      <button
                        type="button"
                        onClick={() => setKeyStatusFilter('all')}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          keyStatusFilter === 'all'
                            ? 'border-pink-300/50 bg-pink-500/30 text-white'
                            : 'border-white/[0.12] bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                        }`}
                      >
                        Semua ({draftQuestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyStatusFilter('terbaca')}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          keyStatusFilter === 'terbaca'
                            ? 'border-cyan-300/60 bg-cyan-500/25 text-cyan-100'
                            : 'border-white/[0.12] bg-white/[0.05] text-cyan-200/80 hover:bg-white/[0.1]'
                        }`}
                      >
                        Terbaca ({keyCounts.terbaca})
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyStatusFilter('perlu_diperiksa')}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          keyStatusFilter === 'perlu_diperiksa'
                            ? 'border-amber-300/60 bg-amber-500/25 text-amber-100'
                            : 'border-white/[0.12] bg-white/[0.05] text-amber-200/80 hover:bg-white/[0.1]'
                        }`}
                      >
                        Perlu Diperiksa ({keyCounts.perluDiperiksa})
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyStatusFilter('belum_ditemukan')}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          keyStatusFilter === 'belum_ditemukan'
                            ? 'border-rose-300/60 bg-rose-500/25 text-rose-100'
                            : 'border-white/[0.12] bg-white/[0.05] text-rose-200/80 hover:bg-white/[0.1]'
                        }`}
                      >
                        Belum Ada ({keyCounts.belumDitemukan})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOnlyNeedsReview((v) => !v)}
                      className={`rounded-xl border px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        onlyNeedsReview
                          ? 'border-pink-300/55 bg-pink-500/25 text-pink-100'
                          : 'border-white/[0.12] bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]'
                      }`}
                    >
                      {onlyNeedsReview
                        ? `Tampilkan Semua (${draftQuestions.length})`
                        : `Hanya Perlu Diperiksa (${needsReviewCount})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Empty / Post-Reset State or Questions Editor List */}
              {draftQuestions.length === 0 ? (
                <div className={`${GLASS_CARD} p-10 text-center space-y-4`}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-300/35 bg-pink-500/15 text-pink-200 shadow-[0_0_24px_rgba(236,72,153,0.2)]">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-white">Belum ada soal</h4>
                    <p className="mx-auto max-w-md text-xs text-slate-300 leading-relaxed">
                      {previewDoc
                        ? `Dokumen "${previewDoc.meta.fileName}" tidak memiliki pola nomor soal yang terbaca otomatis.`
                        : 'Sesi soal saat ini kosong. Unggah dokumen PDF atau DOCX baru untuk mata pelajaran yang ingin digunakan.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveStep('upload')}
                      className={BTN_PINK_GLASS}
                    >
                      <Upload className="h-4 w-4" />
                      <span>UPLOAD SOAL BARU</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddManualQuestion}
                      className={BTN_DARK_GLASS}
                    >
                      <Plus className="h-4 w-4 text-cyan-300" />
                      <span>Buat Soal Manual</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleDraftQuestions.map((q) => {
                    const resolvedThumb = resolveQuestionImage(q.id, q.image);
                    const isBusyImg = uploadingImageForId === q.id;
                    const isPg =
                      q.type === 'pilihan_ganda' || q.type === 'pilihan_ganda_kompleks';
                    const selectedComplexLetters = Array.isArray(q.correctAnswer)
                      ? q.correctAnswer.map((v) => v.toUpperCase())
                      : typeof q.correctAnswer === 'string'
                        ? q.correctAnswer
                            .toUpperCase()
                            .split(/\s*,\s*/)
                            .filter(Boolean)
                        : [];

                    const keyStatus =
                      q.answerKeyStatus ?? evaluateQuestionAnswerKey(q).answerKeyStatus;
                    const isianVariants =
                      q.type === 'isian_singkat' && typeof q.correctAnswer === 'string'
                        ? q.correctAnswer
                            .split(/\s*(?:\||\/|;)\s*/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [];

                    return (
                      <div
                        id={`question-card-${q.id}`}
                        key={q.id}
                        className={`${GLASS_CARD} p-5 space-y-4 transition ${
                          q.needsReview ? 'border-pink-300/35' : 'border-white/[0.14]'
                        }`}
                      >
                        {/* Card Top Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono-num text-xs font-bold text-pink-300">
                              No. {q.originalNumber}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span className="font-mono-num text-[11px] text-slate-400">
                              {q.id}
                            </span>
                            <select
                              aria-label={`Tipe soal ${q.id}`}
                              value={q.type}
                              onChange={(e) =>
                                updateDraftQuestion(q.id, {
                                  type: e.target.value as QuestionModelType,
                                })
                              }
                              className="rounded-xl border border-white/[0.16] bg-[#08112b] px-2.5 py-1 text-xs font-semibold text-cyan-100 focus:border-pink-400 focus:outline-none"
                            >
                              {QUESTION_MODEL_ORDER.map((m) => (
                                <option key={m} value={m} className="bg-[#08112b] text-slate-100">
                                  {QUESTION_MODEL_LABELS[m]}
                                </option>
                              ))}
                            </select>

                            {keyStatus === 'terbaca' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Kunci Siap</span>
                              </span>
                            ) : keyStatus === 'perlu_diperiksa' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Perlu Diperiksa</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Belum Ada Kunci</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 text-xs">
                            <label className="flex items-center gap-1.5 text-slate-300">
                              <span>Bobot</span>
                              <input
                                type="number"
                                min={10}
                                max={1000}
                                step={10}
                                value={q.weight ?? ''}
                                placeholder="150"
                                onChange={(e) =>
                                  updateDraftQuestion(q.id, {
                                    weight: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="w-16 rounded-xl border border-white/[0.16] bg-[#060d21]/80 px-2 py-1 font-mono-num text-slate-100 focus:border-pink-400 focus:outline-none"
                              />
                            </label>

                            <label className="inline-flex items-center gap-1.5 font-medium text-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.enabled}
                                onChange={(e) =>
                                  updateDraftQuestion(q.id, { enabled: e.target.checked })
                                }
                                className="h-4 w-4 accent-pink-500"
                              />
                              <span>Aktif</span>
                            </label>

                            {q.needsReview && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraftQuestion(q.id, {
                                    needsReview: false,
                                    reviewReason: null,
                                  })
                                }
                                className="rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/25 cursor-pointer"
                              >
                                Tandai Valid
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteDraftQuestion(q.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-300/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>

                        {q.reviewReason && (
                          <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                            Catatan: {q.reviewReason}
                          </p>
                        )}

                        {/* Prompt + Image */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                          {/* Image Box */}
                          <div className={`${GLASS_SUBPANEL} md:col-span-4 p-3 space-y-2`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200">Gambar (Opsional)</span>
                              {resolvedThumb && (
                                <span className="text-[11px] font-semibold text-cyan-300">
                                  Terpasang
                                </span>
                              )}
                            </div>

                            {resolvedThumb ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-center rounded-xl border border-white/10 bg-[#050a19]/80 p-2">
                                  <img
                                    src={resolvedThumb}
                                    alt={q.imageAlt || `Gambar soal ${q.id}`}
                                    referrerPolicy="no-referrer"
                                    className="max-h-36 w-full object-contain"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={q.imageAlt ?? ''}
                                  onChange={(e) =>
                                    updateDraftQuestion(q.id, {
                                      imageAlt: e.target.value || null,
                                    })
                                  }
                                  placeholder="Keterangan gambar (opsional)"
                                  className={GLASS_INPUT}
                                />
                                <div className="flex gap-1.5">
                                  <label className="flex-1 rounded-xl border border-cyan-300/30 bg-cyan-400/15 px-2.5 py-1.5 text-center text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/25 cursor-pointer">
                                    {isBusyImg ? 'Memproses...' : 'Ganti'}
                                    <input
                                      type="file"
                                      accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                      disabled={isBusyImg}
                                      onChange={(e) => handleQuestionImageUpload(q.id, e)}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuestionImage(q.id)}
                                    className="rounded-xl border border-rose-300/30 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-[#060d22]/60 px-3 py-5 text-center transition hover:border-pink-300/55 cursor-pointer">
                                {isBusyImg ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-pink-300" />
                                ) : (
                                  <ImagePlus className="h-5 w-5 text-cyan-300" />
                                )}
                                <span className="text-xs font-semibold text-slate-200">
                                  {isBusyImg ? 'Memproses...' : 'Unggah Gambar'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  PNG, JPG, WEBP
                                </span>
                                <input
                                  type="file"
                                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                  disabled={isBusyImg}
                                  onChange={(e) => handleQuestionImageUpload(q.id, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          {/* Question Text & Explanation */}
                          <div className="md:col-span-8 space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-200">
                                Teks Pertanyaan
                              </label>
                              <textarea
                                rows={3}
                                value={q.prompt}
                                placeholder="Tulis pertanyaan soal di sini..."
                                onChange={(e) =>
                                  updateDraftQuestion(q.id, { prompt: e.target.value })
                                }
                                className={`${GLASS_INPUT} leading-relaxed`}
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-300">
                                Pembahasan (Opsional)
                              </label>
                              <input
                                type="text"
                                value={q.explanation ?? ''}
                                placeholder="Tulis pembahasan yang tampil setelah siswa menjawab (opsional)"
                                onChange={(e) =>
                                  updateDraftQuestion(q.id, {
                                    explanation: e.target.value.trim() ? e.target.value : null,
                                  })
                                }
                                className={GLASS_INPUT}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Options Editor for Pilihan Ganda & PG Kompleks */}
                        {isPg && (
                          <div className="space-y-2 border-t border-white/[0.1] pt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-200">
                                Pilihan Jawaban (klik huruf untuk memilih kunci):
                              </span>
                              {q.options.length < 5 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftQuestion(q.id, {
                                      options: [...q.options, ''],
                                    })
                                  }
                                  className="rounded-xl border border-white/[0.15] bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.12] cursor-pointer"
                                >
                                  + Tambah Opsi
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {q.options.map((opt, idx) => {
                                const letter = String.fromCharCode(65 + idx);
                                const isSelectedKey =
                                  q.type === 'pilihan_ganda'
                                    ? typeof q.correctAnswer === 'string' &&
                                      q.correctAnswer.trim().toUpperCase() === letter
                                    : selectedComplexLetters.includes(letter);

                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 backdrop-blur-md ${
                                      isSelectedKey
                                        ? 'border-pink-300/50 bg-pink-500/15 shadow-[0_0_16px_rgba(236,72,153,0.18)]'
                                        : 'border-white/[0.12] bg-[#070f26]/70'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      title={`Jadikan ${letter} kunci jawaban`}
                                      onClick={() => {
                                        if (q.type === 'pilihan_ganda') {
                                          updateDraftQuestion(q.id, {
                                            correctAnswer: letter,
                                            answerKeySource: 'manual_guru',
                                          });
                                        } else {
                                          const nextKeys = isSelectedKey
                                            ? selectedComplexLetters.filter((l) => l !== letter)
                                            : [...selectedComplexLetters, letter].sort();
                                          updateDraftQuestion(q.id, {
                                            correctAnswer: nextKeys.length > 0 ? nextKeys : null,
                                            answerKeySource: 'manual_guru',
                                          });
                                        }
                                      }}
                                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono-num text-xs font-bold transition cursor-pointer ${
                                        isSelectedKey
                                          ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                                          : 'bg-white/[0.08] text-slate-200 hover:bg-pink-500/25 hover:text-pink-200'
                                      }`}
                                    >
                                      {letter}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt}
                                      placeholder={`Isi opsi ${letter}...`}
                                      onChange={(e) => {
                                        const nextOpts = [...q.options];
                                        nextOpts[idx] = e.target.value;
                                        updateDraftQuestion(q.id, { options: nextOpts });
                                      }}
                                      className="flex-1 min-w-0 bg-transparent text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
                                    />
                                    {q.options.length > 2 && (
                                      <button
                                        type="button"
                                        title="Hapus opsi"
                                        onClick={() => {
                                          const nextOpts = q.options.filter((_, i) => i !== idx);
                                          updateDraftQuestion(q.id, { options: nextOpts });
                                        }}
                                        className="px-1 text-slate-400 hover:text-rose-300 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Answer Key Editor Block */}
                        <div
                          className={`rounded-2xl border p-3.5 space-y-2.5 backdrop-blur-md ${
                            manualKeyFocusedId === q.id
                              ? 'border-pink-300/55 bg-pink-500/10'
                              : keyStatus === 'terbaca'
                                ? 'border-cyan-300/25 bg-cyan-500/[0.07]'
                                : 'border-amber-300/30 bg-amber-500/[0.08]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-white">Kunci Jawaban:</span>
                              <span className="font-semibold text-cyan-200">
                                {formatShortAnswerKey(q)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {(keyStatus === 'belum_ditemukan' || q.type === 'benar_salah') && (
                                <button
                                  type="button"
                                  onClick={() => handleActivateManualKeyEditor(q)}
                                  className="rounded-xl border border-cyan-300/30 bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-white/[0.14] cursor-pointer"
                                >
                                  {keyStatus === 'belum_ditemukan'
                                    ? 'Isi Kunci Manual'
                                    : 'Ubah Kunci'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSaveSingleDraftQuestion(q.id)}
                                className="inline-flex items-center gap-1 rounded-xl border border-pink-300/35 bg-pink-500/20 px-2.5 py-1 text-[11px] font-semibold text-pink-100 hover:bg-pink-500/30 cursor-pointer"
                              >
                                <Save className="h-3 w-3" />
                                <span>Simpan Soal Ini</span>
                              </button>
                            </div>
                          </div>

                          {/* PG Quick Selector */}
                          {q.type === 'pilihan_ganda' && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="mr-1 text-xs text-slate-300">Pilih Kunci:</span>
                              {q.options.map((_, idx) => {
                                const letter = String.fromCharCode(65 + idx);
                                const active =
                                  typeof q.correctAnswer === 'string' &&
                                  q.correctAnswer.trim().toUpperCase() === letter;
                                return (
                                  <button
                                    key={letter}
                                    type="button"
                                    onClick={() =>
                                      updateDraftQuestion(q.id, {
                                        correctAnswer: letter,
                                        answerKeySource: 'manual_guru',
                                      })
                                    }
                                    className={`rounded-xl border px-3 py-1 font-mono-num text-xs font-bold transition cursor-pointer ${
                                      active
                                        ? 'border-pink-300/60 bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_14px_rgba(236,72,153,0.45)]'
                                        : 'border-white/[0.15] bg-white/[0.06] text-slate-200 hover:border-pink-300/45'
                                    }`}
                                  >
                                    {letter}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* PG Kompleks Checkboxes */}
                          {q.type === 'pilihan_ganda_kompleks' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-300">Pilih Beberapa:</span>
                              {q.options.map((_, idx) => {
                                const letter = String.fromCharCode(65 + idx);
                                const checked = selectedComplexLetters.includes(letter);
                                return (
                                  <label
                                    key={letter}
                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold cursor-pointer ${
                                      checked
                                        ? 'border-pink-300/60 bg-pink-500/25 text-white'
                                        : 'border-white/[0.15] bg-white/[0.06] text-slate-200'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const nextKeys = checked
                                          ? selectedComplexLetters.filter((l) => l !== letter)
                                          : [...selectedComplexLetters, letter].sort();
                                        updateDraftQuestion(q.id, {
                                          correctAnswer: nextKeys.length > 0 ? nextKeys : null,
                                          answerKeySource: 'manual_guru',
                                        });
                                      }}
                                      className="accent-pink-500"
                                    />
                                    <span className="font-mono-num">{letter}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Benar / Salah */}
                          {q.type === 'benar_salah' && (() => {
                            const selectedTf = resolveTrueFalseSelection(q.correctAnswer);
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-300">Pilih Kunci:</span>
                                {(['Benar', 'Salah'] as const).map((choice) => {
                                  const active = selectedTf === choice;
                                  return (
                                    <button
                                      key={choice}
                                      ref={
                                        choice === 'Benar'
                                          ? (el) => {
                                              benarButtonRefs.current[q.id] = el;
                                            }
                                          : undefined
                                      }
                                      type="button"
                                      aria-pressed={active}
                                      onClick={() => handleSelectTrueFalseKey(q.id, choice)}
                                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                                        active
                                          ? choice === 'Benar'
                                            ? 'border-cyan-300/60 bg-cyan-500/30 text-white shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                                            : 'border-pink-300/60 bg-pink-500/35 text-white shadow-[0_0_16px_rgba(236,72,153,0.35)]'
                                          : 'border-white/[0.15] bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'
                                      }`}
                                    >
                                      {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                                      <span>{choice.toUpperCase()}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Menjodohkan */}
                          {q.type === 'menjodohkan' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-200">
                                  Pasangan Menjodohkan:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftQuestion(q.id, {
                                      matchingPairs: [...q.matchingPairs, { left: '', right: '' }],
                                      answerKeySource: 'manual_guru',
                                    })
                                  }
                                  className="rounded-xl border border-white/[0.15] bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200 cursor-pointer"
                                >
                                  + Tambah Pasangan
                                </button>
                              </div>
                              {q.matchingPairs.map((pair, idx) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono-num text-[11px] font-bold text-pink-300">
                                    {idx + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={pair.left}
                                    placeholder="Pernyataan kiri..."
                                    onChange={(e) => {
                                      const nextPairs = [...q.matchingPairs];
                                      nextPairs[idx] = { ...pair, left: e.target.value };
                                      updateDraftQuestion(q.id, {
                                        matchingPairs: nextPairs,
                                        correctAnswer: nextPairs
                                          .map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`)
                                          .join(' | '),
                                        answerKeySource: 'manual_guru',
                                      });
                                    }}
                                    className="flex-1 min-w-[130px] rounded-xl border border-white/[0.15] bg-[#060d21]/75 px-2.5 py-1.5 text-xs text-slate-100"
                                  />
                                  <span className="text-cyan-300">→</span>
                                  <input
                                    type="text"
                                    value={pair.right}
                                    placeholder="Pasangan kanan..."
                                    onChange={(e) => {
                                      const nextPairs = [...q.matchingPairs];
                                      nextPairs[idx] = { ...pair, right: e.target.value };
                                      updateDraftQuestion(q.id, {
                                        matchingPairs: nextPairs,
                                        correctAnswer: nextPairs
                                          .map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`)
                                          .join(' | '),
                                        answerKeySource: 'manual_guru',
                                      });
                                    }}
                                    className="flex-1 min-w-[130px] rounded-xl border border-white/[0.15] bg-[#060d21]/75 px-2.5 py-1.5 text-xs text-cyan-200"
                                  />
                                  {q.matchingPairs.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextPairs = q.matchingPairs.filter((_, i) => i !== idx);
                                        updateDraftQuestion(q.id, {
                                          matchingPairs: nextPairs,
                                          correctAnswer: nextPairs
                                            .map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`)
                                            .join(' | '),
                                          answerKeySource: 'manual_guru',
                                        });
                                      }}
                                      className="px-1 text-slate-400 hover:text-rose-300 cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Isian Singkat */}
                          {q.type === 'isian_singkat' && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={
                                    typeof q.correctAnswer === 'string'
                                      ? q.correctAnswer
                                      : Array.isArray(q.correctAnswer)
                                        ? q.correctAnswer.join(' | ')
                                        : ''
                                  }
                                  placeholder="Ketik kunci isian (pisahkan variasi dengan | )"
                                  onChange={(e) =>
                                    updateDraftQuestion(q.id, {
                                      correctAnswer: e.target.value.trim() ? e.target.value : null,
                                      answerKeySource: 'manual_guru',
                                    })
                                  }
                                  className="flex-1 min-w-[200px] rounded-xl border border-white/[0.15] bg-[#060d21]/75 px-3 py-1.5 text-xs text-slate-100"
                                />
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={isianVariantDrafts[q.id] ?? ''}
                                    onChange={(e) =>
                                      setIsianVariantDrafts((prev) => ({
                                        ...prev,
                                        [q.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Tambah variasi..."
                                    className="w-32 rounded-xl border border-white/[0.15] bg-[#060d21]/75 px-2.5 py-1.5 text-xs text-slate-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const candidate = (isianVariantDrafts[q.id] ?? '').trim();
                                      if (!candidate) return;
                                      const nextList = Array.from(new Set([...isianVariants, candidate]));
                                      updateDraftQuestion(q.id, {
                                        correctAnswer: nextList.join(' | '),
                                        answerKeySource: 'manual_guru',
                                      });
                                      setIsianVariantDrafts((prev) => ({ ...prev, [q.id]: '' }));
                                    }}
                                    className="rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/25 cursor-pointer"
                                  >
                                    + Variasi
                                  </button>
                                </div>
                              </div>
                              {isianVariants.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {isianVariants.map((variant, vIdx) => (
                                    <span
                                      key={`${variant}-${vIdx}`}
                                      className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/30 bg-[#08122b] px-2.5 py-0.5 text-[11px] text-cyan-200"
                                    >
                                      <span>{variant}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const remaining = isianVariants.filter((_, i) => i !== vIdx);
                                          updateDraftQuestion(q.id, {
                                            correctAnswer: remaining.length > 0 ? remaining.join(' | ') : null,
                                            answerKeySource: 'manual_guru',
                                          });
                                        }}
                                        className="text-rose-300 hover:text-rose-100 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Uraian */}
                          {q.type === 'uraian' && (
                            <textarea
                              rows={2}
                              value={
                                q.rubric ??
                                (typeof q.correctAnswer === 'string' ? q.correctAnswer : '')
                              }
                              placeholder="Tulis pedoman jawaban / poin penting penilaian uraian..."
                              onChange={(e) => {
                                const val = e.target.value;
                                updateDraftQuestion(q.id, {
                                  rubric: val.trim() ? val : null,
                                  correctAnswer: val.trim() ? val : null,
                                  answerKeySource: 'manual_guru',
                                });
                              }}
                              className={GLASS_INPUT}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom Step CTA */}
                  <div className={`${GLASS_CARD} flex flex-wrap items-center justify-between gap-3 p-4`}>
                    <button
                      type="button"
                      onClick={() => setActiveStep('upload')}
                      className={BTN_DARK_GLASS}
                    >
                      ← Kembali ke Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => commitDraftToBank(true)}
                      className={BTN_PINK_GLASS}
                    >
                      <span>LANJUT KE BANK SOAL</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ==================== STEP 03: BANK SOAL ==================== */}
          {activeStep === 'bank' && (
            <section className="space-y-4">
              <div className={`${GLASS_CARD} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold tracking-wide text-pink-300">
                      03 · Bank Soal
                    </div>
                    <h3 className="mt-0.5 text-lg font-extrabold tracking-tight text-white">
                      Bank Soal
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Ringkasan seluruh soal yang siap digunakan dalam game.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {store.questionBank.length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetToBuiltinBank}
                        className={BTN_RESET_GLASS}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Gunakan Soal Bawaan</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveStep('codegs')}
                      className={BTN_PINK_GLASS}
                    >
                      <span>LANJUT KE GENERATOR CODE.GS</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clean 3-metric Summary */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className={`${GLASS_SUBPANEL} p-4`}>
                    <div className="text-xs font-medium text-slate-300">Total Soal</div>
                    <div className="mt-1 font-mono-num text-2xl font-extrabold text-white">
                      {store.questionBank.length}
                    </div>
                  </div>
                  <div className={`${GLASS_SUBPANEL} p-4`}>
                    <div className="text-xs font-medium text-slate-300">Soal Aktif</div>
                    <div className="mt-1 font-mono-num text-2xl font-extrabold text-cyan-300">
                      {store.questionBank.filter((q) => q.enabled).length}
                    </div>
                  </div>
                  <div className={`${GLASS_SUBPANEL} p-4`}>
                    <div className="text-xs font-medium text-slate-300">Kunci Terisi</div>
                    <div className="mt-1 font-mono-num text-2xl font-extrabold text-pink-300">
                      {
                        store.questionBank.filter(
                          (q) =>
                            (q.answerKeyStatus ?? evaluateQuestionAnswerKey(q).answerKeyStatus) ===
                            'terbaca'
                        ).length
                      }
                    </div>
                  </div>
                </div>

                {/* Search */}
                {store.questionBank.length > 0 && (
                  <div className="relative mt-4">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/75" />
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Cari pertanyaan, nomor soal, atau jenis soal..."
                      className={`${GLASS_INPUT} py-2.5 pl-10 pr-4`}
                    />
                  </div>
                )}
              </div>

              {store.questionBank.length === 0 ? (
                <div className={`${GLASS_CARD} p-10 text-center text-sm text-slate-300 space-y-3`}>
                  <Layers className="mx-auto h-8 w-8 text-cyan-300" />
                  <p>
                    Bank Soal masih kosong. Saat ini game menggunakan soal bawaan Stage 1 &amp; Stage 2.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveStep('upload')}
                    className={BTN_PINK_GLASS}
                  >
                    <span>UPLOAD SOAL BARU</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredBankQuestions.map((q) => (
                    <div
                      key={q.id}
                      className={`${GLASS_CARD} flex flex-wrap items-start justify-between gap-3 p-4 transition ${
                        q.enabled ? 'opacity-100' : 'opacity-60'
                      }`}
                    >
                      <div className="min-w-[220px] flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono-num font-bold text-pink-300">
                            No. {q.originalNumber}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="font-semibold text-cyan-200">
                            {QUESTION_MODEL_LABELS[q.type]}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="font-mono-num text-[11px] text-slate-400">
                            {q.id}
                          </span>
                          {resolveQuestionImage(q.id, q.image) && (
                            <>
                              <span className="text-slate-500">·</span>
                              <span className="text-[11px] font-medium text-pink-200">
                                Bergambar
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-slate-100">
                          {q.prompt || '(Pertanyaan kosong)'}
                        </p>
                        <p className="text-xs text-slate-400">
                          Kunci:{' '}
                          <span className="font-semibold text-cyan-200">
                            {formatShortAnswerKey(q)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc(null);
                            setDraftQuestions(store.questionBank);
                            setActiveStep('edit');
                            window.setTimeout(() => {
                              document
                                .getElementById(`question-card-${q.id}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 80);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.12] cursor-pointer"
                        >
                          <Pencil className="h-3 w-3 text-cyan-300" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBankItemEnabled(q.id)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                            q.enabled
                              ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30'
                              : 'border-white/[0.12] bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]'
                          }`}
                        >
                          {q.enabled ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`${GLASS_CARD} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <button
                  type="button"
                  onClick={() => setActiveStep('edit')}
                  className={BTN_DARK_GLASS}
                >
                  ← Kembali ke Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('codegs')}
                  className={BTN_PINK_GLASS}
                >
                  <span>LANJUT KE GENERATOR CODE.GS</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ==================== STEP 04: GENERATOR CODE.GS ==================== */}
          {activeStep === 'codegs' && (
            <section className="mx-auto max-w-4xl space-y-5">
              <div className={`${GLASS_CARD} p-6 space-y-5`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-[#102457] to-pink-500/45 text-cyan-200 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                      <Code2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-xs font-bold tracking-wide text-pink-300">
                        04 · Generator Code.gs
                      </div>
                      <h3 className="text-xl font-extrabold tracking-tight text-white">
                        Generator Code.gs
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {generatedAppsScriptCode
                          ? 'Kode Google Apps Script siap disalin ke Google Sheets.'
                          : 'Siap membuat kode Google Apps Script.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleGenerateCodeGs}
                    className={BTN_BLUE_PINK_GLASS}
                  >
                    <Code2 className="h-4 w-4 text-pink-300" />
                    <span>GENERATE CODE.GS</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCodeGs}
                    className={
                      appsScriptCopied
                        ? 'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/55 bg-cyan-500/25 px-4 py-2.5 text-xs font-bold text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.25)] cursor-pointer whitespace-nowrap'
                        : BTN_DARK_GLASS
                    }
                  >
                    <ClipboardCopy className="h-4 w-4 text-cyan-300" />
                    <span>{appsScriptCopied ? '✓ CODE.GS TERSALIN' : 'COPY CODE.GS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCodeGs}
                    className={BTN_DARK_GLASS}
                  >
                    <Download className="h-4 w-4 text-pink-300" />
                    <span>DOWNLOAD CODE.GS</span>
                  </button>
                </div>

                <div className={`${GLASS_SUBPANEL} p-4 text-xs text-slate-200 space-y-1.5`}>
                  <div className="font-bold text-cyan-200">Cara Singkat Memasang di Google Sheets:</div>
                  <ol className="list-inside list-decimal space-y-1 text-slate-300">
                    <li>Klik <strong className="text-white">GENERATE CODE.GS</strong> lalu tekan <strong className="text-white">COPY CODE.GS</strong>.</li>
                    <li>Buka Google Spreadsheet baru → klik <strong className="text-white">Ekstensi → Apps Script</strong>.</li>
                    <li>Tempel kode ke file <code className="text-pink-200">Code.gs</code> lalu klik <strong className="text-white">Simpan</strong>.</li>
                    <li>Jalankan fungsi <code className="text-cyan-200">setupExamEduverse</code> untuk membuat sheet secara otomatis.</li>
                  </ol>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold text-slate-200">Pratinjau Kode (JavaScript Apps Script)</span>
                    {generatedAppsScriptCode && (
                      <span className="font-mono-num text-cyan-300">
                        {generatedAppsScriptCode.split('\n').length} baris · Valid
                      </span>
                    )}
                  </div>
                  <textarea
                    id="apps-script-code-output"
                    ref={appsScriptTextareaRef}
                    readOnly
                    rows={14}
                    value={generatedAppsScriptCode}
                    placeholder='Klik "GENERATE CODE.GS" untuk menampilkan kode Google Apps Script siap pakai...'
                    className="w-full rounded-2xl border border-white/[0.14] bg-[#040814]/85 p-4 font-mono text-[11px] leading-relaxed text-cyan-100 placeholder:text-slate-500 focus:border-pink-400/70 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.1] pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveStep('bank')}
                    className={BTN_DARK_GLASS}
                  >
                    ← Kembali ke Bank Soal
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep('sync')}
                    className={BTN_PINK_GLASS}
                  >
                    <span>LANJUT KE SINKRONISASI</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ==================== STEP 05: SINKRONISASI KE GAME ==================== */}
          {activeStep === 'sync' && (
            <section className="mx-auto max-w-3xl space-y-5">
              <div className={`${GLASS_CARD} p-6 sm:p-8 space-y-6`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold tracking-wide text-pink-300">
                      05 · Sinkronisasi ke Game
                    </div>
                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                      SINKRONISASI SOAL
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Hubungkan soal dari Bank Soal ke Game EXAM EDUVERSE.
                    </p>
                  </div>
                </div>

                {/* Simple Pre-Sync Info */}
                <div className={`${GLASS_SUBPANEL} p-4 text-xs text-slate-300`}>
                  Sumber soal:{' '}
                  <strong className="text-cyan-200">{activeSourceLabel}</strong>
                  {' · '}
                  Total tersedia:{' '}
                  <strong className="font-mono-num text-white">
                    {draftQuestions.length || store.questionBank.length}
                  </strong>{' '}
                  soal
                  {' · '}
                  Kapasitas Question Box:{' '}
                  <strong className="font-mono-num text-pink-200">
                    {distSummary.totalBoxCapacity}
                  </strong>{' '}
                  kotak
                </div>

                {/* Main Sync Action */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={handleSyncToGame}
                    className={`flex-1 min-w-[220px] py-3.5 text-sm ${BTN_BLUE_PINK_GLASS} border-pink-300/55 shadow-[0_0_28px_rgba(236,72,153,0.28)] disabled:opacity-65`}
                  >
                    {syncBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-pink-300" />
                        <span>Menyinkronkan soal...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 text-pink-300" />
                        <span>SINKRONKAN KE GAME</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep('codegs')}
                    className={`${BTN_DARK_GLASS} py-3.5`}
                  >
                    ← Kembali
                  </button>
                </div>

                {/* Success Output Card */}
                {syncSuccessSummary && (
                  <div className="rounded-3xl border border-cyan-300/40 bg-gradient-to-br from-cyan-500/15 via-[#0b183a]/80 to-pink-500/15 p-6 backdrop-blur-xl shadow-[0_0_32px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.14)] space-y-4">
                    <div className="flex items-center gap-2.5 text-cyan-200">
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-cyan-300" />
                      <div>
                        <h4 className="text-base font-extrabold tracking-tight text-white">
                          ✓ SOAL BERHASIL DISINKRONKAN
                        </h4>
                        {syncSuccessSummary.sheetsSyncNote && (
                          <p className="text-xs text-cyan-200/90">
                            {syncSuccessSummary.sheetsSyncNote}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className={`${GLASS_SUBPANEL} p-3.5`}>
                        <div className="text-[11px] font-medium text-slate-300">Total soal</div>
                        <div className="mt-1 font-mono-num text-xl font-extrabold text-white">
                          {syncSuccessSummary.totalQuestions}
                        </div>
                      </div>
                      <div className={`${GLASS_SUBPANEL} p-3.5`}>
                        <div className="text-[11px] font-medium text-slate-300">Soal berhasil</div>
                        <div className="mt-1 font-mono-num text-xl font-extrabold text-cyan-300">
                          {syncSuccessSummary.syncedQuestions}
                        </div>
                      </div>
                      <div className={`${GLASS_SUBPANEL} p-3.5`}>
                        <div className="text-[11px] font-medium text-slate-300">Question Box terhubung</div>
                        <div className="mt-1 font-mono-num text-xl font-extrabold text-pink-300">
                          {syncSuccessSummary.connectedBoxes}/{syncSuccessSummary.totalBoxCapacity}
                        </div>
                      </div>
                      <div className={`${GLASS_SUBPANEL} p-3.5`}>
                        <div className="text-[11px] font-medium text-slate-300">Status</div>
                        <div className="mt-1 text-sm font-extrabold text-cyan-200">
                          Siap dimainkan
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onBack}
                        className={BTN_PINK_GLASS}
                      >
                        <span>Kembali ke Halaman Utama &amp; Mainkan</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Optional Collapsed Google Sheets & Backup Settings */}
                <div className="border-t border-white/[0.1] pt-4">
                  <button
                    type="button"
                    onClick={() => setShowOptionalSettings((v) => !v)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-left text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/[0.09] cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      {store.examConfig.appsScriptUrl.trim() ? (
                        <Cloud className="h-4 w-4 text-cyan-300" />
                      ) : (
                        <CloudOff className="h-4 w-4 text-slate-400" />
                      )}
                      <span>Pengaturan Tambahan: Google Sheets &amp; Cadangan Data (Opsional)</span>
                    </span>
                    {showOptionalSettings ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {showOptionalSettings && (
                    <div className={`${GLASS_SUBPANEL} mt-3 space-y-4 p-4 text-xs`}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 font-bold text-cyan-200">
                          <Database className="h-4 w-4 text-cyan-300" />
                          <span>Hubungkan Google Apps Script Web App (Opsional)</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block font-semibold text-slate-300">
                              URL Web App Apps Script (/exec)
                            </label>
                            <input
                              type="url"
                              value={appsScriptUrl}
                              onChange={(e) => {
                                setAppsScriptUrl(e.target.value);
                                if (endpointValidationError) setEndpointValidationError(null);
                              }}
                              placeholder="https://script.google.com/macros/s/.../exec"
                              className={GLASS_INPUT}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block font-semibold text-slate-300">
                              Google Spreadsheet ID (Opsional)
                            </label>
                            <input
                              type="text"
                              value={spreadsheetId}
                              onChange={(e) => {
                                setSpreadsheetId(e.target.value);
                                if (endpointValidationError) setEndpointValidationError(null);
                              }}
                              placeholder="ID Spreadsheet"
                              className={GLASS_INPUT}
                            />
                          </div>
                        </div>
                        {endpointValidationError && (
                          <p className="text-rose-300">{endpointValidationError}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSaveSyncConfig}
                            disabled={Boolean(sheetsBusyAction)}
                            className={`${BTN_DARK_GLASS} py-1.5 px-3`}
                          >
                            Simpan URL
                          </button>
                          <button
                            type="button"
                            onClick={handleTestSheetsConnection}
                            disabled={Boolean(sheetsBusyAction)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-400/25 cursor-pointer"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${sheetsBusyAction === 'ping' ? 'animate-spin' : ''}`}
                            />
                            <span>Uji Koneksi</span>
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-white/[0.1] pt-3 space-y-2.5">
                        <div className="font-bold text-slate-200">
                          Cadangan &amp; Pemulihan Data (Backup / Restore)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleCreateManualBackup}
                            className={`${BTN_DARK_GLASS} py-1.5 px-3`}
                          >
                            Siapkan Data Cadangan
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyBackupText}
                            className="rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-400/25 cursor-pointer"
                          >
                            {backupCopied ? '✓ Data Tersalin' : 'Salin Data Cadangan'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadBackupFile}
                            className="inline-flex items-center gap-1 rounded-xl border border-pink-300/35 bg-pink-500/15 px-3 py-1.5 font-semibold text-pink-100 hover:bg-pink-500/25 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Unduh Backup (.json)</span>
                          </button>
                          <label className="inline-flex items-center gap-1 rounded-xl border border-white/[0.16] bg-white/[0.06] px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/[0.12] cursor-pointer">
                            <FileCheck2 className="h-3.5 w-3.5 text-cyan-300" />
                            <span>Muat Backup (.json)</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              onChange={handleLoadRestoreJsonFile}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {backupTSV && (
                          <textarea
                            ref={backupTextareaRef}
                            readOnly
                            rows={4}
                            value={backupTSV}
                            className="w-full rounded-xl border border-white/[0.14] bg-[#040814]/85 p-2.5 font-mono text-[10px] text-cyan-100"
                          />
                        )}

                        {restoreInputText && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={handleValidateRestoreInput}
                                className={`${BTN_DARK_GLASS} py-1.5 px-3`}
                              >
                                Periksa Data Restore
                              </button>
                              {restoreValidation?.valid && (
                                <button
                                  type="button"
                                  onClick={() => setRestoreConfirmOpen(true)}
                                  className={`${BTN_PINK_GLASS} py-1.5 px-3`}
                                >
                                  Pulihkan Data
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {restoreConfirmOpen && restoreValidation?.valid && (
                          <div className="rounded-xl border border-pink-300/35 bg-pink-500/10 p-3 space-y-2">
                            <p className="font-semibold text-pink-100">
                              Pilih cara pemulihan data (data lama dicadangkan otomatis):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleExecuteRestore('use_backup')}
                                className={`${BTN_PINK_GLASS} py-1.5 px-3`}
                              >
                                Gunakan Data Backup
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExecuteRestore('keep_current')}
                                className={`${BTN_DARK_GLASS} py-1.5 px-3`}
                              >
                                Pertahankan Data Saat Ini
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestoreConfirmOpen(false)}
                                className={`${BTN_DARK_GLASS} py-1.5 px-3`}
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}

                        {restoreSuccessResult && (
                          <p className="text-cyan-300 font-semibold">
                            ✓ {restoreSuccessResult.message}
                          </p>
                        )}
                        {preRestoreInfo && (
                          <p className="text-[11px] text-slate-400">
                            Cadangan pengaman terakhir: {new Date(preRestoreInfo.savedAt).toLocaleString('id-ID')} ({preRestoreInfo.questionCount} soal).
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ==================== DIALOG KONFIRMASI RESET SOAL ==================== */}
      {resetConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-soal-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030612]/75 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-3xl border border-pink-300/30 bg-[#0b1430]/92 p-6 text-slate-100 backdrop-blur-2xl shadow-[0_24px_64px_rgba(2,6,23,0.85),0_0_40px_rgba(236,72,153,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] space-y-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/40 bg-rose-500/20 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                <RotateCcw className="h-5 w-5" />
              </span>
              <div>
                <h3
                  id="reset-soal-dialog-title"
                  className="text-base font-extrabold tracking-tight text-white"
                >
                  RESET SOAL?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Semua soal yang sedang dimuat akan dihapus dari sesi ini. Gunakan fitur ini jika ingin mengganti dokumen atau mata pelajaran.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className={`${BTN_DARK_GLASS} px-4 py-2`}
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={handleConfirmResetSession}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-300/50 bg-gradient-to-r from-rose-500/85 to-pink-600/85 px-4 py-2 text-xs font-bold text-white backdrop-blur-md shadow-[0_0_24px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 cursor-pointer whitespace-nowrap"
              >
                YA, RESET SOAL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
