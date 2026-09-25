import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VideoRecord } from '../types';
import { fileNameFromPath } from './desktop';
import { getLang, t } from './i18n';
import { getAIConfig } from './aiConfig';
import { canCloze } from './aiDrills';
import { prepareBreakdowns } from './breakdownPrep';
import { linesOf, prepareCloze } from './clozePrep';
import { jaCheckOn, prepareSegments } from './jaSegments';
import { hasKana, loadJa } from './japanese';
import { parseSRT } from './srtParser';
import { resegment, Word } from './resegment';
import { engineArgs, getTranscribeConfig } from './transcribeConfig';
import * as VideoStorage from './videoStorage';

type ImportProgressPayload = {
  id: string;
  stage: 'setup' | 'download' | 'extract' | 'transcribe' | 'cloud' | 'done' | 'error';
  percent?: number;
  error?: string;
  videoPath?: string;
  subtitleText?: string;
  words?: Word[];
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

export const IMPORT_QUALITIES = [1080, 720, 480] as const;
export type ImportQuality = (typeof IMPORT_QUALITIES)[number];

export type QualitySizes = Record<ImportQuality, number | null>;

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

// YouTube's bot gate has several wordings; they all mean "cookies missing or stale".
export function isCookieError(raw: string): boolean {
  return /Sign in to confirm|needs to be reloaded|confirm you.re not a bot|not a bot/i.test(raw);
}

export async function openYouTubeLogin(): Promise<void> {
  await invoke('open_youtube_login');
}

// Records store the RAW error and translate here at render time, so switching
// language re-translates it. Pre-existing records already hold a translated
// sentence; it matches nothing below and falls through unchanged.
export function formatImportError(raw: string): string {
  if (isCookieError(raw)) return t('import.needCookies');
  if (raw.startsWith('missing-model:')) {
    return t('import.missingModel', { name: raw.slice('missing-model:'.length) });
  }
  if (raw.startsWith('missing:')) {
    return t('import.missingTool', { name: raw.slice('missing:'.length) });
  }
  if (raw.startsWith('setup:')) {
    return t('import.failedSetup', { detail: raw.slice('setup:'.length) });
  }
  if (raw.startsWith('download:')) {
    return t('import.failedDownload', { detail: raw.slice('download:'.length) });
  }
  if (raw.startsWith('extract:')) {
    return t('import.failedExtract', { detail: raw.slice('extract:'.length) });
  }
  if (raw === 'cloud:key') return t('import.cloudKey');
  if (raw === 'cloud:toolarge') return t('import.cloudTooLarge');
  if (raw === 'cloud:empty') return t('import.cloudEmpty');
  if (raw.startsWith('cloud:quota:')) return t('import.cloudQuota', { detail: raw.slice('cloud:quota:'.length) });
  if (raw.startsWith('cloud:network:')) return t('import.cloudNetwork', { detail: raw.slice('cloud:network:'.length) });
  if (raw.startsWith('cloud:denied:')) return t('import.cloudDenied', { detail: raw.slice('cloud:denied:'.length) });
  if (raw.startsWith('cloud:')) return t('import.cloudFailed', { detail: raw.slice('cloud:'.length) });
  if (raw.startsWith('transcribe:')) {
    return t('import.failedTranscribe', { detail: raw.slice('transcribe:'.length) });
  }
  return raw;
}

function pendingRecord(
  id: string,
  source: string,
  fromUrl: boolean,
  lang: string,
  quality: ImportQuality,
): VideoRecord {
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
      lang,
      quality,
    },
  };
}

async function startImport(
  source: string,
  lang: string,
  fromUrl: boolean,
  quality: ImportQuality,
): Promise<void> {
  const id = crypto.randomUUID();
  const record = pendingRecord(id, source, fromUrl, lang, quality);
  await VideoStorage.updateVideoRecord(record);
  notify();
  try {
    await invoke('start_import', { id, source, lang, quality, ...engineArgs() });
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

export function startUrlImport(url: string, lang: string, quality: ImportQuality = 1080): Promise<void> {
  return startImport(url.trim(), lang, true, quality);
}

export function startLocalImport(path: string, lang: string): Promise<void> {
  return startImport(path, lang, false, 1080);
}

// Retry a failed import on the same record: no second card in the history, and the
// language and quality the user originally picked are reused. Two clicks in the
// moment before the card repaints would start two runs writing the same file, so a
// click is ignored while its retry is in flight.
const retrying = new Set<string>();

export async function retryImport(id: string): Promise<void> {
  if (retrying.has(id)) return;
  const rec = await VideoStorage.getVideoRecord(id);
  const job = rec?.importJob;
  if (!rec || !job) return;
  retrying.add(id);
  const lang = job.lang ?? 'en';
  const quality = (job.quality ?? 1080) as ImportQuality;
  const stage = isYouTubeUrl(job.source) ? 'download' as const : 'extract' as const;
  const next = { stage, percent: 0, source: job.source, lang, quality };
  await VideoStorage.updateVideoRecord({ ...rec, importJob: next });
  notify();
  try {
    // Uses the engine picked in Settings now, not the one this card started
    // with: switching to the cloud after a failed download is a way out.
    await invoke('start_import', { id, source: job.source, lang, quality, ...engineArgs() });
  } catch (err) {
    const fresh = await VideoStorage.getVideoRecord(id);
    if (!fresh?.importJob) return;
    const detail = err instanceof Error ? err.message : String(err);
    await VideoStorage.updateVideoRecord({
      ...fresh,
      importJob: { ...fresh.importJob, error: detail },
    });
    notify();
  } finally {
    retrying.delete(id);
  }
}

export type ImportTools = { whisper: boolean; youtube: boolean };

// whisper: the transcription parts for the model picked in Settings are on this
// machine (else the first local import downloads them). youtube: yt-dlp is
// installed by hand, so the link box is worth showing.
export async function importTools(): Promise<ImportTools> {
  return invoke('import_tools', { model: getTranscribeConfig().localModel });
}

export async function probeImportSizes(url: string): Promise<QualitySizes> {
  return invoke('probe_import_sizes', { url: url.trim() });
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
    if (!videoPath) return;
    // Last step of an import: re-cut whisper's lines into short, sensible ones.
    // It can fail (no router, model hiccup); then we keep what whisper gave us.
    await VideoStorage.updateVideoRecord({
      ...rec,
      importJob: { ...rec.importJob, stage: 'segment', percent: undefined },
    });
    notify();
    const recut = payload.words ? await resegment(payload.words) : null;
    // The re-cut can take a minute; a record deleted meanwhile must stay deleted.
    if (!(await VideoStorage.getVideoRecord(rec.id))) return;
    const subtitleText = recut ?? payload.subtitleText ?? '';
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
    // Opted-in AI prep starts in the background; the shelf shows its progress.
    const ai = getAIConfig();
    if (ai.autoBreakdown && canCloze()) prepareBreakdowns(rec.id, subtitleText, getLang()).catch(err => console.error(err));
    if (ai.autoCloze && canCloze()) prepareCloze(rec.id, linesOf(subtitleText)).catch(err => console.error(err));
    // Japanese: the AI check of phrase splits (auto blanks above wait for it anyway).
    else if (jaCheckOn() && hasKana(subtitleText)) {
      loadJa().then(ok => { if (ok) return prepareSegments(rec.id, linesOf(subtitleText)); }).catch(err => console.error(err));
    }
    return;
  }

  if (payload.stage === 'error') {
    await VideoStorage.updateVideoRecord({
      ...rec,
      importJob: {
        ...rec.importJob,
        error: payload.error ?? '',
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
  const run = applyChain
    .then(() => applyProgress(payload))
    .then(() => notify())
    .catch(err => console.error(err));
  // Finishing an import waits on the re-cut, which can take a minute. It still
  // runs after everything already queued, but a second import's progress must
  // not queue up behind it.
  if (payload.stage !== 'done') applyChain = run;
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
