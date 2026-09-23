import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Bookmark, RotateCcw, ArrowLeft, ArrowRight, Scissors } from 'lucide-react';
import { PracticeMode, LearningMode, BlurPlaybackMode, ClozeLevel } from '../types';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { useBreakdown } from '../hooks/useBreakdown';
import { Btn, Card, Seg, MenuItem } from './ui';
import DictationLine, { LINE } from './DictationLine';
import BlurLine from './BlurLine';
import Transport from './Transport';
import SavedDrawer from './SavedDrawer';
import DefinitionPanel, { DefinitionState, emptyDefinition } from './DefinitionPanel';
import { tokenizeText, getWordTokens } from '../utils/textTokenizer';
import { useT } from '../utils/i18n';
import { canCloze, loadOrBuildCloze, pickBlanks } from '../utils/aiDrills';
import { readCacheText, writeCacheText } from '../utils/desktop';

// The practice room: video on the left, a transcript column on the right (two faded
// past lines over the line you work on), the remote (Transport) along the bottom.
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

  // The two lines just before this one, fading back like a transcript.
  const past = [currentSubtitleIndex - 2, currentSubtitleIndex - 1].filter(i => i >= 0 && subtitles[i]);

  const menuItems: MenuItem[] = [
    { label: <><Bookmark size={15} /> {t('studio.savedLinesFromVideo')}{savedIds.size > 0 && <span className="ml-auto text-mute">{savedIds.size}</span>}</>, onClick: () => actions.onToggleSavedList(true) },
  ];
  if (!isBlur && mode === PracticeMode.INPUT && !bdActive) {
    menuItems.push({
      label: <><Scissors size={15} /> {bd.state.status === 'loading' ? t('studio.breakdownLoading') : t('studio.breakdown')}</>,
      onClick: startBreakdown,
      disabled: !hasClozeAi || bd.tooShort || bd.state.status === 'loading',
      title: !hasClozeAi ? t('studio.breakdownNeedKey') : bd.tooShort ? t('studio.breakdownTooShort') : t('studio.breakdownTitle'),
    });
  }
  const menuPanel = isBlur ? (
    <MenuRow label={t('studio.playbackLabel')}>
      <Seg size="sm" className="w-full [&>button]:flex-1" value={blurPlaybackMode} onChange={actions.onSetBlurPlaybackMode} options={[
        { value: BlurPlaybackMode.SENTENCE_BY_SENTENCE, label: t('studio.stepLabel'), title: t('studio.stepTitle') },
        { value: BlurPlaybackMode.CONTINUOUS, label: t('studio.flowLabel'), title: t('studio.flowTitle') },
      ]} />
    </MenuRow>
  ) : (
    <MenuRow label={t('studio.clozeLabel')} hint={!hasClozeAi ? t('studio.clozeNeedKey') : undefined}>
      <Seg size="sm" className="w-full [&>button]:flex-1" value={effectiveLevel} onChange={setLevel} options={[
        { value: 'easy', label: hasClozeAi ? t('studio.clozeEasy') : <span className="opacity-40">{t('studio.clozeEasy')}</span>, title: hasClozeAi ? t('studio.clozeEasyTitle') : t('studio.clozeNeedKey') },
        { value: 'medium', label: hasClozeAi ? t('studio.clozeMedium') : <span className="opacity-40">{t('studio.clozeMedium')}</span>, title: hasClozeAi ? t('studio.clozeMediumTitle') : t('studio.clozeNeedKey') },
        { value: 'full', label: t('studio.clozeFull'), title: t('studio.clozeFullTitle') },
      ]} />
    </MenuRow>
  );

  return (
    <div className="relative h-full flex flex-col bg-paper">
      {/* --- Top strip --- */}
      <header className="shrink-0 h-14 pl-[80px] pr-4 flex items-center justify-between gap-3 text-sm text-mute" data-tauri-drag-region="deep">
        <div className="flex items-center gap-2 min-w-0">
          <Btn square size="sm" flat onClick={actions.onExit} title={t('studio.backToVideos')} aria-label={t('studio.backToVideos')}><ArrowLeft size={16} /></Btn>
          <span className="truncate min-w-0" title={videoName}>{videoName}</span>
          {sections.length > 1 && (
            <div className="inline-flex items-center shrink-0">
              <span className="text-faint mx-1">/</span>
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex - 1)} disabled={currentSectionIndex === 0} title={t('studio.previousSection')}><ChevronLeft size={15} /></Btn>
              <span>{t('studio.part', { current: currentSectionIndex + 1, total: sections.length })}</span>
              <Btn square size="sm" flat onClick={() => actions.onSwitchSection(currentSectionIndex + 1)} disabled={currentSectionIndex === sections.length - 1} title={t('studio.nextSection')}><ChevronRight size={15} /></Btn>
            </div>
          )}
        </div>
      </header>

      {/* --- Video left, transcript right: tops aligned, the pair centred in the window --- */}
      <div className="relative flex-1 min-h-0 flex flex-col justify-center px-6 lg:px-11 pb-8">
       <div className="min-h-0 flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-12">
        <div className="relative min-w-0 flex-1">
          {videoSrc ? (
            <video ref={videoRef} crossOrigin="anonymous" src={videoSrc} onLoadedMetadata={() => actions.onReplayCurrent()} className="block w-full h-auto max-h-[calc(100vh-190px)] object-contain object-left-top" />
          ) : (
            <p className="text-mute text-sm">{t('studio.noVideoLoaded')}</p>
          )}
          {showCenterPlay && (
            <button onClick={actions.onTogglePlay} className="absolute inset-0 flex items-center justify-center" aria-label={t('studio.playAriaLabel')}>
              <span className="press rounded-full bg-accent text-paper w-16 h-16 flex items-center justify-center"><Play size={26} fill="currentColor" className="ml-1" /></span>
            </button>
          )}
        </div>

        <section className="shrink-0 lg:w-[440px] flex flex-col gap-5 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto" aria-label={t('studio.lineCount', { current: currentSubtitleIndex + 1, total: subtitles.length })}>
          {past.map((i, k) => (
            <p key={subtitles[i].id} className={`font-serif text-xl leading-[28px] ${k === past.length - 1 ? 'opacity-40' : 'opacity-20'}`}>{subtitles[i].text}</p>
          ))}

          <div className="mt-1">
            <div className="min-w-0">
              {!currentSub ? (
                <span className="font-serif italic text-mute text-xl">{t('studio.endOfPart')}</span>
              ) : isBlur ? (
                <div className="flex flex-col items-start gap-5">
                  <BlurLine text={currentSub.text} onLookup={lookup} />
                  {isStep && !isPlaying && (
                    <Btn tone="accent" onClick={actions.onContinue}>{t('common.nextLine')} <ChevronRight size={16} /></Btn>
                  )}
                </div>
              ) : bdActive && bdStep ? (
                <div className="flex flex-col items-start gap-4">
                  <div className="flex items-center gap-3 text-xs text-mute">
                    <span className="inline-flex items-center gap-1.5"><Scissors size={12} /> {t('studio.breakdownStep', { current: bdActive.step + 1, total: bdActive.steps.length })}</span>
                    <span>{bdLast ? t('studio.breakdownOriginal') : t('studio.breakdownClean')}</span>
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
                    <p key={s.text} className="text-[15px] leading-relaxed text-ink/80 fade-in">{s.note}</p>
                  ))}
                </div>
              ) : mode === PracticeMode.LISTENING ? (
                <ListeningGhost text={currentSub.text} blanks={blanks} />
              ) : (
                <>
                  <DictationLine
                    targetText={currentSub.text}
                    mode={mode}
                    blanks={blanks}
                    onComplete={correct => (correct ? actions.onContinue() : actions.onInputComplete(correct))}
                    onReplay={actions.onReplayCurrent}
                    onLookup={lookup}
                  />
                  {mode === PracticeMode.INPUT && (bd.state.status === 'failed' || (clozeProgress && effectiveLevel !== 'full')) && (
                    <p className="mt-3 text-xs text-mute">
                      {bd.state.status === 'failed' ? t('studio.breakdownFailed') : t('studio.clozePreparing', clozeProgress!)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
       </div>
      </div>

      {showSectionComplete && (
        <Overlay title={t('studio.sectionDoneTitle', { n: currentSectionIndex + 1 })} body={t('studio.sectionDoneBody')}>
          <Btn onClick={() => actions.onSetShowSectionComplete(false)}><RotateCcw size={16} /> {t('studio.review')}</Btn>
          <Btn onClick={actions.onStopAfterSection}>{t('studio.stopHere')}</Btn>
          <Btn tone="accent" onClick={actions.onNextSection} autoFocus>{t('studio.nextSection')} <ArrowRight size={16} /></Btn>
        </Overlay>
      )}

      {showComplete && (
        <Overlay title={t('studio.finTitle')} body={t('studio.finBody', { name: videoName })} stats={[
          [String(fullSubtitles.length), t('studio.statLines')],
          [String(savedIds.size), t('studio.statSaved')],
        ]}>
          <Btn onClick={actions.onRestart}><RotateCcw size={16} /> {t('studio.startOver')}</Btn>
          <Btn tone="accent" onClick={actions.onExit} autoFocus>{t('studio.backToVideosBtn')}</Btn>
        </Overlay>
      )}

      <Transport lineLabel={t('studio.lineCount', { current: currentSubtitleIndex + 1, total: subtitles.length })} menuItems={menuItems} menuPanel={menuPanel} />

      {showSavedList && <SavedDrawer />}
      {defOpen && (
        <DefinitionPanel def={def} pinned={pinned} onTogglePin={() => setPinned(p => !p)} onClose={closeDef} onWordToAnki={actions.onWordToAnki} />
      )}
    </div>
  );
};

const MenuRow: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="px-3.5 py-2 flex flex-col gap-2">
    <span className="text-xs text-mute">{label}</span>
    {children}
    {hint && <span className="text-xs text-faint leading-snug max-w-[14rem]">{hint}</span>}
  </div>
);

// One covered slot per word while the line plays: given words show as text, blanks as underlines.
const ListeningGhost: React.FC<{ text: string; blanks: number[] }> = ({ text, blanks }) => {
  const words = getWordTokens(tokenizeText(text));
  const set = new Set(blanks);
  return (
    <div className={LINE}>
      {words.map((w, i) => set.has(i) ? (
        <span key={i} className="inline-block relative top-2 h-[30px] border-b-[1.5px] border-ink/25" style={{ width: `${Math.max(2, w.value.length) * 0.46}em` }} />
      ) : (
        <span key={i} className="text-ink/50">{w.value}</span>
      ))}
    </div>
  );
};

const Overlay: React.FC<{ title: string; body: string; stats?: [string, string][]; children: React.ReactNode }> = ({ title, body, stats, children }) => (
  <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-4">
    <Card className="w-full max-w-md fade-in">
      <div className="px-7 pt-7 pb-5 space-y-3">
        <h2 className="font-serif text-[30px] leading-tight">{title}</h2>
        <p className="text-sm text-mute leading-relaxed">{body}</p>
        {stats && (
          <div className="flex gap-10 pt-3">
            {stats.map(([n, label]) => (
              <div key={label}>
                <div className="font-serif text-[30px] leading-none">{n}</div>
                <div className="text-xs text-mute mt-1.5">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-7 py-4 border-t border-line flex justify-end gap-2">{children}</div>
    </Card>
  </div>
);

export default Studio;
