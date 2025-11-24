import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import * as AI from '../utils/ai';
import { tokenizeText, getWordTokens, Token, TokenType } from '../utils/textTokenizer';

interface BlurSubtitleProps {
  targetText: string;
  onWordToAnki?: (word: string, definition: string, includeAudio?: boolean) => void | Promise<void>;
  onReset?: () => void; // Called when replay is triggered to reset revealed words
  onWordSelected?: (word: string, definition: AI.WordDefinition | null, isLoading: boolean) => void; // Callback when word is selected
  selectedWordExternal?: string | null; // Allow parent to control selected word
}

const BlurSubtitle: React.FC<BlurSubtitleProps> = ({
  targetText,
  onWordToAnki,
  onReset,
  onWordSelected,
  selectedWordExternal
}) => {
  // Tokenize target text into words and punctuation
  const tokens = useMemo(() => tokenizeText(targetText), [targetText]);
  const wordTokens = useMemo(() => getWordTokens(tokens), [tokens]);

  // Track which words have been revealed (by word token index)
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());
  
  // AI / Dictionary State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [definitionData, setDefinitionData] = useState<AI.WordDefinition | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [ankiWordStatus, setAnkiWordStatus] = useState<'idle' | 'loading-only-word' | 'loading-with-audio' | 'success-only-word' | 'success-with-audio' | 'error'>('idle');

  // Reset all state when subtitle text changes (new subtitle line)
  useEffect(() => {
    setRevealedWordIndices(new Set());
    setSelectedWord(null);
    setSelectedWordIndex(null);
    setDefinitionData(null);
    setIsLoadingDef(false);
    setAnkiWordStatus('idle');
  }, [targetText]);

  // Reset revealed words when onReset is called (e.g., on replay)
  useEffect(() => {
    if (onReset) {
      const resetHandler = () => {
        setRevealedWordIndices(new Set());
        setSelectedWord(null);
        setSelectedWordIndex(null);
        setDefinitionData(null);
      };
      // Store reset handler reference
      (onReset as any).current = resetHandler;
    }
  }, [onReset]);

  // Handle word click
  const handleWordClick = async (wordIndex: number, word: string) => {
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
    if (!cleanWord) return;

    // First click: reveal the word
    if (!revealedWordIndices.has(wordIndex)) {
      setRevealedWordIndices(prev => new Set(prev).add(wordIndex));
      setSelectedWordIndex(wordIndex);
      setSelectedWord(cleanWord);
      onWordSelected?.(cleanWord, null, false);
      return;
    }

    // Second click: show definition (if already revealed)
    if (selectedWordIndex === wordIndex && definitionData) {
      // Already showing definition, do nothing or toggle
      return;
    }

    // Fetch definition
    setSelectedWord(cleanWord);
    setSelectedWordIndex(wordIndex);
    setDefinitionData(null);
    setIsLoadingDef(true);
    setAnkiWordStatus('idle');
    onWordSelected?.(cleanWord, null, true); // Notify parent that loading started

    try {
      const result = await AI.getWordDefinition(cleanWord, targetText);
      setDefinitionData(result);
      onWordSelected?.(cleanWord, result, false); // Notify parent with definition
    } catch (e) {
      console.error(e);
      onWordSelected?.(cleanWord, null, false);
    } finally {
      setIsLoadingDef(false);
    }
  };

  const handleAddWordToAnki = async (includeAudio: boolean) => {
    if (!onWordToAnki || !selectedWord || !definitionData) return;

    setAnkiWordStatus(includeAudio ? 'loading-with-audio' : 'loading-only-word');
    try {
      const defString = `<b>${definitionData.word}</b> <i>(${definitionData.partOfSpeech})</i><br/>${definitionData.definition}`;
      await onWordToAnki(selectedWord, defString, includeAudio);
      setAnkiWordStatus(includeAudio ? 'success-with-audio' : 'success-only-word');
      setTimeout(() => setAnkiWordStatus('idle'), 2000);
    } catch (e) {
      setAnkiWordStatus('error');
      setTimeout(() => setAnkiWordStatus('idle'), 3000);
    }
  };

  // Render subtitle with placeholders and revealed words
  const renderBlurredSubtitle = () => {
    let wordTokenIndex = 0;

    return (
      <div className="flex flex-wrap gap-1 justify-center items-baseline">
        {tokens.map((token, idx) => {
          if (token.type === TokenType.WORD) {
            const currentWordIndex = wordTokenIndex;
            wordTokenIndex++;
            const isRevealed = revealedWordIndices.has(currentWordIndex);
            const isSelected = selectedWordIndex === currentWordIndex;

            return (
              <button
                key={idx}
                onClick={() => handleWordClick(currentWordIndex, token.value)}
                className={`px-2 py-1 rounded-lg transition-all font-medium text-lg ${
                  isSelected
                    ? 'bg-brand-500/30 text-brand-300 border-2 border-brand-500'
                    : isRevealed
                    ? 'bg-neutral-800/50 text-neutral-200 hover:bg-neutral-700/50 border border-neutral-700'
                    : 'bg-neutral-800/80 text-transparent hover:bg-neutral-700/80 border border-neutral-600 cursor-pointer'
                }`}
                style={!isRevealed ? { userSelect: 'none' } : {}}
              >
                {isRevealed ? token.value : '_'.repeat(token.value.length)}
              </button>
            );
          } else if (token.type === TokenType.PUNCTUATION) {
            return (
              <span key={idx} className="text-neutral-400 text-lg">
                {token.value}
              </span>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Blurred Subtitle Display */}
      <div className="mb-6">
        {renderBlurredSubtitle()}
      </div>
    </div>
  );
};

// Export helper component for definition sidebar
export const BlurDefinitionSidebar: React.FC<{
  selectedWord: string | null;
  definitionData: AI.WordDefinition | null;
  isLoading: boolean;
  onWordToAnki?: (word: string, definition: string, includeAudio?: boolean) => void | Promise<void>;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}> = ({ selectedWord, definitionData, isLoading, onWordToAnki, onClose, width, onWidthChange }) => {
  const [ankiWordStatus, setAnkiWordStatus] = useState<'idle' | 'loading-only-word' | 'loading-with-audio' | 'success-only-word' | 'success-with-audio' | 'error'>('idle');
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleAddWordToAnki = async (includeAudio: boolean) => {
    if (!onWordToAnki || !selectedWord || !definitionData) return;

    setAnkiWordStatus(includeAudio ? 'loading-with-audio' : 'loading-only-word');
    try {
      const defString = `<b>${definitionData.word}</b> <i>(${definitionData.partOfSpeech})</i><br/>${definitionData.definition}`;
      await onWordToAnki(selectedWord, defString, includeAudio);
      setAnkiWordStatus(includeAudio ? 'success-with-audio' : 'success-only-word');
      setTimeout(() => setAnkiWordStatus('idle'), 2000);
    } catch (e) {
      setAnkiWordStatus('error');
      setTimeout(() => setAnkiWordStatus('idle'), 3000);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(200, Math.min(newWidth, window.innerWidth * 0.5)); // Min 200px, max 50%
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  if (!selectedWord) return null;

  return (
    <div
      ref={sidebarRef}
      className="fixed top-0 right-0 h-full bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-700/50 shadow-2xl z-50 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-brand-500/50 transition-colors"
        style={{ marginLeft: '-2px' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/50">
        <h3 className="text-lg font-semibold text-white">Word Definition</h3>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors p-1"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-neutral-400 py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Looking up definition...</span>
          </div>
        ) : definitionData ? (
          <div>
            <div className="mb-6">
              <h4 className="text-3xl font-bold text-white mb-2">{definitionData.word}</h4>
              <p className="text-sm text-neutral-400 italic">{definitionData.partOfSpeech}</p>
            </div>
            <p className="text-neutral-200 leading-relaxed text-base mb-6">{definitionData.definition}</p>

            {/* Add to Anki Buttons */}
            {onWordToAnki && (
              <div className="pt-6 border-t border-neutral-700/50 flex flex-col gap-3">
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2">Add to Anki</p>
                <button
                  onClick={() => handleAddWordToAnki(false)}
                  disabled={ankiWordStatus !== 'idle'}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    ankiWordStatus === 'success-only-word'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : ankiWordStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/50'
                  }`}
                >
                  {ankiWordStatus === 'loading-only-word' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   ankiWordStatus === 'success-only-word' ? <Check className="w-4 h-4" /> : null}
                  Only Word
                </button>
                <button
                  onClick={() => handleAddWordToAnki(true)}
                  disabled={ankiWordStatus !== 'idle'}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    ankiWordStatus === 'success-with-audio'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : ankiWordStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30'
                  }`}
                >
                  {ankiWordStatus === 'loading-with-audio' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   ankiWordStatus === 'success-with-audio' ? <Check className="w-4 h-4" /> : null}
                  With Audio
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-neutral-500 text-center py-8">
            Click on a revealed word to see its definition
          </div>
        )}
      </div>
    </div>
  );
};

export default BlurSubtitle;

