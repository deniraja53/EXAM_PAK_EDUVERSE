import { CheckCircle2, HelpCircle, Unlink, XCircle } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { QuestionModelType, QuizQuestion } from '../game/types/gameTypes';

interface QuestionModalProps {
  question: QuizQuestion;
  onComplete: (isCorrect: boolean, answerPayload?: string) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

const MODEL_BADGE_LABELS: Record<QuestionModelType, string> = {
  pilihan_ganda: 'PILIHAN GANDA',
  pilihan_ganda_kompleks: 'PG KOMPLEKS',
  benar_salah: 'BENAR / SALAH',
  menjodohkan: 'MENJODOHKAN',
  isian_singkat: 'ISIAN SINGKAT',
  uraian: 'URAIAN',
};

const MATCH_PAIR_COLORS = [
  {
    stroke: '#ef4444',
    badge: 'bg-rose-500 text-white border-rose-200',
    box: 'border-rose-400 bg-rose-950/35',
  },
  {
    stroke: '#3b82f6',
    badge: 'bg-blue-500 text-white border-blue-200',
    box: 'border-blue-400 bg-blue-950/35',
  },
  {
    stroke: '#22c55e',
    badge: 'bg-emerald-500 text-slate-950 border-emerald-200',
    box: 'border-emerald-400 bg-emerald-950/35',
  },
  {
    stroke: '#eab308',
    badge: 'bg-yellow-400 text-slate-950 border-yellow-100',
    box: 'border-yellow-300 bg-yellow-950/30',
  },
  {
    stroke: '#a855f7',
    badge: 'bg-purple-500 text-white border-purple-200',
    box: 'border-purple-400 bg-purple-950/35',
  },
  {
    stroke: '#f97316',
    badge: 'bg-orange-500 text-slate-950 border-orange-200',
    box: 'border-orange-400 bg-orange-950/35',
  },
];

interface SvgLineSegment {
  leftIdx: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function QuestionModal({ question, onComplete }: QuestionModalProps) {
  const modelType: QuestionModelType = question.modelType ?? 'pilihan_ganda';

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [imgLoadError, setImgLoadError] = useState(false);

  // Interactive Menjodohkan state: maps leftIdx -> shuffled right slot index
  const [pairRightMap, setPairRightMap] = useState<Record<number, number>>({});
  const [activeLeftIdx, setActiveLeftIdx] = useState<number | null>(null);
  const [activeRightSlotIdx, setActiveRightSlotIdx] = useState<number | null>(null);
  const [svgLines, setSvgLines] = useState<SvgLineSegment[]>([]);

  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const shortInputRef = useRef<HTMLInputElement | null>(null);
  const essayTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const matchingBoardRef = useRef<HTMLDivElement | null>(null);
  const leftAnchorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rightAnchorRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const [submittedResult, setSubmittedResult] = useState<{
    isCorrect: boolean;
    hasKey: boolean;
    answerPayload: string;
    feedbackTitle: string;
  } | null>(null);

  const shuffledRightChoices = useMemo(() => {
    const pairs = question.matchingPairs ?? [];
    const indexed = pairs.map((p, idx) => ({
      origIdx: idx,
      text: p.right,
      sortKey: deterministicHash(`${question.id}:${idx}:${p.right}`),
    }));
    const sorted = [...indexed].sort((a, b) => a.sortKey - b.sortKey);
    // Guarantee choices do not stay aligned 1-to-1 when 2+ pairs exist
    if (sorted.length >= 2 && sorted.every((item, idx) => item.origIdx === idx)) {
      const first = sorted.shift();
      if (first) sorted.push(first);
    }
    return sorted;
  }, [question.id, question.matchingPairs]);

  useEffect(() => {
    setSelectedIndex(null);
    setSelectedIndices([]);
    setTextAnswer('');
    setPairRightMap({});
    setActiveLeftIdx(null);
    setActiveRightSlotIdx(null);
    setSvgLines([]);
    setImgLoadError(false);
    setSubmittedResult(null);
  }, [question.id]);

  useEffect(() => {
    if (submittedResult) return;
    if (modelType === 'isian_singkat') {
      shortInputRef.current?.focus();
      const rafId = window.requestAnimationFrame(() => {
        shortInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
    if (modelType === 'uraian') {
      essayTextareaRef.current?.focus();
      const rafId = window.requestAnimationFrame(() => {
        essayTextareaRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [question.id, modelType, submittedResult]);

  const recomputeSvgLines = useCallback(() => {
    if (modelType !== 'menjodohkan') {
      setSvgLines([]);
      return;
    }
    const board = matchingBoardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const pairs = question.matchingPairs ?? [];
    const nextLines: SvgLineSegment[] = [];

    pairs.forEach((_, leftIdx) => {
      const rightSlotIdx = pairRightMap[leftIdx];
      if (rightSlotIdx === undefined) return;
      const leftAnchor = leftAnchorRefs.current[leftIdx];
      const rightAnchor = rightAnchorRefs.current[rightSlotIdx];
      if (!leftAnchor || !rightAnchor) return;

      const lr = leftAnchor.getBoundingClientRect();
      const rr = rightAnchor.getBoundingClientRect();
      const color = MATCH_PAIR_COLORS[leftIdx % MATCH_PAIR_COLORS.length].stroke;

      nextLines.push({
        leftIdx,
        x1: lr.left + lr.width / 2 - boardRect.left,
        y1: lr.top + lr.height / 2 - boardRect.top,
        x2: rr.left + rr.width / 2 - boardRect.left,
        y2: rr.top + rr.height / 2 - boardRect.top,
        stroke: color,
      });
    });

    setSvgLines(nextLines);
  }, [modelType, pairRightMap, question.matchingPairs]);

  useLayoutEffect(() => {
    recomputeSvgLines();
  }, [recomputeSvgLines, imgLoadError, submittedResult]);

  useEffect(() => {
    if (modelType !== 'menjodohkan') return;
    const onResize = () => recomputeSvgLines();
    window.addEventListener('resize', onResize);

    const scroller = modalScrollRef.current;
    scroller?.addEventListener('scroll', onResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && matchingBoardRef.current) {
      observer = new ResizeObserver(() => recomputeSvgLines());
      observer.observe(matchingBoardRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      scroller?.removeEventListener('scroll', onResize);
      observer?.disconnect();
    };
  }, [modelType, recomputeSvgLines]);

  const submitSingleChoice = (idx: number) => {
    if (submittedResult) return;
    setSelectedIndex(idx);
    const hasKey = question.correctIndex >= 0;
    const isCorrect = hasKey && idx === question.correctIndex;
    const label = OPTION_LABELS[idx] ?? String(idx + 1);
    const optText = question.options[idx] ?? '';
    const answerPayload = `${label}. ${optText}`;
    setSubmittedResult({
      isCorrect,
      hasKey,
      answerPayload,
      feedbackTitle: !hasKey
        ? 'JAWABAN DICATAT (MENUNGGU PENILAIAN GURU)'
        : isCorrect
          ? `BENAR! +${question.rewardScore} POIN`
          : 'KURANG TEPAT!',
    });
  };

  const trueFalseMeta = useMemo(() => {
    const opts = question.options.length >= 2 ? question.options : ['Benar', 'Salah'];
    const foundTrue = opts.findIndex((o) => /^(benar|true)$/i.test(o.trim()));
    const foundFalse = opts.findIndex((o) => /^(salah|false)$/i.test(o.trim()));
    const trueIdx = foundTrue >= 0 ? foundTrue : 0;
    const falseIdx = foundFalse >= 0 ? foundFalse : trueIdx === 0 ? 1 : 0;
    return { opts, trueIdx, falseIdx };
  }, [question.options]);

  const handleSubmitTrueFalse = () => {
    if (submittedResult || selectedIndex === null) return;
    const hasKey = question.correctIndex >= 0;
    const isCorrect = hasKey && selectedIndex === question.correctIndex;
    const chosenText =
      trueFalseMeta.opts[selectedIndex] ??
      (selectedIndex === trueFalseMeta.trueIdx ? 'Benar' : 'Salah');

    setSubmittedResult({
      isCorrect,
      hasKey,
      answerPayload: chosenText,
      feedbackTitle: !hasKey
        ? 'JAWABAN DICATAT (MENUNGGU PENILAIAN GURU)'
        : isCorrect
          ? `BENAR! +${question.rewardScore} POIN`
          : 'KURANG TEPAT!',
    });
  };

  const handleSubmitComplex = () => {
    if (submittedResult || selectedIndices.length === 0) return;
    const sortedPicked = [...selectedIndices].sort((a, b) => a - b);
    const answerPayload = sortedPicked
      .map((i) => OPTION_LABELS[i] ?? String(i + 1))
      .join(', ');

    const expected = [...(question.correctIndices ?? [])].sort((a, b) => a - b);
    const hasKey = expected.length > 0;
    const isCorrect =
      hasKey &&
      sortedPicked.length === expected.length &&
      sortedPicked.every((val, i) => val === expected[i]);

    setSubmittedResult({
      isCorrect,
      hasKey,
      answerPayload,
      feedbackTitle: !hasKey
        ? 'JAWABAN DICATAT (MENUNGGU PENILAIAN GURU)'
        : isCorrect
          ? `BENAR! +${question.rewardScore} POIN`
          : 'KURANG TEPAT!',
    });
  };

  const connectLeftAndRight = (leftIdx: number, rightSlotIdx: number) => {
    setPairRightMap((prev) => {
      const next: Record<number, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        const numKey = Number(k);
        if (numKey !== leftIdx && v !== rightSlotIdx) {
          next[numKey] = v;
        }
      }
      next[leftIdx] = rightSlotIdx;
      return next;
    });
    setActiveLeftIdx(null);
    setActiveRightSlotIdx(null);
  };

  const handleLeftMatchingClick = (leftIdx: number) => {
    if (submittedResult) return;
    if (activeRightSlotIdx !== null) {
      connectLeftAndRight(leftIdx, activeRightSlotIdx);
      return;
    }
    setActiveLeftIdx((curr) => (curr === leftIdx ? null : leftIdx));
  };

  const handleRightMatchingClick = (rightSlotIdx: number) => {
    if (submittedResult) return;
    if (activeLeftIdx !== null) {
      connectLeftAndRight(activeLeftIdx, rightSlotIdx);
      return;
    }
    setActiveRightSlotIdx((curr) => (curr === rightSlotIdx ? null : rightSlotIdx));
  };

  const handleUnlinkLeft = (leftIdx: number) => {
    if (submittedResult) return;
    setPairRightMap((prev) => {
      const next = { ...prev };
      delete next[leftIdx];
      return next;
    });
  };

  const handleSubmitMatching = () => {
    const pairs = question.matchingPairs ?? [];
    if (submittedResult || pairs.length === 0) return;
    const allPicked = pairs.every((_, idx) => pairRightMap[idx] !== undefined);
    if (!allPicked) return;

    const isCorrect = pairs.every((pair, idx) => {
      const slotIdx = pairRightMap[idx];
      const chosenRight = shuffledRightChoices[slotIdx]?.text ?? '';
      return chosenRight.trim().toLowerCase() === pair.right.trim().toLowerCase();
    });
    const answerPayload = pairs
      .map((pair, idx) => {
        const slotIdx = pairRightMap[idx];
        const chosenRight = shuffledRightChoices[slotIdx]?.text ?? '-';
        return `${pair.left} -> ${chosenRight}`;
      })
      .join(' | ');

    setSubmittedResult({
      isCorrect,
      hasKey: true,
      answerPayload,
      feedbackTitle: isCorrect
        ? `BENAR! +${question.rewardScore} POIN`
        : 'KURANG TEPAT!',
    });
  };

  const handleSubmitText = (e?: FormEvent) => {
    e?.preventDefault();
    if (submittedResult) return;
    const trimmed = textAnswer.trim();
    if (!trimmed) return;

    if (modelType === 'uraian') {
      setSubmittedResult({
        isCorrect: false,
        hasKey: false,
        answerPayload: trimmed,
        feedbackTitle: 'JAWABAN URAIAN TERSIMPAN UNTUK PEMERIKSAAN GURU',
      });
      return;
    }

    const expected = (question.correctText ?? '').trim();
    const hasKey = expected.length > 0;
    const acceptedVariants = expected
      .split(/\s*(?:\||\/|;)\s*/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const isCorrect =
      hasKey && acceptedVariants.includes(trimmed.toLowerCase());

    setSubmittedResult({
      isCorrect,
      hasKey,
      answerPayload: trimmed,
      feedbackTitle: !hasKey
        ? 'JAWABAN DICATAT (MENUNGGU PENILAIAN GURU)'
        : isCorrect
          ? `BENAR! +${question.rewardScore} POIN`
          : 'KURANG TEPAT!',
    });
  };

  const isEditableEventTarget = (target: EventTarget | null): boolean => {
    if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
    const el = target as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const inputType = ((el as HTMLInputElement).type || 'text').toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(
        inputType
      );
    }
    return Boolean(el.isContentEditable);
  };

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (!submittedResult) {
      if (isEditableEventTarget(e.target) || isEditableEventTarget(document.activeElement)) {
        return;
      }
      if (modelType === 'pilihan_ganda') {
        const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
        if (idx >= 0 && idx < question.options.length) {
          e.preventDefault();
          submitSingleChoice(idx);
        }
      } else if (modelType === 'benar_salah') {
        if (e.key === '1') {
          e.preventDefault();
          setSelectedIndex(trueFalseMeta.trueIdx);
        } else if (e.key === '2') {
          e.preventDefault();
          setSelectedIndex(trueFalseMeta.falseIdx);
        } else if (e.key === 'Enter' && selectedIndex !== null) {
          e.preventDefault();
          handleSubmitTrueFalse();
        }
      }
    } else {
      if (isEditableEventTarget(e.target)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        onComplete(submittedResult.isCorrect, submittedResult.answerPayload);
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keyHandlerRef.current(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hasAnswered = submittedResult !== null;
  const hasImage = Boolean(question.image && !imgLoadError);
  const modalWidthClass = hasImage
    ? 'max-w-3xl'
    : modelType === 'menjodohkan'
      ? 'max-w-2xl'
      : 'max-w-lg';

  const pairedCount = Object.keys(pairRightMap).length;
  const totalPairs = (question.matchingPairs ?? []).length;

  const renderAnswerControls = () => (
    <>
      {modelType === 'pilihan_ganda' && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt, idx) => {
            const isPicked = selectedIndex === idx;
            const isRightOption =
              question.correctIndex >= 0 && idx === question.correctIndex;

            let btnStyle =
              'bg-[#101b30] hover:bg-[#1a2b4a] border-slate-400 text-slate-100';

            if (hasAnswered) {
              if (isRightOption) {
                btnStyle = 'bg-emerald-950/90 border-emerald-400 text-emerald-100';
              } else if (isPicked && submittedResult.hasKey) {
                btnStyle = 'bg-rose-950/90 border-rose-400 text-rose-100';
              } else if (isPicked) {
                btnStyle = 'bg-sky-950/90 border-sky-400 text-sky-100';
              } else {
                btnStyle = 'bg-[#0b1322] border-slate-700 text-slate-400';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasAnswered}
                onClick={() => submitSingleChoice(idx)}
                className={`pixel-btn flex items-center justify-between gap-3 border-2 px-3.5 py-2.5 text-left text-xs sm:text-sm transition-colors ${btnStyle}`}
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono-num font-bold text-amber-300">
                    {OPTION_LABELS[idx] ?? idx + 1}.
                  </span>
                  <span className="font-sans">{opt}</span>
                </span>

                {hasAnswered && isRightOption && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                {hasAnswered && isPicked && submittedResult.hasKey && !isRightOption && (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {modelType === 'benar_salah' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'BENAR',
                optIdx: trueFalseMeta.trueIdx,
                selectedStyle:
                  'bg-emerald-600 border-emerald-200 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.45)]',
              },
              {
                label: 'SALAH',
                optIdx: trueFalseMeta.falseIdx,
                selectedStyle:
                  'bg-rose-600 border-rose-200 text-white shadow-[0_0_0_2px_rgba(244,63,94,0.45)]',
              },
            ].map((item) => {
              const isPicked = selectedIndex === item.optIdx;
              const neutralStyle =
                'bg-[#101b30] hover:bg-[#1a2b4a] border-slate-400 text-slate-100';

              let btnStyle = isPicked ? item.selectedStyle : neutralStyle;

              if (hasAnswered) {
                if (question.correctIndex >= 0 && item.optIdx === question.correctIndex) {
                  btnStyle = 'bg-emerald-950/90 border-emerald-400 text-emerald-100';
                } else if (isPicked && submittedResult.hasKey) {
                  btnStyle = 'bg-rose-950/90 border-rose-400 text-rose-100';
                } else if (isPicked) {
                  btnStyle = item.selectedStyle;
                } else {
                  btnStyle = 'bg-[#0b1322] border-slate-700 text-slate-400';
                }
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={hasAnswered}
                  aria-pressed={isPicked}
                  onClick={() => setSelectedIndex(item.optIdx)}
                  className={`pixel-btn flex items-center justify-center gap-2 border-2 px-4 py-3.5 text-sm font-bold tracking-wider transition-all cursor-pointer ${btnStyle}`}
                >
                  <span>{item.label}</span>
                  {hasAnswered &&
                    question.correctIndex >= 0 &&
                    item.optIdx === question.correctIndex && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    )}
                  {hasAnswered &&
                    isPicked &&
                    submittedResult.hasKey &&
                    item.optIdx !== question.correctIndex && (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                    )}
                </button>
              );
            })}
          </div>

          {!hasAnswered && (
            <button
              type="button"
              disabled={selectedIndex === null}
              onClick={handleSubmitTrueFalse}
              className="pixel-btn w-full bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold border-2 border-slate-100 px-4 py-2.5 text-xs cursor-pointer"
            >
              KIRIM JAWABAN
            </button>
          )}
        </div>
      )}

      {modelType === 'pilihan_ganda_kompleks' && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt, idx) => {
            const checked = selectedIndices.includes(idx);
            const expected = question.correctIndices ?? [];
            const isRightOption = expected.includes(idx);

            let rowStyle = checked
              ? 'bg-sky-950/90 border-sky-400 text-sky-50'
              : 'bg-[#101b30] hover:bg-[#1a2b4a] border-slate-400 text-slate-100';

            if (hasAnswered) {
              if (expected.length > 0 && isRightOption) {
                rowStyle = 'bg-emerald-950/90 border-emerald-400 text-emerald-100';
              } else if (checked && expected.length > 0 && !isRightOption) {
                rowStyle = 'bg-rose-950/90 border-rose-400 text-rose-100';
              } else {
                rowStyle = 'bg-[#0b1322] border-slate-700 text-slate-400';
              }
            }

            return (
              <label
                key={idx}
                className={`flex cursor-pointer items-center justify-between gap-3 border-2 px-3.5 py-2.5 text-xs sm:text-sm ${rowStyle}`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={hasAnswered}
                    checked={checked}
                    onChange={() => {
                      setSelectedIndices((prev) =>
                        prev.includes(idx)
                          ? prev.filter((item) => item !== idx)
                          : [...prev, idx]
                      );
                    }}
                    className="h-4 w-4 accent-amber-400"
                  />
                  <span className="font-mono-num font-bold text-amber-300">
                    {OPTION_LABELS[idx] ?? idx + 1}.
                  </span>
                  <span className="font-sans">{opt}</span>
                </span>
              </label>
            );
          })}

          {!hasAnswered && (
            <button
              type="button"
              disabled={selectedIndices.length === 0}
              onClick={handleSubmitComplex}
              className="pixel-btn mt-2 w-full bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold border-2 border-slate-100 px-4 py-2.5 text-xs cursor-pointer"
            >
              KIRIM JAWABAN ({selectedIndices.length} DIPILIH)
            </button>
          )}
        </div>
      )}

      {modelType === 'menjodohkan' && (
        <div className="space-y-3">
          {!hasAnswered && (
            <div className="border border-slate-700 bg-[#0b1426] px-3 py-2 text-[11px] text-slate-300">
              Klik item di <strong>Kolom Kiri</strong> lalu klik pasangannya di{' '}
              <strong>Kolom Kanan</strong> untuk menarik garis penghubung ({pairedCount}/
              {totalPairs} terpasang).
            </div>
          )}

          <div
            ref={matchingBoardRef}
            className="relative grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-stretch gap-y-2.5"
          >
            {/* SVG Connecting Overlay */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
            >
              {svgLines.map((line) => {
                const dx = Math.max(24, Math.abs(line.x2 - line.x1) * 0.45);
                const d = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;
                return (
                  <g key={line.leftIdx}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#09101d"
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={line.stroke}
                      strokeWidth={3.25}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={line.x1}
                      cy={line.y1}
                      r={4.5}
                      fill={line.stroke}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={line.x2}
                      cy={line.y2}
                      r={4.5}
                      fill={line.stroke}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Left Column Items */}
            <div className="z-20 flex flex-col justify-center gap-2.5">
              {(question.matchingPairs ?? []).map((pair, leftIdx) => {
                const palette = MATCH_PAIR_COLORS[leftIdx % MATCH_PAIR_COLORS.length];
                const rightSlot = pairRightMap[leftIdx];
                const isPaired = rightSlot !== undefined;
                const isActive = activeLeftIdx === leftIdx;

                let cardClass =
                  'border-slate-500 bg-[#101b30] hover:border-amber-300 text-slate-100';
                if (isActive) {
                  cardClass = 'border-amber-300 bg-amber-950/50 text-amber-50 ring-2 ring-amber-300/60';
                } else if (isPaired) {
                  cardClass = `${palette.box} text-slate-50`;
                }

                if (hasAnswered && isPaired) {
                  const chosenRight = shuffledRightChoices[rightSlot]?.text ?? '';
                  const pairOk =
                    chosenRight.trim().toLowerCase() === pair.right.trim().toLowerCase();
                  cardClass = pairOk
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                    : 'border-rose-400 bg-rose-950/60 text-rose-100';
                }

                return (
                  <div
                    key={leftIdx}
                    className={`relative flex items-center justify-between gap-2 border-2 px-2.5 py-2 text-xs transition-colors ${cardClass}`}
                  >
                    <button
                      type="button"
                      disabled={hasAnswered}
                      onClick={() => handleLeftMatchingClick(leftIdx)}
                      className="flex flex-1 items-center gap-2 text-left cursor-pointer disabled:cursor-default"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border font-mono-num text-[11px] font-bold ${
                          isPaired || isActive
                            ? palette.badge
                            : 'border-slate-500 bg-slate-800 text-amber-300'
                        }`}
                      >
                        {leftIdx + 1}
                      </span>
                      <span className="font-sans leading-snug break-words">
                        {pair.left}
                      </span>
                    </button>

                    {!hasAnswered && isPaired && (
                      <button
                        type="button"
                        title={`Putuskan garis nomor ${leftIdx + 1}`}
                        onClick={() => handleUnlinkLeft(leftIdx)}
                        className="shrink-0 p-0.5 text-slate-300 hover:text-rose-300 cursor-pointer"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Anchor dot on right edge */}
                    <span
                      ref={(el) => {
                        leftAnchorRefs.current[leftIdx] = el;
                      }}
                      className="h-3 w-3 shrink-0 rounded-full border-2 border-white bg-slate-700"
                      style={isPaired ? { backgroundColor: palette.stroke } : undefined}
                    />
                  </div>
                );
              })}
            </div>

            {/* Middle SVG Spacer Column */}
            <div aria-hidden="true" />

            {/* Right Column Items */}
            <div className="z-20 flex flex-col justify-center gap-2.5">
              {shuffledRightChoices.map((choice, rightSlotIdx) => {
                const connectedLeftEntry = Object.entries(pairRightMap).find(
                  ([, rIdx]) => rIdx === rightSlotIdx
                );
                const connectedLeftIdx = connectedLeftEntry
                  ? Number(connectedLeftEntry[0])
                  : null;
                const palette =
                  connectedLeftIdx !== null
                    ? MATCH_PAIR_COLORS[connectedLeftIdx % MATCH_PAIR_COLORS.length]
                    : null;
                const isActive = activeRightSlotIdx === rightSlotIdx;

                let cardClass =
                  'border-slate-500 bg-[#101b30] hover:border-amber-300 text-slate-100';
                if (isActive) {
                  cardClass = 'border-amber-300 bg-amber-950/50 text-amber-50 ring-2 ring-amber-300/60';
                } else if (palette) {
                  cardClass = `${palette.box} text-slate-50`;
                }

                return (
                  <button
                    key={`${choice.origIdx}-${rightSlotIdx}`}
                    type="button"
                    disabled={hasAnswered}
                    onClick={() => handleRightMatchingClick(rightSlotIdx)}
                    className={`relative flex items-center gap-2 border-2 px-2.5 py-2 text-left text-xs transition-colors cursor-pointer disabled:cursor-default ${cardClass}`}
                  >
                    {/* Anchor dot on left edge */}
                    <span
                      ref={(el) => {
                        rightAnchorRefs.current[rightSlotIdx] = el;
                      }}
                      className="h-3 w-3 shrink-0 rounded-full border-2 border-white bg-slate-700"
                      style={palette ? { backgroundColor: palette.stroke } : undefined}
                    />
                    <span className="flex-1 font-sans leading-snug break-words">
                      {choice.text}
                    </span>
                    {connectedLeftIdx !== null && palette && (
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border font-mono-num text-[11px] font-bold ${palette.badge}`}
                      >
                        {connectedLeftIdx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!hasAnswered && (
            <button
              type="button"
              disabled={totalPairs === 0 || pairedCount < totalPairs}
              onClick={handleSubmitMatching}
              className="pixel-btn mt-2 w-full bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold border-2 border-slate-100 px-4 py-2.5 text-xs cursor-pointer"
            >
              KIRIM PASANGAN JAWABAN ({pairedCount}/{totalPairs})
            </button>
          )}
        </div>
      )}

      {(modelType === 'isian_singkat' || modelType === 'uraian') && (
        <form onSubmit={handleSubmitText} className="space-y-3">
          {modelType === 'isian_singkat' ? (
            <input
              ref={shortInputRef}
              type="text"
              autoFocus
              disabled={hasAnswered}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Ketik jawaban singkat Anda..."
              className="w-full bg-[#0f1d36] border-2 border-slate-400 px-3 py-2.5 text-xs sm:text-sm text-slate-50 placeholder:text-slate-400 focus:border-amber-300 focus:outline-none"
            />
          ) : (
            <textarea
              ref={essayTextareaRef}
              rows={4}
              autoFocus
              disabled={hasAnswered}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Tulis jawaban uraian Anda secara lengkap..."
              className="w-full bg-[#0f1d36] border-2 border-slate-400 px-3 py-2 text-xs sm:text-sm text-slate-50 placeholder:text-slate-400 focus:border-amber-300 focus:outline-none"
            />
          )}

          {!hasAnswered && (
            <button
              type="submit"
              disabled={!textAnswer.trim()}
              className="pixel-btn w-full bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold border-2 border-slate-100 px-4 py-2.5 text-xs cursor-pointer"
            >
              KIRIM JAWABAN
            </button>
          )}
        </form>
      )}
    </>
  );

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 pt-16 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Question Box Challenge"
    >
      <div
        ref={modalScrollRef}
        className={`pixel-panel-warm w-full ${modalWidthClass} max-h-[85vh] overflow-y-auto p-5 sm:p-6 text-left`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center bg-amber-400 text-slate-950 border-2 border-slate-100">
              <HelpCircle className="h-4 w-4" />
            </span>
            <span className="font-pixel-ui text-xs text-amber-300 tracking-wide">
              QUESTION BOX · {question.region.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {question.modelType && (
              <span className="border border-sky-400/60 bg-sky-950/80 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                {MODEL_BADGE_LABELS[modelType]}
              </span>
            )}
            <span className="font-mono-num text-xs font-bold text-emerald-300">
              +{question.rewardScore} PTS
            </span>
          </div>
        </div>

        {/* Layout Condition: Two-Column Image + Prompt ONLY when question.image is present */}
        {hasImage ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-5 border-2 border-slate-600 bg-[#08101f] p-2.5 flex flex-col items-center justify-center">
              <img
                src={question.image ?? undefined}
                alt={question.imageAlt || question.prompt}
                onError={() => setImgLoadError(true)}
                className="w-full max-h-60 md:max-h-72 object-contain"
              />
              {question.imageAlt && (
                <p className="mt-1.5 text-center text-[11px] text-slate-400">
                  {question.imageAlt}
                </p>
              )}
            </div>

            <div className="md:col-span-7">
              <h2 className="mb-4 text-sm sm:text-base font-bold leading-relaxed text-slate-50">
                {question.prompt}
              </h2>
              {modelType !== 'menjodohkan' && renderAnswerControls()}
            </div>

            {modelType === 'menjodohkan' && (
              <div className="md:col-span-12">{renderAnswerControls()}</div>
            )}
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-sm sm:text-base font-bold leading-relaxed text-slate-50">
              {question.prompt}
            </h2>
            {renderAnswerControls()}
          </>
        )}

        {hasAnswered && submittedResult && (
          <div className="mt-4 space-y-3">
            <div
              className={`border-2 p-3 text-xs leading-relaxed ${
                !submittedResult.hasKey
                  ? 'border-sky-400 bg-sky-950/60 text-sky-100'
                  : submittedResult.isCorrect
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                    : 'border-rose-400 bg-rose-950/60 text-rose-100'
              }`}
            >
              <p className="font-pixel-ui text-xs mb-1">
                {submittedResult.feedbackTitle}
              </p>
              <p className="text-slate-200">{question.explanation}</p>
              {modelType === 'uraian' && question.rubric && (
                <p className="mt-1.5 border-t border-sky-400/40 pt-1.5 text-[11px] text-sky-200">
                  <strong>Rubrik Penilaian Guru:</strong> {question.rubric}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onComplete(submittedResult.isCorrect, submittedResult.answerPayload)
              }
              className="pixel-btn w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold border-2 border-slate-100 px-5 py-3 text-xs shadow-[0_3px_0_#78350f] cursor-pointer"
            >
              LANJUTKAN BERMAIN (ENTER)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
