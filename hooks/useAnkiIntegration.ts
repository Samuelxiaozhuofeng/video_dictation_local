import { useState, useCallback } from 'react';
import { Subtitle, AnkiConfig, AnkiCardTemplateConfig } from '../types';
import * as Anki from '../utils/anki';
import * as Storage from '../utils/storage';

export type AnkiStatus = 'idle' | 'recording' | 'adding' | 'success' | 'error';

export interface UseAnkiIntegrationParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoFileName: string | null;
}

export interface UseAnkiIntegrationReturn {
  // State
  ankiConfig: AnkiConfig | null;
  ankiStatus: AnkiStatus;

  // Actions
  setAnkiConfig: (config: Anki.AnkiConfig | null) => void;
  setAnkiStatus: (status: AnkiStatus) => void;
  handleAddToAnki: (subtitle: Subtitle) => Promise<void>;
  handleWordToAnki: (word: string, definition: string, subtitle: Subtitle, includeAudio?: boolean) => Promise<void>;
  reloadConfig: () => void;
}

export function useAnkiIntegration(params: UseAnkiIntegrationParams): UseAnkiIntegrationReturn {
  const { videoRef, videoFileName } = params;

  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig | null>(Anki.getAnkiConfig());
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>('idle');

  // Reload config from storage
  const reloadConfig = useCallback(() => {
    setAnkiConfig(Anki.getAnkiConfig());
  }, []);

  // Capture audio clip from video with padding
  const captureAudioClip = useCallback(async (start: number, end: number): Promise<string | null> => {
    const video = videoRef.current;
    if (!video) return null;

    // Get audio padding configuration
    const paddingConfig = Storage.getAudioPaddingConfig();
    const startPaddingSec = paddingConfig.startPadding / 1000;
    const endPaddingSec = paddingConfig.endPadding / 1000;

    // Apply padding
    const paddedStart = start - startPaddingSec;
    const paddedEnd = end + endPaddingSec;

    // Boundary checks
    if (paddedStart < 0) {
      throw new Error(`Audio padding error: Start time (${paddedStart.toFixed(2)}s) is before video start. Please reduce start padding.`);
    }
    if (paddedEnd > video.duration) {
      throw new Error(`Audio padding error: End time (${paddedEnd.toFixed(2)}s) exceeds video duration (${video.duration.toFixed(2)}s). Please reduce end padding.`);
    }

    // Check for browser support
    const stream: MediaStream | null = (video as any).captureStream ? (video as any).captureStream() :
                                       (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;

    if (!stream) return null;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return null;

    const recorder = new MediaRecorder(new MediaStream([audioTrack]), { mimeType: 'audio/webm' });
    const chunks: BlobPart[] = [];
    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;

    return new Promise((resolve, reject) => {
        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.includes(',') ? result.split(',')[1] : result;

                // Restore state
                video.currentTime = originalTime;
                if (!wasPlaying) video.pause();

                resolve(base64);
            }
        };

        // Start recording sequence with padded times
        video.currentTime = paddedStart;
        recorder.start();
        video.play().catch(e => {
            console.error("Record playback failed", e);
            reject(e);
        });

        const duration = (paddedEnd - paddedStart) * 1000;

        // Stop slightly after duration to ensure we catch the end
        setTimeout(() => {
            if (recorder.state !== 'inactive') {
                recorder.stop();
                video.pause();
            }
        }, duration + 50); // 50ms buffer
    });
  }, [videoRef]);

  // Capture media (screenshot and/or audio) for a subtitle
  const captureMedia = useCallback(async (currentSub: Subtitle, template: AnkiCardTemplateConfig | null, includeAudio: boolean = true) => {
      let screenshotBase64 = undefined;
      let audioBase64 = undefined;

      if (!template) return { screenshotBase64, audioBase64 };

      const mappingValues = Object.values(template.fieldMapping);
      const needsScreenshot = mappingValues.includes('screenshot');
      const needsAudio = mappingValues.includes('audio');

      // 1. Capture Screenshot
      if (videoRef.current && needsScreenshot) {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  screenshotBase64 = canvas.toDataURL('image/jpeg', 0.8);
              }
          } catch (e) {
              console.error("Screenshot capture failed", e);
          }
      }

      // 2. Capture Audio (only if includeAudio is true)
      if (includeAudio && needsAudio && videoRef.current) {
          try {
              const result = await captureAudioClip(currentSub.startTime, currentSub.endTime);
              if (result) audioBase64 = result;
          } catch (e) {
              console.error("Audio capture failed", e);
          }
      }

      return { screenshotBase64, audioBase64 };
  }, [ankiConfig, videoRef, captureAudioClip]);

  // Add current subtitle to Anki
  const handleAddToAnki = useCallback(async (subtitle: Subtitle) => {
    if (!ankiConfig) {
      alert("Please configure Anki settings first.");
      return;
    }
    if (ankiStatus !== 'idle') return;

    // 优先使用 Audio 卡片模板，其次回退到 Word 模板
    const template: AnkiCardTemplateConfig | null =
      ankiConfig.audioCard || ankiConfig.wordCard || null;

    if (!template) {
      alert("Please configure Anki card templates in Settings.");
      return;
    }

    const needsAudio = Object.values(template.fieldMapping).includes('audio');
    if (needsAudio) setAnkiStatus('recording');
    else setAnkiStatus('adding');

    const { screenshotBase64, audioBase64 } = await captureMedia(subtitle, template, true);

    setAnkiStatus('adding');
    try {
        await Anki.addNote(ankiConfig.url, template, {
            sentence: subtitle.text,
            videoName: videoFileName || 'Unknown',
            timestamp: Storage.formatTimeCode(subtitle.startTime),
            screenshotBase64,
            audioBase64
        });
        setAnkiStatus('success');
        setTimeout(() => setAnkiStatus('idle'), 2000);
    } catch (e: any) {
        console.error(e);
        setAnkiStatus('error');
        alert("Failed to add to Anki: " + e.message);
        setTimeout(() => setAnkiStatus('idle'), 3000);
    }
  }, [ankiConfig, ankiStatus, captureMedia, videoFileName]);

  // Add word with definition to Anki
  const handleWordToAnki = useCallback(async (word: string, definition: string, subtitle: Subtitle, includeAudio: boolean = true) => {
      if (!ankiConfig) {
        alert("Please configure Anki settings first.");
        return;
      }

      // 只有 Only Word（includeAudio === false）使用 Word 卡片模板；
      // 其余（With Audio 等）优先使用 Audio 模板
      let template: AnkiCardTemplateConfig | null;
      if (includeAudio) {
        template = ankiConfig.audioCard || ankiConfig.wordCard || null;
      } else {
        template = ankiConfig.wordCard || ankiConfig.audioCard || null;
      }

      if (!template) {
        alert("Please configure Anki card templates in Settings.");
        return;
      }

      const { screenshotBase64, audioBase64 } = await captureMedia(subtitle, template, includeAudio);

      await Anki.addNote(ankiConfig.url, template, {
          sentence: subtitle.text,
          videoName: videoFileName || 'Unknown',
          timestamp: Storage.formatTimeCode(subtitle.startTime),
          screenshotBase64,
          audioBase64,
          word,
          definition
      });
  }, [ankiConfig, captureMedia, videoFileName]);

  return {
    ankiConfig,
    ankiStatus,
    setAnkiConfig,
    setAnkiStatus,
    handleAddToAnki,
    handleWordToAnki,
    reloadConfig
  };
}
