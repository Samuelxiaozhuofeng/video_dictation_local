/**
 * Checks cloze-drill maths in utils/aiDrills.ts.
 * Run with: node test-cloze.mjs
 *
 * Bundles the real module (stubbing Tauri's fetch, which node has no use
 * for) instead of re-typing the logic, so this fails when that file drifts.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `cloze-${process.pid}.mjs`);
await build({
  entryPoints: ['utils/aiDrills.ts'],
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
  parseClozeResponse, parseClozeCache, pickBlanks, batchLinesByWords, hashSrt, BATCH_WORDS, BATCH_LINES,
} = await import(out);

const nWords = (n, prefix = 'w') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
// prefixes must be letters/digits only: tokenizeText splits on underscore.

// 1. A well-formed model reply yields the ranked index arrays it named.
{
  const content = 'Here you go:\n{"lines":[[2,0,1],[4,1,0,2,3]]}\n';
  const outLines = parseClozeResponse(content, [3, 5]);
  assert.deepEqual(outLines, [[2, 0, 1], [4, 1, 0, 2, 3]]);
}

// 2. One sentence with a bad index is dropped; the rest of the batch is kept.
{
  const content = JSON.stringify({
    lines: [
      [0, 1],
      [99],
      [0, 0],
      [0, 1.5],
      [1, 2],
    ],
  });
  const outLines = parseClozeResponse(content, [3, 3, 3, 3, 3]);
  assert.deepEqual(outLines[0], [0, 1], 'valid line kept');
  assert.equal(outLines[1], null, 'out-of-range index drops that line');
  assert.equal(outLines[2], null, 'duplicate index drops that line');
  assert.equal(outLines[3], null, 'non-integer index drops that line');
  assert.deepEqual(outLines[4], [1, 2], 'later valid line still kept');
}

// 3. Easy / medium / full take min(3,n), ceil(n/2), and n blanks from the ranking.
{
  const ranked = [7, 0, 4, 2, 1, 3, 5, 6];
  assert.equal(pickBlanks(ranked, 8, 'easy').length, 3);
  assert.deepEqual(pickBlanks(ranked, 8, 'easy'), [7, 0, 4]);
  assert.equal(pickBlanks(ranked, 8, 'medium').length, 4);
  assert.equal(pickBlanks(ranked, 8, 'full').length, 8);
  assert.equal(pickBlanks(ranked, 2, 'easy').length, 2, 'easy never asks more words than the line has');
  assert.equal(pickBlanks(null, 8, 'easy').length, 8, 'missing ranking practises as full write');
}

// 4. A cache whose lines array does not match the sentence count is discarded whole.
{
  const srt = '1\n00:00:00,000 --> 00:00:01,000\nhello there\n';
  const raw = JSON.stringify({ v: 1, srt: hashSrt(srt), lines: [[0]] });
  assert.equal(parseClozeCache(raw, hashSrt(srt), [2, 2]), null);
  assert.equal(parseClozeCache(raw, hashSrt('different'), [1]), null, 'fingerprint mismatch also discards');
  const ok = JSON.stringify({ v: 1, srt: hashSrt(srt), lines: [[1, 0], [0]] });
  assert.deepEqual(parseClozeCache(ok, hashSrt(srt), [2, 1]), [[1, 0], [0]]);
}

// 5. Sentences are packed into batches, never one sentence per call.
{
  const texts = Array.from({ length: 6 }, (_, i) => nWords(60, `s${i}w`));
  const batches = batchLinesByWords(texts, 250, 25);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0], { start: 0, end: 4 }, 'four 60-word lines fill a 250-word batch');
  assert.deepEqual(batches[1], { start: 4, end: 6 }, 'the leftovers go in the next batch');
  const oneLong = batchLinesByWords([nWords(1500)], 250, 25);
  assert.deepEqual(oneLong, [{ start: 0, end: 1 }], 'a single oversize line is still one batch');
}

// 5b. The LINE cap is the one that matters: the model has to return exactly one
// sub-array per line, so a batch of many short lines is what actually breaks it.
// Real subtitles run ~8 words a line, which put 287 lines in a 1000-word batch.
{
  const shorts = Array.from({ length: 100 }, (_, i) => `a${i} b${i}`); // 2 words each
  const batches = batchLinesByWords(shorts, 250, 25);
  assert.ok(batches.every(b => b.end - b.start <= 25), 'no batch exceeds the line cap');
  assert.equal(batches.length, 4, '100 two-word lines split by the line cap, not the word cap');
  assert.deepEqual(batches[0], { start: 0, end: 25 });
  // every line lands in exactly one batch, in order, nothing lost
  assert.deepEqual(batches.flatMap(b => Array.from({ length: b.end - b.start }, (_, k) => b.start + k)),
    Array.from({ length: 100 }, (_, i) => i), 'batches cover every line exactly once');
  assert.ok(BATCH_WORDS <= 250 && BATCH_LINES <= 25, 'shipped caps stay within what the model answers reliably');
}

console.log('cloze: all checks passed');
