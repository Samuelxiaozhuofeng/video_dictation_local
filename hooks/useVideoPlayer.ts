import { useState, useRef, useEffect, useCallback } from 'react';
import { Subtitle, PracticeMode } from '../types';

export interface UseVideoPlayerParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  subtitles: Subtitle[];
  currentSubtitleIndex: number;
  mode: PracticeMode;
  shouldAutoAdvance: boolean;
  onSubtitleEnded?: () => void;
  onModeChange?: (mode: PracticeMode) => void;
  onAutoAdvance?: () => void;
  onShouldAutoAdvanceChange?: (value: boolean) => void;
}

export interface UseVideoPlayerReturn {
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
  progress: number;
  setIsPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setPlaybackSpeed: (value: number) => void;
  setProgress: (value: number) => void;
  togglePlay: () => void;
  handleProgressSeek: (e: React.ChangeEvent<HTMLInputElement>, sections: any[], currentSectionIndex: number, onSectionChange: (index: number, subIndex: number) => void) => void;
  handleReplayCurrent: (autoAdvanceAfter?: boolean) => void;
}

export function useVideoPlayer(params: UseVideoPlayerParams): UseVideoPlayerReturn {
  const {
    videoRef,
    subtitles,
    currentSubtitleIndex,
    mode,
    shouldAutoAdvance,
    onSubtitleEnded,
    onModeChange,
    onAutoAdvance,
    onShouldAutoAdvanceChange
  } = params;

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const requestRef = useRef<number | undefined>(undefined);

  // Video Loop for pausing at end of subtitle
  const checkVideoTime = useCallback(() => {
    if (!videoRef.current || subtitles.length === 0) return;
    
    const video = videoRef.current;
    const currentSub = subtitles[currentSubtitleIndex];
    
    if (!currentSub) return;

    if (isPlaying) {
      if (video.currentTime >= currentSub.endTime) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = currentSub.endTime;

        if (mode === PracticeMode.LISTENING) {
          onModeChange?.(PracticeMode.INPUT);
        } else if (shouldAutoAdvance) {
          onShouldAutoAdvanceChange?.(false);
          onAutoAdvance?.();
        }
      }
    }
    
    if (video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }

    requestRef.current = requestAnimationFrame(checkVideoTime);
  }, [subtitles, currentSubtitleIndex, mode, isPlaying, shouldAutoAdvance, onModeChange, onAutoAdvance, onShouldAutoAdvanceChange, videoRef]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(checkVideoTime);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [checkVideoTime]);

  // Handle Volume/Speed changes directly on ref
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed, videoRef]);

  // Initial Seek when index changes (Subtitle Change)
  useEffect(() => {
    if (videoRef.current && subtitles.length > 0 && mode === PracticeMode.LISTENING && subtitles[currentSubtitleIndex]) {
      const currentSub = subtitles[currentSubtitleIndex];
      
      const tolerance = 0.5;
      if (videoRef.current.currentTime < currentSub.startTime - tolerance || videoRef.current.currentTime > currentSub.endTime) {
        videoRef.current.currentTime = currentSub.startTime;
      }
      
      if (!isPlaying) {
        videoRef.current.play().catch(e => console.error("Autoplay blocked", e));
        setIsPlaying(true);
      }
    }
  }, [currentSubtitleIndex, subtitles, mode, videoRef]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (mode === PracticeMode.INPUT || mode === PracticeMode.FEEDBACK) {
        handleReplayCurrent();
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [isPlaying, mode, videoRef]);

  const handleReplayCurrent = useCallback((autoAdvanceAfter: boolean = false) => {
    if (videoRef.current && subtitles[currentSubtitleIndex]) {
      videoRef.current.currentTime = subtitles[currentSubtitleIndex].startTime;
      videoRef.current.play();
      setIsPlaying(true);
      onShouldAutoAdvanceChange?.(autoAdvanceAfter);
    }
  }, [subtitles, currentSubtitleIndex, videoRef, onShouldAutoAdvanceChange]);

  const handleProgressSeek = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    sections: any[],
    currentSectionIndex: number,
    onSectionChange: (sectionIndex: number, subIndex: number) => void
  ) => {
    if (videoRef.current && videoRef.current.duration) {
      const newTime = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(Number(e.target.value));
      
      const targetSectionIndex = sections.findIndex(s => newTime >= s.startTime && newTime < s.endTime);
      
      if (targetSectionIndex !== -1) {
        if (targetSectionIndex !== currentSectionIndex) {
          const newSection = sections[targetSectionIndex];
          const subIndex = newSection.subtitles.findIndex((s: Subtitle) => newTime >= s.startTime && newTime <= s.endTime);
          onSectionChange(targetSectionIndex, subIndex !== -1 ? subIndex : 0);
        } else {
          const subIndex = subtitles.findIndex(s => newTime >= s.startTime && newTime <= s.endTime);
          if (subIndex !== -1) {
            onSectionChange(currentSectionIndex, subIndex);
          }
        }
      }
    }
  }, [videoRef, subtitles]);

  return {
    isPlaying,
    volume,
    playbackSpeed,
    progress,
    setIsPlaying,
    setVolume,
    setPlaybackSpeed,
    setProgress,
    togglePlay,
    handleProgressSeek,
    handleReplayCurrent
  };
}

