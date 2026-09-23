import { hashSrt, lineWordCount, loadOrBuildCloze, parseClozeCache } from './aiDrills';
import { readCacheText, writeCacheText } from './desktop';
import { parseSRT } from './srtParser';

// Cloze ranking as a background job per video, shared by the shelf ("…" →
// Blanks, auto-run after an import) and the practice page, so the two never ask
// the AI twice for the same video. Module-level: leaving a page does not stop it.

type ClozeJob = { done: number; total: number; cancelled?: boolean; saving?: Promise<void>; promise: Promise<(number[] | null)[]> };
const jobs = new Map<string, ClozeJob>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export const linesOf = (subtitleText: string) => parseSRT(subtitleText).map(s => s.text);

export function getClozeJob(recordId: string): ClozeJob | undefined {
  return jobs.get(recordId);
}

export function subscribeCloze(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Before a record's files go to the Trash: a finishing job must not write the cache back.
export async function cancelCloze(recordId: string): Promise<void> {
  const job = jobs.get(recordId);
  if (!job) return;
  job.cancelled = true;
  await job.saving;
}

// Ranked word indices per line, from the cache plus the AI for lines not ranked yet.
export function prepareCloze(recordId: string | null, lineTexts: string[]): Promise<(number[] | null)[]> {
  const running = recordId ? jobs.get(recordId) : undefined;
  if (running) return running.promise;
  const job: ClozeJob = { done: 0, total: 0, promise: Promise.resolve([]) };
  job.promise = loadOrBuildCloze({
    lineTexts,
    recordId,
    subtitleText: lineTexts.join('\n'),
    readText: id => readCacheText(id, 'cloze'),
    writeText: (id, text) => {
      if (job.cancelled) return Promise.resolve();
      // A failed write only costs the cache; it must not make cancelCloze throw.
      job.saving = writeCacheText(id, 'cloze', text).catch(() => {});
      return job.saving;
    },
    onProgress: (done, total) => { job.done = done; job.total = total; notify(); },
  }).finally(() => {
    if (recordId && jobs.get(recordId) === job) jobs.delete(recordId);
    notify();
  });
  if (recordId) { jobs.set(recordId, job); notify(); }
  return job.promise;
}

// How many lines still have no ranking, for the shelf.
export async function clozeStatus(recordId: string, subtitleText: string): Promise<{ eligible: number; missing: number }> {
  const lineTexts = linesOf(subtitleText);
  const counts = lineTexts.map(lineWordCount);
  const raw = await readCacheText(recordId, 'cloze');
  const cached = raw ? parseClozeCache(raw, hashSrt(lineTexts.join('\n')), counts) : null;
  const eligible = counts.filter(n => n > 0).length;
  const missing = counts.filter((n, i) => n > 0 && !cached?.[i]).length;
  return { eligible, missing };
}
