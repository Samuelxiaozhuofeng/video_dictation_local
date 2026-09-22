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
  // null, or [] for a line that has words (older caches saved failed batches
  // that way), means "not ranked yet" and gets asked again.
  return data.lines.map((line, i) => {
    const ranked = validateIndices(line, counts[i]);
    return ranked && (ranked.length > 0 || counts[i] === 0) ? ranked : null;
  });
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
  let cached: (number[] | null)[] | null = null;
  if (opts.recordId) {
    try {
      const raw = await opts.readText(opts.recordId);
      if (raw) cached = parseClozeCache(raw, srt, counts);
    } catch { /* missing cache is fine */ }
  }
  const result = cached ?? counts.map(() => null);
  // Only ask about lines not ranked yet: a failed batch retries next time
  // instead of being cached as "no blanks" for good.
  const missing = counts.flatMap((n, i) => (n > 0 && !result[i] ? [i] : []));
  if (missing.length === 0) return result;
  const generated = await generateCloze(missing.map(i => opts.lineTexts[i]), opts.onProgress);
  missing.forEach((li, k) => { result[li] = generated[k] ?? null; });
  if (opts.recordId && generated.some(Boolean)) {
    const body = JSON.stringify({ v: 1, srt, lines: result });
    try { await opts.writeText(opts.recordId, body); } catch { /* cache must not break practice */ }
  }
  return result;
}

// --- Break it down: split one line into 2–3 chunks ---
// The model returns chunk START indices into the line's word list plus one
// note per chunk. The notes are the only free text it writes and are never
// used to locate anything; any rule broken below throws the whole answer out.

// One short line, and the user is sitting there waiting on it.
const BREAKDOWN_TIMEOUT_MS = 30_000;

export type Breakdown = { starts: number[]; notes: string[] };

export function validateBreakdown(value: unknown, wordCount: number): Breakdown | null {
  const v = value as { starts?: unknown; notes?: unknown } | null;
  if (!v || !Array.isArray(v.starts) || !Array.isArray(v.notes)) return null;
  const { starts, notes } = v as { starts: unknown[]; notes: unknown[] };
  if (starts.length < 2 || starts.length > 3 || notes.length !== starts.length) return null;
  if (starts[0] !== 0) return null;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    if (!Number.isInteger(s) || (s as number) < 0 || (s as number) >= wordCount) return null;
    if (i > 0 && (s as number) <= (starts[i - 1] as number)) return null;
  }
  if (notes.some(n => typeof n !== 'string' || !n.trim())) return null;
  return { starts: starts as number[], notes: (notes as string[]).map(n => n.trim()) };
}

export function parseBreakdownResponse(content: string, wordCount: number): Breakdown | null {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : content;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return validateBreakdown(JSON.parse(match[0]), wordCount); } catch { return null; }
}

function breakdownPrompt(words: string[], lang: 'zh' | 'en'): string {
  const listing = words.map((w, i) => `${i}\t${w}`).join('\n');
  const noteLang = lang === 'zh' ? '简体中文' : 'English';
  const example = lang === 'zh' ? '"looking for = 寻找"' : '"looking for = searching for"';
  return `下面是一句口语转录，按「序号<TAB>词」列出，共 ${words.length} 个词。

把它切成 2 到 3 块，切在意群的自然边界（从句、介词短语、停顿处），不要劈开固定搭配（如 tengo que、looking for）。
只输出 JSON，格式：{"starts":[0,6,9],"notes":["…","…","…"]}
- starts：每块第一个词的序号。第一个必须是 0，严格递增，都小于 ${words.length}。
- notes：与 starts 一一对应，每条用一句简短的${noteLang}说明这一块的意思或用法，例如 ${example}。
- JSON 以外不要输出任何文字。

${listing}`;
}

export async function askBreakdown(words: string[], lang: 'zh' | 'en'): Promise<Breakdown | null> {
  const router = clozeRouter();
  if (!router || words.length === 0) return null;
  const once = async (): Promise<Breakdown | null> => {
    const res = await fetch(`${router.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${router.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: router.model, messages: [{ role: 'user', content: breakdownPrompt(words, lang) }] }),
      signal: AbortSignal.timeout(BREAKDOWN_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`router ${res.status}`);
    const body = await readJsonBody<{ choices?: { message?: { content?: string } }[] }>(res);
    const content = body?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseBreakdownResponse(content, words.length) : null;
  };
  // A network hiccup gets one retry; an answer that fails the checks does not.
  try { return await once(); } catch { try { return await once(); } catch { return null; } }
}
