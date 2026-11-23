const DB_NAME = 'exam_eduverse_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'questionImages';
export const IDB_IMAGE_PREFIX = 'idb://';
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB raw upload limit

const ACCEPTED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const mediaMemoryCache = new Map<string, string>();
let hydrationPromise: Promise<void> | null = null;

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function validateQuestionImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const lower = file.name.toLowerCase();
  const hasValidExt =
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp');
  const hasValidMime = ACCEPTED_IMAGE_MIME.has(file.type.toLowerCase());

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Format gambar harus PNG, JPG, JPEG, atau WEBP.',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'File gambar kosong (0 byte).',
    };
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return {
      valid: false,
      error: 'Ukuran gambar melebihi batas maksimal 5 MB.',
    };
  }

  return { valid: true };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file gambar sebagai Data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('File gambar tidak dapat dirender.'));
    img.src = src;
  });
}

/**
 * Validates, resizes/compresses, and returns a permanent Data URL
 * (never a temporary blob: URL).
 */
export async function processQuestionImageFile(file: File): Promise<string> {
  const check = validateQuestionImageFile(file);
  if (!check.valid) {
    throw new Error(check.error ?? 'Gambar tidak valid.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (typeof document === 'undefined') {
    return rawDataUrl;
  }

  try {
    const img = await loadImageElement(rawDataUrl);
    const maxWidth = 960;
    const maxHeight = 720;
    const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth), maxHeight / Math.max(1, img.naturalHeight));
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer compressed WebP (supports transparency + small payload); fallback cleanly
    const webp = canvas.toDataURL('image/webp', 0.82);
    if (webp.startsWith('data:image/webp')) {
      return webp.length < rawDataUrl.length || scale < 1 ? webp : rawDataUrl;
    }

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const fallback = isPng
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.84);
    return fallback.length < rawDataUrl.length || scale < 1 ? fallback : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

export async function saveQuestionImageToMediaStore(
  questionId: string,
  dataUrl: string
): Promise<void> {
  if (!questionId || !dataUrl || dataUrl.startsWith('blob:')) return;
  mediaMemoryCache.set(questionId, dataUrl);

  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        id: questionId,
        dataUrl,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function removeQuestionImageFromMediaStore(
  questionId: string
): Promise<void> {
  if (!questionId) return;
  mediaMemoryCache.delete(questionId);

  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(questionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllQuestionImagesFromMediaStore(): Promise<void> {
  mediaMemoryCache.clear();
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function hydrateTeacherMediaCache(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const db = await openMediaDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const rows = Array.isArray(req.result) ? req.result : [];
          for (const row of rows) {
            if (
              row &&
              typeof row.id === 'string' &&
              typeof row.dataUrl === 'string' &&
              row.dataUrl.startsWith('data:image/')
            ) {
              mediaMemoryCache.set(row.id, row.dataUrl);
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  })();

  await hydrationPromise;
  hydrationPromise = null;
}

export function setCachedQuestionImage(
  questionId: string,
  dataUrl: string | null | undefined
): void {
  if (!questionId) return;
  if (!dataUrl) {
    mediaMemoryCache.delete(questionId);
    return;
  }
  if (!dataUrl.startsWith('blob:') && !dataUrl.startsWith(IDB_IMAGE_PREFIX)) {
    mediaMemoryCache.set(questionId, dataUrl);
  }
}

export function resolveQuestionImage(
  questionId: string,
  storedImage?: string | null
): string | null {
  if (storedImage) {
    if (storedImage.startsWith('blob:')) {
      // Never rely on temporary blob URLs
      return mediaMemoryCache.get(questionId) ?? null;
    }
    if (storedImage.startsWith(IDB_IMAGE_PREFIX)) {
      const refId = storedImage.slice(IDB_IMAGE_PREFIX.length) || questionId;
      return mediaMemoryCache.get(refId) ?? mediaMemoryCache.get(questionId) ?? null;
    }
    if (storedImage.startsWith('data:image/')) {
      mediaMemoryCache.set(questionId, storedImage);
    }
    return storedImage;
  }

  return mediaMemoryCache.get(questionId) ?? null;
}
