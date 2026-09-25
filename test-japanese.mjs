/**
 * Checks Japanese splitting and kana answers (utils/japanese.ts + textTokenizer.ts).
 * Run with: node test-japanese.mjs
 *
 * Bundles the real modules; the Tauri side is stubbed to read the dictionary
 * straight out of node_modules/kuromoji/dict.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `japanese-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './utils/textTokenizer.ts'; export * from './utils/japanese.ts'; export * from './utils/jaSegments.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  plugins: [{
    name: 'stub-desktop',
    setup(b) {
      b.onResolve({ filter: /\/desktop$|^@tauri-apps\/plugin-http$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: `import { readFileSync } from 'node:fs';
          export const jaDictStatus = async () => ({ installed: true, dir: 'node_modules/kuromoji/dict', bytes: 0 });
          export const readBinaryFile = async p => new Uint8Array(readFileSync(p));
          export const installJaDict = async () => {}; export const removeJaDict = async () => {};
          export const onJaDictProgress = async () => () => {};
          export const readCacheText = async () => null; export const writeCacheText = async () => {};
          export const fetch = globalThis.fetch;`,
        resolveDir: process.cwd(),
      }));
    },
  }],
});
const tok = await import(out);
const ja = tok;
const { tokenizeText, getWordTokens, isInputCorrectFlexibleCase, areAllWordsCorrectFlexibleCase } = tok;
const words = text => getWordTokens(tokenizeText(text)).map(w => w.value);

// 1. Before the dictionary loads, a Japanese line is one box (the old behaviour).
assert.deepEqual(words('今日はいい天気ですね。'), ['今日はいい天気ですね']);

// 2. Loaded: one box per phrase, particles and endings on their word.
assert.equal(await ja.loadJa(), true);
assert.deepEqual(words('今日はいい天気ですね。散歩に行きませんか？'), ['今日は', 'いい', '天気ですね', '散歩に', '行きませんか']);
assert.deepEqual(words('昨日友達と新宿で映画を見てきました'), ['昨日', '友達と', '新宿で', '映画を', '見てきました']);
assert.deepEqual(words('食べさせられたくなかったんですけど'), ['食べさせられたくなかったんですけど']);
assert.deepEqual(words('お茶を飲む'), ['お茶を', '飲む']);

// 3. The pieces always add back up to the line, punctuation and spaces included.
for (const line of ['えっと、それは ちょっと難しいかも……', 'iPhoneを3台買った！', '「はい」と言った']) {
  assert.equal(tokenizeText(line).map(t => t.value).join(''), line);
}

// 4. Kana counts for a kanji word; katakana and full-width fold; wrong kana does not.
const [kyou] = getWordTokens(tokenizeText('今日は晴れ'));
assert.equal(kyou.value, '今日は');
assert.ok(isInputCorrectFlexibleCase('今日は', kyou.value, kyou.reading));
assert.ok(isInputCorrectFlexibleCase('きょうは', kyou.value, kyou.reading));
assert.ok(isInputCorrectFlexibleCase('キョウハ', kyou.value, kyou.reading));
assert.ok(!isInputCorrectFlexibleCase('きのうは', kyou.value, kyou.reading));
const line = tokenizeText('コーヒーを飲みながら');
assert.ok(areAllWordsCorrectFlexibleCase(line, ['こーひーを', 'のみながら']));
assert.ok(!areAllWordsCorrectFlexibleCase(line, ['こーひーを', 'のむながら']));

// 5. AI cut points override the default grouping for that line only.
ja.setJaCuts([['やめとけって', [0]]]);
assert.deepEqual(words('やめとけって'), ['やめとけって']);
assert.deepEqual(words('提出しなければなりません'), ['提出', 'しなければなりません']);

// 6. The AI's answer: fragment indices → char offsets; a line breaking a rule is null.
{
  const lines = ['今日はいい天気ですね。', 'やめとけって', '明日'];
  assert.match(ja.segmentPrompt(lines), /0\t今日\n1\tは/);
  const out = ja.parseSegmentResponse('{"lines":[[0,2,3],[1,2],[0,9]]}', lines);
  assert.deepEqual(out, [[0, 3, 5], null, null]); // 今日は | いい | 天気ですね ; must start at 0 ; out of range
  assert.throws(() => ja.parseSegmentResponse('{"lines":[[0]]}', lines), /length/);
}

// 7. English is untouched.
assert.deepEqual(words("Don't stop, Mary."), ["Don't", 'stop', 'Mary']);
assert.ok(isInputCorrectFlexibleCase('mary', 'Mary'));
assert.ok(!isInputCorrectFlexibleCase('MARY', 'Mary'));

// --- what a clicked group is looked up as ---
for (const [group, lemma] of [['食べました', '食べる'], ['お茶を', 'お茶'], ['今日は', '今日'], ['行きたくない', '行く'],
  ['見ている', '見る'], ['美しかった', '美しい'], ['天気ですね', '天気'], ['日本人', '日本人'], ['です', 'です']]) {
  assert.equal(ja.jaLemma(group), lemma, group);
}

assert.equal(ja.jaKana('皆さん'), 'みなさん');
assert.equal(ja.jaKana('食べる'), 'たべる');

console.log('test-japanese: all checks passed');
