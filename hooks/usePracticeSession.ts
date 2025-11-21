import { useState, useCallback } from 'react';
import { PracticeMode, Subtitle, VideoSection } from '../types';
import * as Storage from '../utils/storage';

export interface UsePracticeSessionParams {
  videoId: string | null;
  appState: string;
}

export interface UsePracticeSessionReturn {
  // Subtitles & Sections
  fullSubtitles: Subtitle[];
  subtitles: Subtitle[];
  sections: VideoSection[];
  currentSectionIndex: number;
  
  // Practice State
  currentSubtitleIndex: number;
  mode: PracticeMode;
  showSectionComplete: boolean;
  shouldAutoAdvance: boolean;
  
  // Setters
  setFullSubtitles: (subtitles: Subtitle[]) => void;
  setSubtitles: (subtitles: Subtitle[]) => void;
  setSections: (sections: VideoSection[]) => void;
  setCurrentSectionIndex: (index: number) => void;
  setCurrentSubtitleIndex: (index: number | ((prev: number) => number)) => void;
  setMode: (mode: PracticeMode) => void;
  setShowSectionComplete: (show: boolean) => void;
  setShouldAutoAdvance: (should: boolean) => void;
  
  // Actions
  switchSection: (index: number, videoRef?: React.RefObject<HTMLVideoElement>, setIsPlaying?: (value: boolean) => void) => void;
  handleContinue: (onSectionComplete: () => void, onPracticeComplete: () => void, onAnkiStatusChange: (status: string) => void) => void;
  handleNextSection: (videoRef?: React.RefObject<HTMLVideoElement>, setIsPlaying?: (value: boolean) => void) => void;
}

export function usePracticeSession(params: UsePracticeSessionParams): UsePracticeSessionReturn {
  const { videoId, appState } = params;

  // Subtitles & Sections
  const [fullSubtitles, setFullSubtitles] = useState<Subtitle[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [sections, setSections] = useState<VideoSection[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Practice State
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const [mode, setMode] = useState<PracticeMode>(PracticeMode.LISTENING);
  const [showSectionComplete, setShowSectionComplete] = useState(false);
  const [shouldAutoAdvance, setShouldAutoAdvance] = useState(false);

  // Change current active subtitles when section changes
  const switchSection = useCallback((
    index: number,
    videoRef?: React.RefObject<HTMLVideoElement>,
    setIsPlaying?: (value: boolean) => void
  ) => {
    if (index < 0 || index >= sections.length) return;

    const newSection = sections[index];
    setCurrentSectionIndex(index);
    setSubtitles(newSection.subtitles);
    setCurrentSubtitleIndex(0);
    setMode(PracticeMode.LISTENING);
    setShowSectionComplete(false);
    setIsPlaying?.(false);

    // Seek to start of section
    if (videoRef?.current) {
      const startTime = newSection.subtitles.length > 0 ? newSection.subtitles[0].startTime : newSection.startTime;
      videoRef.current.currentTime = startTime;
    }
  }, [sections]);

  const handleContinue = useCallback((
    onSectionComplete: () => void,
    onPracticeComplete: () => void,
    onAnkiStatusChange: (status: string) => void
  ) => {
    if (currentSubtitleIndex < subtitles.length - 1) {
      setCurrentSubtitleIndex(prev => prev + 1);
      setMode(PracticeMode.LISTENING);
      onAnkiStatusChange('idle');
    } else {
      // End of current section
      if (currentSectionIndex < sections.length - 1) {
        setShowSectionComplete(true);
        onSectionComplete();
      } else {
        onPracticeComplete();
      }
    }
  }, [currentSubtitleIndex, subtitles.length, currentSectionIndex, sections.length]);

  const handleNextSection = useCallback((
    videoRef?: React.RefObject<HTMLVideoElement>,
    setIsPlaying?: (value: boolean) => void
  ) => {
    switchSection(currentSectionIndex + 1, videoRef, setIsPlaying);
  }, [currentSectionIndex, switchSection]);

  return {
    // State
    fullSubtitles,
    subtitles,
    sections,
    currentSectionIndex,
    currentSubtitleIndex,
    mode,
    showSectionComplete,
    shouldAutoAdvance,
    
    // Setters
    setFullSubtitles,
    setSubtitles,
    setSections,
    setCurrentSectionIndex,
    setCurrentSubtitleIndex,
    setMode,
    setShowSectionComplete,
    setShouldAutoAdvance,
    
    // Actions
    switchSection,
    handleContinue,
    handleNextSection
  };
}

