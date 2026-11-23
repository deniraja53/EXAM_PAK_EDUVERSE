import { MatchingPair, QuestionModelType } from '../game/types/gameTypes';
import {
  AnswerKeyStatus,
  AnswerKeySummary,
  QUESTION_MODEL_ORDER,
  QuestionDistributionMap,
  TeacherBankQuestion,
} from './teacherTypes';

const SECTION_HEADER_PATTERNS: Array<{ type: QuestionModelType; regex: RegExp }> = [
  {
    type: 'pilihan_ganda_kompleks',
    regex: /\bpilihan\s+ganda\s+kompleks\b|\bpg\s+kompleks\b|\bpgk\b/i,
  },
  {
    type: 'pilihan_ganda',
    regex: /\bpilihan\s+ganda\b(?!\s+kompleks)/i,
  },
  {
    type: 'benar_salah',
    regex: /\bbenar\s*(?:[\/\-]|atau)\s*salah\b|\btrue\s*(?:[\/\-]|or)\s*false\b/i,
  },
  {
    type: 'menjodohkan',
    regex: /\bmenjodohkan\b|\bpasangkan\b|\bjodohkan\b/i,
  },
  {
    type: 'isian_singkat',
    regex: /\bisian\s+singkat\b|\bisian\b|\bmelengkapi\b/i,
  },
  {
    type: 'uraian',
    regex: /\buraian\b|\besai\b|\bessay\b/i,
  },
];

const INLINE_TAG_PATTERNS: Array<{ type: QuestionModelType; regex: RegExp }> = [
  { type: 'pilihan_ganda_kompleks', regex: /\[(PGK|PILIHAN\s+GANDA\s+KOMPLEKS)\]/i },
  { type: 'pilihan_ganda', regex: /\[(PG|PILIHAN\s+GANDA)\]/i },
  { type: 'benar_salah', regex: /\[(BS|BENAR\s*[\/\-]\s*SALAH|TRUE\s*[\/\-]\s*FALSE)\]/i },
  { type: 'menjodohkan', regex: /\[(MENJODOHKAN|JODOHKAN|PASANGKAN)\]/i },
  { type: 'isian_singkat', regex: /\[(ISIAN|ISIAN\s+SINGKAT)\]/i },
  { type: 'uraian', regex: /\[(URAIAN|ESAI|ESSAY)\]/i },
];

function stripInlineTags(text: string): string {
  let clean = text;
  for (const { regex } of INLINE_TAG_PATTERNS) {
    clean = clean.replace(regex, '');
  }
  return clean.replace(/\s{2,}/g, ' ').trim();
}

function detectExplicitTypeTag(text: string): QuestionModelType | null {
  for (const { type, regex } of INLINE_TAG_PATTERNS) {
    if (regex.test(text)) return type;
  }
  return null;
}

function detectAnswerKeySectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  // Avoid matching a full exam question that mentions "kunci jawaban" in prose
  if (
    /^\d+\s*[.)]\s+\S.{25,}/.test(trimmed) ||
    /\?/.test(trimmed)
  ) {
    return false;
  }

  const normalized = trimmed
    .replace(/^(?:[IVXLCDM]+|[A-Z]|\d+)\s*[.)]\s*/i, '')
    .replace(/[:\-–—=\s]+$/g, '')
    .trim();

  return /^(?:kunci\s+jawaban(?:\s+(?:dan|&)?\s*(?:pembahasan|pedoman\s+(?:penilaian|penskoran|jawaban)|rubrik(?:\s+penilaian)?|evaluasi|soal|ujian|[a-z0-9\s]{1,30}))?|kunci\s*(?:&|dan)\s*(?:pembahasan|pedoman\s+(?:penilaian|penskoran)|rubrik)|pembahasan\s+(?:dan|&)\s+kunci(?:\s+jawaban)?|answer\s+keys?(?:\s+[a-z0-9\s]{1,25})?|rubrik\s+(?:penilaian|jawaban)(?:\s+[a-z0-9\s]{1,25})?|pedoman\s+(?:penilaian|penskoran|jawaban)(?:\s+(?:dan|&)\s+kunci(?:\s+jawaban)?)?)$/i.test(
    normalized
  );
}

function detectSectionHeader(line: string): QuestionModelType | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 90) return null;
  if (detectExplicitTypeTag(trimmed) !== null) return null;
  if (detectAnswerKeySectionHeader(trimmed)) return null;

  const qStart = matchQuestionStart(trimmed);
  if (qStart) {
    // Only allow a numbered line to be a section heading if the remainder is strictly a short section title
    const cleanRest = qStart.rest.replace(/[:.\-–—]+$/g, '').trim();
    const pureTitleRegex =
      /^(?:bagian\s+[a-z0-9]+\s*[:.\-]?\s*)?(?:soal\s+)?(?:pilihan\s+ganda(?:\s+kompleks)?|pg\s+kompleks|pgk|benar\s*(?:[\/\-]|atau)\s*salah|true\s*(?:[\/\-]|or)\s*false|menjodohkan|pasangkan|jodohkan|isian(?:\s+singkat)?|melengkapi|uraian|esai|essay)$/i;
    if (!pureTitleRegex.test(cleanRest)) {
      return null;
    }
  }

  for (const { type, regex } of SECTION_HEADER_PATTERNS) {
    if (regex.test(trimmed)) return type;
  }
  return null;
}

function matchQuestionStart(line: string): { num: string; rest: string } | null {
  const trimmed = line.trim();
  // Avoid mistaking decimals like "1.5 km" for question #1
  const patterns: RegExp[] = [
    /^(?:Soal\s*No\.?|Nomor|Pertanyaan|Soal|No\.?)\s*(\d{1,3})\s*[.):=\-]?\s+(.+)$/i,
    /^\((\d{1,3})\)\s+(.+)$/,
    /^(\d{1,3})\s*[.):]\s+(.+)$/,
    /^(\d{1,3})\.\s*([A-Za-z[(“"'].+)$/,
    /^(\d{1,3})\)\s*([A-Za-z[(“"'].+)$/,
  ];

  for (const rx of patterns) {
    const m = trimmed.match(rx);
    if (m) {
      return { num: m[1], rest: m[2].trim() };
    }
  }
  return null;
}

function matchStandaloneQuestionNumber(line: string): string | null {
  const m = line.trim().match(/^(?:(?:Soal|Nomor|Pertanyaan|No\.?)\s*)?\(?(\d{1,3})\)?\s*[.):-]?$/i);
  return m ? m[1] : null;
}

function extractWeight(lines: string[]): { weight: number | null; remaining: string[] } {
  let weight: number | null = null;
  const remaining: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /^(?:bobot|skor|nilai|poin)\s*[:=]\s*(\d+(?:[.,]\d+)?)/i
    );
    if (match) {
      const num = Number.parseFloat(match[1].replace(',', '.'));
      if (Number.isFinite(num) && num > 0) {
        weight = num;
        continue;
      }
    }

    const inlineWeight = line.match(/\(bobot\s*[:=]?\s*(\d+)\s*(?:poin|skor)?\)/i);
    if (inlineWeight && weight === null) {
      const num = Number.parseInt(inlineWeight[1], 10);
      if (Number.isFinite(num) && num > 0) {
        weight = num;
      }
      remaining.push(line.replace(inlineWeight[0], '').trim());
      continue;
    }

    remaining.push(line);
  }

  return { weight, remaining };
}

function extractAnswerKeyAndRubric(lines: string[]): {
  rawKey: string | null;
  rawRubric: string | null;
  remaining: string[];
} {
  let rawKey: string | null = null;
  let rawRubric: string | null = null;
  const remaining: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const rubricMatch = trimmed.match(
      /^(?:rubrik(?:\s+penilaian)?|pedoman\s+(?:penilaian|jawaban|penskoran)|kriteria\s+penilaian)\s*[:=]\s*(.+)$/i
    );
    if (rubricMatch) {
      const val = rubricMatch[1].trim();
      rawRubric = rawRubric ? `${rawRubric}; ${val}` : val;
      continue;
    }

    const inlineBracketKey = trimmed.match(/\[(?:kunci(?:\s+jawaban)?|jawaban|key)\s*[:=]\s*([^\]]+)\]/i);
    if (inlineBracketKey) {
      rawKey = inlineBracketKey[1].trim();
      const withoutTag = trimmed.replace(inlineBracketKey[0], '').trim();
      if (withoutTag) remaining.push(withoutTag);
      continue;
    }

    const match = trimmed.match(
      /^(?:kunci\s*jawaban|kunci|jawaban\s*benar|jawaban|key|answer)\s*[:=]\s*(.+)$/i
    );
    if (match) {
      rawKey = match[1].trim();
      continue;
    }
    remaining.push(line);
  }

  return { rawKey, rawRubric, remaining };
}

function extractExplanation(lines: string[]): {
  explanation: string | null;
  remaining: string[];
} {
  const explanationParts: string[] = [];
  const remaining: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /^(?:pembahasan|penjelasan|keterangan|explanation)\s*[:=]\s*(.+)$/i
    );
    if (match) {
      const part = match[1].trim();
      if (part) explanationParts.push(part);
      continue;
    }
    remaining.push(line);
  }

  return {
    explanation: explanationParts.length > 0 ? explanationParts.join(' ') : null,
    remaining,
  };
}

export function formatCanonicalQuestionId(sequence: number): string {
  const num = Math.max(1, Math.floor(sequence));
  return `Q${String(num).padStart(3, '0')}`;
}

function splitInlineOptions(line: string): string[] {
  // Detects multiple lettered options on a single line: "A. satu   B. dua   C. tiga   D. empat"
  const parts = line
    .split(/(?=(?:^|\s)\(?[A-Ea-e]\)?[.)]\s+)/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^\(?[A-Ea-e]\)?[.)]\s+/.test(p))) {
    return parts;
  }
  return [line];
}

function matchLetteredOption(line: string): { letter: string; text: string } | null {
  const trimmed = line.trim();
  const std = trimmed.match(/^\(?([A-Ea-e])\)?[.)]\s+(.+)$/);
  if (std) {
    return { letter: std[1].toUpperCase(), text: std[2].trim() };
  }
  const tightUpper = trimmed.match(/^([A-E])[.)]([A-Za-z0-9“"'(].+)$/);
  if (tightUpper) {
    return { letter: tightUpper[1], text: tightUpper[2].trim() };
  }
  return null;
}

function parseMatchingPairStrings(rawKey: string): MatchingPair[] {
  const parts = rawKey
    .split(/\s*(?:;|\||\n)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pairs: MatchingPair[] = [];
  for (const part of parts) {
    const m = part.match(/^(?:[A-Za-z0-9]+[.)]\s*)?(.+?)\s*(?:->|=>|↔|<->|=)\s*(.+)$/);
    if (m && m[1].trim() && m[2].trim()) {
      pairs.push({ left: m[1].trim(), right: m[2].trim() });
    }
  }
  return pairs;
}

function parseIndexedLetterPairs(rawKey: string): Array<{ leftNum: number; rightLetter: string }> {
  const clean = rawKey.replace(/[()]/g, ' ').trim();
  const matches = Array.from(clean.matchAll(/\b(\d{1,2})\s*(?:[-=:>→]+)\s*([A-Ea-e])\b/g));
  return matches.map((m) => ({
    leftNum: Number.parseInt(m[1], 10),
    rightLetter: m[2].toUpperCase(),
  }));
}

interface ParsedKeyNormalizationResult {
  correctAnswer: string | string[] | null;
  rubric?: string | null;
  matchingPairs?: MatchingPair[];
  ambiguousNote: string | null;
}

function normalizeKeyForQuestionType(
  rawKey: string,
  qType: QuestionModelType,
  options: string[],
  existingPairs: MatchingPair[],
  hasExplicitLetteredOptions = true,
  numberedPromptsForMatching: string[] = []
): ParsedKeyNormalizationResult {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    return { correctAnswer: null, ambiguousNote: null };
  }

  if (qType === 'pilihan_ganda') {
    // Handles "B", "(B)", "B.", "B. Jakarta", "B (Jakarta)", "Jawaban: B"
    const clean = trimmed
      .replace(/^(?:kunci|jawaban)\s*[:=]?\s*/i, '')
      .trim();
    const letterLead = clean.match(/^\(?([A-Ea-e])\)?(?:[.):\s]+(.*))?$/);
    if (letterLead) {
      const letter = letterLead[1].toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      if (options.length > 0 && (idx < 0 || idx >= options.length)) {
        return {
          correctAnswer: letter,
          ambiguousNote: `Kunci "${letter}" berada di luar jumlah opsi (${options.length} opsi)`,
        };
      }
      return { correctAnswer: letter, ambiguousNote: null };
    }

    // Match by exact option text if teacher wrote option text instead of letter
    const norm = clean.toLowerCase();
    const matchedIndices = options
      .map((opt, idx) => (opt.trim().toLowerCase() === norm ? idx : -1))
      .filter((idx) => idx >= 0);
    if (matchedIndices.length === 1) {
      return {
        correctAnswer: String.fromCharCode(65 + matchedIndices[0]),
        ambiguousNote: null,
      };
    }

    return {
      correctAnswer: clean,
      ambiguousNote: `Format kunci Pilihan Ganda "${clean}" belum mengarah jelas ke huruf A-${String.fromCharCode(64 + Math.max(4, options.length))}`,
    };
  }

  if (qType === 'pilihan_ganda_kompleks') {
    const clean = trimmed.replace(/[()]/g, '').trim();
    // Matches "A, C", "A dan C", "A & B", "A; C; D", or "A B C"
    const tokens = clean
      .toUpperCase()
      .split(/\s*(?:,|;|DAN|AND|&|\+|\s)\s*/i)
      .map((t) => t.replace(/[.)]$/, '').trim())
      .filter(Boolean);

    const letters = Array.from(
      new Set(tokens.filter((t) => /^[A-E]$/.test(t)))
    );
    // Support compact "AC" or "ABD" when every char is A-E
    if (letters.length === 0 && /^[A-E]{2,5}$/i.test(clean)) {
      const splitChars = Array.from(new Set(clean.toUpperCase().split('')));
      const outOfBounds = splitChars.some((l) => l.charCodeAt(0) - 65 >= options.length);
      return {
        correctAnswer: splitChars,
        ambiguousNote:
          splitChars.length < 2
            ? 'Pilihan Ganda Kompleks memerlukan minimal 2 kunci'
            : outOfBounds && options.length > 0
              ? 'Sebagian huruf kunci melebihi jumlah opsi'
              : null,
      };
    }

    if (letters.length > 0 && tokens.every((t) => /^[A-E]$/.test(t))) {
      const outOfBounds =
        options.length > 0 &&
        letters.some((l) => l.charCodeAt(0) - 65 >= options.length);
      return {
        correctAnswer: letters,
        ambiguousNote:
          letters.length < 2
            ? 'Pilihan Ganda Kompleks baru memiliki 1 kunci; periksa kembali'
            : outOfBounds
              ? 'Sebagian huruf kunci di luar jumlah opsi yang tersedia'
              : null,
      };
    }

    return {
      correctAnswer: letters.length > 0 ? letters : [clean],
      ambiguousNote: `Kunci Pilihan Ganda Kompleks "${trimmed}" perlu diverifikasi guru`,
    };
  }

  if (qType === 'benar_salah') {
    const kl = trimmed
      .replace(/^\(([A-Za-z]+)\)$/, '$1')
      .replace(/[.)]$/, '')
      .trim()
      .toLowerCase();

    if (/^(benar|true|t|ya|betul)$/.test(kl)) {
      return { correctAnswer: 'Benar', ambiguousNote: null };
    }
    if (/^(salah|false|f|tidak|keliru)$/.test(kl)) {
      return { correctAnswer: 'Salah', ambiguousNote: null };
    }
    if (kl === 'b') {
      if (hasExplicitLetteredOptions && options.length >= 2) {
        return {
          correctAnswer: 'Salah',
          ambiguousNote:
            'Kunci tertulis "B" pada soal Benar/Salah beropsi A/B; pastikan apakah berarti opsi B atau "Benar"',
        };
      }
      return { correctAnswer: 'Benar', ambiguousNote: null };
    }
    if (kl === 's') {
      return { correctAnswer: 'Salah', ambiguousNote: null };
    }
    if (kl === 'a') {
      return {
        correctAnswer: 'Benar',
        ambiguousNote: hasExplicitLetteredOptions
          ? null
          : 'Kunci "A" pada Benar/Salah diasumsikan "Benar"; periksa kembali',
      };
    }

    return {
      correctAnswer: trimmed,
      ambiguousNote: `Kunci Benar/Salah "${trimmed}" tidak standar; perlu verifikasi guru`,
    };
  }

  if (qType === 'menjodohkan') {
    // Format 1: explicit pairs "Left -> Right; Left2 -> Right2"
    const parsedPairs = parseMatchingPairStrings(trimmed);
    if (parsedPairs.length >= 2) {
      return {
        correctAnswer: parsedPairs.map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`).join(' | '),
        matchingPairs: parsedPairs,
        ambiguousNote: null,
      };
    }

    // Format 2: indexed mappings like "1-B, 2-A" combined with numbered left items + lettered right options
    const indexedPairs = parseIndexedLetterPairs(trimmed);
    if (indexedPairs.length >= 2) {
      if (numberedPromptsForMatching.length >= 2 && options.length >= 2) {
        const resolved: MatchingPair[] = [];
        let missing = false;
        for (const item of indexedPairs) {
          const leftText = numberedPromptsForMatching[item.leftNum - 1];
          const rightIdx = item.rightLetter.charCodeAt(0) - 65;
          const rightText = options[rightIdx];
          if (leftText && rightText) {
            resolved.push({ left: leftText, right: rightText });
          } else {
            missing = true;
          }
        }
        if (resolved.length >= 2 && !missing) {
          return {
            correctAnswer: resolved
              .map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`)
              .join(' | '),
            matchingPairs: resolved,
            ambiguousNote: null,
          };
        }
      }
      if (existingPairs.length >= 2) {
        return {
          correctAnswer: trimmed,
          ambiguousNote: 'Pasangan menjodohkan sudah terisi, tetapi kode kunci (mis. 1-B) perlu dicek kesesuaiannya',
        };
      }
      return {
        correctAnswer: trimmed,
        ambiguousNote: 'Kode kunci menjodohkan terbaca, lengkapi teks pasangan kiri & kanan',
      };
    }

    return {
      correctAnswer: trimmed,
      ambiguousNote: existingPairs.length >= 2 ? null : 'Format kunci menjodohkan belum lengkap',
    };
  }

  if (qType === 'uraian') {
    const cleanRubric = trimmed
      .replace(
        /^(?:rubrik(?:\s+penilaian)?|pedoman(?:\s+(?:penilaian|jawaban|penskoran))?|kriteria\s+penilaian)\s*[:=]\s*/i,
        ''
      )
      .trim();
    return {
      correctAnswer: cleanRubric,
      rubric: cleanRubric,
      ambiguousNote: null,
    };
  }

  // isian_singkat
  const cleanIsian = trimmed
    .replace(/^(?:kunci|jawaban)\s*[:=]?\s*/i, '')
    .trim();
  return {
    correctAnswer: cleanIsian,
    ambiguousNote: null,
  };
}

/**
 * Evaluates answer key completeness & status consistently across extracted and manual questions.
 */
export function evaluateQuestionAnswerKey(
  q: TeacherBankQuestion,
  extraAmbiguousReasons: string[] = []
): {
  answerKeyStatus: AnswerKeyStatus;
  needsReview: boolean;
  reviewReason: string | null;
} {
  const reviewReasons: string[] = [...extraAmbiguousReasons];
  let answerKeyStatus: AnswerKeyStatus = 'belum_ditemukan';

  if (!q.prompt.trim()) {
    reviewReasons.push('Teks soal kosong atau terpotong');
  }

  if (q.answerKeySource === 'konflik') {
    reviewReasons.push('Konflik antara kunci inline dan bagian Kunci Jawaban; periksa manual');
  } else if (q.answerKeySource === 'duplikat_nomor') {
    reviewReasons.push(`Nomor soal "${q.originalNumber}" muncul ganda sehingga pencocokan kunci ambigu`);
  }

  if (q.type === 'pilihan_ganda') {
    if (q.options.length < 2) {
      reviewReasons.push('Pilihan jawaban kurang dari 2 opsi');
    }
    const val = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (!val) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Kunci jawaban belum ditemukan di dokumen');
    } else if (/^[A-E]$/i.test(val)) {
      const idx = val.toUpperCase().charCodeAt(0) - 65;
      if (idx < 0 || idx >= q.options.length) {
        answerKeyStatus = 'perlu_diperiksa';
        reviewReasons.push(`Kunci jawaban "${val.toUpperCase()}" di luar jumlah opsi`);
      } else {
        answerKeyStatus = 'terbaca';
      }
    } else {
      answerKeyStatus = 'perlu_diperiksa';
      reviewReasons.push(`Kunci "${val}" perlu dicocokkan ke salah satu huruf opsi`);
    }
  } else if (q.type === 'pilihan_ganda_kompleks') {
    if (q.options.length < 2) {
      reviewReasons.push('Pilihan jawaban kurang dari 2 opsi');
    }
    const arr = Array.isArray(q.correctAnswer)
      ? q.correctAnswer
      : typeof q.correctAnswer === 'string' && q.correctAnswer.trim()
        ? q.correctAnswer
            .toUpperCase()
            .split(/\s*(?:,|;|DAN|&|\+)\s*/i)
            .filter(Boolean)
        : [];
    const validLetters = arr.filter((l) => {
      if (!/^[A-E]$/i.test(l)) return false;
      const idx = l.toUpperCase().charCodeAt(0) - 65;
      return idx >= 0 && idx < q.options.length;
    });

    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (arr.length === 0) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Kunci Pilihan Ganda Kompleks belum ditemukan di dokumen');
    } else if (validLetters.length < 2 || validLetters.length !== arr.length) {
      answerKeyStatus = 'perlu_diperiksa';
      if (validLetters.length < 2) {
        reviewReasons.push('Pilihan Ganda Kompleks memerlukan minimal 2 kunci benar');
      }
    } else {
      answerKeyStatus = 'terbaca';
    }
  } else if (q.type === 'benar_salah') {
    const val = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (!val) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Kunci Benar/Salah belum ditemukan di dokumen');
    } else if (/^(benar|salah)$/i.test(val) && extraAmbiguousReasons.length === 0) {
      answerKeyStatus = 'terbaca';
    } else {
      answerKeyStatus = 'perlu_diperiksa';
      if (!/^(benar|salah)$/i.test(val)) {
        reviewReasons.push(`Kunci Benar/Salah "${val}" perlu dikonfirmasi`);
      }
    }
  } else if (q.type === 'menjodohkan') {
    const validPairs = q.matchingPairs.filter((p) => p.left.trim() && p.right.trim());
    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (q.matchingPairs.length === 0 && !q.correctAnswer) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Pasangan kunci menjodohkan belum ditemukan');
    } else if (validPairs.length < 2) {
      answerKeyStatus = 'perlu_diperiksa';
      reviewReasons.push('Pasangan menjodohkan belum lengkap (< 2 pasang terisi)');
    } else {
      answerKeyStatus = extraAmbiguousReasons.length > 0 ? 'perlu_diperiksa' : 'terbaca';
    }
  } else if (q.type === 'isian_singkat') {
    const val = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (!val) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Kunci jawaban isian singkat belum ditemukan');
    } else if (extraAmbiguousReasons.length > 0) {
      answerKeyStatus = 'perlu_diperiksa';
    } else {
      answerKeyStatus = 'terbaca';
    }
  } else if (q.type === 'uraian') {
    const rubricText = (
      q.rubric ??
      (typeof q.correctAnswer === 'string' ? q.correctAnswer : '')
    ).trim();
    if (q.answerKeySource === 'konflik' || q.answerKeySource === 'duplikat_nomor') {
      answerKeyStatus = 'perlu_diperiksa';
    } else if (!rubricText) {
      answerKeyStatus = 'belum_ditemukan';
      reviewReasons.push('Pedoman jawaban / rubrik uraian belum tercantum (opsional diisi guru)');
    } else {
      answerKeyStatus = 'terbaca';
    }
  }

  const uniqueReasons = Array.from(new Set(reviewReasons));
  return {
    answerKeyStatus,
    needsReview: uniqueReasons.length > 0 || answerKeyStatus !== 'terbaca',
    reviewReason: uniqueReasons.length > 0 ? uniqueReasons.join('; ') : null,
  };
}

interface InternalParsedQuestion {
  question: TeacherBankQuestion;
  sectionType: QuestionModelType | null;
  hasExplicitLetteredOptions: boolean;
  numberedSubPrompts: string[];
  ambiguousNotes: string[];
}

function parseBlockIntoQuestion(
  rawBlockLines: string[],
  originalNumber: string,
  sectionType: QuestionModelType | null,
  sourceDocument: string,
  index: number
): InternalParsedQuestion {
  const expandedLines = rawBlockLines.flatMap((line) => splitInlineOptions(line));
  const fullText = expandedLines.join('\n');
  const explicitTag = detectExplicitTypeTag(fullText);

  const { weight, remaining: afterWeight } = extractWeight(expandedLines);
  const { rawKey, rawRubric, remaining: afterKey } = extractAnswerKeyAndRubric(afterWeight);
  const { explanation, remaining: contentLines } = extractExplanation(afterKey);

  const options: string[] = [];
  const checkedOptionLetters: string[] = [];
  const matchingPairs: MatchingPair[] = [];
  const numberedSubPrompts: string[] = [];
  const promptLines: string[] = [];
  let hasExplicitLetteredOptions = false;

  for (const line of contentLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Checkbox style option: "[x] A. ..." or "[ ] B. ..."
    const checkboxMatch = trimmed.match(/^\[(x|X|\s)\]\s*(?:([A-Ea-e])[.)]\s*)?(.+)$/);
    if (checkboxMatch) {
      const checked = checkboxMatch[1].toLowerCase() === 'x';
      const label = checkboxMatch[2]?.toUpperCase() ?? String.fromCharCode(65 + options.length);
      const text = stripInlineTags(checkboxMatch[3].trim());
      if (text) {
        options.push(text);
        hasExplicitLetteredOptions = true;
        if (checked) checkedOptionLetters.push(label);
      }
      continue;
    }

    // Matching pair: "kiri -> kanan", "kiri => kanan", "kiri <-> kanan", or "1) kiri = kanan"
    const pairMatch = trimmed.match(
      /^(?:[A-Za-z0-9]+[.)]\s*)?(.+?)\s*(?:->|=>|↔|<->|=)\s*(.+)$/
    );
    if (
      pairMatch &&
      !/^(?:kunci|jawaban|bobot|skor|nilai)/i.test(trimmed) &&
      (explicitTag === 'menjodohkan' ||
        sectionType === 'menjodohkan' ||
        /->|=>|↔|<->/.test(trimmed))
    ) {
      const left = pairMatch[1].trim();
      const right = pairMatch[2].trim();
      if (left && right) {
        matchingPairs.push({ left, right });
        continue;
      }
    }

    // Standard lettered option: "A. teks", "a) teks", "(A) teks"
    const optMatch = matchLetteredOption(trimmed);
    if (optMatch) {
      const cleanedOpt = stripInlineTags(optMatch.text);
      if (cleanedOpt) {
        options.push(cleanedOpt);
        hasExplicitLetteredOptions = true;
      }
      continue;
    }

    // Capture numbered left-side statements inside a matching question without ->
    const isMatchingContext =
      sectionType === 'menjodohkan' ||
      explicitTag === 'menjodohkan' ||
      /\b(?:jodohkan|pasangkan|cocokkan)\b/i.test(promptLines.join(' '));
    if (isMatchingContext) {
      const subNumMatch = trimmed.match(/^\d{1,2}[.)]\s+(.+)$/);
      if (subNumMatch) {
        numberedSubPrompts.push(stripInlineTags(subNumMatch[1]));
        continue;
      }
    }

    promptLines.push(stripInlineTags(trimmed));
  }

  const prompt = promptLines.join(' ').replace(/\s{2,}/g, ' ').trim();

  // Classify conservatively based on document evidence
  let type: QuestionModelType = 'uraian';
  const ambiguousNotes: string[] = [];

  if (explicitTag) {
    type = explicitTag;
  } else if (sectionType) {
    type = sectionType;
  } else if (matchingPairs.length >= 2 || /\bjodohkan\b|\bpasangkan\b/i.test(prompt)) {
    type = 'menjodohkan';
  } else if (
    (/\bbenar\b[\s\S]*\bsalah\b|\btrue\b[\s\S]*\bfalse\b|\(b\s*\/\s*s\)/i.test(fullText) &&
      options.length <= 2) ||
    (options.length === 2 &&
      /^(benar|true)$/i.test(options[0].trim()) &&
      /^(salah|false)$/i.test(options[1].trim()))
  ) {
    type = 'benar_salah';
  } else if (
    checkedOptionLetters.length > 1 ||
    (rawKey &&
      /^[A-Ea-e](?:\s*(?:,|;|dan|&|\+)\s*[A-Ea-e])+$/i.test(rawKey.trim())) ||
    /\bpilih\s+(?:lebih\s+dari\s+satu|dua|beberapa|semua\s+jawaban\s+benar)\b/i.test(prompt)
  ) {
    type = 'pilihan_ganda_kompleks';
  } else if (options.length >= 2) {
    type = 'pilihan_ganda';
  } else if (
    /_{3,}|\.{4,}/.test(prompt) ||
    (/\b(siapa(?:kah)?|kapan|dimana|di\s+mana|berapa(?:kah)?|tuliskan\s+nama)\b/i.test(prompt) &&
      !/\b(jelaskan|mengapa|bagaimana|uraikan|analisis|bandingkan|deskripsikan)\b/i.test(prompt)) ||
    (rawKey !== null &&
      rawKey.length <= 45 &&
      !/\b(jelaskan|mengapa|bagaimana|uraikan|sebutkan)\b/i.test(prompt))
  ) {
    type = 'isian_singkat';
  } else {
    type = 'uraian';
    if (!/\b(jelaskan|mengapa|bagaimana|uraikan|analisis|bandingkan|deskripsikan|siapa(?:kah)?|apa(?:kah)?)\b/i.test(prompt)) {
      ambiguousNotes.push('Struktur tipe soal belum eksplisit; perlu konfirmasi guru');
    }
  }

  const finalOptions =
    type === 'benar_salah' && options.length < 2 ? ['Benar', 'Salah'] : options;

  let correctAnswer: string | string[] | null = null;
  let rubric: string | null = rawRubric;
  let finalPairs = matchingPairs;
  let answerKeySource: string | null = null;

  if (checkedOptionLetters.length > 0) {
    correctAnswer =
      checkedOptionLetters.length > 1 ? checkedOptionLetters : checkedOptionLetters[0];
    answerKeySource = 'inline_checkbox';
  } else if (rawKey) {
    const normalized = normalizeKeyForQuestionType(
      rawKey,
      type,
      finalOptions,
      matchingPairs,
      hasExplicitLetteredOptions,
      numberedSubPrompts
    );
    correctAnswer = normalized.correctAnswer;
    if (normalized.rubric) rubric = normalized.rubric;
    if (normalized.matchingPairs) finalPairs = normalized.matchingPairs;
    if (normalized.ambiguousNote) ambiguousNotes.push(normalized.ambiguousNote);
    answerKeySource = 'inline';
  } else if (rawRubric && type === 'uraian') {
    correctAnswer = rawRubric;
    answerKeySource = 'inline_rubrik';
  } else if (type === 'menjodohkan' && finalPairs.length >= 2) {
    correctAnswer = finalPairs.map((p, i) => `${i + 1}: ${p.left} -> ${p.right}`).join(' | ');
    answerKeySource = 'inline_pasangan';
  }

  const baseQuestion: TeacherBankQuestion = {
    id: formatCanonicalQuestionId(index + 1),
    originalNumber,
    type,
    prompt,
    question: prompt,
    questionType: type,
    options: finalOptions,
    correctAnswer,
    rubric,
    answerKeySource,
    explanation,
    matchingPairs: finalPairs,
    weight,
    sourceDocument,
    enabled: true,
    needsReview: false,
    reviewReason: null,
    image: null,
    imageAlt: null,
  };

  const evalRes = evaluateQuestionAnswerKey(baseQuestion, ambiguousNotes);
  baseQuestion.answerKeyStatus = evalRes.answerKeyStatus;
  baseQuestion.needsReview = evalRes.needsReview;
  baseQuestion.reviewReason = evalRes.reviewReason;

  return {
    question: baseQuestion,
    sectionType,
    hasExplicitLetteredOptions,
    numberedSubPrompts,
    ambiguousNotes,
  };
}

interface ExtractedKeyEntry {
  num: string;
  rawValue: string;
  explanation: string | null;
  sectionType: QuestionModelType | null;
}

function splitMultiColumnKeyLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Compact space-separated table rows: "1 B 2 A 3 D 4 C" or "1. B 26. A" or "1) B 26) A"
  if (
    /^\(?\d{1,3}\)?[.):]?\s+(?:[A-Ea-e]|Benar|Salah|True|False)(?:\s+\(?\d{1,3}\)?[.):]?\s+(?:[A-Ea-e]|Benar|Salah|True|False))+$/i.test(
      trimmed
    )
  ) {
    const pairs = Array.from(
      trimmed.matchAll(/\(?\b(\d{1,3})\)?[.):]?\s+([A-Ea-e]|Benar|Salah|True|False)\b/gi)
    );
    if (pairs.length >= 2) {
      return pairs.map((m) => `${m[1]}. ${m[2]}`);
    }
  }

  // Wide gaps, pipe dividers, or repeated "Nomor/No/Soal" tokens on one line
  const split = trimmed
    .split(
      /(?:\s{2,}|\s*\|\s*|\t+|,\s*(?=(?:Soal\s*No\.?|Nomor|No\.?|Soal)\s*\d{1,3}))(?=(?:(?:Soal\s*No\.?|Nomor|No\.?|Soal)\s*)?\(?\d{1,3}\)?\s*(?:[.):=\-]|\s+))/i
    )
    .map((p) => p.trim())
    .filter(Boolean);

  return split.length > 0 ? split : [trimmed];
}

function matchAnswerKeyEntryLine(
  segment: string
): { num: string; val: string } | null {
  const s = segment.trim();
  if (!s) return null;

  // Reject pure table headers like "No. Jawaban"
  if (/^(?:no\.?|nomor)\s+(?:kunci|jawaban|skor|bobot|pembahasan)/i.test(s)) {
    return null;
  }

  const patterns: RegExp[] = [
    // "Nomor 1 = B", "No. 2 : A, C", "Soal 3 = Benar", "Soal No. 4: B"
    /^(?:Soal\s*No\.?|Nomor|No\.?|Soal)\s*\(?(\d{1,3})\)?\s*(?:=|:|->|=>|-|[.)])?\s+(.+)$/i,
    // "1. B", "1) A", "(1) C", "1 = D", "1: B", "1 - A", "1 -> B"
    /^\(?(\d{1,3})\)?\s*(?:=|:|->|=>|-|[.)])\s*(.+)$/,
    // "1 B" (2-column table space-joined)
    /^(\d{1,3})\s+([A-Ea-e](?:\s*(?:,|;|dan|&|\+)\s*[A-Ea-e])*|Benar|Salah|True|False)\s*$/i,
  ];

  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) {
      const num = m[1];
      const val = m[2].trim();
      if (num && val) {
        return { num, val };
      }
    }
  }

  return null;
}

function extractShortSectionLabel(line: string): string | null {
  const m = line
    .trim()
    .match(/^(?:bagian|bab|section|part)\s+([a-z0-9]+)\b/i);
  return m ? `bagian_${m[1].toLowerCase()}` : null;
}

function parseAnswerKeySectionLines(
  lines: string[],
  sectionLabelToType: Map<string, QuestionModelType> = new Map()
): ExtractedKeyEntry[] {
  const entries: ExtractedKeyEntry[] = [];
  let currentKeySection: QuestionModelType | null = null;
  let activeEntry: ExtractedKeyEntry | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Repeated Answer Key headings (e.g. page 2 of key section)
    if (detectAnswerKeySectionHeader(line)) {
      continue;
    }

    const secHeader = detectSectionHeader(line);
    if (secHeader) {
      currentKeySection = secHeader;
      activeEntry = null;
      continue;
    }

    const shortLabel = extractShortSectionLabel(line);
    if (shortLabel && sectionLabelToType.has(shortLabel) && line.length <= 45) {
      currentKeySection = sectionLabelToType.get(shortLabel) ?? currentKeySection;
      activeEntry = null;
      continue;
    }

    const explanationLine = line.match(
      /^(?:pembahasan|penjelasan|keterangan|explanation)\s*[:=]\s*(.+)$/i
    );
    if (explanationLine && activeEntry) {
      const exp = explanationLine[1].trim();
      if (exp) {
        activeEntry.explanation = activeEntry.explanation
          ? `${activeEntry.explanation} ${exp}`
          : exp;
      }
      continue;
    }

    const segments = splitMultiColumnKeyLine(line);
    let matchedAnyInLine = false;

    for (const seg of segments) {
      const entry = matchAnswerKeyEntryLine(seg);
      if (entry) {
        const created: ExtractedKeyEntry = {
          num: entry.num,
          rawValue: entry.val,
          explanation: null,
          sectionType: currentKeySection,
        };
        entries.push(created);
        activeEntry = created;
        matchedAnyInLine = true;
      }
    }

    if (!matchedAnyInLine && activeEntry) {
      // Multi-line continuation (common in Uraian rubrics or multi-line explanations)
      if (!/^(?:no\.?\s*$|halaman\s+\d+)/i.test(line)) {
        activeEntry.rawValue = `${activeEntry.rawValue} ${line}`.trim();
      }
    }
  }

  return entries;
}

function isCompactTrailingKeyBlock(block: {
  originalNumber: string;
  lines: string[];
}): boolean {
  if (block.lines.length === 0 || block.lines.length > 2) return false;
  const joined = block.lines.join(' ').trim();
  if (joined.length > 48 || /\?/.test(joined)) return false;

  return (
    /^(?:[A-Ea-e](?:\s*(?:,|;|dan|&|\+)\s*[A-Ea-e])*|Benar|Salah|True|False|[A-Ea-e]\s*[.)]\s*\S{1,25}|\d+\s*[-=:>→]+\s*[A-Ea-e](?:\s*,\s*\d+\s*[-=:>→]+\s*[A-Ea-e])*)$/i.test(
      joined
    ) || /^(?:=|:|-)\s*\S{1,35}$/.test(joined)
  );
}

/**
 * Classifies extracted document lines into authentic Question Bank items and
 * automatically extracts + matches answer keys by original question number.
 */
export function classifyExtractedDocument(
  rawText: string,
  sourceDocument: string,
  _docId: string
): {
  questions: TeacherBankQuestion[];
  warnings: string[];
  answerKeySummary: AnswerKeySummary;
} {
  const normalized = rawText.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  const warnings: string[] = [];
  const blocks: Array<{
    originalNumber: string;
    sectionType: QuestionModelType | null;
    lines: string[];
  }> = [];
  const answerKeyRawLines: string[] = [];

  let currentSection: QuestionModelType | null = null;
  const sectionLabelToType = new Map<string, QuestionModelType>();
  let inAnswerKeySection = false;
  let currentBlock: {
    originalNumber: string;
    sectionType: QuestionModelType | null;
    lines: string[];
  } | null = null;
  let pendingStandaloneNum: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (detectAnswerKeySectionHeader(line)) {
      pendingStandaloneNum = null;
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      inAnswerKeySection = true;
      continue;
    }

    if (inAnswerKeySection) {
      answerKeyRawLines.push(line);
      continue;
    }

    // Check section headings (e.g. "BAGIAN A: PILIHAN GANDA", "II. MENJODOHKAN")
    const detectedSection = detectSectionHeader(line);
    if (detectedSection) {
      pendingStandaloneNum = null;
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      currentSection = detectedSection;
      const shortLabel = extractShortSectionLabel(line);
      if (shortLabel) {
        sectionLabelToType.set(shortLabel, detectedSection);
      }
      continue;
    }

    if (pendingStandaloneNum) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        originalNumber: pendingStandaloneNum,
        sectionType: currentSection,
        lines: [line],
      };
      pendingStandaloneNum = null;
      continue;
    }

    const standaloneNum = matchStandaloneQuestionNumber(line);
    if (standaloneNum) {
      pendingStandaloneNum = standaloneNum;
      continue;
    }

    // Match numbered question start: "1. ...", "2) ...", "Nomor 1 = B", "Soal 3: ..."
    const qStartMatch = matchQuestionStart(line);
    if (qStartMatch) {
      const numVal = qStartMatch.num;
      const rest = qStartMatch.rest;
      const numInt = Number.parseInt(numVal, 10);
      const currNumInt = currentBlock
        ? Number.parseInt(currentBlock.originalNumber, 10)
        : 0;
      const inMatchingBlock = Boolean(
        currentBlock &&
          (currentSection === 'menjodohkan' ||
            detectExplicitTypeTag(currentBlock.lines.join('\n')) === 'menjodohkan' ||
            /\b(?:jodohkan|pasangkan|cocokkan)\b/i.test(currentBlock.lines[0] ?? ''))
      );
      const looksLikeSubPair =
        inMatchingBlock &&
        (/(?:->|=>|↔|<->|=)/.test(rest) ||
          (numInt <= 15 &&
            !/\?/.test(rest) &&
            rest.length <= 90 &&
            (numInt !== currNumInt + 1 || numInt === 1)));

      if (!looksLikeSubPair) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          originalNumber: numVal,
          sectionType: currentSection,
          lines: [rest],
        };
        continue;
      }
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Detect implicit trailing Answer Key list (e.g. "1. B / 2. A / 3. D" at document end without heading)
  let implicitTrailingKeys: ExtractedKeyEntry[] = [];
  if (answerKeyRawLines.length === 0 && blocks.length >= 4) {
    let trailingStart = blocks.length;
    while (trailingStart > 0 && isCompactTrailingKeyBlock(blocks[trailingStart - 1])) {
      trailingStart -= 1;
    }
    const trailingCount = blocks.length - trailingStart;
    if (trailingCount >= 2 && trailingStart >= 2) {
      const earlierNumbers = new Set(
        blocks.slice(0, trailingStart).map((b) => b.originalNumber)
      );
      const trailingBlocks = blocks.slice(trailingStart);
      const overlapCount = trailingBlocks.filter((b) =>
        earlierNumbers.has(b.originalNumber)
      ).length;
      if (overlapCount >= Math.min(2, trailingBlocks.length)) {
        implicitTrailingKeys = trailingBlocks.map((b) => ({
          num: b.originalNumber,
          rawValue: b.lines
            .join(' ')
            .replace(/^(?:=|:|-)\s*/, '')
            .trim(),
          explanation: null,
          sectionType: null,
        }));
        blocks.splice(trailingStart);
      }
    }
  }

  if (blocks.length === 0) {
    warnings.push(
      'Tidak ditemukan pola nomor soal terstruktur (mis. "1. ...", "2. ...", "Soal 1: ..."). Periksa pratinjau teks di bawah atau tambahkan soal secara manual di Tab 3.'
    );
  }

  const internalItems = blocks
    .map((block, idx) =>
      parseBlockIntoQuestion(
        block.lines,
        block.originalNumber,
        block.sectionType,
        sourceDocument,
        idx
      )
    )
    .filter(
      (item) =>
        item.question.prompt.length > 0 ||
        item.question.options.length > 0 ||
        item.question.matchingPairs.length > 0
    );

  // Extract keys from dedicated Answer Key section or implicit trailing key list
  const extractedKeys =
    answerKeyRawLines.length > 0
      ? parseAnswerKeySectionLines(answerKeyRawLines, sectionLabelToType)
      : implicitTrailingKeys;

  const hasAnswerKeySection =
    answerKeyRawLines.length > 0 || implicitTrailingKeys.length > 0;

  // Count occurrences of originalNumber across questions to detect duplicate numbering ambiguity
  const numberGroups = new Map<string, InternalParsedQuestion[]>();
  for (const item of internalItems) {
    const arr = numberGroups.get(item.question.originalNumber) ?? [];
    arr.push(item);
    numberGroups.set(item.question.originalNumber, arr);
  }

  const unmatchedKeyNumbers: string[] = [];

  for (const keyEntry of extractedKeys) {
    const candidates = numberGroups.get(keyEntry.num) ?? [];
    if (candidates.length === 0) {
      unmatchedKeyNumbers.push(keyEntry.num);
      continue;
    }

    let targetItem: InternalParsedQuestion | null = null;
    let isAmbiguousDuplicate = false;

    if (candidates.length === 1) {
      targetItem = candidates[0];
    } else if (keyEntry.sectionType) {
      const sameSection = candidates.filter(
        (c) => (c.sectionType ?? c.question.type) === keyEntry.sectionType
      );
      if (sameSection.length === 1) {
        targetItem = sameSection[0];
      } else {
        isAmbiguousDuplicate = true;
      }
    } else {
      isAmbiguousDuplicate = true;
    }

    if (isAmbiguousDuplicate || !targetItem) {
      // Never guess which duplicate-numbered question gets the key — flag all candidates for teacher check
      for (const c of candidates) {
        c.question.answerKeySource = 'duplikat_nomor';
        const evalRes = evaluateQuestionAnswerKey(c.question, c.ambiguousNotes);
        c.question.answerKeyStatus = evalRes.answerKeyStatus;
        c.question.needsReview = evalRes.needsReview;
        c.question.reviewReason = evalRes.reviewReason;
      }
      continue;
    }

    const q = targetItem.question;
    const normalized = normalizeKeyForQuestionType(
      keyEntry.rawValue,
      q.type,
      q.options,
      q.matchingPairs,
      targetItem.hasExplicitLetteredOptions,
      targetItem.numberedSubPrompts
    );

    const extraNotes = [...targetItem.ambiguousNotes];
    if (normalized.ambiguousNote) {
      extraNotes.push(normalized.ambiguousNote);
    }

    // Detect conflict if inline key already existed and differs from section key
    const existingSerialized = Array.isArray(q.correctAnswer)
      ? q.correctAnswer.join(',')
      : String(q.correctAnswer ?? '').trim().toUpperCase();
    const newSerialized = Array.isArray(normalized.correctAnswer)
      ? normalized.correctAnswer.join(',')
      : String(normalized.correctAnswer ?? '').trim().toUpperCase();

    if (
      q.answerKeySource === 'inline' &&
      existingSerialized &&
      newSerialized &&
      existingSerialized !== newSerialized
    ) {
      q.answerKeySource = 'konflik';
      extraNotes.push(
        `Kunci inline (${existingSerialized}) berbeda dengan bagian Kunci Jawaban (${newSerialized})`
      );
    } else {
      q.correctAnswer = normalized.correctAnswer;
      if (normalized.rubric) q.rubric = normalized.rubric;
      if (normalized.matchingPairs) q.matchingPairs = normalized.matchingPairs;
      q.answerKeySource = 'bagian_kunci';
    }

    if (keyEntry.explanation && !q.explanation) {
      q.explanation = keyEntry.explanation;
    }

    const evalRes = evaluateQuestionAnswerKey(q, extraNotes);
    q.answerKeyStatus = evalRes.answerKeyStatus;
    q.needsReview = evalRes.needsReview;
    q.reviewReason = evalRes.reviewReason;
  }

  // Re-index canonical IDs cleanly (Q001, Q002, ...) while keeping originalNumber untouched
  const questions = internalItems.map((item, idx) => ({
    ...item.question,
    id: formatCanonicalQuestionId(idx + 1),
  }));

  const matchedCount = questions.filter((q) => q.answerKeyStatus === 'terbaca').length;
  const needsReviewCount = questions.filter(
    (q) => q.answerKeyStatus === 'perlu_diperiksa'
  ).length;
  const notFoundCount = questions.filter(
    (q) => q.answerKeyStatus === 'belum_ditemukan'
  ).length;

  if (hasAnswerKeySection && unmatchedKeyNumbers.length > 0) {
    warnings.push(
      `Terdapat ${unmatchedKeyNumbers.length} nomor pada bagian Kunci Jawaban yang tidak ditemukan soalnya (No: ${unmatchedKeyNumbers.slice(0, 8).join(', ')}${unmatchedKeyNumbers.length > 8 ? ', ...' : ''}).`
    );
  }

  return {
    questions,
    warnings,
    answerKeySummary: {
      hasAnswerKeySection,
      extractedKeyCount: extractedKeys.length,
      matchedCount,
      needsReviewCount,
      notFoundCount,
      unmatchedKeyNumbers,
    },
  };
}

export function computeDetectedDistribution(
  questions: TeacherBankQuestion[],
  previous?: QuestionDistributionMap
): QuestionDistributionMap {
  const counts: Record<QuestionModelType, number> = {
    pilihan_ganda: 0,
    pilihan_ganda_kompleks: 0,
    benar_salah: 0,
    menjodohkan: 0,
    isian_singkat: 0,
    uraian: 0,
  };

  for (const q of questions) {
    if (q.enabled) {
      counts[q.type] += 1;
    }
  }

  const result = {} as QuestionDistributionMap;
  for (const model of QUESTION_MODEL_ORDER) {
    const detected = counts[model];
    const prev = previous?.[model];
    const isPrimaryPg = model === 'pilihan_ganda';
    const newlyAppearedModel = Boolean(prev && prev.detectedCount === 0 && detected > 0);
    const enabled = isPrimaryPg
      ? true
      : newlyAppearedModel
        ? true
        : (prev?.enabled ?? detected > 0);
    const prevUsed = prev?.usedCount;
    const prevWasFull = Boolean(prev && prev.usedCount >= prev.detectedCount);
    const usedCount = !enabled
      ? 0
      : newlyAppearedModel
        ? detected
        : typeof prevUsed === 'number' && prev
          ? prevWasFull && detected > prev.detectedCount
            ? detected
            : Math.min(detected, Math.max(0, prevUsed))
          : detected;

    result[model] = {
      model,
      detectedCount: detected,
      usedCount,
      enabled,
    };
  }

  return result;
}
