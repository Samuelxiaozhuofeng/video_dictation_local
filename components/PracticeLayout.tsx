import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  RotateCcw, Bookmark, X, Trash2, PlayCircle, PlusCircle,
  Check, Mic, ChevronLeft, ChevronRight, Settings
} from 'lucide-react';
import { PracticeMode, AudioPaddingConfig, LearningMode, BlurPlaybackMode } from '../types';
import * as Storage from '../utils/storage';
import * as AI from '../utils/ai';
import InputFeedback from './InputFeedback';
import BlurSubtitle, { BlurDefinitionSidebar } from './BlurSubtitle';
import { usePracticeContext } from '../hooks/usePracticeContext';

export default function PracticeLayout() {
  const { practice, video, saved, anki, actions } = usePracticeContext();

  const {
    subtitles,
    fullSubtitles,
    sections,
    currentSectionIndex,
    currentSubtitleIndex,
    mode,
    showSectionComplete,
    learningMode,
    blurPlaybackMode,
  } = practice;

  const {
    videoRef,
    videoSrc,
    isPlaying,
    volume,
    playbackSpeed,
    progress,
  } = video;

  const {
    savedIds,
    showSavedList,
    savedItems,
    isCurrentSaved,
  } = saved;

  const {
    ankiConfig,
    ankiStatus,
  } = anki;

  const {
    onExit,
    onSwitchSection,
    onToggleSavedList,
    onTogglePlay,
    onReplayCurrent,
    onSkip,
    onProgressSeek,
    onToggleSaveCurrent,
    onAddToAnki,
    onWordToAnki,
    onNextSection,
    onSetShowSectionComplete,
    onSetVolume,
    onSetPlaybackSpeed,
    onInputComplete,
    onContinue,
    onDeleteSavedItem,
    onJumpToSaved,
    onSetBlurPlaybackMode,
  } = actions;

  const currentSub = subtitles[currentSubtitleIndex];

  // Audio Padding State
  const [showPaddingControl, setShowPaddingControl] = useState(false);
  const [audioPadding, setAudioPadding] = useState<AudioPaddingConfig>({ startPadding: 100, endPadding: 200 });

  // Blur Mode Definition Sidebar State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definitionData, setDefinitionData] = useState<AI.WordDefinition | null>(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400); // Default 400px, 20% of typical 1920px screen
  const [isDefinitionPanelPinned, setIsDefinitionPanelPinned] = useState(false);

  // Load audio padding config on mount
  useEffect(() => {
    const config = Storage.getAudioPaddingConfig();
    setAudioPadding(config);
  }, []);

  // Save audio padding config when changed
  const handlePaddingChange = (field: 'startPadding' | 'endPadding', value: number) => {
    const newConfig = { ...audioPadding, [field]: value };
    setAudioPadding(newConfig);
    Storage.saveAudioPaddingConfig(newConfig);
  };

  const handleCloseDefinitionPanel = () => {
    setSelectedWord(null);
    setDefinitionData(null);
    setIsLoadingDefinition(false);
    setIsDefinitionPanelPinned(false);
  };

  const shouldShowDefinitionSidebar =
    learningMode === LearningMode.BLUR &&
    (isDefinitionPanelPinned || isLoadingDefinition || (selectedWord !== null && definitionData !== null));

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden relative flex flex-col">

      {/* --- Top Floating Header --- */}
      <header className="absolute top-0 left-0 right-0 h-20 z-40 bg-gradient-to-b from-neutral-950/95 via-neutral-950/60 to-transparent flex items-start pt-5 px-6 justify-between transition-opacity hover:opacity-100 opacity-0 sm:opacity-100">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-600 backdrop-blur rounded-2xl flex items-center justify-center font-bold text-white shadow-soft-lg">LC</div>

            {/* Section Selector */}
            {sections.length > 1 && (
                <div className="flex items-center gap-1 ml-2 bg-neutral-900/60 backdrop-blur-xl border border-neutral-700/50 rounded-xl p-1">
                    <button
                        onClick={() => onSwitchSection(currentSectionIndex - 1)}
                        disabled={currentSectionIndex === 0}
                        className="p-1.5 hover:bg-neutral-700/50 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className="px-3 text-xs font-semibold text-neutral-200 flex items-center gap-2">
                         <span className="hidden sm:inline">Section</span>
                         <span>{currentSectionIndex + 1} / {sections.length}</span>
                    </div>
                    <button
                        onClick={() => onSwitchSection(currentSectionIndex + 1)}
                        disabled={currentSectionIndex === sections.length - 1}
                        className="p-1.5 hover:bg-neutral-700/50 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-2">
            {/* Exit Button */}
            <button
                onClick={onExit}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/50 transition-all"
            >
                Exit
            </button>

            {/* Saved List Toggle */}
            <button
                onClick={() => onToggleSavedList(!showSavedList)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    showSavedList
                      ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                      : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
            >
                <Bookmark className="w-4 h-4" />
                <span className="hidden sm:inline">Saved</span>
                {savedIds.size > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-brand-500 text-white font-semibold">
                        {savedIds.size}
                    </span>
                )}
            </button>
        </div>
      </header>

      {/* --- Video Layer --- */}
      <div className="relative flex-1 flex items-center justify-center bg-neutral-950">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-h-[70vh] max-w-5xl w-full rounded-2xl shadow-soft-xl bg-neutral-950 object-contain"
          />
        ) : (
          <div className="text-neutral-500">No video loaded.</div>
        )}

        {/* Section Complete Overlay */}
        {showSectionComplete && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 backdrop-blur-xl z-30">
            <div className="bg-neutral-900/95 border border-neutral-700/50 rounded-3xl p-10 max-w-md w-full mx-4 text-center shadow-soft-xl">
              <div className="flex items-center justify-center mb-5">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Section Complete!</h2>
              <p className="text-neutral-400 mb-8">Great work. You have finished this section.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onNextSection}
                  className="flex-1 px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl shadow-soft flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <PlayCircle className="w-5 h-5" />
                  Next Section
                </button>
                <button
                  onClick={() => onSetShowSectionComplete(false)}
                  className="flex-1 px-5 py-3 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 font-medium rounded-xl border border-neutral-700/50 flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recording Overlay for Anki */}
        {ankiStatus === 'recording' && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 backdrop-blur-md z-20">
            <div className="bg-neutral-900/95 border border-red-500/30 rounded-2xl px-8 py-5 flex items-center gap-4 shadow-soft-xl">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <div className="flex items-center gap-3 text-sm text-white font-medium">
                <Mic className="w-5 h-5 text-red-400" />
                <span>Recording audio clip for Anki...</span>
              </div>
            </div>
          </div>
        )}

        {/* Center Play Button when paused */}
        {!isPlaying && mode === PracticeMode.LISTENING && ankiStatus !== 'recording' && !showSectionComplete && (
          <button onClick={onTogglePlay} className="absolute inset-0 flex items-center justify-center z-10 group">
            <div className="p-7 bg-neutral-900/40 backdrop-blur-md rounded-full shadow-soft-xl transform transition-all group-hover:scale-110 group-hover:bg-brand-500/90 border border-neutral-700/30 group-hover:border-brand-500/50">
              <Play className="w-14 h-14 text-white fill-current ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* --- Bottom Interaction Layer --- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent pt-32 pb-8 px-4 flex flex-col items-center justify-end transition-all duration-300 pointer-events-none">

        <div className="w-full max-w-4xl pointer-events-auto">
            {/* Input / Feedback Zone */}
            <div className="mb-8 min-h-[80px] flex items-end justify-center">
                {currentSub ? (
                    learningMode === LearningMode.BLUR ? (
                        // Blur Mode: Show BlurSubtitle component and Continue button
                        <div className="w-full flex flex-col items-center gap-4">
                            <BlurSubtitle
                                targetText={currentSub.text}
                                onWordToAnki={onWordToAnki}
                                onWordSelected={(word, definition, loading) => {
                                    setSelectedWord(word);
                                    setDefinitionData(definition);
                                    setIsLoadingDefinition(loading);
                                }}
                            />
                            {/* Continue Button for Sentence-by-Sentence mode */}
                            {blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE && !isPlaying && (
                                <button
                                    onClick={onContinue}
                                    className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl shadow-soft-lg transition-all hover:scale-105 flex items-center gap-2"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                    Continue
                                </button>
                            )}
                        </div>
                    ) : (
                        // Dictation Mode: Original behavior
                        mode === PracticeMode.LISTENING ? (
                            <div className="flex flex-col items-center justify-center text-neutral-400 animate-pulse pb-4">
                                <p className="text-xs uppercase tracking-[0.25em] font-semibold bg-neutral-900/50 px-4 py-2 rounded-full backdrop-blur-md border border-neutral-700/50">Listen Carefully</p>
                            </div>
                        ) : (
                            <InputFeedback
                                targetText={currentSub.text}
                                mode={mode}
                                onComplete={(correct) => correct ? onContinue() : onInputComplete(correct)}
                                onReplay={onReplayCurrent}
                                onWordToAnki={onWordToAnki}
                            />
                        )
                    )
                ) : (
                        <div className="text-neutral-500">End of content.</div>
                )}
            </div>

            {/* Progress & Controls */}
            <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-700/50 rounded-3xl p-5 shadow-soft-xl">
                {/* Progress Bar */}
                <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 mb-4">
                    <span className="font-semibold">{videoRef.current ? Storage.formatTimeCode(videoRef.current.currentTime) : "00:00"}</span>
                    <div className="flex-1 relative h-2 bg-neutral-800/50 rounded-full overflow-hidden group">
                         <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-100 rounded-full"
                            style={{ width: `${progress}%` }}
                         />
                         <input
                            type="range"
                            min="0"
                            max="100"
                            value={progress}
                            onChange={onProgressSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <span className="font-semibold">{videoRef.current ? Storage.formatTimeCode(videoRef.current.duration) : "00:00"}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 w-28">
                         <button onClick={() => onSetVolume(volume === 0 ? 1 : 0)} className="text-neutral-400 hover:text-white transition-all p-1.5 hover:bg-neutral-700/50 rounded-lg">
                            {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>

                    <div className="flex items-center gap-5">
                        <button onClick={() => onSkip('prev')} className="text-neutral-400 hover:text-white hover:scale-110 transition-all p-1.5" title="Previous (Ctrl+Left)">
                            <SkipBack size={22} />
                        </button>

                        <button onClick={() => onReplayCurrent()} className="text-neutral-400 hover:text-brand-400 hover:rotate-[-90deg] transition-all p-1.5" title="Replay (Shift+Space)">
                            <RotateCcw size={20} />
                        </button>

                        <button
                            onClick={onTogglePlay}
                            className="w-12 h-12 flex items-center justify-center bg-white text-neutral-950 rounded-full hover:bg-brand-500 hover:text-white transition-all shadow-soft transform active:scale-95"
                            title={learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS ? (isPlaying ? "Pause (Space)" : "Play (Space)") : undefined}
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <button
                            onClick={onToggleSaveCurrent}
                            className={`transition-all hover:scale-110 p-1.5 ${isCurrentSaved ? 'text-brand-500 fill-current' : 'text-neutral-400 hover:text-white'}`}
                        >
                            <Bookmark size={20} />
                        </button>

                        <button onClick={() => onSkip('next')} className="text-neutral-400 hover:text-white hover:scale-110 transition-all p-1.5" title="Next (Ctrl+Right)">
                            <SkipForward size={22} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-28 justify-end relative">
                        {/* Anki Button Mini */}
                        {ankiConfig && (ankiConfig.audioCard || ankiConfig.wordCard) && (
                             <button
                                onClick={onAddToAnki}
                                disabled={ankiStatus !== 'idle'}
                                className={`transition-all p-1.5 rounded-lg ${
                                    ankiStatus === 'success' ? 'text-green-400 bg-green-500/10' :
                                    ankiStatus === 'error' ? 'text-red-400 bg-red-500/10' :
                                    'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
                                }`}
                                title="Add to Anki"
                            >
                                <PlusCircle size={20} />
                            </button>
                        )}

                        {/* Blur Playback Mode Toggle (only in Blur Mode) */}
                        {learningMode === LearningMode.BLUR && onSetBlurPlaybackMode && (
                            <button
                                onClick={() => onSetBlurPlaybackMode(
                                    blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE
                                        ? BlurPlaybackMode.CONTINUOUS
                                        : BlurPlaybackMode.SENTENCE_BY_SENTENCE
                                )}
                                className="text-neutral-400 hover:text-white transition-all p-1.5 hover:bg-neutral-700/50 rounded-lg group relative"
                                title={blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE ? "Switch to Continuous" : "Switch to Sentence-by-Sentence"}
                            >
                                {blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE ? (
                                    <PlayCircle size={18} />
                                ) : (
                                    <Pause size={18} />
                                )}
                                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-neutral-800 text-neutral-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {blurPlaybackMode === BlurPlaybackMode.SENTENCE_BY_SENTENCE ? "Sentence-by-Sentence" : "Continuous"}
                                </span>
                            </button>
                        )}

                        {/* Audio Padding Control Button */}
                        <button
                            onClick={() => setShowPaddingControl(!showPaddingControl)}
                            className="text-neutral-400 hover:text-white transition-all p-1.5 hover:bg-neutral-700/50 rounded-lg"
                            title="Audio Padding Settings"
                        >
                            <Settings size={18} />
                        </button>

                        <select
                            value={playbackSpeed}
                            onChange={(e) => onSetPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-2 py-1 text-neutral-300 text-xs font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
                        >
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1">1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                        </select>

                        {/* Audio Padding Control Panel */}
                        {showPaddingControl && (
                            <div className="absolute bottom-full right-0 mb-3 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-4 shadow-soft-xl w-72 z-50">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-white">Audio Padding</h3>
                                    <button
                                        onClick={() => setShowPaddingControl(false)}
                                        className="text-neutral-400 hover:text-white p-1 hover:bg-neutral-700/50 rounded-lg transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Start Padding */}
                                    <div>
                                        <label className="text-xs text-neutral-300 mb-2 block font-medium">
                                            Start: <span className="text-brand-400">{audioPadding.startPadding}ms</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1000"
                                            step="50"
                                            value={audioPadding.startPadding}
                                            onChange={(e) => handlePaddingChange('startPadding', parseInt(e.target.value))}
                                            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                        />
                                    </div>

                                    {/* End Padding */}
                                    <div>
                                        <label className="text-xs text-neutral-300 mb-2 block font-medium">
                                            End: <span className="text-brand-400">{audioPadding.endPadding}ms</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1000"
                                            step="50"
                                            value={audioPadding.endPadding}
                                            onChange={(e) => handlePaddingChange('endPadding', parseInt(e.target.value))}
                                            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-neutral-400 mt-4 leading-relaxed bg-neutral-800/30 rounded-lg p-2">
                                    Adds extra time when recording audio for Anki cards.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Saved Items Drawer (Overlay) */}
      {showSavedList && (
            <>
                <div
                    className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => onToggleSavedList(false)}
                />
                <div className="absolute top-0 right-0 h-full w-80 sm:w-96 bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-700/50 z-50 shadow-soft-xl flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
                    <div className="p-6 border-b border-neutral-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
                                <Bookmark className="w-5 h-5 text-brand-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white">Saved Lines</h2>
                        </div>
                        <button
                            onClick={() => onToggleSavedList(false)}
                            className="p-2 hover:bg-neutral-700/50 rounded-xl text-neutral-400 hover:text-white transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {savedItems.length === 0 ? (
                            <div className="text-center mt-20 text-neutral-500">
                                <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neutral-700/50">
                                    <Bookmark className="w-8 h-8 opacity-30" />
                                </div>
                                <p className="text-sm">No lines saved from this video.</p>
                            </div>
                        ) : (
                            savedItems.map(item => (
                                <div key={item.id} className="bg-neutral-800/30 hover:bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-4 transition-all group">
                                    <p className="text-sm text-neutral-100 font-medium mb-3 line-clamp-2 leading-relaxed">
                                        "{item.text}"
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs font-mono text-neutral-400 bg-neutral-900/50 px-2 py-1 rounded-lg">
                                            {Storage.formatTimeCode(item.startTime)}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => onDeleteSavedItem(item.id, e)}
                                                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all border border-transparent hover:border-red-400/20"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => onJumpToSaved(item.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-all shadow-soft active:scale-95"
                                            >
                                                <PlayCircle size={14} />
                                                Go
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )}

        {/* Blur Mode Definition Sidebar */}
        {shouldShowDefinitionSidebar && (
            <BlurDefinitionSidebar
                selectedWord={selectedWord}
                definitionData={definitionData}
                isLoading={isLoadingDefinition}
                onWordToAnki={onWordToAnki}
                onClose={handleCloseDefinitionPanel}
                width={sidebarWidth}
                onWidthChange={setSidebarWidth}
                isPinned={isDefinitionPanelPinned}
                onTogglePin={() => setIsDefinitionPanelPinned(prev => !prev)}
            />
        )}

    </div>
  );
}
