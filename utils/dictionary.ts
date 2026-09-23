import { fetch } from '@tauri-apps/plugin-http';

// Dictionary lookup without AI, after ODH (github.com/ninja33/ODH, MIT): the
// same public dictionary pages it reads, fetched through the http plugin (no
// CORS in the shell). Youdao has a JSON endpoint; Cambridge and Eudic are HTML
// and parsed here. None of these is an official API — a site redesign breaks
// its parser, and the caller falls back to AI when it can.

export type DictLang = 'en' | 'es' | 'fr' | 'de';
export type DictSource = 'youdao' | 'cambridge' | 'eudic';

// Eudic draws some Chinese characters as tiny images (anti-scraping), so a
// definition is text interleaved with those glyph images.
export type Seg = string | { img: string };
// One numbered meaning: what the user picks and sends to Anki on its own.
// phrase = the set phrase it belongs to (Eudic, e.g. "llegar a ser").
export interface Sense { pos: string; phrase?: string; text: Seg[]; examples: Seg[][] }
export interface DictEntry { word: string; phonetic: string; senses: Sense[]; source: DictSource }

// First option = the default. Youdao barely splits Spanish/French/German into
// meanings and has no examples there, so Eudic leads for those.
export const DICT_OPTIONS: Record<DictLang, DictSource[]> = {
  en: ['youdao', 'cambridge'],
  es: ['eudic', 'youdao'],
  fr: ['eudic', 'youdao'],
  de: ['eudic', 'youdao'],
};

const STORAGE_KEY = 'linguaclip_dict_choice';

const storedChoice = (): Record<string, unknown> => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

export const getDictChoice = (): Record<DictLang, DictSource> => {
  const stored = storedChoice();
  const pick = {} as Record<DictLang, DictSource>;
  for (const lang of Object.keys(DICT_OPTIONS) as DictLang[]) {
    const v = stored[lang] as DictSource;
    pick[lang] = DICT_OPTIONS[lang].includes(v) ? v : DICT_OPTIONS[lang][0];
  }
  return pick;
};

// Only the language the user touched is stored, so the others keep following
// the default.
export const saveDictChoice = (lang: DictLang, source: DictSource) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedChoice(), [lang]: source }));
};

// One word says little about its language (parler is also an English
// headword), so the whole subtitle file votes with its function words.
const STOPWORDS: Record<DictLang, string[]> = {
  en: ['the', 'and', 'is', 'you', 'to', 'of', 'it', 'that', 'what', 'this', 'have', 'with', 'are', 'was', 'i', 'my', "it's", "don't"],
  es: ['el', 'la', 'que', 'y', 'los', 'las', 'es', 'por', 'se', 'una', 'con', 'para', 'lo', 'qué', 'está', 'pero', 'yo', 'muy'],
  fr: ['le', 'la', 'les', 'et', 'est', 'que', 'je', 'vous', 'pas', 'une', 'des', 'du', 'il', 'ce', 'qui', "c'est", 'ne', 'mais'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ich', 'nicht', 'zu', 'ein', 'eine', 'sie', 'es', 'mit', 'den', 'dem', 'auf', 'wir', 'du'],
};

// null = a language with no dictionary here (Japanese, Chinese, …): spaceless
// scripts arrive as whole clauses anyway, which no dictionary can look up.
export const detectLang = (texts: string[]): DictLang | null => {
  const words = texts.join(' ').toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}']+/gu) ?? [];
  if (words.length === 0) return null;
  const latin = words.filter(w => /^[\p{Script=Latin}']+$/u.test(w)).length;
  if (latin / words.length < 0.8) return null;
  let best: DictLang | null = null;
  let bestScore = 0;
  for (const lang of Object.keys(STOPWORDS) as DictLang[]) {
    const set = new Set(STOPWORDS[lang]);
    const score = words.filter(w => set.has(w)).length;
    if (score > bestScore) { best = lang; bestScore = score; }
  }
  // ponytail: a few subtitle lines can tie or barely score; fine for whole files.
  return bestScore >= 3 ? best : null;
};

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

type YdTr = { l?: { i?: string[] | string } };
type YdWord = { phone?: string; usphone?: string; ukphone?: string; 'return-phrase'?: string | { l?: { i?: string } }; trs?: { pos?: string; tran?: string; tr?: YdTr[] }[] };
type YdCollins = { headword?: string; entries?: { entry?: { tran_entry?: { pos_entry?: { pos?: string }; tran?: string; exam_sents?: { sent?: { eng_sent?: string; chn_sent?: string }[] } }[] }[] } };

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
const stripTags = (s: string) => clean(s.replace(/<[^>]+>/g, ''));

// Collins EN-CN inside the Youdao JSON: one meaning per entry, English
// explanation then its Chinese, with examples.
const collinsSenses = (list: YdCollins[] | undefined): Sense[] =>
  (list ?? []).flatMap(c => c.entries?.entry ?? []).flatMap(x => x.tran_entry ?? []).flatMap(t => {
    const tran = stripTags(t.tran ?? '');
    if (!tran) return [];
    const i = tran.search(CJK);
    const en = i < 0 ? tran : tran.slice(0, i).trim();
    const zh = i < 0 ? '' : tran.slice(i).trim();
    const examples = (t.exam_sents?.sent ?? [])
      .filter(e => e.eng_sent)
      .map(e => [clean(e.eng_sent) + (e.chn_sent ? `\n${clean(e.chn_sent)}` : '')]);
    return [{ pos: clean(t.pos_entry?.pos), text: [zh ? `${en}\n${zh}` : en], examples }];
  });

// Youdao's jsonapi_s: `ec` for English (Collins preferred unless it is a lone
// example-less stub like "past tense of go"), `fc` for French, `multle` for the rest.
export const parseYoudao = (body: any, word: string): DictEntry | null => {
  const w: YdWord | undefined = body?.ec?.word ?? body?.fc?.word?.[0] ?? body?.multle?.word?.[0];
  const collins = collinsSenses(body?.collins?.collins_entries);
  const useCollins = collins.length >= 2 || collins.some(s => s.examples.length > 0);
  const senses: Sense[] = useCollins ? collins : (w?.trs ?? [])
    .map(t => ({
      pos: clean(t.pos),
      text: clean(t.tran ?? (t.tr ?? []).flatMap(x => x.l?.i ?? []).join('；')),
    }))
    .filter(s => s.text && !/cop\s?yright/i.test(s.text))
    .map(s => ({ pos: s.pos, text: [s.text], examples: [] }));
  if (senses.length === 0) return null;
  const rp = w?.['return-phrase'];
  const phonetic = w?.usphone || w?.ukphone || w?.phone || '';
  const headword = useCollins ? body.collins.collins_entries[0]?.headword : undefined;
  return {
    word: headword || (typeof rp === 'string' ? rp : rp?.l?.i) || word,
    phonetic: phonetic ? `/${phonetic}/` : '',
    senses,
    source: 'youdao',
  };
};

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');

export const parseCambridge = (html: string, word: string): DictEntry | null => {
  const doc = parseHtml(html);
  const entries = [...doc.querySelectorAll('.pr .entry-body__el')];
  const senses: Sense[] = [];
  for (const entry of entries) {
    const pos = clean(entry.querySelector('.posgram')?.textContent);
    for (const block of entry.querySelectorAll('.def-block')) {
      const en = clean(block.querySelector('.ddef_h .def')?.textContent).replace(/:$/, '');
      const zh = clean(block.querySelector('.def-body > .trans')?.textContent);
      const examples = [...block.querySelectorAll('.def-body .examp')].map(x => {
        const eg = clean(x.querySelector('.eg')?.textContent);
        const tr = clean(x.querySelector('.trans')?.textContent);
        return [tr ? `${eg}\n${tr}` : eg];
      }).filter(x => x[0]);
      if (en) senses.push({ pos, text: [zh ? `${en}\n${zh}` : en], examples });
    }
  }
  if (senses.length === 0) return null;
  const first = entries[0];
  const ipa = clean(first?.querySelector('.us .ipa')?.textContent || first?.querySelector('.ipa')?.textContent);
  return { word: clean(first?.querySelector('.headword')?.textContent) || word, phonetic: ipa ? `/${ipa}/` : '', senses, source: 'cambridge' };
};

const EUDIC_HOST: Record<Exclude<DictLang, 'en'>, string> = {
  es: 'https://www.esdict.cn',
  fr: 'https://www.frdic.com',
  de: 'https://www.godic.net',
};
const GLYPH = /^https:\/\/www\.(esdict\.cn|frdic\.com|godic\.net)\/tmp\/wordimg\/[\w@=.-]+$/;

type EudicTerm = { value?: string; recordid?: string | null; recordtype?: string | null; iscghint?: boolean };

// The prefix list mixes the word itself, its lemma (for a conjugated form) and
// unrelated completions; keep only the first two kinds.
export const pickEudicTerms = (terms: EudicTerm[], word: string): EudicTerm[] => {
  const lower = word.toLowerCase();
  const exact = terms.filter(t => t.recordid && t.recordtype !== 'CG' && t.value?.toLowerCase() === lower);
  const lemma = terms.filter(t => t.recordid && t.recordtype === 'Dict' && t.iscghint);
  return [...exact, ...lemma].filter((t, i, all) => all.findIndex(x => x.recordid === t.recordid) === i).slice(0, 2);
};

// Text plus glyph images, in order; <br> becomes a line break. Descendants
// matching `skip` (examples nested in a meaning) are left to their own pass.
const segs = (node: Node, skip?: string): Seg[] => {
  const out: Seg[] = [];
  const walk = (n: Node) => {
    if (skip && n !== node && n instanceof Element && n.matches(skip)) return;
    if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent ?? '');
    else if (n instanceof Element && n.tagName === 'BR') out.push('\n');
    else if (n instanceof Element && n.tagName === 'IMG') {
      const src = n.getAttribute('src') ?? '';
      if (GLYPH.test(src)) out.push({ img: src });
    } else n.childNodes.forEach(walk);
  };
  walk(node);
  // Trim the run's ends; inner whitespace collapsed per text piece.
  const merged = out
    .map(s => (typeof s === 'string' && s !== '\n' ? s.replace(/\s+/g, ' ') : s))
    .filter((s, i, all) => !(s === '\n' && all[i - 1] === '\n'));
  while (typeof merged[0] === 'string' && !(merged[0] as string).trim()) merged.shift();
  while (typeof merged[merged.length - 1] === 'string' && !(merged[merged.length - 1] as string).trim()) merged.pop();
  return merged;
};

const lineText = (line: Seg[]) => line.map(p => (typeof p === 'string' ? p : '□')).join('');
const hasCjk = (line: Seg[]) => line.some(p => typeof p !== 'string' || CJK.test(p));

// Seg run -> lines, split at <br>.
const splitLines = (run: Seg[]): Seg[][] => {
  const lines: Seg[][] = [[]];
  for (const p of run) {
    if (p === '\n') lines.push([]);
    else lines[lines.length - 1].push(p);
  }
  return lines
    .map(l => l.map((p, i) => (typeof p !== 'string' ? p : i === 0 ? p.trimStart() : i === l.length - 1 ? p.trimEnd() : p)))
    .filter(l => lineText(l).trim());
};

// "1. 移近. <br>2. 聚拢" is two meanings; an unnumbered line continues the last.
const NUMBERED = /^\s*(\d+\s*\.|[①-⑳]|[⑴-⒇])/;
const groupSenses = (lines: Seg[][]): Seg[][] => {
  const groups: Seg[][] = [];
  for (const line of lines) {
    if (groups.length === 0 || NUMBERED.test(lineText(line))) groups.push([...line]);
    else groups[groups.length - 1].push('\n', ...line);
  }
  return groups;
};

// "~" stands for the headword in Eudic's phrases and examples.
const tilde = (line: Seg[], word: string): Seg[] =>
  line.map(p => (typeof p === 'string' && word ? p.replace(/~/g, word) : p));

export const parseEudic = (html: string): DictEntry | null => {
  const doc = parseHtml(html);
  const body = doc.querySelector('#ExpFCchild');
  if (!body) return null;
  const head = doc.querySelector('#exp-head');
  const word = clean(head?.querySelector('.word')?.textContent);
  // Links (the conjugation hint) and the invisible watermark span go.
  body.querySelectorAll('script, a, [style]').forEach(n => n.remove());
  const senses: Sense[] = [];
  let pos = '';
  let phrase = '';
  for (const el of body.querySelectorAll('.cara, .exp, .eg, [id="phrase"]')) {
    if (el.classList.contains('cara')) { pos = clean(el.textContent); phrase = ''; }
    else if (el.id === 'phrase') phrase = clean(el.textContent).replace(/~/g, word);
    else if (el.classList.contains('exp')) {
      for (const text of groupSenses(splitLines(segs(el, '.exp, .eg')))) {
        // A set phrase is listed after the last part of speech but is not one.
        senses.push(phrase ? { pos: '', phrase, text, examples: [] } : { pos, text, examples: [] });
      }
      // A phrase holds until the next phrase or part of speech: it can have
      // several numbered meanings, each its own .exp.
    } else {
      const last = senses[senses.length - 1];
      if (!last) continue;
      for (const line of splitLines(segs(el)).map(l => tilde(l, word))) {
        // German gives the sentence and its Chinese as two .eg; rejoin them.
        const prev = last.examples[last.examples.length - 1];
        if (prev && !hasCjk(prev) && hasCjk(line)) prev.push('\n', ...line);
        else last.examples.push(line);
      }
    }
  }
  // Some entries (many German nouns) are one run of text with no .exp.
  if (senses.length === 0) {
    const cara = body.querySelector('.cara');
    pos = clean(cara?.textContent);
    cara?.remove();
    body.querySelectorAll('.eg').forEach(n => n.remove());
    const groups = groupSenses(splitLines(segs(body)));
    // An unnumbered first line before numbered ones is grammar ("..-er"), not a meaning.
    if (groups.length > 1 && !NUMBERED.test(lineText(groups[0]))) pos = clean(`${pos} ${lineText(groups.shift()!)}`);
    for (const text of groups) senses.push({ pos, text, examples: [] });
  }
  if (senses.length === 0) return null;
  return { word, phonetic: clean(head?.querySelector('.Phonitic')?.textContent), senses, source: 'eudic' };
};

const get = async (url: string): Promise<Response> => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
};

const fromSource = async (source: DictSource, word: string, lang: DictLang): Promise<DictEntry[] | null> => {
  const q = encodeURIComponent(word);
  if (source === 'cambridge') {
    const html = await (await get(`https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${q}`)).text();
    const entry = parseCambridge(html, word);
    return entry ? [entry] : null;
  }
  if (source === 'eudic' && lang !== 'en') {
    const host = EUDIC_HOST[lang];
    const terms = pickEudicTerms(await (await get(`${host}/dicts/prefix/${q}`)).json(), word);
    const pages = await Promise.all(terms.map(async t =>
      parseEudic(await (await get(`${host}/dicts/${lang}/${encodeURIComponent(t.value!)}?recordid=${t.recordid}`)).text())));
    const found = pages.filter((p): p is DictEntry => !!p);
    return found.length ? found : null;
  }
  const body = await (await get(`https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4&le=${lang}&q=${q}`)).json();
  const entry = parseYoudao(body, word);
  return entry ? [entry] : null;
};

// null = the dictionary has no such word; throws when it cannot be reached.
// Cambridge sits behind a bot check that turns requests away now and then, so
// an unreachable Cambridge or Eudic falls back to Youdao for that lookup.
export const lookupWord = async (word: string, lang: DictLang): Promise<DictEntry[] | null> => {
  const source = getDictChoice()[lang];
  try {
    return await fromSource(source, word, lang);
  } catch (e) {
    if (source === 'youdao') throw e;
    console.warn(`Dictionary ${source} unreachable, using Youdao:`, e);
    return fromSource('youdao', word, lang);
  }
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const segsToHtml = (line: Seg[]) =>
  line.map(p => (typeof p === 'string' ? esc(p).replace(/\n/g, '<br/>') : `<img src="${p.img}">`)).join('');

// One meaning as Anki fields: the definition (headword, pos, set phrase and
// meaning) and its first two examples. Glyph images stay as <img>.
export const senseToAnki = (entry: DictEntry, sense: Sense): { definition: string; example: string } => {
  const head = `<b>${esc(entry.word)}</b>${entry.phonetic ? ` ${esc(entry.phonetic)}` : ''}`;
  const meaning = [
    sense.pos && `<i>${esc(sense.pos)}</i>`,
    sense.phrase && `<b>${esc(sense.phrase)}</b>`,
    segsToHtml(sense.text),
  ].filter(Boolean).join(' ');
  return {
    definition: `${head}<br/>${meaning}`,
    example: sense.examples.slice(0, 2).map(segsToHtml).join('<br/><br/>'),
  };
};

// Every meaning across the entries, numbered from 1, as plain text for the AI
// to pick from (glyph images read as □, so the first example helps it).
export const senseList = (entries: DictEntry[]): { entry: number; sense: number; line: string }[] => {
  const out: { entry: number; sense: number; line: string }[] = [];
  entries.forEach((e, entry) => e.senses.forEach((s, sense) => {
    const text = [e.word, s.pos, s.phrase, lineText(s.text).replace(/\n/g, ' ')].filter(Boolean).join(' | ');
    const eg = s.examples[0] ? ` e.g. ${lineText(s.examples[0]).split('\n')[0]}` : '';
    out.push({ entry, sense, line: `${out.length + 1}. ${text}${eg}` });
  }));
  return out;
};
