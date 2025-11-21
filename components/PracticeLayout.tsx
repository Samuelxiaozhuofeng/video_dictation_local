import React, { useState, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  RotateCcw, Bookmark, X, Trash2, PlayCircle, PlusCircle,
  Check, Mic, ChevronLeft, ChevronRight, Settings
} from 'lucide-react';
import { PracticeMode, Subtitle, VideoSection, AnkiConfig, AudioPaddingConfig } from '../types';
import * as Storage from '../utils/storage';
import InputFeedback from './InputFeedback';

interface PracticeLayoutProps {
  // 字幕和分段
  subtitles: Subtitle[];
  fullSubtitles: Subtitle[];
  sections: VideoSection[];
  currentSectionIndex: number;
  currentSubtitleIndex: number;
  
  // 练习状态
  mode: PracticeMode;
  showSectionComplete: boolean;
  
  // 视频控制
  videoRef: React.RefObject<HTMLVideoElement>;
  videoSrc: string | null;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
  progress: number;
  
  // Saved Lines
  savedIds: Set<number>;
  showSavedList: boolean;
  savedItems: Subtitle[];
  isCurrentSaved: boolean;
  
  // Anki
  ankiConfig: AnkiConfig | null;
  ankiStatus: 'idle' | 'recording' | 'adding' | 'success' | 'error';
  
  // 事件处理
  onExit: () => void;
  onSwitchSection: (index: number) => void;
  onToggleSavedList: (show: boolean) => void;
  onTogglePlay: () => void;
  onReplayCurrent: (autoAdvanceAfter?: boolean) => void;
  onSkip: (direction: 'prev' | 'next') => void;
  onProgressSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSaveCurrent: () => void;
  onAddToAnki: () => void;
  onWordToAnki: (word: string, definition: string) => void;
  onNextSection: () => void;
  onSetShowSectionComplete: (show: boolean) => void;
  onSetVolume: (volume: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  onInputComplete: (wasCorrect: boolean) => void;
  onContinue: () => void;
  onDeleteSavedItem: (id: number, e: React.MouseEvent) => void;
  onJumpToSaved: (id: number) => void;
}

export default function PracticeLayout(props: PracticeLayoutProps) {
  const {
    subtitles, sections, currentSectionIndex, currentSubtitleIndex,
    mode, showSectionComplete, videoRef, videoSrc, isPlaying,
    volume, playbackSpeed, progress, savedIds, showSavedList,
    savedItems, isCurrentSaved, ankiConfig, ankiStatus,
    onExit, onSwitchSection, onToggleSavedList, onTogglePlay,
    onReplayCurrent, onSkip, onProgressSeek, onToggleSaveCurrent,
    onAddToAnki, onWordToAnki, onNextSection, onSetShowSectionComplete,
    onSetVolume, onSetPlaybackSpeed, onInputComplete, onContinue,
    onDeleteSavedItem, onJumpToSaved
  } = props;

  const currentSub = subtitles[currentSubtitleIndex];

  // Audio Padding State
  const [showPaddingControl, setShowPaddingControl] = useState(false);
  const [audioPadding, setAudioPadding] = useState<AudioPaddingConfig>({ startPadding: 100, endPadding: 200 });

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

  return (
    <div className="h-screen w-screen bg-black text-slate-200 overflow-hidden relative flex flex-col">
      
      {/* --- Top Floating Header --- */}
      <header className="absolute top-0 left-0 right-0 h-20 z-40 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-start pt-4 px-6 justify-between transition-opacity hover:opacity-100 opacity-0 sm:opacity-100">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600/90 backdrop-blur rounded-lg flex items-center justify-center font-bold text-white shadow-lg">LC</div>
            
            {/* Section Selector */}
            {sections.length > 1 && (
                <div className="flex items-center gap-1 ml-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg p-1">
                    <button
                        onClick={() => onSwitchSection(currentSectionIndex - 1)}
                        disabled={currentSectionIndex === 0}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className="px-2 text-xs font-medium text-slate-300 flex items-center gap-2">
                         <span className="hidden sm:inline">Section</span>
                         <span>{currentSectionIndex + 1} / {sections.length}</span>
                    </div>
                    <button
                        onClick={() => onSwitchSection(currentSectionIndex + 1)}
                        disabled={currentSectionIndex === sections.length - 1}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={() => onToggleSavedList(true)}
                className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-brand-400 transition-colors bg-black/50 hover:bg-black/70 backdrop-blur px-3 py-1.5 rounded-full border border-white/10"
            >
                <Bookmark size={14} className={savedIds.size > 0 ? "fill-brand-400 text-brand-400" : ""} />
                <span className="hidden sm:inline">Saved ({savedIds.size})</span>
            </button>

            <button onClick={onExit} className="text-xs font-medium text-slate-400 hover:text-white transition-colors bg-black/50 hover:bg-red-900/30 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur">
                Exit
            </button>
        </div>
      </header>

      {/* --- Main Fullscreen Video Layer --- */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
             {videoSrc && (
                 <video 
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full object-contain"
                    playsInline
                    onClick={onTogglePlay}
                    crossOrigin="anonymous"
                 />
             )}
             
             {/* Overlays */}
             {ankiStatus === 'recording' && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                     <div className="p-4 rounded-full bg-red-500/20 mb-4 animate-pulse">
                         <Mic className="w-10 h-10 text-red-500" />
                     </div>
                     <p className="text-white font-medium text-lg">Capturing Audio...</p>
                 </div>
             )}

             {showSectionComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl text-center max-w-md shadow-2xl">
                        <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Section Complete!</h2>
                        <p className="text-slate-400 mb-6">Great job. You've finished all lines in this section.</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onNextSection}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all"
                            >
                                Continue to Next Section
                            </button>
                            <button
                                onClick={() => onSetShowSectionComplete(false)}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all"
                            >
                                Review Current Section
                            </button>
                        </div>
                    </div>
                </div>
             )}

             {!isPlaying && mode === PracticeMode.LISTENING && ankiStatus !== 'recording' && !showSectionComplete && (
                 <button onClick={onTogglePlay} className="absolute inset-0 flex items-center justify-center z-10 group">
                     <div className="p-6 bg-black/40 backdrop-blur-sm rounded-full shadow-2xl transform transition-all group-hover:scale-110 group-hover:bg-brand-600/80 border border-white/10">
                        <Play className="w-12 h-12 text-white fill-current ml-1" />
                     </div>
                 </button>
             )}
      </div>

      {/* --- Bottom Interaction Layer --- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent pt-32 pb-6 px-4 flex flex-col items-center justify-end transition-all duration-300 pointer-events-none">

        <div className="w-full max-w-4xl pointer-events-auto">
            {/* Input / Feedback Zone */}
            <div className="mb-6 min-h-[80px] flex items-end justify-center">
                {currentSub ? (
                    mode === PracticeMode.LISTENING ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 animate-pulse pb-4">
                            <p className="text-xs uppercase tracking-[0.2em] font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">Listen Carefully</p>
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
                ) : (
                        <div className="text-slate-500">End of content.</div>
                )}
            </div>

            {/* Progress & Controls */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
                {/* Progress Bar */}
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mb-3">
                    <span>{videoRef.current ? Storage.formatTimeCode(videoRef.current.currentTime) : "00:00"}</span>
                    <div className="flex-1 relative h-1.5 bg-white/10 rounded-full overflow-hidden group">
                         <div
                            className="absolute top-0 left-0 h-full bg-brand-500 transition-all duration-100"
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
                    <span>{videoRef.current ? Storage.formatTimeCode(videoRef.current.duration) : "00:00"}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 w-24">
                         <button onClick={() => onSetVolume(volume === 0 ? 1 : 0)} className="text-slate-400 hover:text-white transition-colors">
                            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={() => onSkip('prev')} className="text-slate-400 hover:text-white hover:scale-110 transition-all" title="Previous (Ctrl+Left)">
                            <SkipBack size={20} />
                        </button>

                        <button onClick={() => onReplayCurrent()} className="text-slate-400 hover:text-brand-400 hover:rotate-[-90deg] transition-all" title="Replay (Shift+Space)">
                            <RotateCcw size={18} />
                        </button>

                        <button
                            onClick={onTogglePlay}
                            className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:bg-brand-400 hover:text-white transition-all shadow-lg transform active:scale-95"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <button
                            onClick={onToggleSaveCurrent}
                            className={`transition-all hover:scale-110 ${isCurrentSaved ? 'text-brand-500 fill-current' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Bookmark size={18} />
                        </button>

                        <button onClick={() => onSkip('next')} className="text-slate-400 hover:text-white hover:scale-110 transition-all" title="Next (Ctrl+Right)">
                            <SkipForward size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-24 justify-end relative">
                        {/* Anki Button Mini */}
                        {ankiConfig && (
                             <button
                                onClick={onAddToAnki}
                                disabled={ankiStatus !== 'idle'}
                                className={`mr-2 transition-all ${
                                    ankiStatus === 'success' ? 'text-green-400' :
                                    ankiStatus === 'error' ? 'text-red-400' :
                                    'text-slate-400 hover:text-white'
                                }`}
                                title="Add to Anki"
                            >
                                <PlusCircle size={18} />
                            </button>
                        )}

                        {/* Audio Padding Control Button */}
                        <button
                            onClick={() => setShowPaddingControl(!showPaddingControl)}
                            className="text-slate-400 hover:text-white transition-all mr-2"
                            title="Audio Padding Settings"
                        >
                            <Settings size={16} />
                        </button>

                        <select
                            value={playbackSpeed}
                            onChange={(e) => onSetPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-transparent text-slate-400 text-xs font-medium focus:outline-none focus:text-white cursor-pointer"
                        >
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1">1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                        </select>

                        {/* Audio Padding Control Panel */}
                        {showPaddingControl && (
                            <div className="absolute bottom-full right-0 mb-2 bg-slate-900/95 backdrop-blur border border-white/20 rounded-lg p-3 shadow-2xl w-64 z-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-white">Audio Padding</h3>
                                    <button
                                        onClick={() => setShowPaddingControl(false)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Start Padding */}
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">
                                            Start: {audioPadding.startPadding}ms
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1000"
                                            step="50"
                                            value={audioPadding.startPadding}
                                            onChange={(e) => handlePaddingChange('startPadding', parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                        />
                                    </div>

                                    {/* End Padding */}
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">
                                            End: {audioPadding.endPadding}ms
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1000"
                                            step="50"
                                            value={audioPadding.endPadding}
                                            onChange={(e) => handlePaddingChange('endPadding', parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
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
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => onToggleSavedList(false)}
                />
                <div className="absolute top-0 right-0 h-full w-80 sm:w-96 bg-slate-900/95 backdrop-blur border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bookmark className="w-5 h-5 text-brand-500 fill-brand-500" />
                            <h2 className="text-lg font-bold text-white">Saved Lines</h2>
                        </div>
                        <button
                            onClick={() => onToggleSavedList(false)}
                            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {savedItems.length === 0 ? (
                            <div className="text-center mt-20 text-slate-500">
                                <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No lines saved from this video.</p>
                            </div>
                        ) : (
                            savedItems.map(item => (
                                <div key={item.id} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 transition-all group">
                                    <p className="text-sm text-slate-200 font-medium mb-2 line-clamp-2 font-serif">
                                        "{item.text}"
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs font-mono text-slate-500">
                                            {Storage.formatTimeCode(item.startTime)}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => onDeleteSavedItem(item.id, e)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => onJumpToSaved(item.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all"
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

    </div>
  );
}

