import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, RefreshCw, ArrowRight, Sparkles, Loader2, PlusCircle, Check, X } from 'lucide-react';
import { PracticeMode } from '../types';
import * as AI from '../utils/ai';
import { tokenizeText, getWordTokens, isInputCorrect, areAllWordsCorrect, Token, TokenType } from '../utils/textTokenizer';

interface InputFeedbackProps {
  targetText: string;
  mode: PracticeMode;
  onComplete: (wasCorrect: boolean) => void;
  onReplay: (autoAdvanceAfter?: boolean) => void;
  onWordToAnki?: (word: string, definition: string) => Promise<void>;
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
  const [ankiWordStatus, setAnkiWordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...wordInputs];
    newInputs[index] = value;
    setWordInputs(newInputs);

    // Auto-advance: if current word is correct, move to next input
    const currentWordToken = wordTokens[index];
    if (currentWordToken && isInputCorrect(value, currentWordToken.value)) {
      // Word is correct, move to next
      if (index < wordTokens.length - 1) {
        // Move to next input field
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
        }, 100);
      } else {
        // This was the last word, check if all are correct
        if (areAllWordsCorrect(tokens, newInputs)) {
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
       const fullInput = wordInputs.join(' ').trim();
       if (fullInput.length > 0) {
          onComplete(fullInput.toLowerCase() === targetText.trim().toLowerCase());
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

  const handleAddWordToAnki = async () => {
      if (!onWordToAnki || !selectedWord || !definitionData) return;
      
      setAnkiWordStatus('loading');
      try {
          const defString = `<b>${definitionData.word}</b> <i>(${definitionData.partOfSpeech})</i><br/>${definitionData.definition}`;
          await onWordToAnki(selectedWord, defString);
          setAnkiWordStatus('success');
      } catch (e) {
          setAnkiWordStatus('error');
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
    const fullInput = wordInputs.join(' ');
    const inputArray: string[] = Array.from(fullInput);
    const targetArray: string[] = Array.from(targetText);

    return (
      <div className="w-full max-w-3xl mx-auto relative">
         {/* Glass Panel */}
         <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl transform transition-all">
             {/* Correct Text */}
             <div className="mb-3">
                 {renderTokenizedText(targetText)}
             </div>
             
             {/* Diff View (Compact) */}
             <div className="flex flex-wrap justify-center items-center gap-0.5 text-sm font-mono border-t border-white/10 pt-3 opacity-90">
                <span className="text-xs text-slate-400 mr-2">YOU:</span>
                {inputArray.map((char, idx) => {
                    const targetChar = targetArray[idx];
                    const isCorrect = targetChar && char.toLowerCase() === targetChar.toLowerCase();
                    return (
                    <span 
                        key={idx} 
                        className={`${isCorrect ? 'text-emerald-400' : 'text-rose-400 font-bold bg-rose-500/10'}`}
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                    );
                })}
            </div>
         </div>
      </div>
    );
  };

  if (mode === PracticeMode.FEEDBACK) {
    return (
      <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300 gap-4">
        {renderDetailedFeedback()}
        
        {/* Definition Popover (Absolute over everything) */}
        {selectedWord && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onClick={() => setSelectedWord(null)}>
                <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-brand-400" />
                            AI Explanation
                        </h3>
                        <button onClick={() => setSelectedWord(null)} className="text-slate-400 hover:text-white">
                             <X className="w-5 h-5" />
                        </button>
                    </div>

                    {isLoadingDef ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mb-2 text-brand-500" />
                            <p className="text-sm">Consulting Gemini...</p>
                        </div>
                    ) : definitionData ? (
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-bold text-white">{definitionData.word}</span>
                                    <span className="text-xs text-slate-400 italic border border-slate-700 px-1.5 py-0.5 rounded">{definitionData.partOfSpeech}</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                                    {definitionData.definition}
                                </p>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-800 flex justify-end">
                                {onWordToAnki && (
                                    <button 
                                        onClick={handleAddWordToAnki}
                                        disabled={ankiWordStatus !== 'idle'}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            ankiWordStatus === 'success' 
                                            ? 'bg-emerald-500/20 text-emerald-400' 
                                            : ankiWordStatus === 'error'
                                            ? 'bg-rose-500/20 text-rose-400'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                        }`}
                                    >
                                        {ankiWordStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                                         ankiWordStatus === 'success' ? <Check className="w-3.5 h-3.5" /> :
                                         <PlusCircle className="w-3.5 h-3.5" />}
                                        {ankiWordStatus === 'success' ? 'Added' : 'Add to Anki'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-rose-400 text-sm">Failed to load definition.</div>
                    )}
                </div>
            </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onReplay(false)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 rounded-full text-sm font-medium transition-colors border border-white/10 backdrop-blur"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => onComplete(true)}
            autoFocus
            className="flex items-center gap-2 px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-full text-sm font-bold shadow-lg shadow-brand-900/30 transition-all"
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
       <form onSubmit={handleSubmit} className="relative w-full flex flex-wrap justify-center gap-1 items-center">
          {tokens.map((token: Token, tokenIndex: number) => {
            if (token.type === TokenType.WORD) {
              const currentWordIndex = wordInputIndex;
              wordInputIndex++;

              return (
                <input
                  key={tokenIndex}
                  ref={el => { inputRefs.current[currentWordIndex] = el; }}
                  type="text"
                  value={wordInputs[currentWordIndex] || ''}
                  onChange={(e) => handleInputChange(currentWordIndex, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(currentWordIndex, e)}
                  onPaste={handlePaste}
                  style={{ minWidth: '3ch', width: `${Math.max(3, token.value.length + 1)}ch` }}
                  className={`bg-black/50 backdrop-blur-md border focus:bg-black/70 focus:ring-1 text-white text-xl md:text-2xl p-2 rounded-lg outline-none shadow-lg transition-all text-center font-medium placeholder-slate-700 ${
                    wordInputs[currentWordIndex] && isInputCorrect(wordInputs[currentWordIndex], token.value)
                      ? 'border-emerald-500/50 focus:border-emerald-500 bg-emerald-500/10'
                      : 'border-white/20 focus:border-brand-500'
                  }`}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
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
            className="ml-2 p-3 bg-brand-600 text-white rounded-full hover:bg-brand-500 disabled:opacity-0 disabled:scale-90 disabled:pointer-events-none transition-all shadow-lg flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
       </form>

       {/* Hint / Help Text */}
       <div className="mt-4 text-center animate-pulse text-slate-500 text-xs font-medium">
          <span className="bg-black/40 px-3 py-1 rounded-full border border-white/5">
            Type words • Auto-advance when correct • Space to Next
          </span>
       </div>
    </div>
  );
};

export default InputFeedback;