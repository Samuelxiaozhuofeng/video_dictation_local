import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, PracticeMode, VideoRecord, LearningMode, BlurPlaybackMode } from './types';
import SavedLibrary from './components/SavedLibrary';
import Settings from './components/Settings';
import Home, { NewPair } from './components/Home';
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
import { t, useLang } from './utils/i18n';

// Plain <input type="file"> as a promise; used where showOpenFilePicker is unavailable.
const pickFileWithInput = () => new Promise<File | null>(resolve => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*,.mp4,.webm,.mkv,.mov,.avi,.m4v';
  input.onchange = () => resolve(input.files?.[0] ?? null);
  input.oncancel = () => resolve(null);
  input.click();
});

export default function App() {
  const lang = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [learningMode, setLearningMode] = useState<LearningMode>(LearningMode.DICTATION);
  const [blurPlaybackMode, setBlurPlaybackModeState] = useState<BlurPlaybackMode>(BlurPlaybackMode.SENTENCE_BY_SENTENCE);
  const [showComplete, setShowComplete] = useState(false);

  const {
    currentVideoId, setCurrentVideoId, createVideoRecord,
    getVideoFileFromRecord, getSubtitleFileFromRecord, saveVideoFileHandle,
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
    isCurrentSaved: savedLinesIsCurrentSaved, loadSavedIds, setSavedIds,
  } = useSavedLines({ videoId: currentVideoId, fullSubtitles, videoFileName: videoFile?.name || null });

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
  } = useAnkiIntegration({ videoRef, videoFileName: videoFile?.name || null });

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
    vf: File, sf: File, lm: LearningMode, bpm: BlurPlaybackMode,
    startIndex?: number, startSectionIndex?: number, videoId?: string, handle?: FileSystemFileHandle,
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
        const record = await createVideoRecord(vf, sf, subText, result.parsed.length, { learningMode: lm, blurPlaybackMode: bpm, videoFileHandle: handle });
        recordId = record.id;
      } catch (error) {
        console.error('Failed to save video record:', error);
      }
    }

    setVideoFile(vf);
    setIsPlaying(false);
    setCurrentVideoId(recordId || null);
    setSavedIds(loadSavedIds(result.parsed));
    setVideoSrc(URL.createObjectURL(vf));
    setShowComplete(false);
    setAppState(AppState.PRACTICE);
  };

  const handleStartNew = (pair: NewPair, lm: LearningMode) =>
    startPractice(pair.video, pair.srt, lm, BlurPlaybackMode.SENTENCE_BY_SENTENCE, undefined, undefined, undefined, pair.handle);

  const handleResume = async (record: VideoRecord, lm: LearningMode) => {
    try {
      let vf = await getVideoFileFromRecord(record);

      if (!vf) {
        const ok = await dialog.confirm(t('app.pickVideoTitle'), t('app.pickVideoBody', { name: record.videoFileName }), { ok: t('app.pickVideoOk') });
        if (!ok) return;
        const picker = (window as any).showOpenFilePicker;
        if (picker) {
          try {
            const [handle] = await picker({ types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v'] } }] });
            vf = await handle.getFile();
            await saveVideoFileHandle(record.id, handle);
          } catch {
            return; // cancelled
          }
        } else {
          vf = await pickFileWithInput(); // browsers without the File System Access API: plain file input, no handle to remember
          if (!vf) return;
        }
      }

      if (record.learningMode !== lm) await VideoStorage.updateVideoMode(record.id, { learningMode: lm });
      const finished = record.completionRate >= 100;
      await startPractice(
        vf!, getSubtitleFileFromRecord(record), lm,
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
    if (currentVideoId) VideoStorage.updateVideoMode(currentVideoId, { blurPlaybackMode: bpm });
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

  const exitPractice = () => { setShowComplete(false); setAppState(AppState.UPLOAD); };
  const restartPractice = () => {
    setShowComplete(false);
    switchSection(0, videoRef, setIsPlaying);
    if (currentVideoId) VideoStorage.updateProgress(currentVideoId, 0, 0);
  };

  // --- Keyboard ---
  const inPractice = appState === AppState.PRACTICE && !showSectionComplete && !showComplete;
  const blurStepPaused = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE && !isPlaying;

  const keyboardShortcuts = useMemo(() => ([
    { code: 'Space', shiftKey: true, preventDefault: true, condition: () => inPractice, handler: () => handleReplayCurrent() },
    { code: 'Space', shiftKey: false, preventDefault: true, allowInEditable: false, condition: () => inPractice, handler: () => togglePlay() },
    { code: 'Enter', preventDefault: true, allowInEditable: false, condition: () => inPractice && (mode === PracticeMode.FEEDBACK || blurStepPaused), handler: () => handleContinue() },
    { code: 'ArrowLeft', ctrlOrMeta: true, preventDefault: true, condition: () => inPractice, handler: () => handleSkip('prev') },
    { code: 'ArrowRight', ctrlOrMeta: true, preventDefault: true, condition: () => inPractice, handler: () => handleSkip('next') },
    { code: 'KeyN', altKey: true, condition: () => inPractice, handler: (e: KeyboardEvent) => handleAddToAnkiShortcut(e) },
  ]), [inPractice, mode, blurStepPaused, handleReplayCurrent, togglePlay, handleContinue, handleSkip, handleAddToAnkiShortcut]);

  useKeyboardShortcuts(keyboardShortcuts);

  // --- Render ---

  const currentSub = subtitles[currentSubtitleIndex];

  const page = appState !== AppState.PRACTICE ? (
    <Shell active={appState} onNav={setAppState}>
      {appState === AppState.SETTINGS ? <Settings /> :
       appState === AppState.LIBRARY ? <SavedLibrary /> :
       <Home onStartNew={handleStartNew} onResume={handleResume} />}
    </Shell>
  ) : (
    <PracticeProvider
      practice={{
        subtitles, fullSubtitles, sections, currentSectionIndex, currentSubtitleIndex, mode,
        showSectionComplete, showComplete, learningMode, blurPlaybackMode,
        videoName: videoFile?.name || 'Video',
      }}
      video={{ videoRef, videoSrc, isPlaying, volume, playbackSpeed, progress }}
      saved={{ savedIds, showSavedList, savedItems, isCurrentSaved: savedLinesIsCurrentSaved(currentSub) }}
      anki={{ ankiConfig, ankiStatus }}
      actions={{
        onExit: exitPractice,
        onRestart: restartPractice,
        onSwitchSection: (index: number) => switchSection(index, videoRef, setIsPlaying),
        onToggleSavedList: setShowSavedList,
        onTogglePlay: togglePlay,
        onReplayCurrent: handleReplayCurrent,
        onSkip: handleSkip,
        onProgressSeek: handleProgressSeek,
        onToggleSaveCurrent: toggleSaveCurrent,
        onAddToAnki: handleAddToAnki,
        onWordToAnki: handleWordToAnki,
        onNextSection: handleNextSectionClick,
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
