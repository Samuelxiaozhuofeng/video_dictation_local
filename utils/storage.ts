import { SavedLine, Subtitle, PracticeConfig, AudioPaddingConfig, ClozeLevel } from '../types';

const STORAGE_KEY = 'linguaclip_saved_lines';
const STORAGE_KEY_PRACTICE = 'linguaclip_practice_config';
const STORAGE_KEY_AUDIO_PADDING = 'linguaclip_audio_padding';

// Helper to format seconds to MM:SS
export const formatTimeCode = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const getSavedLines = (): SavedLine[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load saved lines", e);
    return [];
  }
};

export const saveLineToStorage = (sub: Subtitle, videoName: string): SavedLine[] => {
  const lines = getSavedLines();
  // Prevent duplicates based on text content
  if (lines.some(l => l.text === sub.text)) {
    return lines;
  }

  const newLine: SavedLine = {
    id: crypto.randomUUID(),
    text: sub.text,
    dateSaved: Date.now(),
    videoName,
    timeDisplay: formatTimeCode(sub.startTime),
  };

  const updated = [newLine, ...lines];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const removeLineFromStorage = (text: string): SavedLine[] => {
  const lines = getSavedLines();
  const updated = lines.filter(l => l.text !== text);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const clearStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  return [];
};

// --- Practice Config Storage ---

// A practice session should have an end you can see from the start: four
// minutes of video is already 20-30 minutes of dictation. 0 (the whole video)
// stays available in Settings, it just is not what you get by default.
export const DEFAULT_SECTION_LENGTH = 4;

const parseClozeLevel = (value: unknown): ClozeLevel =>
  value === 'easy' || value === 'medium' || value === 'full' ? value : 'full';

export const getPracticeConfig = (): PracticeConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PRACTICE);
    if (!stored) return { sectionLength: DEFAULT_SECTION_LENGTH, clozeLevel: 'full' };
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      sectionLength: parsed.sectionLength ?? DEFAULT_SECTION_LENGTH,
      clozeLevel: parseClozeLevel(parsed.clozeLevel),
    };
  } catch (e) {
    return { sectionLength: DEFAULT_SECTION_LENGTH, clozeLevel: 'full' };
  }
};

export const savePracticeConfig = (config: PracticeConfig) => {
  localStorage.setItem(STORAGE_KEY_PRACTICE, JSON.stringify(config));
};

// --- Audio Padding Config Storage ---

export const getAudioPaddingConfig = (): AudioPaddingConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_AUDIO_PADDING);
    // Default: 100ms start, 200ms end
    return stored ? JSON.parse(stored) : { startPadding: 100, endPadding: 200 };
  } catch (e) {
    return { startPadding: 100, endPadding: 200 };
  }
};

export const saveAudioPaddingConfig = (config: AudioPaddingConfig) => {
  localStorage.setItem(STORAGE_KEY_AUDIO_PADDING, JSON.stringify(config));
};