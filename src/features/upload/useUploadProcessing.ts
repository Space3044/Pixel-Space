import type { Ref } from 'vue';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

import { reverseGeocodeLocation, type GeocodeRegion } from '@/features/images/geocode.api';
import { checkAdminImageHash, fetchAdminImage } from '@/features/images/images.api';
import { normalizeExif } from './exif';
import { previewAiAnnotation } from './ai-preview.api';
import { retryTelegramArchive, uploadImage } from './upload.api';
import { buildUploadFormData } from './upload-form';
import type { UploadDimensions, UploadExif } from './upload.types';
import { geocodeRegionForCoordinate } from './useUploadPickMap';
import type { UploadEntry } from './useUploadQueue';

const MAX_EDGE = 2048;
const AI_PREVIEW_MAX_EDGE = 1280;
const AI_PREVIEW_RECOMPRESS_BYTES = 768 * 1024;
const PROCESS_CONCURRENCY = 2;
const AI_CONCURRENCY = 2;
const UPLOAD_CONCURRENCY = 2;
const TELEGRAM_ARCHIVE_POLL_ATTEMPTS = 60;
const TELEGRAM_ARCHIVE_POLL_INTERVAL_MS = 1200;

interface UseUploadProcessingOptions {
  entries: Ref<UploadEntry[]>;
  currentEntry: Readonly<Ref<UploadEntry | null>>;
  currentEntryId: Ref<string | null>;
  pickRegion: Ref<GeocodeRegion>;
  canSubmit: Readonly<Ref<boolean>>;
  isBatchUploading: Ref<boolean>;
  globalError: Ref<string | null>;
  batchFolderId: Ref<string>;
  setEntryCoordinates: (
    entry: UploadEntry,
    lat: number | null,
    lng: number | null,
    centerMap?: boolean,
    region?: GeocodeRegion,
  ) => void;
  onSearchRegionChange: (region: GeocodeRegion) => Promise<void>;
  broadcastLocationInto: (target: UploadEntry) => void;
}

const readExif = async (file: File): Promise<UploadExif> => {
  const tags = [
    'Make',
    'Model',
    'DateTimeOriginal',
    'CreateDate',
    'ModifyDate',
    'ISO',
    'FNumber',
    'ExposureTime',
    'FocalLength',
    'GPSLatitude',
    'GPSLongitude',
  ];
  const raw = await exifr.parse(file, tags).catch(() => null);
  const gps = await exifr.gps(file).catch(() => null);
  return normalizeExif({ ...(raw ?? {}), ...(gps ?? {}) });
};

const compressToWebp = async (file: File): Promise<File> => {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_EDGE,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.86,
    preserveExif: false,
  });

  const outputName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([compressed], outputName, { type: 'image/webp', lastModified: Date.now() });
};

const prepareAiPreviewFile = async (file: File): Promise<File> => {
  if (file.size <= AI_PREVIEW_RECOMPRESS_BYTES) return file;

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: AI_PREVIEW_MAX_EDGE,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.72,
    preserveExif: false,
  });

  if (compressed.size >= file.size) return file;

  const outputName = file.name.replace(/\.[^.]+$/, '.ai.webp');
  return new File([compressed], outputName, { type: 'image/webp', lastModified: Date.now() });
};

const sha256HexFromFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const readImageDimensions = (file: File): Promise<UploadDimensions> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error('无法读取压缩后图片尺寸。'));
        return;
      }
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取压缩后图片尺寸。'));
    };

    image.src = objectUrl;
  });

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const runConcurrentEntries = async (
  uploadCandidates: UploadEntry[],
  concurrency: number,
  worker: (entry: UploadEntry) => Promise<void>,
) => {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, uploadCandidates.length) },
    async () => {
      while (nextIndex < uploadCandidates.length) {
        const entry = uploadCandidates[nextIndex];
        nextIndex += 1;
        await worker(entry);
      }
    },
  );

  await Promise.all(workers);
};

export const useUploadProcessing = ({
  entries,
  currentEntry,
  currentEntryId,
  pickRegion,
  canSubmit,
  isBatchUploading,
  globalError,
  batchFolderId,
  setEntryCoordinates,
  onSearchRegionChange,
  broadcastLocationInto,
}: UseUploadProcessingOptions) => {
  const watchTelegramArchive = async (entry: UploadEntry, key: string) => {
    for (let attempt = 0; attempt < TELEGRAM_ARCHIVE_POLL_ATTEMPTS; attempt += 1) {
      if (!entries.value.some((live) => live.id === entry.id)) return;
      if (!entry.uploadResult || entry.uploadResult.key !== key) return;
      if (entry.uploadResult.tg_status !== 'pending') return;

      await delay(TELEGRAM_ARCHIVE_POLL_INTERVAL_MS);

      try {
        const latest = await fetchAdminImage(key);
        if (!entries.value.some((live) => live.id === entry.id)) return;
        if (!entry.uploadResult || entry.uploadResult.key !== key) return;

        entry.uploadResult = { ...entry.uploadResult, tg_status: latest.tg_status };
        if (latest.tg_status !== 'pending') return;
      } catch {
        continue;
      }
    }
  };

  const runAiPreview = async (entry: UploadEntry) => {
    const compressed = entry.compressedFile;
    if (!compressed) return;
    const requestId = ++entry.aiRequestId;
    entry.aiStatus = 'pending';
    entry.aiError = null;
    entry.meta.ai_status = 'pending';

    try {
      const aiImage = entry.aiPreviewFile ?? await prepareAiPreviewFile(compressed);
      if (requestId !== entry.aiRequestId) return;
      entry.aiPreviewFile = aiImage;

      const result = await previewAiAnnotation(aiImage);
      if (requestId !== entry.aiRequestId) return;

      entry.meta.title = result.title || entry.meta.title;
      entry.meta.caption = result.caption;
      entry.meta.tags = result.tags.join(', ');
      entry.meta.search_content = result.search_content;
      entry.meta.dominant_color = result.dominant_color;
      entry.meta.palette = result.palette.join(', ');
      entry.meta.composition = result.composition;
      entry.meta.ai_status = 'done';
      entry.aiStatus = 'done';
    } catch (error) {
      if (requestId !== entry.aiRequestId) return;
      entry.aiError = (error as Error).message || 'AI 分析失败。';
      entry.meta.ai_status = 'failed';
      entry.aiStatus = 'failed';
    }
  };

  const processEntry = async (entry: UploadEntry) => {
    try {
      const hash = await sha256HexFromFile(entry.file);
      const existing = await checkAdminImageHash(hash);
      if (existing) {
        entry.uploadResult = existing;
        entry.duplicate = true;
        entry.status = 'done';
        entry.aiStatus = 'idle';
        entry.meta.ai_status = 'done';
        return;
      }

      entry.originalHash = hash;
      const nextExif = await readExif(entry.file);
      const nextCompressed = await compressToWebp(entry.file);
      const nextDimensions = await readImageDimensions(nextCompressed);
      entry.exif = nextExif;
      entry.compressedFile = nextCompressed;
      entry.compressedDimensions = nextDimensions;
      if (nextExif.location_lat !== null && nextExif.location_lng !== null) {
        const exifRegion = geocodeRegionForCoordinate(nextExif.location_lat, nextExif.location_lng);
        if (entry.id === currentEntryId.value && exifRegion !== pickRegion.value) void onSearchRegionChange(exifRegion);
        setEntryCoordinates(
          entry,
          nextExif.location_lat,
          nextExif.location_lng,
          entry.id === currentEntryId.value,
          exifRegion,
        );
        if (!entry.meta.location_name) {
          void reverseGeocodeLocation(nextExif.location_lat, nextExif.location_lng, exifRegion)
            .then((name) => {
              if (name && !entry.meta.location_name) entry.meta.location_name = name;
            })
            .catch(() => undefined);
        }
      }
      entry.status = 'ready';
      enqueueAi(entry);
      broadcastLocationInto(entry);
    } catch (error) {
      entry.status = 'error';
      entry.errorMessage = (error as Error).message || '图片处理失败。';
    }
  };

  const processQueue: UploadEntry[] = [];
  let processWorkers = 0;

  const runProcessWorker = async () => {
    if (processWorkers >= PROCESS_CONCURRENCY) return;
    processWorkers += 1;
    try {
      while (processQueue.length > 0) {
        const queued = processQueue.shift()!;
        const live = entries.value.find((e) => e.id === queued.id);
        if (!live) continue;
        await processEntry(live);
      }
    } finally {
      processWorkers -= 1;
      if (processQueue.length > 0) pumpProcessQueue();
    }
  };

  const pumpProcessQueue = () => {
    while (processWorkers < PROCESS_CONCURRENCY && processQueue.length > 0) {
      void runProcessWorker();
    }
  };

  const enqueueProcess = (entry: UploadEntry) => {
    processQueue.push(entry);
    pumpProcessQueue();
  };

  const aiQueue: UploadEntry[] = [];
  let aiWorkers = 0;

  const runAiWorker = async () => {
    if (aiWorkers >= AI_CONCURRENCY) return;
    aiWorkers += 1;
    try {
      while (aiQueue.length > 0) {
        const queued = aiQueue.shift()!;
        const live = entries.value.find((e) => e.id === queued.id);
        if (!live || !live.compressedFile) continue;
        await runAiPreview(live);
      }
    } finally {
      aiWorkers -= 1;
      if (aiQueue.length > 0) pumpAiQueue();
    }
  };

  const pumpAiQueue = () => {
    while (aiWorkers < AI_CONCURRENCY && aiQueue.length > 0) {
      void runAiWorker();
    }
  };

  const enqueueAi = (entry: UploadEntry) => {
    if (entry.aiStatus === 'pending') return;
    if (aiQueue.some((queued) => queued.id === entry.id)) return;
    aiQueue.push(entry);
    pumpAiQueue();
  };

  const triggerAiForCurrent = () => {
    const entry = currentEntry.value;
    if (!entry || !entry.compressedFile) return;
    enqueueAi(entry);
  };

  const uploadEntry = async (entry: UploadEntry) => {
    if (!entry.originalHash || !entry.compressedFile || !entry.compressedDimensions) return;
    const formData = buildUploadFormData({
      original: entry.file,
      compressed: entry.compressedFile,
      hash: entry.originalHash,
      exif: entry.exif,
      meta: { ...entry.meta, folder_id: batchFolderId.value || null },
      dimensions: entry.compressedDimensions,
    });

    entry.status = 'uploading';
    entry.errorMessage = null;
    try {
      const record = await uploadImage(formData);
      entry.uploadResult = record;
      entry.status = 'done';
      if (record.tg_status === 'pending') void watchTelegramArchive(entry, record.key);
    } catch (error) {
      entry.errorMessage = (error as Error).message || '上传失败。';
      entry.status = 'error';
    }
  };

  const retryArchiveForCurrent = async () => {
    const entry = currentEntry.value;
    if (!entry?.uploadResult || entry.uploadResult.tg_status !== 'failed' || entry.archiveRetrying) return;

    entry.archiveRetrying = true;
    entry.archiveRetryError = null;
    try {
      const record = await retryTelegramArchive(entry.uploadResult.key, entry.file);
      if (!entries.value.some((live) => live.id === entry.id)) return;

      entry.uploadResult = record;
      if (record.tg_status === 'pending') void watchTelegramArchive(entry, record.key);
    } catch (error) {
      entry.archiveRetryError = (error as Error).message || '归档重试失败。';
    } finally {
      entry.archiveRetrying = false;
    }
  };

  const submitUploadAll = async () => {
    if (!canSubmit.value) return;
    isBatchUploading.value = true;
    globalError.value = null;
    try {
      const uploadCandidates = entries.value.filter((entry) => entry.status === 'ready');
      await runConcurrentEntries(uploadCandidates, UPLOAD_CONCURRENCY, uploadEntry);
    } finally {
      isBatchUploading.value = false;
    }
  };

  return {
    enqueueProcess,
    enqueueAi,
    triggerAiForCurrent,
    uploadEntry,
    retryArchiveForCurrent,
    submitUploadAll,
  };
};
