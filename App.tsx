import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { AppState, PracticeMode, VideoRecord } from './types';
import * as Storage from './utils/storage';
import SavedLibrary from './components/SavedLibrary';
import Settings from './components/Settings';
import VideoLibrary from './components/VideoLibrary';
import UploadSection from './components/UploadSection';
import PracticeLayout from './components/PracticeLayout';
import { useVideoHistory } from './hooks/useVideoHistory';
import { usePracticeSession } from './hooks/usePracticeSession';
import { useAnkiIntegration } from './hooks/useAnkiIntegration';
import { useSavedLines } from './hooks/useSavedLines';
import { useVideoController } from './hooks/useVideoController';

export default function App() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);

  // Resources
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);

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
  const [uploadTab, setUploadTab] = useState<'library' | 'upload'>('library');

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

  // Config
  const [practiceConfig, setPracticeConfig] = useState(Storage.getPracticeConfig());

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
    setPracticeConfig(Storage.getPracticeConfig());
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

  const handleStartPractice = async (vFile?: File, sFile?: File, startIndex?: number, startSectionIndex?: number, videoId?: string) => {
    const vf = vFile || videoFile;
    const sf = sFile || subtitleFile;

    if (vf && sf) {
      try {
        const subText = await sf.text();

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

  const handleInputComplete = (wasCorrect: boolean) => {
     setMode(PracticeMode.FEEDBACK);
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

      // Start practice with saved progress
      await handleStartPractice(
        videoFileFromHandle,
        subtitleFileFromRecord,
        record.currentSubtitleIndex,
        record.currentSectionIndex,
        record.id
      );
    } catch (error) {
      console.error('Failed to continue from library:', error);
      alert('Failed to load video. Please try again.');
    }
  };

  const handleContinue = () => {
    practiceHandleContinue(
      () => {}, // onSectionComplete - already handled by setShowSectionComplete in hook
      () => {
        alert("Practice Complete! You have finished the video.");
        setAppState(AppState.UPLOAD);
      },
      (status: string) => setAnkiStatus(status as 'idle' | 'recording' | 'adding' | 'success' | 'error')
    );
  };

  const handleNextSectionClick = () => {
    handleNextSection(videoRef, setIsPlaying);
  };

  const handleSkip = useCallback((direction: 'prev' | 'next') => {
      if (direction === 'prev' && currentSubtitleIndex > 0) {
          setCurrentSubtitleIndex(prev => prev - 1);
          setMode(PracticeMode.LISTENING);
          setAnkiStatus('idle');
      } else if (direction === 'next' && currentSubtitleIndex < subtitles.length - 1) {
          setCurrentSubtitleIndex(prev => prev + 1);
          setMode(PracticeMode.LISTENING);
          setAnkiStatus('idle');
      }
  }, [currentSubtitleIndex, subtitles.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        handleReplayCurrent();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowLeft') {
         e.preventDefault();
         handleSkip('prev');
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowRight') {
         e.preventDefault();
         handleSkip('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReplayCurrent, handleSkip]);

  const handleProgressSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    videoPlayerHandleProgressSeek(e, sections, currentSectionIndex, (sectionIndex, subIndex) => {
      if (sectionIndex !== currentSectionIndex) {
        const newSection = sections[sectionIndex];
        setCurrentSectionIndex(sectionIndex);
        setSubtitles(newSection.subtitles);
        setCurrentSubtitleIndex(subIndex);
      } else {
        setCurrentSubtitleIndex(subIndex);
      }
      setMode(PracticeMode.LISTENING);
      setAnkiStatus('idle');
    });
  };

  const toggleSaveCurrent = () => {
      const currentSub = subtitles[currentSubtitleIndex];
      if (!currentSub) return;
      savedLinesToggleSave(currentSub);
  };

  // --- Anki Integration (using Hook) ---

  const handleAddToAnki = async () => {
    const currentSub = subtitles[currentSubtitleIndex];
    if (!currentSub) return;
    await ankiHandleAddToAnki(currentSub);
  };

  const handleWordToAnki = async (word: string, definition: string) => {
    const currentSub = subtitles[currentSubtitleIndex];
    if (!currentSub) return;
    await ankiHandleWordToAnki(word, definition, currentSub);
  };

  const deleteSavedItem = (id: number, e: React.MouseEvent) => {
      savedLinesDeleteSavedItem(id, e);
  };

  const jumpToSaved = (id: number) => {
      const sub = fullSubtitles.find(s => s.id === id);
      if (sub) {
         const sectionIdx = sections.findIndex(sec => sub.startTime >= sec.startTime && sub.startTime < sec.endTime);
         if (sectionIdx !== -1) {
             if (sectionIdx !== currentSectionIndex) {
                 switchSection(sectionIdx, videoRef, setIsPlaying);
                 const newSectionSubs = sections[sectionIdx].subtitles;
                 const subIndex = newSectionSubs.findIndex(s => s.id === id);
                 if (subIndex !== -1) setCurrentSubtitleIndex(subIndex);
             } else {
                 const subIndex = subtitles.findIndex(s => s.id === id);
                 if (subIndex !== -1) setCurrentSubtitleIndex(subIndex);
             }
             setMode(PracticeMode.LISTENING);
             setAnkiStatus('idle');
             setShowSavedList(false);
         }
      }
  };

  // --- Render ---

  if (appState === AppState.SETTINGS) {
      return <Settings onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.LIBRARY) {
      return <SavedLibrary onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.UPLOAD) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 w-full max-w-6xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight mb-2">LinguaClip Practice</h1>
              <p className="text-slate-400 text-lg">Master language listening by typing what you hear from your favorite videos.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAppState(AppState.SETTINGS)}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setAppState(AppState.LIBRARY)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
              >
                <Bookmark className="w-4 h-4 text-brand-400" />
                <span>My Collection</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative z-10 w-full max-w-6xl mx-auto mb-6">
          <div className="flex gap-2 border-b border-slate-700">
            <button
              onClick={() => setUploadTab('library')}
              className={`px-6 py-3 font-medium transition-all relative ${
                uploadTab === 'library'
                  ? 'text-brand-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📚 My Videos
              {uploadTab === 'library' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400"></div>
              )}
            </button>
            <button
              onClick={() => setUploadTab('upload')}
              className={`px-6 py-3 font-medium transition-all relative ${
                uploadTab === 'upload'
                  ? 'text-brand-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ➕ Upload New
              {uploadTab === 'upload' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400"></div>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 overflow-auto pb-6">
          {uploadTab === 'library' ? (
            <VideoLibrary onContinuePractice={handleContinueFromLibrary} />
          ) : (
            <UploadSection onStartPractice={(vf, sf) => handleStartPractice(vf, sf)} />
          )}
        </div>
      </div>
    );
  }

  // PRACTICE MODE
  const currentSub = subtitles[currentSubtitleIndex];
  const isCurrentSaved = savedLinesIsCurrentSaved(currentSub);

  return (
    <PracticeLayout
      subtitles={subtitles}
      fullSubtitles={fullSubtitles}
      sections={sections}
      currentSectionIndex={currentSectionIndex}
      currentSubtitleIndex={currentSubtitleIndex}
      mode={mode}
      showSectionComplete={showSectionComplete}
      videoRef={videoRef}
      videoSrc={videoSrc}
      isPlaying={isPlaying}
      volume={volume}
      playbackSpeed={playbackSpeed}
      progress={progress}
      savedIds={savedIds}
      showSavedList={showSavedList}
      savedItems={savedItems}
      isCurrentSaved={isCurrentSaved}
      ankiConfig={ankiConfig}
      ankiStatus={ankiStatus}
      onExit={() => setAppState(AppState.UPLOAD)}
      onSwitchSection={(index) => switchSection(index, videoRef, setIsPlaying)}
      onToggleSavedList={setShowSavedList}
      onTogglePlay={togglePlay}
      onReplayCurrent={handleReplayCurrent}
      onSkip={handleSkip}
      onProgressSeek={handleProgressSeek}
      onToggleSaveCurrent={toggleSaveCurrent}
      onAddToAnki={handleAddToAnki}
      onWordToAnki={handleWordToAnki}
      onNextSection={handleNextSectionClick}
      onSetShowSectionComplete={setShowSectionComplete}
      onSetVolume={setVolume}
      onSetPlaybackSpeed={setPlaybackSpeed}
      onInputComplete={handleInputComplete}
      onContinue={handleContinue}
      onDeleteSavedItem={deleteSavedItem}
      onJumpToSaved={jumpToSaved}
    />
  );
}
