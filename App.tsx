import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState, PracticeMode, VideoRecord, LearningMode, BlurPlaybackMode } from './types';
import ReviewPage from './components/ReviewPage';
import CardsPage from './components/CardsPage';
import Settings from './components/Settings';
import Home from './components/Home';
import Shell from './components/Shell';
import Studio from './components/Studio';
import { DialogHost, dialog } from './components/Dialog';
import { PracticeProvider } from './hooks/usePracticeContext';
import { useVideoHistory } from './hooks/useVideoHistory';
import { usePracticeSession } from './hooks/usePracticeSession';
import { useAnkiIntegration } from './hooks/useAnkiIntegration';
import { useSavedLines } from './hooks/useSavedLines';
import { useVideoController } from './hooks/useVideoController';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePracticeActions } from './hooks/usePracticeActions';
import * as VideoStorage from './utils/videoStorage';
import { fileNameFromPath, pathExists, pickVideoPath, videoSrcFromPath } from './utils/desktop';
import { t, useLang } from './utils/i18n';
import { markInterruptedJobs, startImportListener } from './utils/importJob';
import { matches } from './utils/shortcuts';
import { countLine } from './utils/today';
import { deleteCards, keepOrphans, orphanCards } from './utils/review';

let orphansAsked = false; // StrictMode runs effects twice in dev
async function askAboutOrphans() {
  if (orphansAsked) return;
  orphansAsked = true;
  const cards = await orphanCards();
  if (!cards.length) return;
  const names = [...new Set(cards.map(c => c.videoName))];
  const ok = await dialog.confirm(
    t('app.orphansTitle', { n: cards.length }),
    t('app.orphansBody', { names: names.slice(0, 3).join(' · ') + (names.length > 3 ? ' …' : '') }),
    { ok: t('app.orphansOk'), cancel: t('app.orphansKeep'), danger: true },
  );
  if (ok) await deleteCards(cards.map(c => c.id));
  else if (ok === false) keepOrphans(cards.map(c => c.id)); // dismissed: ask again next launch
}

export default function App() {
  const lang = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Cards left by videos deleted in older versions: ask once whether they go too.
  useEffect(() => { askAboutOrphans().catch(console.error); }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        await markInterruptedJobs();
      } catch (err) {
        console.error(err);
      }
      try {
        const fn = await startImportListener();
        if (cancelled) fn();
        else unlisten = fn;
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [learningMode, setLearningMode] = useState<LearningMode>(LearningMode.DICTATION);
  const [blurPlaybackMode, setBlurPlaybackModeState] = useState<BlurPlaybackMode>(BlurPlaybackMode.SENTENCE_BY_SENTENCE);
  const [showComplete, setShowComplete] = useState(false);

  const {
    currentVideoId, setCurrentVideoId, createVideoRecord,
    getSubtitleFileFromRecord,
  } = useVideoHistory();

  const {
    fullSubtitles, subtitles, sections, currentSectionIndex, currentSubtitleIndex, mode,
    showSectionComplete, shouldAutoAdvance,
    setSubtitles, setCurrentSectionIndex, setCurrentSubtitleIndex, setMode, setShowSectionComplete, setShouldAutoAdvance,
    switchSection, handleContinue: practiceHandleContinue, handleNextSection, initializePractice,
  } = usePracticeSession({ videoId: currentVideoId, appState });

  const {
    savedIds, showSavedList, savedItems, setShowSavedList,
    toggleSave: savedLinesToggleSave, deleteSavedItem: savedLinesDeleteSavedItem,
    isCurrentSaved: savedLinesIsCurrentSaved,
  } = useSavedLines({ videoId: currentVideoId, fullSubtitles, videoFileName });

  const finishPractice = useCallback(() => {
    setShowComplete(true);
    if (currentVideoId) VideoStorage.updateProgress(currentVideoId, fullSubtitles.length, currentSectionIndex);
  }, [currentVideoId, fullSubtitles.length, currentSectionIndex]);

  const {
    videoRef, videoSrc, setVideoSrc, isPlaying, volume, playbackSpeed, progress,
    setIsPlaying, setVolume, setPlaybackSpeed, togglePlay,
    handleProgressSeek: videoPlayerHandleProgressSeek, handleReplayCurrent,
  } = useVideoController({
    subtitles, currentSubtitleIndex, mode, shouldAutoAdvance, learningMode, blurPlaybackMode,
    onModeChange: setMode,
    onAutoAdvance: () => {
      // Continuous blur play rolls past lines on its own; those aren't practised.
      if (!(learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS)) countLine();
      if (currentSubtitleIndex < subtitles.length - 1) {
        setCurrentSubtitleIndex(prev => prev + 1);
        setMode(PracticeMode.LISTENING);
        setAnkiStatus('idle');
      } else if (currentSectionIndex < sections.length - 1) {
        setShowSectionComplete(true);
      } else {
        finishPractice();
      }
    },
    onShouldAutoAdvanceChange: setShouldAutoAdvance,
  });

  const {
    ankiConfig, ankiStatus, setAnkiStatus,
    handleAddToAnki: ankiHandleAddToAnki, handleWordToAnki: ankiHandleWordToAnki, reloadConfig: reloadAnkiConfig,
  } = useAnkiIntegration({ videoRef, videoFileName });

  // Settings autosaves; pick the latest Anki config up whenever we leave that page.
  useEffect(() => {
    if (appState !== AppState.SETTINGS) reloadAnkiConfig();
  }, [appState, reloadAnkiConfig]);

  // Progress autosave (% is measured across the whole video, not just this section)
  useEffect(() => {
    if (currentVideoId && appState === AppState.PRACTICE && currentSubtitleIndex > 0 && !showComplete) {
      const before = sections.slice(0, currentSectionIndex).reduce((n, s) => n + s.subtitles.length, 0);
      VideoStorage.updateProgress(currentVideoId, currentSubtitleIndex, currentSectionIndex, before + currentSubtitleIndex);
    }
  }, [currentSubtitleIndex, currentSectionIndex, currentVideoId, appState, showComplete, sections]);

  // --- Starting a session ---

  const startPractice = async (
    videoName: string, videoPath: string, sf: File, lm: LearningMode, bpm: BlurPlaybackMode,
    startIndex?: number, startSectionIndex?: number, videoId?: string,
  ) => {
    let subText: string;
    try {
      subText = await sf.text();
    } catch {
      dialog.alert(t('app.subtitleReadFailTitle'), t('app.subtitleReadFailBody'));
      return;
    }
    const result = initializePractice(subText, startIndex, startSectionIndex);
    if (!result) {
      dialog.alert(t('app.noSubtitlesTitle'), t('app.noSubtitlesBody', { name: sf.name }));
      return;
    }

    setLearningMode(lm);
    setBlurPlaybackModeState(bpm);

    let recordId = videoId;
    if (!recordId) {
      try {
        const record = await createVideoRecord(videoName, sf, subText, result.parsed.length, { learningMode: lm, blurPlaybackMode: bpm, videoPath });
        recordId = record.id;
      } catch (error) {
        console.error('Failed to save video record:', error);
      }
    }

    setVideoFileName(videoName);
    setIsPlaying(false);
    setCurrentVideoId(recordId || null);
    setVideoSrc(videoSrcFromPath(videoPath));
    setShowComplete(false);
    setAppState(AppState.PRACTICE);
  };

  const handleResume = async (record: VideoRecord, lm: LearningMode) => {
    if (record.importJob) return;
    try {
      let videoPath = record.videoPath;
      if (!videoPath || !(await pathExists(videoPath))) {
        const ok = await dialog.confirm(t('app.pickVideoTitle'), t('app.pickVideoBody', { name: record.videoFileName }), { ok: t('app.pickVideoOk') });
        if (!ok) return;
        const picked = await pickVideoPath();
        if (!picked) return;
        videoPath = picked;
        await VideoStorage.patchVideoRecord(record.id, { videoPath });
      }

      if (record.learningMode !== lm) await VideoStorage.patchVideoRecord(record.id, { learningMode: lm });
      const finished = record.completionRate >= 100;
      await startPractice(
        record.videoFileName, videoPath, getSubtitleFileFromRecord(record), lm,
        record.blurPlaybackMode ?? BlurPlaybackMode.SENTENCE_BY_SENTENCE,
        finished ? 0 : record.currentSubtitleIndex, finished ? 0 : record.currentSectionIndex, record.id,
      );
    } catch (error) {
      console.error('Failed to continue from library:', error);
      dialog.alert(t('app.openVideoFailTitle'), t('app.openVideoFailBody'));
    }
  };

  const setBlurPlaybackMode = (bpm: BlurPlaybackMode) => {
    setBlurPlaybackModeState(bpm);
    if (currentVideoId) VideoStorage.patchVideoRecord(currentVideoId, { blurPlaybackMode: bpm });
  };

  const {
    handleSkip, toggleSaveCurrent, handleAddToAnki, handleWordToAnki, deleteSavedItem, jumpToSaved,
    handleProgressSeek, handleInputComplete, handleContinue, handleNextSectionClick, handleAddToAnkiShortcut,
  } = usePracticeActions({
    subtitles, fullSubtitles, currentSubtitleIndex, sections, currentSectionIndex, mode, ankiStatus,
    setCurrentSubtitleIndex, setCurrentSectionIndex, setMode, setAnkiStatus, setSubtitles, setShowSavedList,
    videoRef, setIsPlaying, switchSection,
    savedLinesToggleSave, savedLinesDeleteSavedItem, ankiHandleAddToAnki, ankiHandleWordToAnki,
    practiceHandleContinue, handleNextSection,
    onPracticeComplete: finishPractice,
    videoPlayerHandleProgressSeek,
  });

  // While "break it down" is on, every way of replaying (Shift+Space, Space,
  // the transport's replay button) plays the current step's clip instead.
  const stepReplayRef = useRef<(() => void) | null>(null);
  const setStepReplay = useCallback((play: (() => void) | null) => { stepReplayRef.current = play; }, []);
  const replayCurrent = useCallback((autoAdvanceAfter?: boolean, fromRatio?: number) => {
    if (stepReplayRef.current) stepReplayRef.current();
    else handleReplayCurrent(autoAdvanceAfter, fromRatio);
  }, [handleReplayCurrent]);
  const togglePlayOrStep = useCallback(() => {
    if (stepReplayRef.current && !isPlaying) stepReplayRef.current();
    else togglePlay();
  }, [togglePlay, isPlaying]);

  const exitPractice = () => { setShowComplete(false); setAppState(AppState.UPLOAD); };

  // "That's enough for today" from the section-done overlay. The autosave has
  // us parked on the last line of the finished section, so resuming there would
  // replay that line and pop the same overlay again; park at the top of the
  // next section instead.
  const stopAfterSection = () => {
    const next = Math.min(currentSectionIndex + 1, sections.length - 1);
    if (currentVideoId) {
      const done = sections.slice(0, next).reduce((n, s) => n + s.subtitles.length, 0);
      VideoStorage.updateProgress(currentVideoId, 0, next, done);
    }
    setShowSectionComplete(false);
    exitPractice();
  };
  const restartPractice = () => {
    setShowComplete(false);
    switchSection(0, videoRef, setIsPlaying);
    if (currentVideoId) VideoStorage.updateProgress(currentVideoId, 0, 0);
  };

  // --- Keyboard ---
  const inPractice = appState === AppState.PRACTICE && !showSectionComplete && !showComplete;
  const blurStepPaused = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE && !isPlaying;

  const keyboardShortcuts = useMemo(() => ([
    { preventDefault: true, condition: (e: KeyboardEvent) => inPractice && matches(e, 'replay'), handler: () => replayCurrent() },
    { code: 'Space', shiftKey: false, preventDefault: true, allowInEditable: false, condition: () => inPractice, handler: () => togglePlayOrStep() },
    { code: 'Enter', preventDefault: true, allowInEditable: false, condition: () => inPractice && (mode === PracticeMode.FEEDBACK || blurStepPaused), handler: () => handleContinue() },
    { preventDefault: true, condition: (e: KeyboardEvent) => inPractice && matches(e, 'prev'), handler: () => handleSkip('prev') },
    { preventDefault: true, condition: (e: KeyboardEvent) => inPractice && matches(e, 'next'), handler: () => handleSkip('next') },
    { preventDefault: true, condition: (e: KeyboardEvent) => inPractice && matches(e, 'skipLine'), handler: () => handleSkip('next') },
    { condition: (e: KeyboardEvent) => inPractice && matches(e, 'anki'), handler: (e: KeyboardEvent) => handleAddToAnkiShortcut(e) },
    // In a blank DictationLine handles it (from that word); anywhere else there's no current word, so replay the line.
    { preventDefault: true, condition: (e: KeyboardEvent) => inPractice && matches(e, 'playFrom'), handler: () => replayCurrent() },
  ]), [inPractice, mode, blurStepPaused, replayCurrent, togglePlayOrStep, handleContinue, handleSkip, handleAddToAnkiShortcut]);

  useKeyboardShortcuts(keyboardShortcuts);

  // --- Render ---

  const currentSub = subtitles[currentSubtitleIndex];

  const page = appState !== AppState.PRACTICE ? (
    <Shell active={appState} onNav={setAppState}>
      {appState === AppState.SETTINGS ? <Settings /> :
       appState === AppState.LIBRARY ? <ReviewPage /> :
       appState === AppState.CARDS ? <CardsPage /> :
       <Home onResume={handleResume} onOpenReview={() => setAppState(AppState.LIBRARY)} />}
    </Shell>
  ) : (
    <PracticeProvider
      practice={{
        videoId: currentVideoId,
        subtitles, fullSubtitles, sections, currentSectionIndex, currentSubtitleIndex, mode,
        showSectionComplete, showComplete, learningMode, blurPlaybackMode,
        videoName: videoFileName || 'Video',
      }}
      video={{ videoRef, videoSrc, isPlaying, volume, playbackSpeed, progress }}
      saved={{ savedIds, showSavedList, savedItems, isCurrentSaved: savedLinesIsCurrentSaved(currentSub) }}
      anki={{ ankiConfig, ankiStatus }}
      actions={{
        onExit: exitPractice,
        onRestart: restartPractice,
        onSwitchSection: (index: number) => switchSection(index, videoRef, setIsPlaying),
        onToggleSavedList: setShowSavedList,
        onTogglePlay: togglePlayOrStep,
        onReplayCurrent: replayCurrent,
        onSetStepReplay: setStepReplay,
        onSkip: handleSkip,
        onProgressSeek: handleProgressSeek,
        onToggleSaveCurrent: toggleSaveCurrent,
        onAddToAnki: handleAddToAnki,
        onWordToAnki: handleWordToAnki,
        onNextSection: handleNextSectionClick,
        onStopAfterSection: stopAfterSection,
        onSetShowSectionComplete: setShowSectionComplete,
        onSetVolume: setVolume,
        onSetPlaybackSpeed: setPlaybackSpeed,
        onInputComplete: handleInputComplete,
        onContinue: handleContinue,
        onDeleteSavedItem: deleteSavedItem,
        onJumpToSaved: jumpToSaved,
        onSetBlurPlaybackMode: setBlurPlaybackMode,
      }}
    >
      <Studio />
    </PracticeProvider>
  );

  return (
    <>
      {page}
      <DialogHost />
    </>
  );
}
