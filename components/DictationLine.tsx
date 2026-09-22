import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, RefreshCw, ArrowRight } from 'lucide-react';
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
}

const DictationLine: React.FC<Props> = ({ targetText, mode, onComplete, onReplay, onLookup, blanks }) => {
  const t = useT();
  const tokens = useMemo(() => tokenizeText(targetText), [targetText]);
  const wordTokens = useMemo(() => getWordTokens(tokens), [tokens]);
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
      <div className="w-full flex flex-col items-center gap-5">
        {/* The answer: click any word to look it up */}
        <p className="text-center font-serif text-2xl sm:text-[28px] font-medium leading-relaxed">
          {targetText.split(/(\s+)/).map((part, i) =>
            part.trim() === '' ? <span key={i}>{part}</span> : (
              <button key={i} type="button" onClick={e => { e.currentTarget.blur(); lookup(part); }} className="rounded hover:mark-yellow px-0.5 -mx-0.5" title={t('common.lookup')}>{part}</button>
            ))}
        </p>

        {/* Yours, word by word */}
        <div className="w-full flex flex-wrap justify-center items-center gap-x-2 gap-y-1 font-mono text-lg">
          <span className="text-[11px] font-sans text-mute mr-2">{t('dictation.youTyped')}</span>
          {tokens.map((tk, i) => {
            if (tk.type === TokenType.WORD) {
              const wi = wordTokens.findIndex(w => w.index === tk.index);
              if (wi >= 0 && !isBlank(wi)) return null;
              const r = results.find(x => x.tokenIndex === tk.index);
              if (!r) return null;
              return (
                <span key={i} title={r.isCorrect ? '' : t('dictation.expected', { word: r.targetWord })}
                  className={`px-1 ${r.isCorrect ? 'mark-green text-green' : 'mark-rose text-rose line-through decoration-rose decoration-2'}`}>
                  {r.inputWord || '·'}
                </span>
              );
            }
            if (tk.type === TokenType.PUNCTUATION) return <span key={i} className="text-mute">{tk.value}</span>;
            return null;
          })}
        </div>

        <div className="flex gap-3">
          <Btn onClick={() => onReplay(false)}><RefreshCw size={16} /> {t('dictation.hearAgain')}</Btn>
          <Btn tone="green" onClick={() => onComplete(true)}>{t('common.nextLine')} <ArrowRight size={16} /></Btn>
        </div>
      </div>
    );
  }

  // INPUT mode
  let wi = 0;
  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex flex-wrap justify-center items-center gap-2">
        {tokens.map((tk: Token, ti: number) => {
          if (tk.type === TokenType.WORD) {
            const i = wi++;
            if (!isBlank(i)) {
              return <span key={ti} className="font-mono text-xl sm:text-2xl text-ink/70 select-none px-0.5">{tk.value}</span>;
            }
            const ok = !!inputs[i] && isInputCorrectFlexibleCase(inputs[i], tk.value);
            return (
              <div key={ti} className="relative inline-flex">
                <input
                  ref={el => { refs.current[i] = el; }}
                  type="text"
                  value={inputs[i] || ''}
                  onChange={e => change(i, e.target.value)}
                  onKeyDown={e => keyDown(i, e)}
                  onPaste={paste}
                  style={{ width: `${Math.max(3, tk.value.length + 1)}ch` }}
                  className={`flat min-w-[3ch] px-2 py-1.5 font-mono text-xl sm:text-2xl font-medium text-center focus:border-green focus:shadow-sm ${ok ? 'bg-green-soft border-green text-green' : ''}`}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                />
                {peek === i && (
                  <div className="absolute -top-11 left-1/2 -translate-x-1/2 card bg-highlight px-3 py-1 font-mono font-medium whitespace-nowrap pointer-events-none z-10 fade-in">
                    {tk.value}
                  </div>
                )}
              </div>
            );
          }
          if (tk.type === TokenType.PUNCTUATION) return <span key={ti} className="font-mono text-xl sm:text-2xl text-mute select-none">{tk.value}</span>;
          return null;
        })}
        <Btn type="submit" tone="green" square disabled={wordTokens.every((_, i) => !isBlank(i) || !(inputs[i] || '').trim())} className="ml-2" title={t('dictation.checkTitle')}>
          <Send size={18} />
        </Btn>
      </form>
      <p className="mt-3 text-center text-xs text-mute">
        {t('dictation.keyHint')}
      </p>
    </div>
  );
};

export default DictationLine;
