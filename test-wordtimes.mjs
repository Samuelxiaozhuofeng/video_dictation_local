/**
 * Checks utils/wordTimes.ts: which timed words belong to a line, matching the
 * line's boxes to them letter by letter, and what stretch gets played.
 * Run with: node test-wordtimes.mjs
 *
 * Bundles the real module (Tauri stubbed out) instead of re-typing the logic.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `wordtimes-${process.pid}.mjs`);
await build({
  entryPoints: ['utils/wordTimes.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  plugins: [{
    name: 'stub-desktop',
    setup(b) {
      b.onResolve({ filter: /^\.\/desktop$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const readCacheText = async () => null;' }));
    },
  }],
});
const { parseWords, wordsInLine, wordSpans, playSpan, WORD_LEAD_SEC, WORD_TAIL_SEC, WORD_MIN_SEC, PLAY_FROM_LEAD_SEC } = await import(out);

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

// parseWords: only a non-empty list of {w, from, to}
assert.equal(parseWords(null), null);
assert.equal(parseWords('not json'), null);
assert.equal(parseWords('[]'), null);
assert.equal(parseWords('[{"w":"a","from":1}]'), null);
assert.equal(parseWords('[{"w":"a","from":1,"to":2}]').length, 1);

// wordsInLine: the words within 0.8 s of the line, times as 0..1 of the line
const all = [
  { w: 'before', from: 0, to: 100 },      // ends 0.9 s before the line: out
  { w: 'Hello,', from: 900, to: 1100 },
  { w: 'well-being', from: 1200, to: 2200 },
  { w: 'next', from: 2900, to: 3300 },    // the next line's, but near: in
];
const inLine = wordsInLine(all, 1, 3);
assert.deepEqual(inLine.map(w => w.w), ['Hello,', 'well-being', 'next']);
close(inLine[0].from, -0.05);
close(inLine[1].to, 0.6);
assert.equal(wordsInLine(null, 1, 3), undefined);
assert.equal(wordsInLine(all, 10, 12), undefined);

// wordSpans: punctuation and case ignored; a hyphenated word splits by letters
const spans = wordSpans(['hello', 'well', 'being'], inLine);
close(spans[0][0], -0.05); close(spans[0][1], 0.05);
close(spans[1][0], 0.1); close(spans[1][1], 0.1 + 0.5 * 4 / 9);
close(spans[2][0], 0.1 + 0.5 * 4 / 9); close(spans[2][1], 0.6);
// Two timed words in one box (whisper split "don't" as "don" + "'t")
const dont = wordSpans(['don’t', 'go'], [{ w: 'don', from: 0, to: 0.2 }, { w: "'t", from: 0.2, to: 0.3 }, { w: 'go', from: 0.4, to: 0.6 }]);
assert.deepEqual(dont, [[0, 0.3], [0.4, 0.6]]);
// The line's last word runs past its end (whisper drift): still found
const over = wordSpans(['into', 'it'], [{ w: 'into', from: 0.6, to: 0.9 }, { w: 'it.', from: 0.95, to: 1.3 }, { w: 'Next', from: 1.4, to: 1.6 }]);
assert.deepEqual(over, [[0.6, 0.9], [0.95, 1.3]]);
// Same words twice nearby: the run starting nearest the line's start wins
const twice = wordSpans(['hello'], [{ w: 'hello', from: -0.4, to: -0.2 }, { w: 'hello', from: 0.02, to: 0.3 }]);
assert.deepEqual(twice, [[0.02, 0.3]]);
// Text doesn't match the timed words (edited line / other subtitles): no spans
assert.equal(wordSpans(['hello', 'world'], inLine), null);
assert.equal(wordSpans(['hello'], undefined), null);
// Japanese: kana/kanji letters line up the same way
const ja = wordSpans(['今日は', 'いい天気'], [{ w: '今日', from: 0, to: 0.2 }, { w: 'は', from: 0.2, to: 0.3 }, { w: 'いい', from: 0.3, to: 0.5 }, { w: '天気', from: 0.5, to: 0.8 }]);
assert.deepEqual(ja, [[0, 0.3], [0.3, 0.8]]);
// Spanish accents written composed vs decomposed still match
assert.ok(wordSpans(['está'], [{ w: 'está', from: 0, to: 1 }]));

// playSpan: whole line / from a word / one word, clamped to the line
assert.deepEqual(playSpan(10, 14), [10, 14]);
close(playSpan(10, 14, 0.5)[0], 12 - PLAY_FROM_LEAD_SEC);
assert.equal(playSpan(10, 14, 0.5)[1], 14);
const one = playSpan(10, 14, 0.5, 0.75);
close(one[0], 12 - WORD_LEAD_SEC); close(one[1], 13 + WORD_TAIL_SEC);
assert.equal(playSpan(10, 14, 0, 0.1)[0], 10, 'never before the line starts');
assert.equal(playSpan(10, 14, 0.9, 1)[1], 14, 'never past the line end');
// a 10 ms word still plays WORD_MIN_SEC; at the line's end it grows backwards instead
const tiny = playSpan(10, 14, 0.5, 0.5025);
close(tiny[1] - tiny[0], WORD_MIN_SEC); close(tiny[0], 12 - WORD_LEAD_SEC);
const last = playSpan(10, 14, 0.999, 1);
assert.equal(last[1], 14); close(last[0], 14 - WORD_MIN_SEC);
// a line shorter than WORD_MIN_SEC just plays whole
assert.deepEqual(playSpan(10, 10.3, 0.5, 0.6), [10, 10.3]);
// whisper's first word can start a hair before the line: still inside the line
assert.equal(playSpan(10, 14, -0.05, 0.05)[0], 10);
// a word wholly before / after the line still plays something, never from > to
for (const [f, t] of [[-0.2, -0.1], [1.1, 1.3], [1.4, undefined], [-0.3, undefined]]) {
  const [a, b] = playSpan(10, 14, f, t);
  assert.ok(a >= 10 && b <= 14 && b - a >= 0.29, `${f}..${t} → ${a}..${b}`);
}

console.log('word times: all checks passed');
