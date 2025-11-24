import { useState, useCallback } from 'react';
import { VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';
import { CreateVideoRecordOptions } from '../utils/videoStorage';

export interface UseVideoHistoryReturn {
  currentVideoId: string | null;
  setCurrentVideoId: (id: string | null) => void;
  createVideoRecord: (
    videoFile: File,
    subtitleFile: File,
    subtitleText: string,
    totalSubtitles: number,
    options?: CreateVideoRecordOptions
  ) => Promise<VideoRecord>;
  updateProgress: (videoId: string, subtitleIndex: number, sectionIndex: number) => Promise<void>;
  getVideoFileFromRecord: (record: VideoRecord) => Promise<File | null>;
  getSubtitleFileFromRecord: (record: VideoRecord) => File;
  saveVideoFileHandle: (videoId: string, fileHandle: any) => Promise<void>;
}

export function useVideoHistory(): UseVideoHistoryReturn {
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  const createVideoRecord = useCallback(async (
    videoFile: File,
    subtitleFile: File,
    subtitleText: string,
    totalSubtitles: number,
    options: CreateVideoRecordOptions = {}
  ): Promise<VideoRecord> => {
    return await VideoStorage.createVideoRecord(
      videoFile,
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

  const getVideoFileFromRecord = useCallback(async (record: VideoRecord): Promise<File | null> => {
    return await VideoStorage.getVideoFileFromRecord(record);
  }, []);

  const getSubtitleFileFromRecord = useCallback((record: VideoRecord): File => {
    return VideoStorage.getSubtitleFileFromRecord(record);
  }, []);

  const saveVideoFileHandle = useCallback(async (videoId: string, fileHandle: any): Promise<void> => {
    await VideoStorage.saveVideoFileHandle(videoId, fileHandle);
  }, []);

  return {
    currentVideoId,
    setCurrentVideoId,
    createVideoRecord,
    updateProgress,
    getVideoFileFromRecord,
    getSubtitleFileFromRecord,
    saveVideoFileHandle
  };
}
