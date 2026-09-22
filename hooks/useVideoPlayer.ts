import { useState, useRef, useEffect, useCallback } from 'react';
import { Subtitle, PracticeMode, LearningMode, BlurPlaybackMode } from '../types';

export interface UseVideoPlayerParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  subtitles: Subtitle[];
  currentSubtitleIndex: number;
  mode: PracticeMode;
  shouldAutoAdvance: boolean;
  learningMode?: LearningMode;
  blurPlaybackMode?: BlurPlaybackMode;
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
    learningMode = LearningMode.DICTATION,
    blurPlaybackMode = BlurPlaybackMode.SENTENCE_BY_SENTENCE,
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
  const blurAutoAdvanceRef = useRef(false);
  const userPausedRef = useRef(false); // Track if user manually paused in continuous mode

  useEffect(() => {
    blurAutoAdvanceRef.current = false;
    // Reset user pause state when subtitle changes
    userPausedRef.current = false;
  }, [currentSubtitleIndex, learningMode, blurPlaybackMode]);

  // Checks whether the current line has ended; runs every frame and on `timeupdate`
  // (rAF is throttled in background tabs, timeupdate keeps firing).
  const checkVideoTime = useCallback(() => {
    if (!videoRef.current || subtitles.length === 0) return;
    
    const video = videoRef.current;
    const currentSub = subtitles[currentSubtitleIndex];
    
    if (!currentSub) return;

    const isBlurContinuous = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS;

    if (isPlaying) {
      if (video.currentTime >= currentSub.endTime) {
        if (isBlurContinuous) {
          if (!blurAutoAdvanceRef.current) {
            blurAutoAdvanceRef.current = true;
            onAutoAdvance?.();
          }
        } else {
          video.pause();
          setIsPlaying(false);
          video.currentTime = currentSub.endTime;

          if (learningMode === LearningMode.BLUR) {
            // Sentence-by-sentence mode waits for user action between lines.
          } else {
            if (mode === PracticeMode.LISTENING) {
              onModeChange?.(PracticeMode.INPUT);
            } else if (shouldAutoAdvance) {
              onShouldAutoAdvanceChange?.(false);
              onAutoAdvance?.();
            }
          }
        }
      }
    }
    
    if (video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  }, [
    subtitles,
    currentSubtitleIndex,
    mode,
    isPlaying,
    shouldAutoAdvance,
    learningMode,
    blurPlaybackMode,
    onModeChange,
    onAutoAdvance,
    onShouldAutoAdvanceChange,
    videoRef
  ]);

  useEffect(() => {
    const loop = () => { checkVideoTime(); requestRef.current = requestAnimationFrame(loop); };
    requestRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    video?.addEventListener('timeupdate', checkVideoTime);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      video?.removeEventListener('timeupdate', checkVideoTime);
    };
  }, [checkVideoTime, videoRef]);

  // Handle Volume/Speed changes directly on ref
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed, videoRef]);

  // Seek + autoplay when the line changes. Deliberately not keyed on isPlaying:
  // otherwise the end-of-line pause flips isPlaying and this would restart the video.
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    const currentSub = subtitles[currentSubtitleIndex];
    if (!video || !currentSub || mode !== PracticeMode.LISTENING) return;
    const isBlurContinuous = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS;
    const playing = isPlayingRef.current;

    const tolerance = 0.5;
    const shouldForceSeek = !(isBlurContinuous && playing);
    if (shouldForceSeek && (video.currentTime < currentSub.startTime - tolerance || video.currentTime > currentSub.endTime)) {
      video.currentTime = currentSub.startTime;
    }

    if (playing) return;
    // Continuous mode respects a manual pause; every other mode plays the new line.
    if (isBlurContinuous && userPausedRef.current) return;
    setIsPlaying(true);
    video.play().catch(e => { console.error("Autoplay blocked", e); setIsPlaying(false); });
  }, [currentSubtitleIndex, subtitles, mode, videoRef, learningMode, blurPlaybackMode]);

  const handleReplayCurrent = useCallback((autoAdvanceAfter: boolean = false) => {
    if (videoRef.current && subtitles[currentSubtitleIndex]) {
      videoRef.current.currentTime = subtitles[currentSubtitleIndex].startTime;
      setIsPlaying(true);
      videoRef.current.play().catch(e => { console.error("Play blocked", e); setIsPlaying(false); });
      onShouldAutoAdvanceChange?.(autoAdvanceAfter);
    }
  }, [subtitles, currentSubtitleIndex, videoRef, onShouldAutoAdvanceChange]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    const isBlurContinuous = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      // Mark that user manually paused in continuous mode
      if (isBlurContinuous) {
        userPausedRef.current = true;
      }
    } else {
      const sub = subtitles[currentSubtitleIndex];
      const atLineEnd = !!sub && videoRef.current.currentTime >= sub.endTime - 0.05;
      if (mode === PracticeMode.INPUT || mode === PracticeMode.FEEDBACK || atLineEnd) {
        handleReplayCurrent();
      } else {
        setIsPlaying(true);
        videoRef.current.play().catch(e => { console.error("Play failed", e); setIsPlaying(false); });
        // Clear user pause flag when resuming
        if (isBlurContinuous) {
          userPausedRef.current = false;
        }
      }
    }
  }, [isPlaying, mode, videoRef, handleReplayCurrent, learningMode, blurPlaybackMode, subtitles, currentSubtitleIndex]);

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
