/**
 * Checks "break it down" maths: utils/wordTimings.ts (line → words mapping,
 * step building) and the AI-answer checks in utils/aiDrills.ts.
 * Run with: node test-breakdown.mjs
 *
 * Bundles the real modules (stubbing Tauri's fetch) instead of re-typing the
 * logic, and builds its lines with the real buildSrt + parseSRT, so this fails
 * when any of those drift apart.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `breakdown-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `
      export * from './utils/wordTimings.ts';
      export { validateBreakdown, parseBreakdownResponse } from './utils/aiDrills.ts';
      export { buildSrt } from './utils/resegment.ts';
      export { parseSRT } from './utils/srtParser.ts';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  outfile: out,
  define: { 'process.env.ROUTER9_BASE_URL': '""', 'process.env.ROUTER9_BASE_KEY': '""' },
  plugins: [{
    name: 'stub-tauri-http',
    setup(b) {
      b.onResolve({ filter: /^@tauri-apps\/plugin-http$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const fetch = globalThis.fetch;' }));
    },
  }],
});
const {
  mapLinesToWords, buildSteps, parseWords, validateBreakdown, parseBreakdownResponse, buildSrt, parseSRT,
} = await import(out);

// Words as whisper hands them over: punctuation rides along ("hola,", "¿cómo"),
// and "U.S.A." is ONE word here though tokenizeText would make three of it.
const spoken = [
  'Hola,', 'amigos.',                                                     // line 0
  'I', 'was', 'looking', 'for', 'my', 'dog', 'when', 'I', 'saw', 'Mary.', // line 1
  '¿cómo', 'estás', 'en', 'U.S.A.?',                                      // line 2
];
const words = spoken.map((w, i) => ({ w, from: 1000 + i * 250, to: 1000 + i * 250 + 200 }));
const starts = [0, 2, 12];
const lines = parseSRT(buildSrt(words, starts));
const joinSpan = (ws, s) => ws.slice(s.start, s.end).map(w => w.w).join(' ');

// 1. Each line maps onto its own run of words.
{
  const spans = mapLinesToWords(lines, words);
  assert.deepEqual(spans, [{ start: 0, end: 2 }, { start: 2, end: 12 }, { start: 12, end: 16 }]);
  spans.forEach((s, i) => assert.equal(joinSpan(words, s), lines[i].text));
}

// 2. Words that do not match the lines are rejected, never shifted: drop one
//    word from the middle of line 1 and neither it nor anything after it maps.
{
  const broken = words.filter((_, i) => i !== 5);
  const spans = mapLinesToWords(lines, broken);
  assert.deepEqual(spans[0], { start: 0, end: 2 });
  assert.equal(spans[1], null);
  assert.equal(spans[2], null);
  // Same words, but a line whose start time is off (e.g. whisper's own SRT) is refused too.
  const moved = lines.map((l, i) => (i === 2 ? { ...l, startTime: l.startTime + 0.5 } : l));
  assert.equal(mapLinesToWords(moved, words)[2], null);
  // A stray word in the text is refused.
  const edited = lines.map((l, i) => (i === 0 ? { ...l, text: 'Hola, mis amigos.' } : l));
  assert.equal(mapLinesToWords(edited, words)[0], null);
}

// 3. Three chunks → three steps, last chunk first, whole line last; every step
//    starts at its chunk's first word and ends at the line's own end.
{
  const span = { start: 2, end: 12 };
  const line = lines[1];
  const steps = buildSteps(words, span, [0, 6, 9], line.endTime);
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.map(s => s.text), ['Mary.', 'when I saw Mary.', line.text]);
  assert.deepEqual(steps.map(s => s.chunk), [2, 1, 0]);
  assert.deepEqual(steps.map(s => s.startSec), [words[11].from / 1000, words[8].from / 1000, words[2].from / 1000]);
  steps.forEach(s => assert.equal(s.endSec, line.endTime));
  assert.equal(steps[2].startSec, line.startTime);
}

// 4. Two chunks → two steps.
{
  const steps = buildSteps(words, { start: 2, end: 12 }, [0, 6], lines[1].endTime);
  assert.deepEqual(steps.map(s => s.text), ['when I saw Mary.', lines[1].text]);
}

// 5. The AI answer is checked rule by rule; any broken rule throws it out.
{
  const n = 10;
  const ok = { starts: [0, 6, 9], notes: ['a', 'b', 'c'] };
  assert.deepEqual(validateBreakdown(ok, n), ok);
  assert.deepEqual(validateBreakdown({ starts: [0, 6], notes: ['a', 'b'] }, n), { starts: [0, 6], notes: ['a', 'b'] });
  const bad = {
    firstNotZero: { starts: [1, 6], notes: ['a', 'b'] },
    notIncreasing: { starts: [0, 6, 6], notes: ['a', 'b', 'c'] },
    decreasing: { starts: [0, 6, 3], notes: ['a', 'b', 'c'] },
    outOfRange: { starts: [0, 10], notes: ['a', 'b'] },
    negative: { starts: [0, -1], notes: ['a', 'b'] },
    notInteger: { starts: [0, 2.5], notes: ['a', 'b'] },
    stringIndex: { starts: [0, '4'], notes: ['a', 'b'] },
    oneChunk: { starts: [0], notes: ['a'] },
    fourChunks: { starts: [0, 2, 4, 6], notes: ['a', 'b', 'c', 'd'] },
    notesShort: { starts: [0, 6, 9], notes: ['a', 'b'] },
    notesLong: { starts: [0, 6], notes: ['a', 'b', 'c'] },
    emptyNote: { starts: [0, 6], notes: ['a', '  '] },
    noNotes: { starts: [0, 6] },
    notObject: [0, 6],
  };
  for (const [name, value] of Object.entries(bad)) {
    assert.equal(validateBreakdown(value, n), null, `should reject: ${name}`);
  }
  assert.deepEqual(
    parseBreakdownResponse('Sure:\n```json\n{"starts":[0,6],"notes":["looking for = 寻找","when = 当…时"]}\n```', n),
    { starts: [0, 6], notes: ['looking for = 寻找', 'when = 当…时'] },
  );
  assert.equal(parseBreakdownResponse('no json here', n), null);
  assert.equal(parseBreakdownResponse('{"starts":[0,6],', n), null);
}

// 6. Units: word times are milliseconds, steps and lines are seconds.
{
  const ws = [{ w: 'a', from: 61250, to: 61400 }, { w: 'b', from: 61500, to: 61700 }, { w: 'c', from: 62005, to: 62300 }];
  const steps = buildSteps(ws, { start: 0, end: 3 }, [0, 2], 62.7);
  assert.equal(steps[0].startSec, 62.005);
  assert.equal(steps[1].startSec, 61.25);
}

// The saved words file is parsed strictly; anything odd means "no timings".
{
  assert.deepEqual(parseWords(JSON.stringify(words)), words);
  assert.equal(parseWords('not json'), null);
  assert.equal(parseWords('[]'), null);
  assert.equal(parseWords('[{"w":"a b","from":0,"to":1}]'), null);
  assert.equal(parseWords('[{"w":"a","from":"0","to":1}]'), null);
}

console.log('breakdown: all checks passed');
