/**
 * Checks the dictionary helpers in utils/dictionary.ts: which language a
 * subtitle file is in, Youdao's three JSON shapes, and which Eudic entries are
 * worth opening. Fixtures are trimmed real responses (2026-09-23).
 * Run with: node test-dictionary.mjs
 *
 * Bundles the real module rather than re-typing the logic.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `dictionary-${process.pid}.mjs`);
await build({ entryPoints: ['utils/dictionary.ts'], bundle: true, format: 'esm', outfile: out });
const { detectLang, parseYoudao, pickEudicTerms, entriesToHtml } = await import(out);

// --- language of a whole subtitle file ---
assert.equal(detectLang(["All right, what's the plan?", 'I think we should go to the station and wait.', 'It is what it is.']), 'en');
assert.equal(detectLang(['Quiero hablar contigo mañana por la tarde.', '¿Qué está pasando con los niños?', 'Pero no es muy tarde.']), 'es');
assert.equal(detectLang(["Je voudrais parler avec vous, c'est important.", 'Il ne sait pas ce qui se passe.', 'Les enfants sont à la maison.']), 'fr');
assert.equal(detectLang(['Ich möchte morgen mit dir sprechen.', 'Das ist nicht so einfach, und wir wissen es.', 'Die Straße ist groß.']), 'de');
assert.equal(detectLang(['明日あなたと話したいです', 'それはいいですね']), null, 'Japanese has no dictionary here');
assert.equal(detectLang(['我们明天见', '今天天气很好']), null);
assert.equal(detectLang(['Hello']), null, 'too little to tell');
assert.equal(detectLang([]), null);

// --- Youdao: English `ec` ---
const running = parseYoudao({ ec: { word: {
  usphone: 'ˈrʌnɪŋ', ukphone: 'ˈrʌnɪŋ', 'return-phrase': 'running', prototype: 'run',
  trs: [{ pos: 'n.', tran: '跑步，赛跑' }, { pos: 'v.', tran: '跑；运转（run的现在分词形式）' }, { tran: '【名】 （Running）（英）朗宁（人名）' }],
} } }, 'running');
assert.equal(running.word, 'running');
assert.equal(running.phonetic, '/ˈrʌnɪŋ/');
assert.equal(running.source, 'youdao');
assert.deepEqual(running.senses.map(s => s.pos), ['n.', 'v.', '']);
assert.deepEqual(running.senses[1].text, ['跑；运转（run的现在分词形式）']);

// --- Youdao: French `fc` (lemma comes back for a conjugated form) ---
const parlons = parseYoudao({ fc: { word: [{
  phone: 'parle', 'return-phrase': { l: { i: 'parler' } },
  trs: [{ pos: 'v.i.', tr: [{ l: { i: ['讲话，谈话'] } }] }, { pos: 'v.t.', tr: [{ l: { i: ['说，讲(某种语言)；谈论'] } }] }],
}] } }, 'parlons');
assert.equal(parlons.word, 'parler');
assert.equal(parlons.phonetic, '/parle/');
assert.deepEqual(parlons.senses.map(s => s.text[0]), ['讲话，谈话', '说，讲(某种语言)；谈论']);

// --- Youdao: Spanish / German `multle`, with its junk line dropped ---
const sprach = parseYoudao({ multle: { word: [{
  'return-phrase': { l: { i: 'sprach' } },
  trs: [{ tr: [{ l: { i: ['sprechen的过去时直陈式 (强变化动词) \n'] } }] }, { tr: [{ l: { i: ['Fr helper cop yright\n'] } }] }],
}] } }, 'sprach');
assert.equal(sprach.senses.length, 1);
assert.deepEqual(sprach.senses[0], { pos: '', text: ['sprechen的过去时直陈式 (强变化动词)'] });
assert.equal(sprach.phonetic, '');

// --- Youdao: nothing found (wrong language, typo) ---
assert.equal(parseYoudao({ web_trans: {}, typos: {} }, 'qwzxv'), null);
assert.equal(parseYoudao({ multle: { word: [{ trs: [] }] } }, 'x'), null);
assert.equal(parseYoudao(null, 'x'), null);

// --- Eudic: the word itself and its lemma, never prefix completions ---
const parle = [
  { value: 'parole', iscghint: false, recordtype: null, recordid: 'A' },
  { value: 'parlé', iscghint: false, recordtype: null, recordid: 'B' },
  { value: 'parler', iscghint: true, recordtype: 'Dict', recordid: 'C' },
  { value: 'parle', iscghint: true, recordtype: 'CG', recordid: 'C' },
];
assert.deepEqual(pickEudicTerms(parle, 'parle').map(t => t.value), ['parler']);
const casa = [
  { value: 'casa', iscghint: false, recordtype: null, recordid: 'A' },
  { value: 'casar', iscghint: true, recordtype: 'Dict', recordid: 'B' },
  { value: 'casa', iscghint: true, recordtype: 'CG', recordid: 'B' },
  { value: 'carcasa', iscghint: false, recordtype: null, recordid: 'C' },
];
assert.deepEqual(pickEudicTerms(casa, 'casa').map(t => t.value), ['casa', 'casar']);
assert.deepEqual(pickEudicTerms([{ value: 'Haus', recordtype: null, recordid: 'A' }], 'haus').map(t => t.value), ['Haus']);
assert.deepEqual(pickEudicTerms([{ value: 'hablo contigo', recordid: null }], 'hablo'), []);

// --- Anki field: escaped text, glyph images kept ---
const html = entriesToHtml([{ word: 'a<b', phonetic: '/x/', source: 'eudic', senses: [{ pos: 'v.', text: ['说', { img: 'https://www.esdict.cn/tmp/wordimg/q.png' }, '\n2.讲'] }] }]);
assert.equal(html, '<b>a&lt;b</b> /x/<br/><i>v.</i> 说<img src="https://www.esdict.cn/tmp/wordimg/q.png"><br/>2.讲');

console.log('test-dictionary: all passed');
