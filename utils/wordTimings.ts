import type { Word } from './resegment';

// Word-level timings saved at import (<record id>.words.json) and the maths that
// turns them into "break it down" steps. Lines are counted by SPACES, never by
// tokenizeText: whisper's words carry their punctuation ("hola,", "¿cómo") and
// buildSrt joined exactly those with single spaces, so a space split lines up
// one-to-one with the words array while tokenizeText would not.

export type LineSpan = { start: number; end: number }; // words[start..end)

export type BreakdownStep = {
  chunk: number;    // which chunk this step adds (last chunk first)
  text: string;     // what the user types: from this chunk to the end of the line
  startSec: number;
  endSec: number;   // always the line's own end time
};

export function spaceWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function parseWords(raw: string): Word[] | null {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(data) || data.length === 0) return null;
  for (const item of data) {
    if (typeof item?.w !== 'string' || !item.w || /\s/.test(item.w)) return null;
    if (!Number.isInteger(item.from) || !Number.isInteger(item.to) || item.from < 0) return null;
  }
  return data as Word[];
}

// Line N is the next run of words after lines 0..N-1. Never trusted blindly:
// the run must re-join to the line's text and start at the line's own start
// time (buildSrt stamps it from that first word), else the line gets null and
// simply has no breakdown — no guessing, no nearby match.
export function mapLinesToWords(
  lines: { text: string; startTime: number }[],
  words: Word[],
): (LineSpan | null)[] {
  let offset = 0;
  return lines.map(line => {
    const parts = spaceWords(line.text);
    const start = offset;
    const end = offset + parts.length;
    offset = end;
    if (parts.length === 0 || end > words.length) return null;
    const joined = words.slice(start, end).map(w => w.w).join(' ');
    if (joined !== parts.join(' ')) return null;
    if (Math.abs(words[start].from / 1000 - line.startTime) > 0.002) return null;
    return { start, end };
  });
}

// Practice order runs from the last chunk back to the whole line; every step
// plays from its chunk's first word to the line's original end.
export function buildSteps(
  words: Word[],
  span: LineSpan,
  chunkStarts: number[],
  lineEndSec: number,
): BreakdownStep[] {
  const steps: BreakdownStep[] = [];
  for (let c = chunkStarts.length - 1; c >= 0; c--) {
    const first = span.start + chunkStarts[c];
    steps.push({
      chunk: c,
      text: words.slice(first, span.end).map(w => w.w).join(' '),
      startSec: words[first].from / 1000,
      endSec: lineEndSec,
    });
  }
  return steps;
}
