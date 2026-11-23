import * as mammoth from 'mammoth/mammoth.browser';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { classifyExtractedDocument } from './questionClassifier';
import { ParsedDocumentPreview } from './teacherTypes';

export const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

let pdfWorkerConfigured = false;
function ensurePdfWorker(): void {
  if (!pdfWorkerConfigured && typeof window !== 'undefined') {
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfWorkerConfigured = true;
  }
}

export interface FileValidationResult {
  valid: boolean;
  fileType?: 'pdf' | 'docx';
  error?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateDocumentFile(file: File): FileValidationResult {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.doc')) {
    return {
      valid: false,
      error:
        'Format .doc (Word lama) tidak didukung oleh parser browser. Silakan simpan ulang sebagai .docx atau .pdf terlebih dahulu.',
    };
  }

  const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
  const isDocx =
    lower.endsWith('.docx') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isPdf && !isDocx) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Unggah dokumen .pdf atau .docx saja.',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Dokumen kosong (0 byte). Pilih file soal yang berisi teks.',
    };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Ukuran file (${formatFileSize(file.size)}) melebihi batas maksimal 2 MB.`,
    };
  }

  return {
    valid: true,
    fileType: isPdf ? 'pdf' : 'docx',
  };
}

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function joinRunsByHorizontalSpacing(runs: PositionedTextItem[]): string {
  const sorted = [...runs].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return '';

  let line = '';
  let prevEndX = sorted[0].x;
  let prevAvgCharWidth = 5;

  for (let i = 0; i < sorted.length; i++) {
    const run = sorted[i];
    const text = run.str.replace(/[ \t]{2,}/g, ' ');
    if (!text) continue;

    if (i === 0) {
      line = text;
    } else {
      const gap = run.x - prevEndX;
      const columnGapThreshold = Math.max(18, prevAvgCharWidth * 3.5);
      const spaceThreshold = Math.max(1.2, prevAvgCharWidth * 0.25);

      if (gap >= columnGapThreshold) {
        line = `${line.trimEnd()}   ${text.trimStart()}`;
      } else {
        const needsSpace =
          gap > spaceThreshold &&
          !line.endsWith(' ') &&
          !text.startsWith(' ');
        line += needsSpace ? ` ${text}` : text;
      }
    }

    const measuredW = run.width > 0 ? run.width : text.length * 4.5;
    prevEndX = run.x + measuredW;
    if (text.trim().length > 0 && run.width > 0) {
      prevAvgCharWidth = Math.max(2.5, Math.min(12, run.width / text.length));
    }
  }

  return line.trim();
}

/**
 * Merges standalone number markers ("1.", "No. 1") or option markers ("A.")
 * that PDF/table layouts sometimes place on their own line right above content.
 */
export function postProcessExtractedLines(rawText: string): string {
  const rawLines = rawText.replace(/\r\n?/g, '\n').split('\n');
  const merged: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const current = rawLines[i].trim();
    if (!current) {
      if (merged.length > 0 && merged[merged.length - 1] !== '') {
        merged.push('');
      }
      continue;
    }

    const standaloneQNum = current.match(
      /^(?:(?:Soal|Nomor|No\.?)\s*)?\(?(\d{1,3})\)?\s*[.):-]?$/i
    );
    const standaloneOptLetter = current.match(/^\(?([A-Ea-e])\)?[.):]$/);

    if ((standaloneQNum || standaloneOptLetter) && i + 1 < rawLines.length) {
      let nextIdx = i + 1;
      while (nextIdx < rawLines.length && !rawLines[nextIdx].trim()) {
        nextIdx++;
      }
      if (nextIdx < rawLines.length) {
        const nextLine = rawLines[nextIdx].trim();
        if (standaloneQNum) {
          merged.push(`${standaloneQNum[1]}. ${nextLine}`);
          i = nextIdx;
          continue;
        }
        if (standaloneOptLetter) {
          merged.push(`${standaloneOptLetter[1].toUpperCase()}. ${nextLine}`);
          i = nextIdx;
          continue;
        }
      }
    }

    merged.push(current);
  }

  return merged.join('\n').trim();
}

async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer
): Promise<{ text: string; pageCount: number }> {
  ensurePdfWorker();
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = [];

    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string') {
        const tx = item.transform;
        items.push({
          str: item.str,
          x: Array.isArray(tx) ? Number(tx[4] ?? 0) : 0,
          y: Array.isArray(tx) ? Number(tx[5] ?? 0) : 0,
          width: 'width' in item && typeof item.width === 'number' ? item.width : 0,
          height: 'height' in item && typeof item.height === 'number' ? item.height : 10,
        });
      }
    }

    // Group PDF text runs into lines by Y coordinate (top-to-bottom, left-to-right)
    const rows: Array<{ y: number; tol: number; runs: PositionedTextItem[] }> = [];
    for (const item of items) {
      if (!item.str.trim()) continue;
      const tol = Math.max(3.5, Math.min(6, (item.height || 10) * 0.42));
      const existingRow = rows.find((r) => Math.abs(r.y - item.y) <= Math.max(r.tol, tol));
      if (existingRow) {
        existingRow.runs.push(item);
      } else {
        rows.push({ y: item.y, tol, runs: [item] });
      }
    }

    rows.sort((a, b) => b.y - a.y);
    const pageLines = rows
      .map((row) => joinRunsByHorizontalSpacing(row.runs))
      .filter(Boolean);
    pageTexts.push(pageLines.join('\n'));
  }

  return {
    text: postProcessExtractedLines(pageTexts.join('\n\n')),
    pageCount: pdf.numPages,
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, ' ');
}

function hasExplicitQuestionNumberPrefix(text: string): boolean {
  return /^(?:(?:Soal|Nomor|Pertanyaan|No\.?)\s*)?\(?\d{1,3}\)?\s*[.):-]\s*/i.test(
    text.trim()
  );
}

function hasExplicitOptionPrefix(text: string): boolean {
  return /^(?:\[[xX\s]\]\s*)?\(?[A-Ea-e]\)?[.)]\s*/.test(text.trim());
}

function formatTableRowsToLines(
  rowsCells: string[][],
  activeSectionMatches: boolean
): string[] {
  const out: string[] = [];
  for (const cells of rowsCells) {
    if (cells.length === 0) continue;

    if (cells.length >= 4 && cells.length % 2 === 0) {
      const looksLikeNumKeyPairs = cells.every((c, idx) =>
        idx % 2 === 0
          ? /^(?:no\.?\s*)?\d{1,3}[.)]?$/i.test(c)
          : c.length > 0 && c.length <= 60
      );
      if (looksLikeNumKeyPairs) {
        for (let c = 0; c < cells.length; c += 2) {
          const num = cells[c]
            .replace(/^(?:no\.?\s*)/i, '')
            .replace(/[.)]$/, '')
            .trim();
          out.push(`${num}. ${cells[c + 1]}`);
        }
        continue;
      }
    }

    if (cells.length === 3 && /^(?:no\.?\s*)?\d{1,3}[.)]?$/i.test(cells[0])) {
      const num = cells[0]
        .replace(/^(?:no\.?\s*)/i, '')
        .replace(/[.)]$/, '')
        .trim();
      out.push(`${num}. ${cells[1]}`);
      if (cells[2] && !/^(?:kunci|jawaban|skor|bobot)$/i.test(cells[2])) {
        out.push(`Pembahasan: ${cells[2]}`);
      }
      continue;
    }

    if (cells.length === 2) {
      const [c1, c2] = cells;
      if (/^\d{1,3}[.)]?$/.test(c1)) {
        const num = c1.replace(/[.)]$/, '');
        out.push(`${num}. ${c2}`);
        continue;
      }
      if (/^[A-Ea-e][.)]?$/.test(c1)) {
        const letter = c1.replace(/[.)]$/, '').toUpperCase();
        out.push(`${letter}. ${c2}`);
        continue;
      }
      if (
        activeSectionMatches &&
        !/^(?:kiri|pernyataan|no|soal|pasangan)$/i.test(c1)
      ) {
        out.push(`${c1} -> ${c2}`);
        continue;
      }
    }

    out.push(cells.join('   '));
  }
  return out;
}

/**
 * Converts Mammoth HTML output into structured lines, preserving Word's
 * automatic numbered lists (<ol><li>), nested option lists, and tables.
 */
export function convertMammothHtmlToStructuredLines(html: string): string {
  if (!html || !html.trim()) return '';

  // Browser DOMParser path (exact tree traversal)
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    const lines: string[] = [];
    let activeSectionMatches = false;

    const getDirectText = (el: Element): string => {
      let acc = '';
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === 3) {
          acc += child.textContent ?? '';
        } else if (child.nodeType === 1) {
          const childEl = child as Element;
          const tag = childEl.tagName.toLowerCase();
          if (tag === 'ol' || tag === 'ul' || tag === 'table') continue;
          if (tag === 'br') {
            acc += '\n';
          } else {
            acc += getDirectText(childEl);
          }
        }
      }
      return acc.replace(/[ \t]+/g, ' ').trim();
    };

    const visitElement = (el: Element, listDepth = 0) => {
      const tag = el.tagName.toLowerCase();

      if (tag === 'ol') {
        const items = Array.from(el.children).filter(
          (c) => c.tagName.toLowerCase() === 'li'
        );
        const typeAttr = (el.getAttribute('type') ?? '').toLowerCase();
        const isLetterList =
          listDepth > 0 || typeAttr === 'a';

        items.forEach((li, idx) => {
          const direct = getDirectText(li);
          if (direct) {
            for (const subLine of direct.split('\n')) {
              const trimmed = subLine.trim();
              if (!trimmed) continue;
              if (listDepth === 0 && !isLetterList) {
                lines.push(
                  hasExplicitQuestionNumberPrefix(trimmed)
                    ? trimmed
                    : `${idx + 1}. ${trimmed}`
                );
              } else {
                const letter = String.fromCharCode(65 + idx);
                lines.push(
                  hasExplicitOptionPrefix(trimmed)
                    ? trimmed
                    : `${letter}. ${trimmed}`
                );
              }
            }
          }

          for (const nested of Array.from(li.children)) {
            const nTag = nested.tagName.toLowerCase();
            if (nTag === 'ol' || nTag === 'ul' || nTag === 'table' || nTag === 'p') {
              visitElement(nested, listDepth + 1);
            }
          }
        });
        return;
      }

      if (tag === 'ul') {
        const items = Array.from(el.children).filter(
          (c) => c.tagName.toLowerCase() === 'li'
        );
        items.forEach((li) => {
          const direct = getDirectText(li);
          if (direct) {
            for (const subLine of direct.split('\n')) {
              const trimmed = subLine.trim();
              if (trimmed) lines.push(trimmed);
            }
          }
          for (const nested of Array.from(li.children)) {
            const nTag = nested.tagName.toLowerCase();
            if (nTag === 'ol' || nTag === 'ul' || nTag === 'table' || nTag === 'p') {
              visitElement(nested, listDepth + 1);
            }
          }
        });
        return;
      }

      if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.children)
            .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
        );
        lines.push(...formatTableRowsToLines(rows, activeSectionMatches));
        return;
      }

      if (/^(p|h[1-6]|div)$/.test(tag)) {
        const hasBlockChildren = Array.from(el.children).some((c) =>
          /^(p|ol|ul|table|div|h[1-6])$/.test(c.tagName.toLowerCase())
        );
        if (hasBlockChildren) {
          for (const child of Array.from(el.children)) {
            visitElement(child, listDepth);
          }
          return;
        }
        const txt = decodeHtmlEntities(getDirectText(el));
        if (txt) {
          if (/menjodohkan|pasangkan|jodohkan/i.test(txt)) {
            activeSectionMatches = true;
          } else if (/pilihan ganda|benar\s*[\/-]\s*salah|isian|uraian|esai/i.test(txt)) {
            activeSectionMatches = false;
          }
          for (const sub of txt.split('\n')) {
            if (sub.trim()) lines.push(sub.trim());
          }
        }
        return;
      }

      for (const child of Array.from(el.children)) {
        visitElement(child, listDepth);
      }
    };

    for (const child of Array.from(doc.body.children)) {
      visitElement(child, 0);
    }

    return postProcessExtractedLines(lines.join('\n'));
  }

  // Fallback lightweight HTML-to-text (including clean <table> row/cell extraction) for non-DOM environments
  const withParsedTables = html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const trMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const rowsCells = trMatches.map((trM) =>
      Array.from(trM[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi))
        .map((cellM) =>
          decodeHtmlEntities(cellM[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter(Boolean)
    );
    return `\n${formatTableRowsToLines(rowsCells, false).join('\n')}\n`;
  });

  const stripped = withParsedTables
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|tr|li|div)>/gi, '\n')
    .replace(/<td[^>]*>/gi, '   ')
    .replace(/<[^>]+>/g, '');
  return postProcessExtractedLines(decodeHtmlEntities(stripped));
}

async function extractTextFromDocxBuffer(
  buffer: ArrayBuffer
): Promise<{ text: string; sectionCount: number }> {
  const ns = mammoth as unknown as {
    extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    convertToHtml?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    default?: {
      extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
      convertToHtml?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
  };
  const extractRawText = ns.extractRawText ?? ns.default?.extractRawText;
  const convertToHtml = ns.convertToHtml ?? ns.default?.convertToHtml;

  if (typeof extractRawText !== 'function' && typeof convertToHtml !== 'function') {
    throw new Error('Parser DOCX (mammoth) tidak tersedia di browser.');
  }

  let structuredText = '';
  if (typeof convertToHtml === 'function') {
    try {
      const htmlResult = await convertToHtml({ arrayBuffer: buffer });
      structuredText = convertMammothHtmlToStructuredLines(htmlResult.value ?? '');
    } catch {
      structuredText = '';
    }
  }

  let rawFallback = '';
  if (typeof extractRawText === 'function') {
    try {
      const rawResult = await extractRawText({ arrayBuffer: buffer });
      rawFallback = postProcessExtractedLines(rawResult.value ?? '');
    } catch {
      rawFallback = '';
    }
  }

  const cleanText = structuredText.length >= 5 ? structuredText : rawFallback;
  const paragraphCount = cleanText
    ? cleanText.split(/\n+/).filter((line) => line.trim().length > 0).length
    : 0;
  return {
    text: cleanText,
    sectionCount: paragraphCount,
  };
}

export async function parseQuestionDocument(
  file: File
): Promise<ParsedDocumentPreview> {
  const validation = validateDocumentFile(file);
  if (!validation.valid || !validation.fileType) {
    throw new Error(validation.error ?? 'File dokumen tidak valid.');
  }

  const buffer = await file.arrayBuffer();
  const docId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  let rawText = '';
  let pageOrSectionCount = 0;

  try {
    if (validation.fileType === 'pdf') {
      const pdfResult = await extractTextFromPdfBuffer(buffer);
      rawText = pdfResult.text;
      pageOrSectionCount = pdfResult.pageCount;
    } else {
      const docxResult = await extractTextFromDocxBuffer(buffer);
      rawText = docxResult.text;
      pageOrSectionCount = docxResult.sectionCount;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
    throw new Error(
      `Dokumen "${file.name}" gagal dibaca (${detail}). Bank soal sebelumnya tetap dipertahankan.`
    );
  }

  if (!rawText || rawText.trim().length < 5) {
    throw new Error(
      `Dokumen "${file.name}" tidak mengandung teks yang dapat diekstrak (mungkin berupa PDF gambar/scan tanpa teks). Bank soal sebelumnya tetap dipertahankan.`
    );
  }

  const { questions, warnings, answerKeySummary } = classifyExtractedDocument(
    rawText,
    file.name,
    docId
  );

  return {
    meta: {
      docId,
      fileName: file.name,
      fileType: validation.fileType,
      fileSizeBytes: file.size,
      parsedAt: new Date().toISOString(),
      pageOrSectionCount,
    },
    rawText,
    questions,
    warnings,
    answerKeySummary,
  };
}
