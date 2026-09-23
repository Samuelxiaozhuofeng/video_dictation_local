import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PracticeMode } from '../types';
import {
  tokenizeText, getWordTokens, Token, TokenType, compareWords,
  isInputCorrectFlexibleCase, areAllWordsCorrectFlexibleCase,
} from '../utils/textTokenizer';
import { Btn } from './ui';
import { useT } from '../utils/i18n';

// Dictation line: one input box per word (INPUT), then a word-by-word comparison (FEEDBACK).
// Word lookup is delegated to Studio via onLookup.
interface Props {
  targetText: string;
  mode: PracticeMode;
  onComplete: (wasCorrect: boolean) => void;
  onReplay: (autoAdvanceAfter?: boolean) => void;
  onLookup: (word: string) => void;
  blanks?: number[]; // word indices the user types; omit = every word
  nextLabel?: string; // feedback's forward button; defaults to "next line"
}

// Typing and the answer share one setting, so submitting changes colours, not positions.
export const LINE = 'flex flex-wrap items-baseline gap-x-[0.25em] font-serif text-[30px] leading-[42px]';

const DictationLine: React.FC<Props> = ({ targetText, mode, onComplete, onReplay, onLookup, blanks, nextLabel }) => {
  const t = useT();
  const tokens = useMemo(() => tokenizeText(targetText), [targetText]);
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
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [peek, setPeek] = useState<number | null>(null);
  const peekTimer = useRef<number | null>(null);
  const replayTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mode === PracticeMode.INPUT) {
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
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
    setPeek(i);
    peekTimer.current = window.setTimeout(() => { setPeek(null); peekTimer.current = null; }, 2000);
  };

  const change = (i: number, value: string) => {
    const next = [...inputs];
    next[i] = value;
    setInputs(next);
    if (!isInputCorrectFlexibleCase(value, wordTokens[i].value)) return;
    const nxt = stepBlank(i, 1);
    if (nxt >= 0) {
      setTimeout(() => refs.current[nxt]?.focus(), 100);
    } else if (areAllWordsCorrectFlexibleCase(tokens, next)) {
      clearReplay();
      replayTimer.current = window.setTimeout(() => onReplay(true), 200); // all right: replay once, then auto-advance
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode !== PracticeMode.INPUT) return;
    clearReplay();
    if (inputs.some(w => w.trim().length > 0)) onComplete(areAllWordsCorrectFlexibleCase(tokens, inputs));
  };

  const keyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.shiftKey && e.key === ' ') { e.preventDefault(); e.stopPropagation(); onReplay(false); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); showPeek(i); return; }
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
          {targetText.split(/\s+/).filter(Boolean).map((part, i) => (
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
                  <span title={t('dictation.expected', { word: r.targetWord })} className="inline-block relative top-1 border-b-[1.5px] border-ink/25" style={{ width: `${Math.max(2, r.targetWord.length) * 0.46}em`, height: '1em' }} />
                )}
                <span className="text-mute">{g.punct}</span>
              </span>
            );
          })}
        </div>

        <Btn tone="accent" onClick={() => onComplete(true)}>{nextLabel ?? t('common.nextLine')}</Btn>
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
          const ok = !!inputs[i] && isInputCorrectFlexibleCase(inputs[i], tk.value);
          return (
            <span key={g.key} className="relative inline-flex items-baseline">
              {/* The slot grows with what you type; once the word is right it shrinks to fit, so the line reads like prose. */}
              <span className="inline-grid" style={{ minWidth: ok ? 0 : `${Math.max(2, tk.value.length) * 0.46 + 0.3}em` }}>
                <input
                  ref={el => { refs.current[i] = el; }}
                  type="text"
                  size={1}
                  value={inputs[i] || ''}
                  onChange={e => change(i, e.target.value)}
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
