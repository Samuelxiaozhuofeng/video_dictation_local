import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PracticeMode } from '../types';
import {
  tokenizeText, getWordTokens, Token, TokenType, compareWords,
  isInputCorrectFlexibleCase, areAllWordsCorrectFlexibleCase,
} from '../utils/textTokenizer';
import { Btn } from './ui';
import { useT } from '../utils/i18n';
import { matches } from '../utils/shortcuts';
import { useJaVersion } from '../utils/japanese';

// Dictation line: one input box per word (INPUT), then a word-by-word comparison (FEEDBACK).
// Word lookup is delegated to Studio via onLookup.
interface Props {
  targetText: string;
  mode: PracticeMode;
  onComplete: (wasCorrect: boolean) => void;
  onReplay: (autoAdvanceAfter?: boolean, fromRatio?: number) => void; // fromRatio: 0..1 into the line
  onLookup: (word: string) => void;
  blanks?: number[]; // word indices the user types; omit = every word
  nextLabel?: string; // feedback's forward button; defaults to "next line"
  // Once per attempt, when the line is done (all right, or submitted): did it
  // come out right, and was help used (peek, or playing from a word).
  onResult?: (o: { correct: boolean; helped: boolean }) => void;
  extra?: React.ReactNode; // shown beside the feedback's forward button
}

// How far into the line word i starts, by letters: a rough stand-in for time when
// there are no word timings.
const letterRatio = (words: string[], i: number): number => {
  const len = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
  const total = words.reduce((n, w) => n + len(w), 0);
  const before = words.slice(0, i).reduce((n, w) => n + len(w), 0);
  return total ? before / total : 0;
};

// Width of an empty slot for a word: Latin letters are narrow, kana and kanji about 1em.
export const slotEm = (word: string) =>
  Math.max(0.92, [...word].reduce((n, ch) => n + (/[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 1 : 0.46), 0));

// Typing and the answer share one setting, so submitting changes colours, not positions.
export const LINE = 'flex flex-wrap items-baseline gap-x-[0.25em] font-serif text-[30px] leading-[42px]';

const DictationLine: React.FC<Props> = ({ targetText, mode, onComplete, onReplay, onLookup, blanks, nextLabel, onResult, extra }) => {
  const t = useT();
  // A Japanese line is re-split when its dictionary or AI cut points arrive, but
  // never under the user's fingers: once something is typed the split holds.
  // (A new set of blanks resets the line anyway, so it re-splits then too.)
  const jaVersion = useJaVersion();
  const [splitVersion, setSplitVersion] = useState(jaVersion);
  const typedRef = useRef(false);
  const lastBlanks = useRef(blanks);
  useEffect(() => {
    const reset = lastBlanks.current !== blanks;
    lastBlanks.current = blanks;
    if (reset || !typedRef.current) setSplitVersion(jaVersion);
  }, [jaVersion, targetText, blanks]);
  const tokens = useMemo(() => tokenizeText(targetText), [targetText, splitVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const wordTokens = useMemo(() => getWordTokens(tokens), [tokens]);
  // Each word carries the punctuation right after it, so a comma sits on its word, not a gap away.
  const groups = useMemo(() => {
    const out: { key: number; wi: number; word?: Token; punct: string }[] = [];
    let wi = 0;
    tokens.forEach((tk, ti) => {
      if (tk.type === TokenType.WORD) out.push({ key: ti, wi: wi++, word: tk, punct: '' });
      else if (tk.type === TokenType.PUNCTUATION) {
        if (out.length) out[out.length - 1].punct += tk.value;
        else out.push({ key: ti, wi: -1, punct: tk.value });
      }
    });
    return out;
  }, [tokens]);
  const blankSet = useMemo(() => blanks ? new Set(blanks) : null, [blanks]);
  const isBlank = (i: number) => blankSet === null || blankSet.has(i);
  const stepBlank = (from: number, dir: number) => {
    for (let i = from + dir; i >= 0 && i < wordTokens.length; i += dir) {
      if (isBlank(i)) return i;
    }
    return -1;
  };
  const firstBlank = () => {
    for (let i = 0; i < wordTokens.length; i++) if (isBlank(i)) return i;
    return 0;
  };

  const [inputs, setInputs] = useState<string[]>([]);
  typedRef.current = mode === PracticeMode.INPUT && inputs.some((w, i) => isBlank(i) && !!w);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [peek, setPeek] = useState<number | null>(null);
  const peekTimer = useRef<number | null>(null);
  const replayTimer = useRef<number | null>(null);
  const attempt = useRef({ helped: false, reported: false });
  const report = (correct: boolean) => {
    if (attempt.current.reported) return;
    attempt.current.reported = true;
    onResult?.({ correct, helped: attempt.current.helped });
  };

  useEffect(() => {
    if (mode === PracticeMode.INPUT) {
      attempt.current = { helped: false, reported: false };
      setInputs(wordTokens.map((w, i) => isBlank(i) ? '' : w.value));
      refs.current = refs.current.slice(0, wordTokens.length);
      setTimeout(() => refs.current[firstBlank()]?.focus(), 50);
    }
  }, [mode, targetText, wordTokens, blankSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearPeek = () => {
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
    peekTimer.current = null;
    setPeek(null);
  };
  const clearReplay = () => { if (replayTimer.current) window.clearTimeout(replayTimer.current); replayTimer.current = null; };
  useEffect(() => { clearPeek(); clearReplay(); }, [targetText, mode]);
  useEffect(() => () => { clearPeek(); clearReplay(); }, []);

  const showPeek = (i: number) => {
    if (!wordTokens[i]) return;
    attempt.current.helped = true;
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
    setPeek(i);
    peekTimer.current = window.setTimeout(() => { setPeek(null); peekTimer.current = null; }, 2000);
  };

  // composing: a Japanese (or Chinese) input method is still turning keystrokes
  // into text; the word is only judged once it is committed.
  const change = (i: number, value: string, composing = false) => {
    const next = [...inputs];
    next[i] = value;
    setInputs(next);
    if (composing) return;
    settle(i, next);
  };

  const settle = (i: number, next: string[]) => {
    if (!isInputCorrectFlexibleCase(next[i] ?? '', wordTokens[i].value, wordTokens[i].reading)) return;
    const nxt = stepBlank(i, 1);
    if (nxt >= 0) {
      setTimeout(() => refs.current[nxt]?.focus(), 100);
    } else if (areAllWordsCorrectFlexibleCase(tokens, next)) {
      report(true);
      clearReplay();
      // All right: replay once and show the answer, then wait for Enter so words can be looked up.
      replayTimer.current = window.setTimeout(() => { onReplay(false); onComplete(true); }, 200);
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode !== PracticeMode.INPUT) return;
    clearReplay();
    if (!inputs.some(w => w.trim().length > 0)) return;
    const correct = areAllWordsCorrectFlexibleCase(tokens, inputs);
    report(correct);
    onComplete(correct);
  };

  const keyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Space picks a kanji and Enter commits it inside an input method; those keys
    // are not ours. Safari reports the committing Enter with keyCode 229.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (matches(e, 'reveal')) { e.preventDefault(); e.stopPropagation(); report(false); onComplete(false); return; }
    if (matches(e, 'replay')) { e.preventDefault(); e.stopPropagation(); clearReplay(); onReplay(false); return; }
    if (matches(e, 'playFrom')) { e.preventDefault(); e.stopPropagation(); clearReplay(); attempt.current.helped = true; onReplay(false, letterRatio(wordTokens.map(w => w.value), i)); return; }
    if (matches(e, 'peek')) { e.preventDefault(); showPeek(i); return; }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const nxt = stepBlank(i, 1);
      if (nxt >= 0) refs.current[nxt]?.focus(); else submit();
    } else if (e.key === 'Backspace' && inputs[i] === '') {
      const prev = stepBlank(i, -1);
      if (prev >= 0) { e.preventDefault(); refs.current[prev]?.focus(); }
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      const prev = stepBlank(i, -1);
      if (prev >= 0) { e.preventDefault(); refs.current[prev]?.focus(); }
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      const nxt = stepBlank(i, 1);
      if (nxt >= 0) { e.preventDefault(); refs.current[nxt]?.focus(); }
    }
  };

  const paste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const words = e.clipboardData.getData('text').trim().split(/\s+/);
    const next = [...inputs];
    const slots = wordTokens.map((_, i) => i).filter(i => isBlank(i));
    const limit = Math.min(words.length, slots.length);
    for (let k = 0; k < limit; k++) next[slots[k]] = words[k];
    setInputs(next);
    refs.current[slots[Math.min(limit, slots.length - 1)] ?? firstBlank()]?.focus();
  };

  const lookup = (raw: string) => {
    const w = raw.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (w) onLookup(w);
  };

  if (mode === PracticeMode.FEEDBACK) {
    const results = compareWords(tokens, inputs);
    return (
      <div className="w-full flex flex-col items-start gap-5">
        {/* The answer: click any word to look it up */}
        <p className={LINE}>
          {(wordTokens.some(w => w.reading !== undefined) ? groups.map(g => (g.word?.value ?? '') + g.punct) : targetText.split(/\s+/)).filter(Boolean).map((part, i) => (
            <button key={i} type="button" onClick={e => { e.currentTarget.blur(); lookup(part); }} className="rounded hover:mark-yellow" title={t('common.lookup')}>{part}</button>
          ))}
        </p>

        {/* Yours, word by word */}
        {/* Yours underneath, dimmer; only a wrong word steps forward. */}
        <div className="w-full flex flex-wrap items-baseline gap-x-[0.3em] gap-y-1 font-serif text-xl" aria-label={t('dictation.youTyped')}>
          {groups.map(g => {
            if (g.wi < 0) return <span key={g.key} className="text-mute">{g.punct}</span>;
            if (!isBlank(g.wi)) return null;
            const r = results.find(x => x.tokenIndex === g.word!.index);
            if (!r) return null;
            return (
              <span key={g.key}>
                {r.inputWord ? (
                  <span title={r.isCorrect ? '' : t('dictation.expected', { word: r.targetWord })} className={r.isCorrect ? 'text-mute' : 'text-ink underline decoration-accent decoration-[1.5px] underline-offset-[6px]'}>
                    {r.inputWord}
                  </span>
                ) : (
                  // Left blank: the same empty slot you saw while typing.
                  <span title={t('dictation.expected', { word: r.targetWord })} className="inline-block relative top-1 border-b-[1.5px] border-ink/25" style={{ width: `${slotEm(r.targetWord)}em`, height: '1em' }} />
                )}
                <span className="text-mute">{g.punct}</span>
              </span>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Btn tone="accent" onClick={() => onComplete(true)}>{nextLabel ?? t('common.nextLine')}</Btn>
          {extra}
        </div>
      </div>
    );
  }

  // INPUT mode
  return (
    <div className="w-full">
      <form onSubmit={submit} className={LINE}>
        {groups.map(g => {
          const punct = g.punct && <span className="text-mute select-none">{g.punct}</span>;
          if (g.wi < 0) return <span key={g.key}>{punct}</span>;
          const i = g.wi;
          const tk = g.word!;
          if (!isBlank(i)) {
            return <span key={g.key} className="text-ink/50 select-none">{tk.value}{punct}</span>;
          }
          const ok = !!inputs[i] && isInputCorrectFlexibleCase(inputs[i], tk.value, tk.reading);
          return (
            <span key={g.key} className="relative inline-flex items-baseline">
              {/* The slot grows with what you type; once the word is right it shrinks to fit, so the line reads like prose. */}
              <span className="inline-grid" style={{ minWidth: ok ? 0 : `${slotEm(tk.value) + 0.3}em` }}>
                <input
                  ref={el => { refs.current[i] = el; }}
                  type="text"
                  size={1}
                  value={inputs[i] || ''}
                  onChange={e => change(i, e.target.value, (e.nativeEvent as InputEvent).isComposing)}
                  onCompositionEnd={e => settle(i, Object.assign([...inputs], { [i]: e.currentTarget.value }))}
                  onKeyDown={e => keyDown(i, e)}
                  onPaste={paste}
                  // A 34px box keeps the underline just under the letters (not under the descenders), so a comma or full stop sits on it.
                  className={`col-start-1 row-start-1 w-full min-w-0 h-[34px] p-0 bg-transparent border-0 border-b-[1.5px] rounded-none font-serif text-ink caret-accent outline-none focus:outline-none focus-visible:outline-none ${ok ? 'border-transparent' : 'border-ink/25 focus:border-accent'}`}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                />
                <span className="invisible h-0 overflow-hidden whitespace-pre col-start-1 row-start-1">{inputs[i] || ''}</span>
              </span>
              {punct}
              {peek === i && (
                <span className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-md bg-accent text-paper px-3 py-1 font-serif text-xl leading-7 whitespace-nowrap pointer-events-none z-10 fade-in">
                  {tk.value}
                </span>
              )}
            </span>
          );
        })}
      </form>
    </div>
  );
};

export default DictationLine;
