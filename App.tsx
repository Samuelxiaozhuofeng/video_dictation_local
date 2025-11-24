import React, { useState, useEffect, useMemo } from 'react';
import { AppState, PracticeMode, VideoRecord, LearningMode, BlurPlaybackMode } from './types';
import SavedLibrary from './components/SavedLibrary';
import Settings from './components/Settings';
import UploadPage from './components/UploadPage';
import PracticeLayout from './components/PracticeLayout';
import { PracticeProvider } from './hooks/usePracticeContext';
import { useVideoHistory } from './hooks/useVideoHistory';
import { usePracticeSession } from './hooks/usePracticeSession';
import { useAnkiIntegration } from './hooks/useAnkiIntegration';
import { useSavedLines } from './hooks/useSavedLines';
import { useVideoController } from './hooks/useVideoController';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePracticeActions } from './hooks/usePracticeActions';

export default function App() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);

  // Resources
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);

  // Learning Mode State
  const [learningMode, setLearningMode] = useState<LearningMode>(LearningMode.DICTATION);
  const [blurPlaybackMode, setBlurPlaybackMode] = useState<BlurPlaybackMode>(BlurPlaybackMode.SENTENCE_BY_SENTENCE);

  // Video History Hook
  const {
    currentVideoId,
    setCurrentVideoId,
    createVideoRecord,
    updateProgress,
    getVideoFileFromRecord,
    getSubtitleFileFromRecord,
    saveVideoFileHandle
  } = useVideoHistory();

  // Practice Session Hook
  const {
    fullSubtitles,
    subtitles,
    sections,
    currentSectionIndex,
    currentSubtitleIndex,
    mode,
    showSectionComplete,
    shouldAutoAdvance,
    setSubtitles,
    setCurrentSectionIndex,
    setCurrentSubtitleIndex,
    setMode,
    setShowSectionComplete,
    setShouldAutoAdvance,
    switchSection,
    handleContinue: practiceHandleContinue,
    handleNextSection,
    initializePractice
  } = usePracticeSession({
    videoId: currentVideoId,
    appState
  });

  // Saved Lines Hook
  const {
    savedIds,
    showSavedList,
    savedItems,
    setShowSavedList,
    toggleSave: savedLinesToggleSave,
    deleteSavedItem: savedLinesDeleteSavedItem,
    isCurrentSaved: savedLinesIsCurrentSaved,
    loadSavedIds,
    setSavedIds
  } = useSavedLines({
    videoId: currentVideoId,
    fullSubtitles,
    videoFileName: videoFile?.name || null
  });

  // Video Controller Hook (integrates videoRef, videoSrc, and useVideoPlayer)
  const {
    videoRef,
    videoSrc,
    setVideoSrc,
    isPlaying,
    volume,
    playbackSpeed,
    progress,
    setIsPlaying,
    setVolume,
    setPlaybackSpeed,
    setProgress,
    togglePlay,
    handleProgressSeek: videoPlayerHandleProgressSeek,
    handleReplayCurrent
  } = useVideoController({
    subtitles,
    currentSubtitleIndex,
    mode,
    shouldAutoAdvance,
    learningMode,
    blurPlaybackMode,
    onModeChange: setMode,
    onAutoAdvance: () => {
      if (currentSubtitleIndex < subtitles.length - 1) {
        setCurrentSubtitleIndex(prev => prev + 1);
        setMode(PracticeMode.LISTENING);
        setAnkiStatus('idle');
      } else {
        if (currentSectionIndex < sections.length - 1) {
          setShowSectionComplete(true);
        } else {
          alert("Practice Complete! You have finished the video.");
          setAppState(AppState.UPLOAD);
        }
      }
    },
    onShouldAutoAdvanceChange: setShouldAutoAdvance
  });

  // Anki Integration Hook
  const {
    ankiConfig,
    ankiStatus,
    setAnkiConfig,
    setAnkiStatus,
    handleAddToAnki: ankiHandleAddToAnki,
    handleWordToAnki: ankiHandleWordToAnki,
    reloadConfig: reloadAnkiConfig
  } = useAnkiIntegration({
    videoRef,
    videoFileName: videoFile?.name || null
  });

  // --- Effects & Logic ---

  // Load configs
  useEffect(() => {
    if (appState !== AppState.SETTINGS) {
      reloadAnkiConfig();
    }
  }, [appState, reloadAnkiConfig]);

  // Auto-save progress when subtitle index changes
  useEffect(() => {
    if (currentVideoId && appState === AppState.PRACTICE && currentSubtitleIndex > 0) {
      updateProgress(currentVideoId, currentSubtitleIndex, currentSectionIndex);
    }
  }, [currentSubtitleIndex, currentSectionIndex, currentVideoId, appState, updateProgress]);

  // --- Handlers ---

  const handleStartPractice = async (
    vFile?: File,
    sFile?: File,
    selectedLearningMode?: LearningMode,
    selectedBlurPlaybackMode?: BlurPlaybackMode,
    startIndex?: number,
    startSectionIndex?: number,
    videoId?: string
  ) => {
    const vf = vFile || videoFile;
    const sf = sFile || subtitleFile;

    if (vf && sf) {
      try {
        const subText = await sf.text();

        // Set learning mode
        if (selectedLearningMode) {
          setLearningMode(selectedLearningMode);
        }
        if (selectedBlurPlaybackMode) {
          setBlurPlaybackMode(selectedBlurPlaybackMode);
        }

        // Use the hook's initializePractice method
        const result = initializePractice(subText, startIndex, startSectionIndex);

        if (!result) {
          alert("No subtitles found in file. Please check the format.");
          return;
        }

        const { parsed } = result;
        const previouslySavedIds = loadSavedIds(parsed);

        // Save video record to history if this is a new upload
        let recordId = videoId;
        if (!videoId) {
          try {
            const record = await createVideoRecord(
              vf,
              sf,
              subText,
              parsed.length
            );
            recordId = record.id;
          } catch (error) {
            console.error('Failed to save video record:', error);
          }
        }

        setCurrentVideoId(recordId || null);
        setSavedIds(previouslySavedIds);
        setVideoSrc(URL.createObjectURL(vf));
        setAppState(AppState.PRACTICE);

      } catch (e) {
        alert("Error parsing subtitle file.");
        console.error(e);
      }
    }
  };

  // Handle continuing practice from video library
  const handleContinueFromLibrary = async (record: VideoRecord) => {
    try {
      // Try to get video file from stored handle (File System Access API)
      let videoFileFromHandle = await getVideoFileFromRecord(record);

      // If file handle not available, prompt user to select the video file
      if (!videoFileFromHandle) {
        const confirmed = confirm(
          `Please select the video file: "${record.videoFileName}"\n\n` +
          `Your progress and subtitles are saved, you just need to select the video file again.`
        );

        if (!confirmed) return;

        // Prompt user to select video file
        try {
          const [fileHandle] = await (window as any).showOpenFilePicker({
            types: [{
              description: 'Video files',
              accept: { 'video/*': ['.mp4', '.webm', '.mkv', '.avi'] }
            }],
            multiple: false
          });

          videoFileFromHandle = await fileHandle.getFile();

          // Save the new file handle for future use
          await saveVideoFileHandle(record.id, fileHandle);
        } catch (err) {
          console.error('User cancelled file selection:', err);
          return;
        }
      }

      // Create subtitle file from stored text
      const subtitleFileFromRecord = getSubtitleFileFromRecord(record);

      // Set files for display
      setVideoFile(videoFileFromHandle);
      setSubtitleFile(subtitleFileFromRecord);

      // Start practice with saved progress (use default learning mode for continued sessions)
      await handleStartPractice(
        videoFileFromHandle,
        subtitleFileFromRecord,
        undefined, // learningMode - use current state
        undefined, // blurPlaybackMode - use current state
        record.currentSubtitleIndex,
        record.currentSectionIndex,
        record.id
      );
    } catch (error) {
      console.error('Failed to continue from library:', error);
      alert('Failed to load video. Please try again.');
    }
  };

  const {
    handleSkip,
    toggleSaveCurrent,
    handleAddToAnki,
    handleWordToAnki,
    deleteSavedItem,
    jumpToSaved,
    handleProgressSeek,
    handleInputComplete,
    handleContinue,
    handleNextSectionClick,
    handleAddToAnkiShortcut,
  } = usePracticeActions({
    subtitles,
    fullSubtitles,
    currentSubtitleIndex,
    sections,
    currentSectionIndex,
    mode,
    ankiStatus,
    setCurrentSubtitleIndex,
    setCurrentSectionIndex,
    setMode,
    setAnkiStatus,
    setSubtitles,
    setShowSavedList,
    videoRef,
    setIsPlaying,
    switchSection,
    savedLinesToggleSave,
    savedLinesDeleteSavedItem,
    ankiHandleAddToAnki,
    ankiHandleWordToAnki,
    practiceHandleContinue,
    handleNextSection,
    setAppState,
    AppStateEnum: AppState,
    videoPlayerHandleProgressSeek,
  });

  const keyboardShortcuts = useMemo(() => ([
    // Shift+Space: Replay current subtitle
    {
      code: 'Space',
      shiftKey: true,
      preventDefault: true,
      handler: () => handleReplayCurrent(),
    },
    // Space: Toggle play/pause in Blur Continuous mode
    {
      code: 'Space',
      shiftKey: false,
      preventDefault: true,
      allowInEditable: false,
      condition: () =>
        appState === AppState.PRACTICE &&
        learningMode === LearningMode.BLUR &&
        blurPlaybackMode === BlurPlaybackMode.CONTINUOUS,
      handler: () => togglePlay(),
    },
    {
      code: 'ArrowLeft',
      ctrlOrMeta: true,
      preventDefault: true,
      handler: () => handleSkip('prev'),
    },
    {
      code: 'ArrowRight',
      ctrlOrMeta: true,
      preventDefault: true,
      handler: () => handleSkip('next'),
    },
    {
      code: 'KeyN',
      altKey: true,
      handler: (event: KeyboardEvent) => {
        if (appState !== AppState.PRACTICE) {
          alert('Add to Anki shortcut only works during an active practice session.');
          return;
        }
        handleAddToAnkiShortcut(event);
      },
    },
  ]), [handleReplayCurrent, handleSkip, handleAddToAnkiShortcut, togglePlay, appState, learningMode, blurPlaybackMode]);

  useKeyboardShortcuts(keyboardShortcuts);

  // --- Render ---

  if (appState === AppState.SETTINGS) {
      return <Settings onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.LIBRARY) {
      return <SavedLibrary onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.UPLOAD) {
    return (
      <UploadPage
        onStartPractice={(vf, sf, lm, bpm) => handleStartPractice(vf, sf, lm, bpm)}
        onContinuePractice={handleContinueFromLibrary}
        onOpenSettings={() => setAppState(AppState.SETTINGS)}
        onOpenLibrary={() => setAppState(AppState.LIBRARY)}
      />
    );
  }

  // PRACTICE MODE
  const currentSub = subtitles[currentSubtitleIndex];
  const isCurrentSaved = savedLinesIsCurrentSaved(currentSub);

  return (
    <PracticeProvider
      practice={{
        subtitles,
        fullSubtitles,
        sections,
        currentSectionIndex,
        currentSubtitleIndex,
        mode,
        showSectionComplete,
        learningMode,
        blurPlaybackMode,
      }}
      video={{
        videoRef,
        videoSrc,
        isPlaying,
        volume,
        playbackSpeed,
        progress,
      }}
      saved={{
        savedIds,
        showSavedList,
        savedItems,
        isCurrentSaved,
      }}
      anki={{
        ankiConfig,
        ankiStatus,
      }}
      actions={{
        onExit: () => setAppState(AppState.UPLOAD),
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
      <PracticeLayout />
    </PracticeProvider>
  );
}
