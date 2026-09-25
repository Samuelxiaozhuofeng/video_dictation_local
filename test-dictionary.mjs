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
const { detectLang, parseYoudao, parseYoudaoJa, pickEudicTerms, senseToAnki, senseList, getDictChoice, saveDictChoice } = await import(out);

// --- language of a whole subtitle file ---
assert.equal(detectLang(["All right, what's the plan?", 'I think we should go to the station and wait.', 'It is what it is.']), 'en');
assert.equal(detectLang(['Quiero hablar contigo mañana por la tarde.', '¿Qué está pasando con los niños?', 'Pero no es muy tarde.']), 'es');
assert.equal(detectLang(["Je voudrais parler avec vous, c'est important.", 'Il ne sait pas ce qui se passe.', 'Les enfants sont à la maison.']), 'fr');
assert.equal(detectLang(['Ich möchte morgen mit dir sprechen.', 'Das ist nicht so einfach, und wir wissen es.', 'Die Straße ist groß.']), 'de');
assert.equal(detectLang(['明日あなたと話したいです', 'それはいいですね']), 'ja', 'Japanese is told by its kana');
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
assert.deepEqual(sprach.senses[0], { pos: '', text: ['sprechen的过去时直陈式 (强变化动词)'], examples: [] });
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

// --- Youdao English: Collins (meanings with examples) beats the concise list ---
const collinsEntry = (tran, sents) => ({ tran_entry: [{ pos_entry: { pos: 'V-I' }, tran, exam_sents: sents && { sent: sents } }] });
const looked = parseYoudao({
  ec: { word: { usphone: 'lʊk', 'return-phrase': 'looked', trs: [{ pos: 'v.', tran: '看' }] } },
  collins: { collins_entries: [{ headword: 'look', entries: { entry: [
    collinsEntry('If you <b>look</b> in a direction, you direct your eyes there. 看', [{ eng_sent: 'I looked down the hallway.', chn_sent: '我沿着走廊看过去。' }, { eng_sent: 'Look!', chn_sent: '看！' }, { eng_sent: 'Third.', chn_sent: '第三。' }]),
    collinsEntry('You use <b>look</b> when describing appearance. （表示外观）看上去'),
  ] } }] },
}, 'looked');
assert.equal(looked.word, 'look');
assert.equal(looked.phonetic, '/lʊk/');
assert.equal(looked.senses.length, 2);
assert.deepEqual(looked.senses[0].text, ['If you look in a direction, you direct your eyes there.\n看']);
assert.deepEqual(looked.senses[1].text, ['You use look when describing appearance.\n（表示外观）看上去'], 'a fullwidth bracket starts the Chinese');
assert.deepEqual(looked.senses[0].examples[0], ['I looked down the hallway.\n我沿着走廊看过去。']);
assert.deepEqual(looked.senses[1].examples, []);
// A lone "past tense of" stub is not worth more than the concise list.
const went = parseYoudao({
  ec: { word: { 'return-phrase': 'went', trs: [{ pos: 'v.', tran: '去（go 的过去式）' }, { pos: 'n.', tran: '人名' }] } },
  collins: { collins_entries: [{ headword: 'went', entries: { entry: [collinsEntry('<b>Went</b> is the past tense of . (go)的过去式')] } }] },
}, 'went');
assert.deepEqual(went.senses.map(s => s.text[0]), ['去（go 的过去式）', '人名']);
// One real meaning with examples is still worth taking.
const llama = parseYoudao({
  ec: { word: { 'return-phrase': 'llama', trs: [{ pos: 'n.', tran: '美洲驼' }] } },
  collins: { collins_entries: [{ headword: 'llama', entries: { entry: [collinsEntry('A <b>llama</b> is a South American animal. 美洲驼', [{ eng_sent: 'A llama spat.', chn_sent: '一只美洲驼吐了口水。' }])] } }] },
}, 'llama');
assert.equal(llama.senses.length, 1);
assert.deepEqual(llama.senses[0].examples, [['A llama spat.\n一只美洲驼吐了口水。']]);

// --- One meaning as Anki fields: escaped, glyph images kept, two examples ---
const img = { img: 'https://www.esdict.cn/tmp/wordimg/q.png' };
const entry = { word: 'a<b', phonetic: '/x/', source: 'eudic', senses: [
  { pos: 'intr.', phrase: 'llegar a ser', text: ['6. 实现，', img, '：'], examples: [['Llegó el armisticio. 停战了.'], ['No llegó. ', img], ['third']] },
  { pos: 'tr.', text: ['1. 移近.'], examples: [] },
] };
assert.deepEqual(senseToAnki(entry, entry.senses[0]), {
  definition: '<b>a&lt;b</b> /x/<br/><i>intr.</i> <b>llegar a ser</b> 6. 实现，<img src="https://www.esdict.cn/tmp/wordimg/q.png">：',
  example: 'Llegó el armisticio. 停战了.<br/><br/>No llegó. <img src="https://www.esdict.cn/tmp/wordimg/q.png">',
});
assert.deepEqual(senseToAnki(entry, entry.senses[1]), { definition: '<b>a&lt;b</b> /x/<br/><i>tr.</i> 1. 移近.', example: '' });

// --- The list the AI picks from: numbered across entries, back to (entry, sense) ---
const list = senseList([entry, { word: 'casar', phonetic: '', source: 'eudic', senses: [{ pos: 'tr.', text: ['娶'], examples: [['Se casó. 结婚了.\n']] }] }]);
assert.deepEqual(list.map(x => [x.entry, x.sense]), [[0, 0], [0, 1], [1, 0]]);
assert.equal(list[0].line, '1. a<b | intr. | llegar a ser | 6. 实现，□： e.g. Llegó el armisticio. 停战了.');
assert.equal(list[2].line, '3. casar | tr. | 娶 e.g. Se casó. 结婚了.');

// --- Dictionary choice: Eudic by default for es/fr/de; only the touched language is stored ---
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
assert.deepEqual(getDictChoice(), { en: 'youdao', es: 'eudic', fr: 'eudic', de: 'eudic', ja: 'youdao' });
saveDictChoice('en', 'cambridge');
assert.deepEqual(JSON.parse(store.get('linguaclip_dict_choice')), { en: 'cambridge' });
saveDictChoice('fr', 'youdao');
assert.deepEqual(getDictChoice(), { en: 'cambridge', es: 'eudic', fr: 'youdao', de: 'eudic', ja: 'youdao' });
store.set('linguaclip_dict_choice', '{"es":"cambridge"}');
assert.equal(getDictChoice().es, 'eudic', 'a source the language does not offer falls back');

console.log('test-dictionary: all passed');

// --- Youdao: Japanese `newjc` (kanji query, then a kana query whose real entry is in homonymD) ---
const taberu = parseYoudaoJa({"newjc": {"word": {"head": {"pjm": "たべる", "tone": "②", "hw": "食べる"}, "sense": [{"phrList": [{"jmsyT": "飲食物をいただく。", "ljT": ["你是吃年糕，还是吃面食?", "吃不愁，穿不愁。"], "jmsy": "吃。", "lj": ["君は‘饼’を食べるか，それともめん類を食べるか？", "食べることにも，着ることにも心配したことがない。"]}, {"jmsyT": "生計を立てる。", "ljT": ["靠利息生活。", "连饭都吃不上的生活。"], "jmsy": "生活。", "lj": ["金利で食べるべている", "食べる物にも事欠く生活。"]}], "cx": "他动词・一段/二类"}]}}});
assert.equal(taberu.length, 1);
assert.equal(taberu[0].word, '食べる');
assert.equal(taberu[0].phonetic, 'たべる ②');
assert.equal(taberu[0].senses[0].pos, '他动词・一段/二类');
assert.equal(taberu[0].senses[0].text[0], '吃。\n飲食物をいただく。');
assert.match(taberu[0].senses[0].examples[0][0], /^君は.*食べるか.*\n你是吃/);
const kana = parseYoudaoJa({"newjc": {"word": {"head": {"pjm": "たべる", "hw": "たべる"}, "homonymD": [{"head": {"pjm": "たべる", "tone": "②", "hw": "食べる"}, "sense": [{"phrList": [{"jmsyT": "飲食物をいただく。", "ljT": ["你们吃什么?我们要一斤水饺", "生鱼片你吃得来能吃吗?没问题"], "jmsy": "吃。", "lj": ["何を食べますか――水餃子を1斤お願いします", "刺身は食べられますか――大丈夫です"]}, {"jmsyT": "生計を立てる。", "ljT": ["到了三十岁才不为生活操心了", "靠工资维持生活"], "jmsy": "生活。", "lj": ["30歳になってようやく食べていけるようになった", "月給でたべる"]}], "cx": "他动词・一段/二类"}]}], "sense": [{"phrList": [{"ljT": ["你应该吃这里的菜。", "你喜欢在外面吃还是在家吃?"], "jmsy": " 吃", "lj": ["ここの料理をたべるべきだ。", "外食と家でたべるのとどちらが好きですか。"]}]}, {"phrList": [{"jmsy": " 生活"}]}]}}});
assert.deepEqual(kana.map(e => e.word), ['食べる'], 'kana stub gives way to its real entry');
assert.equal(parseYoudaoJa({}), null);
assert.equal(parseYoudaoJa({ newjc: { word: { head: { hw: 'x' }, sense: [] } } }), null);

console.log('japanese dictionary ok');
