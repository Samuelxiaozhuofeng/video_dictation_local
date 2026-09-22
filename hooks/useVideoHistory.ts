import { useState, useCallback } from 'react';
import { VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';
import { CreateVideoRecordOptions } from '../utils/videoStorage';

export interface UseVideoHistoryReturn {
  currentVideoId: string | null;
  setCurrentVideoId: (id: string | null) => void;
  createVideoRecord: (
    videoName: string,
    subtitleFile: File,
    subtitleText: string,
    totalSubtitles: number,
    options?: CreateVideoRecordOptions
  ) => Promise<VideoRecord>;
  updateProgress: (videoId: string, subtitleIndex: number, sectionIndex: number) => Promise<void>;
  getSubtitleFileFromRecord: (record: VideoRecord) => File;
}

export function useVideoHistory(): UseVideoHistoryReturn {
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  const createVideoRecord = useCallback(async (
    videoName: string,
    subtitleFile: File,
    subtitleText: string,
    totalSubtitles: number,
    options: CreateVideoRecordOptions = {}
  ): Promise<VideoRecord> => {
    return await VideoStorage.createVideoRecord(
      videoName,
      subtitleFile,
      subtitleText,
      totalSubtitles,
      options
    );
  }, []);

  const updateProgress = useCallback(async (
    videoId: string,
    subtitleIndex: number,
    sectionIndex: number
  ): Promise<void> => {
    await VideoStorage.updateProgress(videoId, subtitleIndex, sectionIndex);
  }, []);

  const getSubtitleFileFromRecord = useCallback((record: VideoRecord): File => {
    return VideoStorage.getSubtitleFileFromRecord(record);
  }, []);

  return {
    currentVideoId,
    setCurrentVideoId,
    createVideoRecord,
    updateProgress,
    getSubtitleFileFromRecord,
  };
}
