import React, { createContext, useContext } from 'react';
import { PracticeMode, Subtitle, VideoSection, AnkiConfig } from '../types';

export interface PracticeContextPractice {
  subtitles: Subtitle[];
  fullSubtitles: Subtitle[];
  sections: VideoSection[];
  currentSectionIndex: number;
  currentSubtitleIndex: number;
  mode: PracticeMode;
  showSectionComplete: boolean;
}

export interface PracticeContextVideo {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoSrc: string | null;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
  progress: number;
}

export interface PracticeContextSaved {
  savedIds: Set<number>;
  showSavedList: boolean;
  savedItems: Subtitle[];
  isCurrentSaved: boolean;
}

export interface PracticeContextAnki {
  ankiConfig: AnkiConfig | null;
  ankiStatus: 'idle' | 'recording' | 'adding' | 'success' | 'error';
}

export interface PracticeContextActions {
  onExit: () => void;
  onSwitchSection: (index: number) => void;
  onToggleSavedList: (show: boolean) => void;
  onTogglePlay: () => void;
  onReplayCurrent: (autoAdvanceAfter?: boolean) => void;
  onSkip: (direction: 'prev' | 'next') => void;
  onProgressSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSaveCurrent: () => void;
  onAddToAnki: () => void;
  onWordToAnki: (word: string, definition: string, includeAudio?: boolean) => void;
  onNextSection: () => void;
  onSetShowSectionComplete: (show: boolean) => void;
  onSetVolume: (volume: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  onInputComplete: (wasCorrect: boolean) => void;
  onContinue: () => void;
  onDeleteSavedItem: (id: number, e: React.MouseEvent) => void;
  onJumpToSaved: (id: number) => void;
}

export interface PracticeContextValue {
  practice: PracticeContextPractice;
  video: PracticeContextVideo;
  saved: PracticeContextSaved;
  anki: PracticeContextAnki;
  actions: PracticeContextActions;
}

const PracticeContext = createContext<PracticeContextValue | undefined>(undefined);

interface PracticeProviderProps extends PracticeContextValue {
  children: React.ReactNode;
}

export const PracticeProvider: React.FC<PracticeProviderProps> = (props) => {
  const { children, ...value } = props;
  return (
    <PracticeContext.Provider value={value}>
      {children}
    </PracticeContext.Provider>
  );
};

export const usePracticeContext = (): PracticeContextValue => {
  const ctx = useContext(PracticeContext);
  if (!ctx) {
    throw new Error('usePracticeContext must be used within a PracticeProvider');
  }
  return ctx;
};

