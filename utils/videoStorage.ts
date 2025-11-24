/**
 * Video History and Progress Management
 */

import { VideoRecord, PracticeProgress, LearningMode, BlurPlaybackMode } from '../types';
import * as FileSystemAccess from './fileSystemAccess';

const STORAGE_KEY_PROGRESS = 'linguaclip_video_progress';

/**
 * Create a new video record
 */
export interface CreateVideoRecordOptions {
  videoFileHandle?: FileSystemFileHandle;
  learningMode?: LearningMode;
  blurPlaybackMode?: BlurPlaybackMode;
}

export const createVideoRecord = async (
  videoFile: File,
  subtitleFile: File,
  subtitleText: string,
  totalSubtitles: number,
  options: CreateVideoRecordOptions = {}
): Promise<VideoRecord> => {
  const {
    videoFileHandle,
    learningMode = LearningMode.DICTATION,
    blurPlaybackMode = BlurPlaybackMode.SENTENCE_BY_SENTENCE,
  } = options;
  const id = crypto.randomUUID();
  
  const record: VideoRecord = {
    id,
    displayName: videoFile.name,
    videoFileName: videoFile.name,
    subtitleFileName: subtitleFile.name,
    subtitleText,
    currentSubtitleIndex: 0,
    currentSectionIndex: 0,
    totalSubtitles,
    completionRate: 0,
    dateAdded: Date.now(),
    lastPracticed: Date.now(),
    totalPracticeTime: 0,
    learningMode,
    blurPlaybackMode,
  };

  // Save to IndexedDB
  await FileSystemAccess.saveVideoToDB(record);

  // Save file handle if available
  if (videoFileHandle) {
    await FileSystemAccess.saveFileHandle(id, videoFileHandle);
  }

  return record;
};

/**
 * Get all video records
 */
export const getAllVideoRecords = async (): Promise<VideoRecord[]> => {
  try {
    const records = await FileSystemAccess.getAllVideosFromDB();
    // Sort by last practiced (most recent first)
    return records.sort((a, b) => b.lastPracticed - a.lastPracticed);
  } catch (error) {
    console.error('Failed to get video records:', error);
    return [];
  }
};

/**
 * Get a single video record by ID
 */
export const getVideoRecord = async (id: string): Promise<VideoRecord | null> => {
  try {
    return await FileSystemAccess.getVideoFromDB(id);
  } catch (error) {
    console.error('Failed to get video record:', error);
    return null;
  }
};

/**
 * Update video record
 */
export const updateVideoRecord = async (record: VideoRecord): Promise<void> => {
  try {
    await FileSystemAccess.saveVideoToDB(record);
  } catch (error) {
    console.error('Failed to update video record:', error);
    throw error;
  }
};

/**
 * Delete video record
 */
export const deleteVideoRecord = async (id: string): Promise<void> => {
  try {
    await FileSystemAccess.deleteVideoFromDB(id);
  } catch (error) {
    console.error('Failed to delete video record:', error);
    throw error;
  }
};

/**
 * Update practice progress
 */
export const updateProgress = async (
  videoId: string,
  currentSubtitleIndex: number,
  currentSectionIndex: number
): Promise<void> => {
  try {
    const record = await getVideoRecord(videoId);
    if (!record) return;

    // Update progress
    record.currentSubtitleIndex = currentSubtitleIndex;
    record.currentSectionIndex = currentSectionIndex;
    record.lastPracticed = Date.now();
    
    // Calculate completion rate
    if (record.totalSubtitles > 0) {
      record.completionRate = Math.round((currentSubtitleIndex / record.totalSubtitles) * 100);
    }

    await updateVideoRecord(record);
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
};

/**
 * Get video file from stored handle
 */
export const getVideoFileFromRecord = async (record: VideoRecord): Promise<File | null> => {
  try {
    const handle = await FileSystemAccess.getFileHandle(record.id);
    if (!handle) return null;

    return await FileSystemAccess.getFileFromHandle(handle);
  } catch (error) {
    console.error('Failed to get video file:', error);
    return null;
  }
};

/**
 * Save video file handle for a record
 */
export const saveVideoFileHandle = async (videoId: string, handle: FileSystemFileHandle): Promise<void> => {
  try {
    await FileSystemAccess.saveFileHandle(videoId, handle);
  } catch (error) {
    console.error('Failed to save video file handle:', error);
  }
};

/**
 * Create subtitle file from stored text
 */
export const getSubtitleFileFromRecord = (record: VideoRecord): File => {
  const blob = new Blob([record.subtitleText], { type: 'text/plain' });
  return new File([blob], record.subtitleFileName, { type: 'text/plain' });
};

/**
 * Update total practice time
 */
export const updatePracticeTime = async (videoId: string, additionalSeconds: number): Promise<void> => {
  try {
    const record = await getVideoRecord(videoId);
    if (!record) return;

    record.totalPracticeTime += additionalSeconds;
    await updateVideoRecord(record);
  } catch (error) {
    console.error('Failed to update practice time:', error);
  }
};

/**
 * Format practice time for display
 */
export const formatPracticeTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

/**
 * Format last practiced time for display
 */
export const formatLastPracticed = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  
  return new Date(timestamp).toLocaleDateString();
};
