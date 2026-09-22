import React, { useEffect, useMemo, useState } from 'react';
import { tokenizeText, TokenType } from '../utils/textTokenizer';

// Blur mode line: every word starts as a covered block. First click reveals it,
// second click looks it up. Lookup itself lives in Studio (DefinitionPanel).
const BlurLine: React.FC<{ text: string; onLookup: (word: string) => void }> = ({ text, onLookup }) => {
  const tokens = useMemo(() => tokenizeText(text), [text]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => { setRevealed(new Set()); setPicked(null); }, [text]);

  const click = (e: React.MouseEvent<HTMLButtonElement>, wordIdx: number, raw: string) => {
    e.currentTarget.blur(); // keep Space/Enter shortcuts from re-firing this button
    const word = raw.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (!word) return;
    if (!revealed.has(wordIdx)) {
      setRevealed(prev => new Set(prev).add(wordIdx));
      setPicked(wordIdx);
      return;
    }
    setPicked(wordIdx);
    onLookup(word);
  };

  let wordIdx = 0;
  return (
    <div className="text-center font-serif text-2xl sm:text-[28px] font-medium leading-[2]">
      {tokens.map((t, i) => {
        if (t.type === TokenType.WORD) {
          const idx = wordIdx++;
          const isRevealed = revealed.has(idx);
          const isPicked = picked === idx;
          return (
            <button
              key={i}
              type="button"
              onClick={e => click(e, idx, t.value)}
              title={isRevealed ? 'Look up' : 'Reveal'}
              aria-label={isRevealed ? undefined : 'Hidden word'}
              className={`press inline-block align-baseline rounded px-1 ${
                isRevealed
                  ? (isPicked ? 'mark-yellow' : 'hover:mark-yellow')
                  : 'bg-shade text-transparent select-none hover:bg-line'}`}
            >
              {t.value}
            </button>
          );
        }
        if (t.type === TokenType.PUNCTUATION) {
          return <span key={i} className="text-mute">{t.value}</span>;
        }
        if (t.type === TokenType.SPACE) return <span key={i}> </span>;
        return null;
      })}
    </div>
  );
};

export default BlurLine;
