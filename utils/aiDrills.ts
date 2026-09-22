import { fetch } from '@tauri-apps/plugin-http';
import { ClozeLevel } from '../types';
import { getAIConfig, getEndpoint, normalizeBaseUrl, readJsonBody } from './aiConfig';
import { getRouter } from './resegment';
import { tokenizeText, getWordTokens } from './textTokenizer';

// Cloze drills: the model only returns word indices (never text), so it cannot
// rewrite a line, and every index can be checked against tokenizeText.

// Sized from the user's real subtitles: at ~8 words a line, a 1000-word batch
// swallowed up to 287 lines, and the model has to return exactly that many
// sub-arrays or the whole batch is thrown away. The line cap is the real guard
// here — the word cap alone does not bound how many answers we ask for at once.
export const BATCH_WORDS = 250;
export const BATCH_LINES = 25;
const MAX_INFLIGHT = 8;
const REQUEST_TIMEOUT_MS = 90_000;

export function lineWordCount(text: string): number {
  return getWordTokens(tokenizeText(text)).length;
}

export function lineWords(text: string): string[] {
  return getWordTokens(tokenizeText(text)).map(w => w.value);
}

// djb2 — sync, no crypto.subtle. Unsigned hex so two runs of the same SRT match.
export function hashSrt(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export type LineBatch = { start: number; end: number };

export function batchLinesByWords(texts: string[], maxWords = BATCH_WORDS, maxLines = BATCH_LINES): LineBatch[] {
  const counts = texts.map(lineWordCount);
  const batches: LineBatch[] = [];
  let start = 0;
  let words = 0;
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i];
    if (i > start && (words + n > maxWords || i - start >= maxLines)) {
      batches.push({ start, end: i });
      start = i;
      words = 0;
    }
    words += n;
  }
  if (start < texts.length) batches.push({ start, end: texts.length });
  return batches;
}

export function validateIndices(value: unknown, wordCount: number): number[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of value) {
    if (!Number.isInteger(item) || item < 0 || item >= wordCount || seen.has(item)) return null;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function extractLines(content: string): unknown[] {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : content;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no json');
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.lines)) throw new Error('no lines');
  return parsed.lines;
}

// Throws if the payload is not a lines array of the expected length (batch
// retry). A single bad sentence becomes null and leaves the rest of the batch.
export function parseClozeResponse(content: string, counts: number[]): (number[] | null)[] {
  const lines = extractLines(content);
  if (lines.length !== counts.length) throw new Error('lines length mismatch');
  return lines.map((line, i) => validateIndices(line, counts[i]));
}

export type ClozeCacheFile = { v: 1; srt: string; lines: unknown[] };

export function parseClozeCache(raw: string, srtHash: string, counts: number[]): (number[] | null)[] | null {
  let data: ClozeCacheFile;
  try { data = JSON.parse(raw); } catch { return null; }
  if (data?.v !== 1 || data.srt !== srtHash || !Array.isArray(data.lines)) return null;
  if (data.lines.length !== counts.length) return null;
  return data.lines.map((line, i) => validateIndices(line, counts[i]));
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function pickBlanks(ranked: number[] | null | undefined, wordCount: number, level: ClozeLevel): number[] {
  if (level === 'full' || wordCount <= 0 || !ranked || ranked.length === 0) return range(wordCount);
  const n = level === 'easy' ? Math.min(3, wordCount) : Math.ceil(wordCount / 2);
  return ranked.slice(0, n);
}

type Router = { baseUrl: string; apiKey: string; model: string };

function clozeRouter(): Router | null {
  const viaSegment = getRouter();
  if (viaSegment) return viaSegment;
  const endpoint = getEndpoint();
  const model = getAIConfig().model?.trim();
  if (!endpoint || !model) return null;
  return { baseUrl: normalizeBaseUrl(endpoint.baseUrl), apiKey: endpoint.apiKey, model };
}

export function canCloze(): boolean {
  return clozeRouter() !== null;
}

function promptFor(texts: string[]): { prompt: string; counts: number[] } {
  const counts: number[] = [];
  const blocks = texts.map((text, li) => {
    const words = lineWords(text);
    counts.push(words.length);
    const listing = words.map((w, i) => `${i}\t${w}`).join('\n');
    return `第 ${li} 句（${words.length} 个词）：\n${listing}`;
  });
  const prompt = `下面有 ${texts.length} 句口语转录，每句是「序号<TAB>词」的清单。

请为每句选出最该练习听写的词。要求：
- 对每句给出一个按优先级排好序的下标数组（最该练的排前面），覆盖该句全部词，不重不漏。
- 只输出 JSON，格式：{"lines":[[3,0,1,...],[2,5,...],...]}
- lines 的长度必须等于 ${texts.length}，第 n 项对应第 n 句。
- 每个下标必须是该句词清单里出现过的整数序号。不要输出任何词的文本。

句子：
${blocks.join('\n\n')}`;
  return { prompt, counts };
}

async function askOnce(texts: string[]): Promise<(number[] | null)[]> {
  const router = clozeRouter();
  if (!router) throw new Error('no router configured');
  const { prompt, counts } = promptFor(texts);
  const res = await fetch(`${router.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${router.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: router.model, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`router ${res.status}`);
  const body = await readJsonBody<{ choices?: { message?: { content?: string } }[] }>(res);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('no content in response');
  return parseClozeResponse(content, counts);
}

async function ask(texts: string[]): Promise<(number[] | null)[]> {
  try {
    return await askOnce(texts);
  } catch {
    return await askOnce(texts);
  }
}

export async function generateCloze(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const results: (number[] | null)[] = texts.map(() => null);
  try {
    if (!canCloze()) return results;
    const groups = batchLinesByWords(texts);
    onProgress?.(0, groups.length);
    let next = 0;
    let done = 0;
    await Promise.all(Array.from({ length: Math.min(MAX_INFLIGHT, groups.length) }, async () => {
      while (next < groups.length) {
        const i = next++;
        const { start, end } = groups[i];
        try {
          const ranked = await ask(texts.slice(start, end));
          for (let j = 0; j < ranked.length; j++) results[start + j] = ranked[j];
        } catch {
          // this batch stays null → those lines practise as full write
        }
        done++;
        onProgress?.(done, groups.length);
      }
    }));
    return results;
  } catch {
    return results;
  }
}

export async function loadOrBuildCloze(opts: {
  lineTexts: string[];
  recordId: string | null;
  subtitleText: string;
  readText: (id: string) => Promise<string | null>;
  writeText: (id: string, text: string) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}): Promise<(number[] | null)[]> {
  const counts = opts.lineTexts.map(lineWordCount);
  const srt = hashSrt(opts.subtitleText);
  if (opts.recordId) {
    try {
      const raw = await opts.readText(opts.recordId);
      if (raw) {
        const parsed = parseClozeCache(raw, srt, counts);
        if (parsed) return parsed;
      }
    } catch { /* missing cache is fine */ }
  }
  const generated = await generateCloze(opts.lineTexts, opts.onProgress);
  if (opts.recordId) {
    const body = JSON.stringify({ v: 1, srt, lines: generated.map(r => r ?? []) });
    try { await opts.writeText(opts.recordId, body); } catch { /* cache must not break practice */ }
  }
  return generated;
}
