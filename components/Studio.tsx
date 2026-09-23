import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Bookmark, Check, RotateCcw, PlayCircle, Home as HomeIcon, Pencil, EyeOff, Scissors } from 'lucide-react';
import { PracticeMode, LearningMode, BlurPlaybackMode, ClozeLevel } from '../types';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { useBreakdown } from '../hooks/useBreakdown';
import { Btn, Card, Stamp, Seg } from './ui';
import DictationLine from './DictationLine';
import BlurLine from './BlurLine';
import Transport from './Transport';
import SavedDrawer from './SavedDrawer';
import DefinitionPanel, { DefinitionState, emptyDefinition } from './DefinitionPanel';
import { tokenizeText, getWordTokens } from '../utils/textTokenizer';
import { useT } from '../utils/i18n';
import { canCloze, loadOrBuildCloze, pickBlanks } from '../utils/aiDrills';
import { readCacheText, writeCacheText } from '../utils/desktop';

// The practice room: a TV (video) over a chyron (the line you work on) over a remote (Transport).
const Studio: React.FC = () => {
  const t = useT();
  const { practice, video, saved, anki, actions } = usePracticeContext();
  const { videoId, subtitles, fullSubtitles, sections, currentSectionIndex, currentSubtitleIndex, mode, showSectionComplete, showComplete, learningMode, blurPlaybackMode, videoName } = practice;
  const { videoRef, videoSrc, isPlaying } = video;
  const { savedIds, showSavedList } = saved;
  const { ankiStatus } = anki;

  const currentSub = subtitles[currentSubtitleIndex];
  const isBlur = learningMode === LearningMode.BLUR;
  const isStep = blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE;
  const hasClozeAi = canCloze();
  const [clozeLevel, setClozeLevel] = useState<ClozeLevel>(() => Storage.getPracticeConfig().clozeLevel ?? 'full');
  const [rankedLines, setRankedLines] = useState<(number[] | null)[] | null>(null);
  const [clozeProgress, setClozeProgress] = useState<{ done: number; total: number } | null>(null);
  const effectiveLevel: ClozeLevel = hasClozeAi ? clozeLevel : 'full';
  const lineTexts = useMemo(() => fullSubtitles.map(s => s.text), [fullSubtitles]);
  // The record id alone keys the cache; the line texts ride along in the hash
  // inside the cache file, so a re-cut subtitle invalidates it there, not here.
  const clozeKey = videoId ?? '';
  const lineIndex = currentSub ? fullSubtitles.findIndex(s => s.id === currentSub.id) : -1;
  const wordN = currentSub ? getWordTokens(tokenizeText(currentSub.text)).length : 0;
  const blanks = useMemo(
    () => pickBlanks(rankedLines?.[lineIndex] ?? null, wordN, effectiveLevel),
    [rankedLines, lineIndex, wordN, effectiveLevel],
  );
  const clozeJob = useRef<{ key: string; promise: Promise<(number[] | null)[]> } | null>(null);

  useEffect(() => {
    setRankedLines(null);
    setClozeProgress(null);
    clozeJob.current = null;
  }, [clozeKey]);

  useEffect(() => {
    if (isBlur || effectiveLevel === 'full' || rankedLines || lineTexts.length === 0) return;
    let cancelled = false;
    const jobKey = clozeKey;
    if (!clozeJob.current || clozeJob.current.key !== jobKey) {
      // Progress is gated on this exact job, not its key: a replaced job for the
      // same video (StrictMode re-run, switching away and back) can report after
      // the live one finished and leave "preparing 1/1" stuck on screen.
      const job = { key: jobKey, promise: Promise.resolve<(number[] | null)[]>([]) };
      clozeJob.current = job;
      job.promise = loadOrBuildCloze({
        lineTexts,
        recordId: videoId,
        subtitleText: lineTexts.join('\n'),
        readText: id => readCacheText(id, 'cloze'),
        writeText: (id, text) => writeCacheText(id, 'cloze', text),
        onProgress: (done, total) => { if (clozeJob.current === job) setClozeProgress({ done, total }); },
      });
    }
    clozeJob.current.promise.then(ranked => {
      if (cancelled) return;
      setRankedLines(ranked);
      setClozeProgress(null);
    }).catch(() => {
      if (!cancelled) setClozeProgress(null);
    });
    return () => { cancelled = true; };
  }, [isBlur, effectiveLevel, rankedLines, lineTexts, clozeKey]);

  // --- Break it down: the points on a clean voice, then the whole line on the video's ---
  // Only while typing a dictation line: leaving INPUT (feedback, a seek, a new
  // line) drops any breakdown, so a late AI answer cannot start one elsewhere.
  const bd = useBreakdown(!isBlur && mode === PracticeMode.INPUT ? currentSub : undefined, videoId);
  const bdActive = bd.state.status === 'active' ? bd.state : null;
  const bdStep = bdActive ? bdActive.steps[bdActive.step] : null;
  const bdLast = !!bdActive && bdActive.step === bdActive.steps.length - 1;
  // The last step is the whole line: finishing it moves on like a normal line.
  const bdNext = () => { if (!bd.next()) { bd.cancel(); actions.onContinue(); } };
  const bdReplay = () => { if (!bd.play()) actions.onReplayCurrent(); };

  useEffect(() => {
    actions.onSetStepReplay(bdStep && !bdLast ? () => bd.play() : null);
    if (bdStep) bdReplay();
  }, [bdStep]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => actions.onSetStepReplay(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  // A correct line is replaying on its way to the next one; stop it so that
  // auto-advance does not swallow the breakdown the user just asked for.
  const startBreakdown = () => { if (isPlaying) actions.onTogglePlay(); bd.start(); };

  // The global Enter shortcut only knows the app-wide FEEDBACK mode; a step's
  // review needs its own.
  useEffect(() => {
    if (!bdActive?.reviewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      bdNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bdActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLevel = (level: ClozeLevel) => {
    if (level !== 'full' && !hasClozeAi) return;
    setClozeLevel(level);
    Storage.savePracticeConfig({ ...Storage.getPracticeConfig(), clozeLevel: level });
  };

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
      <header className="shrink-0 h-14 border-b border-line bg-page pl-[80px] pr-3 sm:pr-4 flex items-center justify-between gap-3" data-tauri-drag-region="deep">
        <div className="flex items-center gap-3 min-w-0">
          <Btn size="sm" flat onClick={actions.onExit} title={t('studio.backToVideos')}><HomeIcon size={14} /> <span className="hidden sm:inline">{t('nav.videos')}</span></Btn>
          <span className="font-serif font-semibold truncate min-w-0" title={videoName}>{videoName}</span>
          {sections.length > 1 && (
            <div className="inline-flex items-center gap-1 shrink-0 text-xs text-mute">
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex - 1)} disabled={currentSectionIndex === 0} title={t('studio.previousSection')}><ChevronLeft size={16} /></Btn>
              <span className="font-mono">{t('studio.part', { current: currentSectionIndex + 1, total: sections.length })}</span>
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex + 1)} disabled={currentSectionIndex === sections.length - 1} title={t('studio.nextSection')}><ChevronRight size={16} /></Btn>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Stamp tone={isBlur ? 'ochre-soft' : 'green-soft'} className="hidden sm:inline-flex">{isBlur ? <><EyeOff size={12} /> {t('studio.blurBadge')}</> : <><Pencil size={12} /> {t('studio.dictationBadge')}</>}</Stamp>
          <Btn size="sm" flat onClick={() => actions.onToggleSavedList(!showSavedList)} title={t('studio.savedLinesFromVideo')} className={showSavedList ? '!bg-ochre-soft !text-ochre' : ''}>
            <Bookmark size={14} /> <span className="hidden sm:inline">{t('nav.saved')}</span>{savedIds.size > 0 && <span className="font-mono">{savedIds.size}</span>}
          </Btn>
        </div>
      </header>

      {/* --- Stage --- */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
        {videoSrc ? (
          <video ref={videoRef} crossOrigin="anonymous" src={videoSrc} onLoadedMetadata={() => actions.onReplayCurrent()} className="rounded-lg border border-line shadow-card bg-ink block max-h-full max-w-full" />
        ) : (
          <Card tone="paper" flat className="p-6 text-mute">{t('studio.noVideoLoaded')}</Card>
        )}

        {showCenterPlay && (
          <button onClick={actions.onTogglePlay} className="absolute inset-0 flex items-center justify-center" aria-label={t('studio.playAriaLabel')}>
            <span className="press rounded-full bg-green text-page shadow-lift w-20 h-20 flex items-center justify-center"><Play size={34} fill="currentColor" className="ml-1" /></span>
          </button>
        )}

      </div>

      {/* --- Chyron --- */}
      <div className="shrink-0 px-4 sm:px-6 pb-4">
        <Card className="max-w-5xl mx-auto ruled margin-rule pl-14 pr-5 sm:pr-6 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <Stamp tone="ochre-soft">{t('studio.lineCount', { current: currentSubtitleIndex + 1, total: subtitles.length })}</Stamp>
              {currentSub && <span className="text-mute">{Storage.formatTimeCode(currentSub.startTime)} – {Storage.formatTimeCode(currentSub.endTime)}</span>}
            </div>
            {isBlur ? (
              <Seg size="sm" value={blurPlaybackMode} onChange={actions.onSetBlurPlaybackMode} options={[
                { value: BlurPlaybackMode.SENTENCE_BY_SENTENCE, label: t('studio.stepLabel'), title: t('studio.stepTitle') },
                { value: BlurPlaybackMode.CONTINUOUS, label: t('studio.flowLabel'), title: t('studio.flowTitle') },
              ]} />
            ) : (
              <div className="flex items-center gap-2">
                <Seg size="sm" value={effectiveLevel} onChange={setLevel} options={[
                  { value: 'easy', label: hasClozeAi ? t('studio.clozeEasy') : <span className="opacity-40">{t('studio.clozeEasy')}</span>, title: hasClozeAi ? t('studio.clozeEasyTitle') : t('studio.clozeNeedKey') },
                  { value: 'medium', label: hasClozeAi ? t('studio.clozeMedium') : <span className="opacity-40">{t('studio.clozeMedium')}</span>, title: hasClozeAi ? t('studio.clozeMediumTitle') : t('studio.clozeNeedKey') },
                  { value: 'full', label: t('studio.clozeFull'), title: t('studio.clozeFullTitle') },
                ]} />
                {!hasClozeAi && <span className="text-[11px] text-mute max-w-[12rem] leading-tight">{t('studio.clozeNeedKey')}</span>}
                {clozeProgress && effectiveLevel !== 'full' && <span className="text-[11px] text-mute">{t('studio.clozePreparing', clozeProgress)}</span>}
              </div>
            )}
          </div>

          <div className="min-h-[72px] flex items-center justify-center">
            {!currentSub ? (
              <span className="font-serif italic text-mute">{t('studio.endOfPart')}</span>
            ) : isBlur ? (
              <div className="w-full flex flex-col items-center gap-4">
                <BlurLine text={currentSub.text} onLookup={lookup} />
                {isStep && !isPlaying && (
                  <Btn tone="green" onClick={actions.onContinue}>{t('common.nextLine')} <ChevronRight size={16} /></Btn>
                )}
              </div>
            ) : bdActive && bdStep ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <Stamp tone="green-soft"><Scissors size={12} /> {t('studio.breakdownStep', { current: bdActive.step + 1, total: bdActive.steps.length })}</Stamp>
                  <span className="text-[11px] text-mute">{bdLast ? t('studio.breakdownOriginal') : t('studio.breakdownClean')}</span>
                  <Btn size="sm" flat onClick={bd.cancel} title={t('studio.breakdownQuitTitle')}>{t('studio.breakdownQuit')}</Btn>
                </div>
                <DictationLine
                  key={`${bdActive.lineId}-${bdActive.step}`}
                  targetText={bdStep.text}
                  mode={bdActive.reviewing ? PracticeMode.FEEDBACK : PracticeMode.INPUT}
                  onComplete={() => (bdActive.reviewing ? bdNext() : bd.review())}
                  onReplay={allRight => { if (allRight) bd.review(); bdReplay(); }}
                  onLookup={lookup}
                  nextLabel={bdLast ? undefined : t('dictation.nextStep')}
                />
                {bdActive.reviewing && (bdLast ? bdActive.steps.slice(0, -1) : [bdStep]).map(s => (
                  <p key={s.text} className="max-w-2xl text-center text-sm sm:text-base text-ink/80 bg-paper border border-line rounded-md px-3 py-1.5 fade-in">{s.note}</p>
                ))}
              </div>
            ) : mode === PracticeMode.LISTENING ? (
              <ListeningGhost text={currentSub.text} blanks={blanks} />
            ) : (
              <div className="w-full">
                <DictationLine
                  targetText={currentSub.text}
                  mode={mode}
                  blanks={blanks}
                  onComplete={correct => (correct ? actions.onContinue() : actions.onInputComplete(correct))}
                  onReplay={actions.onReplayCurrent}
                  onLookup={lookup}
                />
                {mode === PracticeMode.INPUT && (
                  <div className="mt-1 flex justify-center items-center gap-2 text-[11px] text-mute">
                    <Btn
                      size="sm" flat className="!text-mute disabled:opacity-40"
                      disabled={!hasClozeAi || bd.tooShort || bd.state.status === 'loading'}
                      onClick={startBreakdown}
                      title={!hasClozeAi ? t('studio.breakdownNeedKey') : bd.tooShort ? t('studio.breakdownTooShort') : t('studio.breakdownTitle')}
                    >
                      <Scissors size={13} /> {bd.state.status === 'loading' ? t('studio.breakdownLoading') : t('studio.breakdown')}
                    </Btn>
                    {!hasClozeAi && <span>{t('studio.breakdownNeedKey')}</span>}
                    {bd.state.status === 'failed' && <span>{t('studio.breakdownFailed')}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {showSectionComplete && (
        <Overlay title={t('studio.sectionDoneTitle', { n: currentSectionIndex + 1 })} body={t('studio.sectionDoneBody')}>
          <Btn onClick={() => actions.onSetShowSectionComplete(false)}><RotateCcw size={16} /> {t('studio.review')}</Btn>
          <Btn onClick={actions.onStopAfterSection}><HomeIcon size={16} /> {t('studio.stopHere')}</Btn>
          <Btn tone="green" onClick={actions.onNextSection} autoFocus><PlayCircle size={16} /> {t('studio.nextSection')}</Btn>
        </Overlay>
      )}

      {showComplete && (
        <Overlay title={t('studio.finTitle')} body={t('studio.finBody', { name: videoName })} stats={[
          [String(fullSubtitles.length), t('studio.statLines')],
          [String(savedIds.size), t('studio.statSaved')],
        ]}>
          <Btn onClick={actions.onRestart}><RotateCcw size={16} /> {t('studio.startOver')}</Btn>
          <Btn tone="green" onClick={actions.onExit} autoFocus><HomeIcon size={16} /> {t('studio.backToVideosBtn')}</Btn>
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

// One covered block per word while the line plays: given words show as text, blanks as dashes.
const ListeningGhost: React.FC<{ text: string; blanks: number[] }> = ({ text, blanks }) => {
  const t = useT();
  const words = getWordTokens(tokenizeText(text));
  const set = new Set(blanks);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 font-mono text-xl sm:text-2xl">
        {words.map((w, i) => set.has(i) ? (
          <span key={i} className="inline-block h-8 border-b-2 border-dashed border-line" style={{ width: `${Math.max(3, w.value.length + 1)}ch` }} />
        ) : (
          <span key={i} className="inline-block h-8 text-ink/70 leading-8">{w.value}</span>
        ))}
      </div>
      <Stamp tone="green-soft"><span className="blink">●</span> {t('studio.listening')}</Stamp>
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
