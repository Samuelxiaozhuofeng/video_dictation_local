import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Bookmark, Check, RotateCcw, PlayCircle, Home as HomeIcon, Pencil, EyeOff } from 'lucide-react';
import { PracticeMode, LearningMode, BlurPlaybackMode } from '../types';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { Btn, Card, Stamp, Seg } from './ui';
import DictationLine from './DictationLine';
import BlurLine from './BlurLine';
import Transport from './Transport';
import SavedDrawer from './SavedDrawer';
import DefinitionPanel, { DefinitionState, emptyDefinition } from './DefinitionPanel';
import { tokenizeText, getWordTokens } from '../utils/textTokenizer';

// The practice room: a TV (video) over a chyron (the line you work on) over a remote (Transport).
const Studio: React.FC = () => {
  const { practice, video, saved, anki, actions } = usePracticeContext();
  const { subtitles, fullSubtitles, sections, currentSectionIndex, currentSubtitleIndex, mode, showSectionComplete, showComplete, learningMode, blurPlaybackMode, videoName } = practice;
  const { videoRef, videoSrc, isPlaying } = video;
  const { savedIds, showSavedList } = saved;
  const { ankiStatus } = anki;

  const currentSub = subtitles[currentSubtitleIndex];
  const isBlur = learningMode === LearningMode.BLUR;
  const isStep = blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE;

  // --- Word lookup (shared by both modes) ---
  const [def, setDef] = useState<DefinitionState>(emptyDefinition);
  const [pinned, setPinned] = useState(false);
  const lookupSeq = useRef(0);

  const lookup = async (word: string) => {
    const seq = ++lookupSeq.current;
    setDef({ word, data: null, loading: true, failed: false });
    try {
      const data = await AI.getWordDefinition(word, currentSub?.text ?? '');
      if (seq === lookupSeq.current) setDef({ word, data, loading: false, failed: false });
    } catch (e) {
      if (seq === lookupSeq.current) setDef({ word, data: null, loading: false, failed: true, error: (e as Error).message });
    }
  };
  const closeDef = () => { lookupSeq.current++; setDef(emptyDefinition); setPinned(false); };

  useEffect(() => { if (!pinned) { lookupSeq.current++; setDef(emptyDefinition); } }, [currentSubtitleIndex, currentSectionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes whichever panel is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showSavedList) actions.onToggleSavedList(false);
      else if (def.word || pinned) closeDef();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSavedList, def.word, pinned, actions]);

  const defOpen = pinned || def.word !== null;
  const showCenterPlay = !isPlaying && mode === PracticeMode.LISTENING && ankiStatus !== 'recording' && !showSectionComplete && !showComplete;

  return (
    <div className="relative h-full flex flex-col bg-paper">
      {/* --- Top strip --- */}
      <header className="shrink-0 h-14 border-b border-line bg-page px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Btn size="sm" flat onClick={actions.onExit} title="Back to your videos"><HomeIcon size={14} /> <span className="hidden sm:inline">Videos</span></Btn>
          <span className="font-serif font-semibold truncate min-w-0" title={videoName}>{videoName}</span>
          {sections.length > 1 && (
            <div className="inline-flex items-center gap-1 shrink-0 text-xs text-mute">
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex - 1)} disabled={currentSectionIndex === 0} title="Previous section"><ChevronLeft size={16} /></Btn>
              <span className="font-mono">Part {currentSectionIndex + 1}/{sections.length}</span>
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex + 1)} disabled={currentSectionIndex === sections.length - 1} title="Next section"><ChevronRight size={16} /></Btn>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Stamp tone={isBlur ? 'ochre-soft' : 'green-soft'} className="hidden sm:inline-flex">{isBlur ? <><EyeOff size={12} /> Blur</> : <><Pencil size={12} /> Dictation</>}</Stamp>
          <Btn size="sm" flat onClick={() => actions.onToggleSavedList(!showSavedList)} title="Saved lines from this video" className={showSavedList ? '!bg-ochre-soft !text-ochre' : ''}>
            <Bookmark size={14} /> <span className="hidden sm:inline">Saved</span>{savedIds.size > 0 && <span className="font-mono">{savedIds.size}</span>}
          </Btn>
        </div>
      </header>

      {/* --- Stage --- */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
        {videoSrc ? (
          <video ref={videoRef} src={videoSrc} onLoadedMetadata={() => actions.onReplayCurrent()} className="rounded-lg border border-line shadow-card bg-ink block max-h-full max-w-full" />
        ) : (
          <Card tone="paper" flat className="p-6 text-mute">No video loaded</Card>
        )}

        {showCenterPlay && (
          <button onClick={actions.onTogglePlay} className="absolute inset-0 flex items-center justify-center" aria-label="Play">
            <span className="press rounded-full bg-green text-page shadow-lift w-20 h-20 flex items-center justify-center"><Play size={34} fill="currentColor" className="ml-1" /></span>
          </button>
        )}

      </div>

      {/* --- Chyron --- */}
      <div className="shrink-0 px-4 sm:px-6 pb-4">
        <Card className="max-w-5xl mx-auto ruled margin-rule pl-14 pr-5 sm:pr-6 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <Stamp tone="ochre-soft">Line {currentSubtitleIndex + 1} / {subtitles.length}</Stamp>
              {currentSub && <span className="text-mute">{Storage.formatTimeCode(currentSub.startTime)} – {Storage.formatTimeCode(currentSub.endTime)}</span>}
            </div>
            {isBlur && (
              <Seg size="sm" value={blurPlaybackMode} onChange={actions.onSetBlurPlaybackMode} options={[
                { value: BlurPlaybackMode.SENTENCE_BY_SENTENCE, label: 'Step', title: 'Pause after every line' },
                { value: BlurPlaybackMode.CONTINUOUS, label: 'Flow', title: 'Keep playing; pause yourself' },
              ]} />
            )}
          </div>

          <div className="min-h-[72px] flex items-center justify-center">
            {!currentSub ? (
              <span className="font-serif italic text-mute">End of this part</span>
            ) : isBlur ? (
              <div className="w-full flex flex-col items-center gap-4">
                <BlurLine text={currentSub.text} onLookup={lookup} />
                {isStep && !isPlaying && (
                  <Btn tone="green" onClick={actions.onContinue}>Next line <ChevronRight size={16} /></Btn>
                )}
              </div>
            ) : mode === PracticeMode.LISTENING ? (
              <ListeningGhost text={currentSub.text} />
            ) : (
              <DictationLine
                targetText={currentSub.text}
                mode={mode}
                onComplete={correct => (correct ? actions.onContinue() : actions.onInputComplete(correct))}
                onReplay={actions.onReplayCurrent}
                onLookup={lookup}
              />
            )}
          </div>
        </Card>
      </div>

      {showSectionComplete && (
        <Overlay title={`Section ${currentSectionIndex + 1} done`} body="Nice. Keep the momentum or go back over it.">
          <Btn onClick={() => actions.onSetShowSectionComplete(false)}><RotateCcw size={16} /> Review</Btn>
          <Btn tone="green" onClick={actions.onNextSection} autoFocus><PlayCircle size={16} /> Next section</Btn>
        </Overlay>
      )}

      {showComplete && (
        <Overlay title="Fin" body={`You worked through every line of “${videoName}”.`} stats={[
          [String(fullSubtitles.length), 'lines'],
          [String(savedIds.size), 'saved'],
        ]}>
          <Btn onClick={actions.onRestart}><RotateCcw size={16} /> Start over</Btn>
          <Btn tone="green" onClick={actions.onExit} autoFocus><HomeIcon size={16} /> Back to videos</Btn>
        </Overlay>
      )}

      <Transport />

      {showSavedList && <SavedDrawer />}
      {defOpen && (
        <DefinitionPanel def={def} pinned={pinned} onTogglePin={() => setPinned(p => !p)} onClose={closeDef} onWordToAnki={actions.onWordToAnki} />
      )}
    </div>
  );
};

// One covered block per word while the line plays: shows how much is coming, not what.
const ListeningGhost: React.FC<{ text: string }> = ({ text }) => {
  const words = getWordTokens(tokenizeText(text));
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 font-mono text-xl sm:text-2xl">
        {words.map((w, i) => (
          <span key={i} className="inline-block h-8 border-b-2 border-dashed border-line" style={{ width: `${Math.max(3, w.value.length + 1)}ch` }} />
        ))}
      </div>
      <Stamp tone="green-soft"><span className="blink">●</span> Listening</Stamp>
    </div>
  );
};

const Overlay: React.FC<{ title: string; body: string; stats?: [string, string][]; children: React.ReactNode }> = ({ title, body, stats, children }) => (
  <div className="absolute inset-0 z-20 bg-ink/60 flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-lift fade-in">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-green-soft text-green flex items-center justify-center"><Check size={22} /></span>
        <h2 className="font-serif text-3xl font-semibold leading-none">{title}</h2>
      </div>
      <div className="px-6 pb-5 space-y-4">
        <p className="text-sm text-mute leading-relaxed">{body}</p>
        {stats && (
          <div className="flex gap-3">
            {stats.map(([n, label]) => (
              <div key={label} className="flat bg-paper px-4 py-3 flex-1">
                <div className="font-serif text-3xl font-semibold leading-none">{n}</div>
                <div className="text-xs text-mute mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-line flex justify-end gap-3">{children}</div>
    </Card>
  </div>
);

export default Studio;
