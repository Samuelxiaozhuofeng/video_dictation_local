import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, RefreshCw, ArrowRight, Sparkles, Loader2, PlusCircle, Check, X } from 'lucide-react';
import { PracticeMode } from '../types';
import * as AI from '../utils/ai';
import { tokenizeText, getWordTokens, isInputCorrect, areAllWordsCorrect, Token, TokenType, compareWords, reconstructText, isInputCorrectFlexibleCase, areAllWordsCorrectFlexibleCase } from '../utils/textTokenizer';

interface InputFeedbackProps {
  targetText: string;
  mode: PracticeMode;
  onComplete: (wasCorrect: boolean) => void;
  onReplay: (autoAdvanceAfter?: boolean) => void;
  onWordToAnki?: (word: string, definition: string, includeAudio?: boolean) => Promise<void>;
}

const InputFeedback: React.FC<InputFeedbackProps> = ({
  targetText,
  mode,
  onComplete,
  onReplay,
  onWordToAnki
}) => {
  // Tokenize target text into words and punctuation
  const tokens = useMemo(() => tokenizeText(targetText), [targetText]);
  const wordTokens = useMemo(() => getWordTokens(tokens), [tokens]);

  // State for inputs (only for word tokens)
  const [wordInputs, setWordInputs] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // AI / Dictionary State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definitionData, setDefinitionData] = useState<AI.WordDefinition | null>(null);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [ankiWordStatus, setAnkiWordStatus] = useState<'idle' | 'loading-only-word' | 'loading-with-audio' | 'success-only-word' | 'success-with-audio' | 'error'>('idle');
  const [revealedWordIndex, setRevealedWordIndex] = useState<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);

  // Initialize inputs
  useEffect(() => {
    if (mode === PracticeMode.INPUT) {
      setWordInputs(new Array(wordTokens.length).fill(''));
      // Reset refs
      inputRefs.current = inputRefs.current.slice(0, wordTokens.length);
      // Auto-focus first box
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    }
  }, [mode, targetText, wordTokens.length]);

  const clearReveal = () => {
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    setRevealedWordIndex(null);
  };

  const handleRevealWord = (index: number) => {
    if (!wordTokens[index]) return;
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
    }
    setRevealedWordIndex(index);
    revealTimeoutRef.current = window.setTimeout(() => {
      setRevealedWordIndex(null);
      revealTimeoutRef.current = null;
    }, 2000);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...wordInputs];
    newInputs[index] = value;
    setWordInputs(newInputs);

    // Auto-advance: if current word is correct, move to next input
    // Use flexible case matching (first letter case-insensitive, rest case-sensitive)
    const currentWordToken = wordTokens[index];
    if (currentWordToken && isInputCorrectFlexibleCase(value, currentWordToken.value)) {
      // Word is correct, move to next
      if (index < wordTokens.length - 1) {
        // Move to next input field
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
        }, 100);
      } else {
        // This was the last word, check if all are correct
        if (areAllWordsCorrectFlexibleCase(tokens, newInputs)) {
          // All correct! Auto-submit and replay
          setTimeout(() => {
            handleAutoComplete();
          }, 200);
        }
      }
    }
  };

  // Handle auto-complete when all words are correct
  const handleAutoComplete = () => {
    // Trigger replay from the beginning of this subtitle with auto-advance enabled
    onReplay(true);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift+Space -> Replay current subtitle (don't move to next box)
    if (e.shiftKey && e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onReplay(false);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      handleRevealWord(index);
      return;
    }

    // Space or Enter -> Move next or Submit
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (index < wordTokens.length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        handleSubmit();
      }
    }
    // Backspace on empty -> Move prev
    else if (e.key === 'Backspace' && wordInputs[index] === '' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    // Navigation
    else if (e.key === 'ArrowLeft' && index > 0) {
       if (e.currentTarget.selectionStart === 0) {
           e.preventDefault();
           inputRefs.current[index - 1]?.focus();
       }
    }
    else if (e.key === 'ArrowRight' && index < wordTokens.length - 1) {
       if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
           e.preventDefault();
           inputRefs.current[index + 1]?.focus();
       }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const pastedWords = pastedText.trim().split(/\s+/);

    const newInputs = [...wordInputs];
    const limit = Math.min(pastedWords.length, wordTokens.length);

    for(let i = 0; i < limit; i++) {
        if (i < newInputs.length) {
            newInputs[i] = pastedWords[i];
        }
    }
    setWordInputs(newInputs);

    // Focus last updated
    const focusIdx = Math.min(limit, wordTokens.length - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === PracticeMode.INPUT) {
       // Check if all words are correct using flexible case matching
       const allCorrect = areAllWordsCorrectFlexibleCase(tokens, wordInputs);
       if (wordInputs.some(w => w.trim().length > 0)) {
          onComplete(allCorrect);
       }
    }
  };

  const handleWordClick = async (word: string) => {
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
    if (!cleanWord) return;

    setSelectedWord(cleanWord);
    setDefinitionData(null);
    setIsLoadingDef(true);
    setAnkiWordStatus('idle');

    try {
        const result = await AI.getWordDefinition(cleanWord, targetText);
        setDefinitionData(result);
    } catch (e) {
        console.error(e);
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
          // Reset to idle after 2 seconds
          setTimeout(() => setAnkiWordStatus('idle'), 2000);
      } catch (e) {
          setAnkiWordStatus('error');
          // Reset to idle after 3 seconds on error
          setTimeout(() => setAnkiWordStatus('idle'), 3000);
      }
  };

  const renderTokenizedText = (text: string) => {
    const parts = text.split(/(\s+)/);
    
    return (
        <div className="text-lg md:text-xl lg:text-2xl text-white font-medium leading-relaxed drop-shadow-md text-center">
            {parts.map((part, i) => {
                if (part.trim() === '') return <span key={i}>{part}</span>;
                
                return (
                    <span 
                        key={i} 
                        onClick={() => handleWordClick(part)}
                        className="cursor-pointer hover:text-brand-400 hover:underline decoration-brand-400/50 underline-offset-4 transition-all select-none"
                    >
                        {part}
                    </span>
                );
            })}
        </div>
    );
  };

  const renderDetailedFeedback = () => {
    // Compare words using the new comparison logic
    const comparisonResults = compareWords(tokens, wordInputs);

    // Reconstruct full text with punctuation for display
    const fullUserInput = reconstructText(tokens, wordInputs);

    return (
      <div className="w-full max-w-3xl mx-auto relative">
         {/* Glass Panel */}
         <div className="bg-neutral-900/70 backdrop-blur-xl border border-neutral-700/50 rounded-3xl p-8 shadow-soft-xl transform transition-all">
             {/* Correct Text */}
             <div className="mb-5">
                 {renderTokenizedText(targetText)}
             </div>

             {/* Word-by-Word Comparison View */}
             <div className="flex flex-wrap justify-center items-center gap-1.5 text-base font-mono border-t border-neutral-700/50 pt-5">
                <span className="text-xs text-neutral-400 mr-2 font-semibold uppercase tracking-wider">Your Input:</span>
                {tokens.map((token, idx) => {
                  if (token.type === TokenType.WORD) {
                    // Find the comparison result for this word
                    const wordResult = comparisonResults.find(r => r.tokenIndex === token.index);

                    if (!wordResult) return null;

                    const isCorrect = wordResult.isCorrect;
                    const displayWord = wordResult.inputWord || '';

                    return (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-lg ${
                          isCorrect
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 font-semibold bg-rose-500/20 border border-rose-500/40'
                        }`}
                        title={!isCorrect ? `Expected: ${wordResult.targetWord}` : ''}
                      >
                        {displayWord}
                      </span>
                    );
                  } else if (token.type === TokenType.PUNCTUATION) {
                    // Display punctuation as-is (not part of comparison)
                    return (
                      <span key={idx} className="text-neutral-400">
                        {token.value}
                      </span>
                    );
                  } else if (token.type === TokenType.SPACE) {
                    // Display space
                    return <span key={idx}>{token.value}</span>;
                  }
                  return null;
                })}
            </div>
         </div>
      </div>
    );
  };

  useEffect(() => {
    clearReveal();
  }, [targetText, mode]);

  useEffect(() => {
    return () => clearReveal();
  }, []);

  if (mode === PracticeMode.FEEDBACK) {
    return (
      <div className="w-full flex flex-col items-center animate-fade-in gap-5">
        {renderDetailedFeedback()}

        {/* Definition Popover (Absolute over everything) */}
        {selectedWord && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-md" onClick={() => setSelectedWord(null)}>
                <div className="bg-neutral-900/95 border border-neutral-700/50 rounded-3xl p-7 max-w-sm w-full shadow-soft-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-brand-400" />
                            AI Explanation
                        </h3>
                        <button onClick={() => setSelectedWord(null)} className="text-neutral-400 hover:text-white p-1 hover:bg-neutral-700/50 rounded-lg transition-all">
                             <X className="w-5 h-5" />
                        </button>
                    </div>

                    {isLoadingDef ? (
                        <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                            <Loader2 className="w-7 h-7 animate-spin mb-3 text-brand-500" />
                            <p className="text-sm">Consulting Gemini...</p>
                        </div>
                    ) : definitionData ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-baseline gap-2 mb-3">
                                    <span className="text-2xl font-bold text-white">{definitionData.word}</span>
                                    <span className="text-xs text-neutral-400 italic bg-neutral-800/50 border border-neutral-700/50 px-2 py-1 rounded-lg">{definitionData.partOfSpeech}</span>
                                </div>
                                <p className="text-sm text-neutral-200 leading-relaxed">
                                    {definitionData.definition}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-neutral-700/50 flex justify-end gap-2">
                                {onWordToAnki && (
                                    <>
                                        {/* Only Word Button */}
                                        <button
                                            onClick={() => handleAddWordToAnki(false)}
                                            disabled={ankiWordStatus !== 'idle'}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                                ankiWordStatus === 'success-only-word'
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : ankiWordStatus === 'error'
                                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/50'
                                            }`}
                                        >
                                            {ankiWordStatus === 'loading-only-word' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                             ankiWordStatus === 'success-only-word' ? <Check className="w-4 h-4" /> :
                                             <PlusCircle className="w-4 h-4" />}
                                            {ankiWordStatus === 'success-only-word' ? 'Added' : 'Word Only'}
                                        </button>

                                        {/* With Audio Button */}
                                        <button
                                            onClick={() => handleAddWordToAnki(true)}
                                            disabled={ankiWordStatus !== 'idle'}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                                ankiWordStatus === 'success-with-audio'
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : ankiWordStatus === 'error'
                                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                : 'bg-brand-500 hover:bg-brand-600 text-white border border-brand-500/50'
                                            }`}
                                        >
                                            {ankiWordStatus === 'loading-with-audio' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                             ankiWordStatus === 'success-with-audio' ? <Check className="w-4 h-4" /> :
                                             <PlusCircle className="w-4 h-4" />}
                                            {ankiWordStatus === 'success-with-audio' ? 'Added' : 'With Audio'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">Failed to load definition.</div>
                    )}
                </div>
            </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onReplay(false)}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800/60 hover:bg-neutral-800 hover:text-white text-neutral-300 rounded-2xl text-sm font-semibold transition-all border border-neutral-700/50 backdrop-blur-md"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => onComplete(true)}
            autoFocus
            className="flex items-center gap-2 px-7 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-sm font-bold shadow-soft transition-all active:scale-[0.98]"
          >
            Next Line
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Input Mode - Render tokens with input fields for words and static display for punctuation
  let wordInputIndex = 0;

  return (
    <div className="w-full max-w-5xl mx-auto relative group px-4">
       <form onSubmit={handleSubmit} className="relative w-full flex flex-wrap justify-center gap-2 items-center">
          {tokens.map((token: Token, tokenIndex: number) => {
            if (token.type === TokenType.WORD) {
              const currentWordIndex = wordInputIndex;
              wordInputIndex++;

              return (
                <div key={tokenIndex} className="relative inline-flex">
                  <input
                    ref={el => { inputRefs.current[currentWordIndex] = el; }}
                    type="text"
                    value={wordInputs[currentWordIndex] || ''}
                    onChange={(e) => handleInputChange(currentWordIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(currentWordIndex, e)}
                    onPaste={handlePaste}
                    style={{ minWidth: '3ch', width: `${Math.max(3, token.value.length + 1)}ch` }}
                    className={`bg-neutral-900/60 backdrop-blur-xl border focus:bg-neutral-900/80 focus:ring-2 text-white text-xl md:text-2xl p-3 rounded-xl outline-none shadow-soft transition-all text-center font-medium placeholder-neutral-700 ${
                      wordInputs[currentWordIndex] && isInputCorrectFlexibleCase(wordInputs[currentWordIndex], token.value)
                        ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30 bg-emerald-500/10'
                        : 'border-neutral-700/50 focus:border-brand-500 focus:ring-brand-500/30'
                    }`}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {revealedWordIndex === currentWordIndex && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900/95 text-brand-300 text-sm font-semibold px-4 py-2 rounded-xl border border-brand-500/40 shadow-soft-lg whitespace-nowrap pointer-events-none animate-scale-in">
                      {token.value}
                    </div>
                  )}
                </div>
              );
            } else if (token.type === TokenType.PUNCTUATION) {
              // Display punctuation as static text
              return (
                <span
                  key={tokenIndex}
                  className="text-white text-xl md:text-2xl font-medium select-none"
                >
                  {token.value}
                </span>
              );
            } else if (token.type === TokenType.SPACE) {
              // Render space (already handled by gap in flex, but keep for accuracy)
              return <span key={tokenIndex} className="w-1"></span>;
            }
            return null;
          })}

          <button
            type="submit"
            disabled={wordInputs.every(w => w === '')}
            className="ml-3 p-3.5 bg-brand-500 text-white rounded-full hover:bg-brand-600 disabled:opacity-0 disabled:scale-90 disabled:pointer-events-none transition-all shadow-soft flex-shrink-0 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
       </form>

       {/* Hint / Help Text */}
       <div className="mt-5 text-center animate-pulse text-neutral-400 text-xs font-medium">
          <span className="bg-neutral-900/50 px-4 py-2 rounded-xl border border-neutral-700/50 backdrop-blur-md">
            Type words • Auto-advance when correct • Space for next • Ctrl+X to peek word
          </span>
       </div>
    </div>
  );
};

export default InputFeedback;
