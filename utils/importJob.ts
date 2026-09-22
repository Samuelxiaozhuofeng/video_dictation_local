import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VideoRecord } from '../types';
import { fileNameFromPath } from './desktop';
import { t } from './i18n';
import { parseSRT } from './srtParser';
import * as VideoStorage from './videoStorage';

type ImportProgressPayload = {
  id: string;
  stage: 'download' | 'extract' | 'transcribe' | 'done' | 'error';
  percent?: number;
  error?: string;
  videoPath?: string;
  subtitleText?: string;
};

const listeners = new Set<() => void>();

export function subscribeImportJobs(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  listeners.forEach(fn => fn());
}

export function isYouTubeUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  } catch {
    return false;
  }
}

export function formatImportError(raw: string): string {
  if (raw.includes('Sign in to confirm')) return t('import.needCookies');
  if (raw.startsWith('missing-model:')) {
    return t('import.missingModel', { name: raw.slice('missing-model:'.length) });
  }
  if (raw.startsWith('missing:')) {
    return t('import.missingTool', { name: raw.slice('missing:'.length) });
  }
  if (raw.startsWith('download:')) {
    return t('import.failedDownload', { detail: raw.slice('download:'.length) });
  }
  if (raw.startsWith('extract:')) {
    return t('import.failedExtract', { detail: raw.slice('extract:'.length) });
  }
  if (raw.startsWith('transcribe:')) {
    return t('import.failedTranscribe', { detail: raw.slice('transcribe:'.length) });
  }
  return raw;
}

function pendingRecord(id: string, source: string, fromUrl: boolean): VideoRecord {
  const now = Date.now();
  const label = fromUrl ? source : fileNameFromPath(source);
  return {
    id,
    displayName: label,
    videoFileName: label,
    subtitleFileName: '',
    subtitleText: '',
    currentSubtitleIndex: 0,
    currentSectionIndex: 0,
    totalSubtitles: 0,
    completionRate: 0,
    dateAdded: now,
    lastPracticed: now,
    totalPracticeTime: 0,
    importJob: {
      stage: fromUrl ? 'download' : 'extract',
      percent: 0,
      source,
    },
  };
}

async function startImport(source: string, lang: string, fromUrl: boolean): Promise<void> {
  const id = crypto.randomUUID();
  const record = pendingRecord(id, source, fromUrl);
  await VideoStorage.updateVideoRecord(record);
  notify();
  try {
    await invoke('start_import', { id, source, lang });
  } catch (err) {
    const rec = await VideoStorage.getVideoRecord(id);
    if (!rec?.importJob) return;
    const detail = err instanceof Error ? err.message : String(err);
    await VideoStorage.updateVideoRecord({
      ...rec,
      importJob: { ...rec.importJob, error: formatImportError(detail) },
    });
    notify();
  }
}

export function startUrlImport(url: string, lang: string): Promise<void> {
  return startImport(url.trim(), lang, true);
}

export function startLocalImport(path: string, lang: string): Promise<void> {
  return startImport(path, lang, false);
}

function srtNameFromVideo(videoPath: string): string {
  const name = fileNameFromPath(videoPath);
  return name.replace(/\.[^.]+$/, '') + '.srt';
}

let applyChain: Promise<void> = Promise.resolve();

async function applyProgress(payload: ImportProgressPayload): Promise<void> {
  const rec = await VideoStorage.getVideoRecord(payload.id);
  if (!rec) return;
  if (!rec.importJob) return;

  if (payload.stage === 'done') {
    const videoPath = payload.videoPath;
    const subtitleText = payload.subtitleText ?? '';
    if (!videoPath) return;
    const name = fileNameFromPath(videoPath);
    const rest = { ...rec };
    delete rest.importJob;
    await VideoStorage.updateVideoRecord({
      ...rest,
      displayName: name,
      videoFileName: name,
      videoPath,
      subtitleText,
      subtitleFileName: srtNameFromVideo(videoPath),
      totalSubtitles: parseSRT(subtitleText).length,
      lastPracticed: Date.now(),
    });
    return;
  }

  if (payload.stage === 'error') {
    await VideoStorage.updateVideoRecord({
      ...rec,
      importJob: {
        ...rec.importJob,
        error: formatImportError(payload.error ?? ''),
      },
    });
    return;
  }

  await VideoStorage.updateVideoRecord({
    ...rec,
    importJob: {
      ...rec.importJob,
      stage: payload.stage,
      percent: payload.percent ?? rec.importJob.percent,
    },
  });
}

function enqueueProgress(payload: ImportProgressPayload): void {
  applyChain = applyChain
    .then(() => applyProgress(payload))
    .then(() => notify())
    .catch(err => console.error(err));
}

export async function startImportListener(): Promise<() => void> {
  return listen<ImportProgressPayload>('import-progress', event => {
    enqueueProgress(event.payload);
  });
}

export async function markInterruptedJobs(): Promise<void> {
  const records = await VideoStorage.getAllVideoRecords();
  let changed = false;
  for (const rec of records) {
    if (!rec.importJob || rec.importJob.error) continue;
    await VideoStorage.updateVideoRecord({
      ...rec,
      importJob: { ...rec.importJob, error: t('import.errorInterrupted') },
    });
    changed = true;
  }
  if (changed) notify();
}
