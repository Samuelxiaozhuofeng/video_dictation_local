/**
 * In-app review: the sentence deck and the word deck, scheduled with FSRS.
 *
 * Cards live in their own IndexedDB database (`linguaclip_review`) so the
 * practice records' database (and its DB_VERSION) is never touched. Each card
 * carries its own copy of the line, its times and the video path, so it
 * outlives the video record it came from.
 *
 * Grading is automatic, from how the dictation went: nobody rates themselves.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { parseSRT } from './srtParser';
import { getAllVideosFromDB, getVideoFromDB } from './fileSystemAccess';
import type { SavedLine } from '../types';

export type Deck = 'line' | 'word';
export type Reason = 'wrong' | 'peek' | 'breakdown' | 'blur' | 'saved' | 'lookup';

type Stored<T> = { [K in keyof T]: T[K] extends Date ? number : T[K] extends Date | undefined ? number | undefined : T[K] };

export interface ReviewCard {
  id: string;
  deck: Deck;
  videoId: string;       // '' for an old bookmark that matched no video
  videoName: string;
  videoPath?: string;    // snapshot; the video record's current path wins at review time
  text: string;          // the subtitle line
  start: number;         // seconds; -1 = no audio (unmatched old bookmark)
  end: number;
  word?: string;         // word deck only
  definition?: string;
  example?: string;
  reasons: Reason[];
  saved: boolean;        // bookmarked by hand
  fsrs: Stored<Card>;
  createdAt: number;
}

// How a dictation went. `helped` = peeked or replayed from a word.
export interface Outcome { correct: boolean; helped: boolean }

export const SESSION_SIZE = 15;

// Intervals in whole days: no minute-level steps, so finishing a round never
// leaves "due now" cards behind on the home screen.
const scheduler = fsrs({ enable_fuzz: true, enable_short_term: false });

export const gradeOf = (o: Outcome): Grade => (!o.correct ? Rating.Again : o.helped ? Rating.Hard : Rating.Good);

const toStored = (c: Card): Stored<Card> => ({ ...c, due: +c.due, last_review: c.last_review ? +c.last_review : undefined });
const fromStored = (c: Stored<Card>): Card => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });

export const lineCardId = (videoId: string, start: number) => `${videoId}|${start.toFixed(2)}`;
export const wordCardId = (videoId: string, start: number, word: string) => `${lineCardId(videoId, start)}|w|${word.toLowerCase()}`;

export const hasAudio = (c: ReviewCard) => c.start >= 0 && !!c.videoId;

// --- Pure scheduling (checked by test-review.mjs) ---

export const newCard = (base: Omit<ReviewCard, 'fsrs' | 'createdAt' | 'reasons' | 'saved'>, reason: Reason, now = Date.now()): ReviewCard => ({
  ...base,
  reasons: [reason],
  saved: reason === 'saved',
  fsrs: toStored(createEmptyCard(new Date(now))),
  createdAt: now,
});

// Meeting a card again while practising only notes why; it never resets the schedule.
export const withReason = (card: ReviewCard, reason: Reason): ReviewCard => ({
  ...card,
  reasons: card.reasons.includes(reason) ? card.reasons : [...card.reasons, reason],
  saved: card.saved || reason === 'saved',
});

export const schedule = (card: ReviewCard, o: Outcome, now = Date.now()): ReviewCard => ({
  ...card,
  fsrs: toStored(scheduler.next(fromStored(card.fsrs), new Date(now), gradeOf(o)).card),
});

export const isDue = (c: ReviewCard, now = Date.now()) => hasAudio(c) && c.fsrs.due <= now;

export const dueQueue = (cards: ReviewCard[], deck: Deck, now = Date.now(), limit = SESSION_SIZE) =>
  cards.filter(c => c.deck === deck && isDue(c, now)).sort((a, b) => a.fsrs.due - b.fsrs.due).slice(0, limit);

export const isNew = (c: ReviewCard) => c.fsrs.state === State.New;

// Which word to blank in a word card: the first token equal to it, ignoring case and punctuation.
export const wordIndexIn = (words: string[], word: string): number => {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, '');
  const i = words.findIndex(w => norm(w) === norm(word));
  return i < 0 ? 0 : i;
};

// Old bookmark (text + file name + mm:ss) → the line it came from, or null.
export const matchLegacy = (
  line: { text: string; videoName?: string; timeDisplay: string },
  records: { id: string; videoFileName: string; displayName: string; videoPath?: string; subtitleText?: string }[],
) => {
  const [m, s] = line.timeDisplay.split(':').map(Number);
  const at = (m || 0) * 60 + (s || 0);
  let best: { record: typeof records[number]; start: number; end: number; gap: number } | null = null;
  for (const record of records) {
    if (record.videoFileName !== line.videoName || !record.subtitleText) continue;
    for (const sub of parseSRT(record.subtitleText)) {
      if (sub.text !== line.text) continue;
      const gap = Math.abs(sub.startTime - at);
      if (!best || gap < best.gap) best = { record, start: sub.startTime, end: sub.endTime, gap };
    }
  }
  return best;
};

// --- Storage ---

const DB_NAME = 'linguaclip_review';
const STORE = 'cards';
const META = 'meta'; // { id: 'migrated' } once the old bookmarks are in, written in the same transaction
let dbp: Promise<IDBDatabase> | null = null;

const db = () => dbp ??= new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    for (const name of [STORE, META]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => { dbp = null; reject(req.error ?? new Error('Failed to open review database')); };
});

// Every read and write waits for the old-bookmark move, so a card written while
// it runs can't be overwritten by it (or overwrite it). A failed move doesn't block.
const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  await migrateSavedLines().catch(console.error);
  const t = (await db()).transaction(STORE, mode);
  const req = run(t.objectStore(STORE));
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = t.onabort = () => reject(t.error ?? new Error('Review database write failed'));
  });
};

const listeners = new Set<() => void>();
export const subscribeCards = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const changed = () => listeners.forEach(fn => fn());

export const getAllCards = async (): Promise<ReviewCard[]> => (await tx<ReviewCard[]>('readonly', s => s.getAll())) ?? [];
const getCard = async (id: string) => (await tx<ReviewCard>('readonly', s => s.get(id))) ?? null;
const putCards = async (cards: ReviewCard[]) => { await tx('readwrite', s => { cards.forEach(c => s.put(c)); }); changed(); };
export const putCard = (card: ReviewCard) => putCards([card]);
export const deleteCard = async (id: string) => { await tx('readwrite', s => s.delete(id)); changed(); };

export interface LineRef { videoId: string; videoName: string; videoPath?: string; text: string; start: number; end: number }

// The card keeps its own copy of the video path, so it still plays after the record is deleted.
const withPath = async (ref: LineRef): Promise<LineRef> =>
  ref.videoPath ? ref : { ...ref, videoPath: (await getVideoFromDB(ref.videoId).catch(() => null))?.videoPath };

// A line the learner got stuck on (or bookmarked). Creates the card or just adds the reason.
export const addLine = async (ref: LineRef, reason: Reason) => {
  if (!ref.videoId) return;
  const id = lineCardId(ref.videoId, ref.start);
  const [old, full] = await Promise.all([getCard(id), withPath(ref)]);
  await putCard(old ? withReason({ ...old, videoPath: full.videoPath ?? old.videoPath }, reason) : newCard({ id, deck: 'line', ...full }, reason));
};

export const addWord = async (ref: LineRef, word: string, definition: string, example: string) => {
  if (!ref.videoId || !word) return;
  const id = wordCardId(ref.videoId, ref.start, word);
  const [old, full] = await Promise.all([getCard(id), withPath(ref)]);
  await putCard(old ? { ...old, definition, example } : newCard({ id, deck: 'word', ...full, word, definition, example }, 'lookup'));
};

export const hasWord = async (videoId: string, start: number, word: string) => !!(await getCard(wordCardId(videoId, start, word)));

// Un-bookmark: a card that is only a bookmark goes; a line you also got stuck on stays.
export const unsaveLine = async (videoId: string, start: number) => {
  const old = await getCard(lineCardId(videoId, start));
  if (!old) return;
  const reasons = old.reasons.filter(r => r !== 'saved');
  if (reasons.length === 0) await deleteCard(old.id);
  else await putCard({ ...old, reasons, saved: false });
};

// Start times of this video's bookmarked lines, for the practice page's bookmark icons.
export const savedStarts = async (videoId: string): Promise<Set<string>> =>
  new Set((await getAllCards()).filter(c => c.deck === 'line' && c.saved && c.videoId === videoId).map(c => c.start.toFixed(2)));

export const recordOutcome = async (card: ReviewCard, o: Outcome) => putCard(schedule(card, o));

export const countForVideo = async (videoId: string) => (await getAllCards()).filter(c => c.videoId === videoId).length;

export const repointVideo = async (videoId: string, videoPath: string) =>
  putCards((await getAllCards()).filter(c => c.videoId === videoId).map(c => ({ ...c, videoPath })));

export const deckCounts = (cards: ReviewCard[], now = Date.now()) => {
  const count = (deck: Deck) => ({
    due: cards.filter(c => c.deck === deck && isDue(c, now)).length,
    total: cards.filter(c => c.deck === deck).length,
  });
  return { line: count('line'), word: count('word') };
};

// --- One-time move of the old text-only bookmarks ---
// Reads localStorage `linguaclip_saved_lines` and never writes it (it stays as
// a backup). The "done" mark is written in the same transaction as the cards,
// so they land together or not at all; ids are fixed, so a rerun is harmless.
// Known limit: bookmarks made in an older app version after this ran aren't picked up.

let migrating: Promise<void> | null = null;

export const migrateSavedLines = () => migrating ??= (async () => {
  const d = await db();
  const done = await new Promise<boolean>((resolve, reject) => {
    const q = d.transaction(META).objectStore(META).get('migrated');
    q.onsuccess = () => resolve(!!q.result);
    q.onerror = () => reject(q.error);
  });
  if (done) return;
  // Unreadable (not just empty) old bookmarks throw here, so the move isn't marked done and runs again next launch.
  const raw = localStorage.getItem('linguaclip_saved_lines');
  const lines: SavedLine[] = raw ? JSON.parse(raw) : [];
  const records = lines.length ? await getAllVideosFromDB() : [];
  const cards = lines.map(line => {
    const hit = matchLegacy(line, records);
    const base = hit
      ? { id: lineCardId(hit.record.id, hit.start), videoId: hit.record.id, videoName: hit.record.displayName, videoPath: hit.record.videoPath, start: hit.start, end: hit.end }
      : { id: `legacy|${line.id}`, videoId: '', videoName: line.videoName ?? '', start: -1, end: -1 };
    return newCard({ ...base, deck: 'line', text: line.text }, 'saved', line.dateSaved);
  });
  const t = d.transaction([STORE, META], 'readwrite');
  const s = t.objectStore(STORE);
  // Never clobber a card that already exists (made by practising before this finished).
  for (const c of cards) { const r = s.get(c.id); r.onsuccess = () => { s.put(r.result ? withReason(r.result, 'saved') : c); }; }
  t.objectStore(META).put({ id: 'migrated', at: Date.now(), count: cards.length });
  await new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(t.error); });
  changed();
})().catch(e => { migrating = null; throw e; });
