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
export interface Sense { pos: string; text: Seg[] }
export interface DictEntry { word: string; phonetic: string; senses: Sense[]; source: DictSource }

export const DICT_OPTIONS: Record<DictLang, DictSource[]> = {
  en: ['youdao', 'cambridge'],
  es: ['youdao', 'eudic'],
  fr: ['youdao', 'eudic'],
  de: ['youdao', 'eudic'],
};

const STORAGE_KEY = 'linguaclip_dict_choice';

export const getDictChoice = (): Record<DictLang, DictSource> => {
  const pick = { en: 'youdao', es: 'youdao', fr: 'youdao', de: 'youdao' } as Record<DictLang, DictSource>;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const lang of Object.keys(DICT_OPTIONS) as DictLang[]) {
      if (DICT_OPTIONS[lang].includes(stored?.[lang])) pick[lang] = stored[lang];
    }
  } catch { /* defaults */ }
  return pick;
};

export const saveDictChoice = (lang: DictLang, source: DictSource) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getDictChoice(), [lang]: source }));
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

// Youdao's jsonapi_s: `ec` for English, `fc` for French, `multle` for the rest.
export const parseYoudao = (body: any, word: string): DictEntry | null => {
  const w: YdWord | undefined = body?.ec?.word ?? body?.fc?.word?.[0] ?? body?.multle?.word?.[0];
  if (!w?.trs?.length) return null;
  const senses = w.trs
    .map(t => ({
      pos: clean(t.pos),
      text: clean(t.tran ?? (t.tr ?? []).flatMap(x => x.l?.i ?? []).join('；')),
    }))
    .filter(s => s.text && !/cop\s?yright/i.test(s.text))
    .map(s => ({ pos: s.pos, text: [s.text] }));
  if (senses.length === 0) return null;
  const rp = w['return-phrase'];
  const phonetic = w.usphone || w.ukphone || w.phone || '';
  return {
    word: (typeof rp === 'string' ? rp : rp?.l?.i) || word,
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
      if (en) senses.push({ pos, text: [zh ? `${en}\n${zh}` : en] });
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

// Text plus glyph images, in order; <br> becomes a line break.
const segs = (node: Node): Seg[] => {
  const out: Seg[] = [];
  const walk = (n: Node) => {
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

export const parseEudic = (html: string): DictEntry | null => {
  const doc = parseHtml(html);
  const body = doc.querySelector('#ExpFCchild');
  if (!body) return null;
  // Links (the conjugation hint), examples and the invisible watermark span go.
  body.querySelectorAll('script, a, [style], .eg').forEach(n => n.remove());
  const senses: Sense[] = [];
  let pos = '';
  for (const el of body.querySelectorAll('.cara, .exp')) {
    if (el.classList.contains('cara')) pos = clean(el.textContent);
    else {
      const text = segs(el);
      if (text.length) senses.push({ pos, text });
    }
  }
  // Some entries (many German nouns) are one run of text with no .exp.
  if (senses.length === 0) {
    const cara = body.querySelector('.cara');
    pos = clean(cara?.textContent);
    cara?.remove();
    const text = segs(body);
    if (text.length) senses.push({ pos, text });
  }
  if (senses.length === 0) return null;
  const head = doc.querySelector('#exp-head');
  return {
    word: clean(head?.querySelector('.word')?.textContent),
    phonetic: clean(head?.querySelector('.Phonitic')?.textContent),
    senses,
    source: 'eudic',
  };
};

const get = async (url: string): Promise<Response> => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
};

// null = the dictionary has no such word; throws when it cannot be reached.
export const lookupWord = async (word: string, lang: DictLang): Promise<DictEntry[] | null> => {
  const q = encodeURIComponent(word);
  const source = getDictChoice()[lang];
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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The Anki "definition" field: plain HTML, glyph images kept as <img>.
export const entriesToHtml = (entries: DictEntry[]): string =>
  entries.map(e => {
    const head = `<b>${esc(e.word)}</b>${e.phonetic ? ` ${esc(e.phonetic)}` : ''}`;
    const lines = e.senses.map(s => {
      const text = s.text.map(p => (typeof p === 'string' ? esc(p).replace(/\n/g, '<br/>') : `<img src="${p.img}">`)).join('');
      return `${s.pos ? `<i>${esc(s.pos)}</i> ` : ''}${text}`;
    });
    return [head, ...lines].join('<br/>');
  }).join('<br/><br/>');
