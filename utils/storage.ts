import { Subtitle, PracticeConfig, AudioPaddingConfig, ClozeLevel } from '../types';
import { CustomConfig, parseCustomConfig } from './customPick';

const STORAGE_KEY_PRACTICE = 'linguaclip_practice_config';
const STORAGE_KEY_AUDIO_PADDING = 'linguaclip_audio_padding';

// Helper to format seconds to MM:SS
export const formatTimeCode = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
// --- Custom practice (utils/customPick.ts) ---

export const getCustomConfig = (): CustomConfig => parseCustomConfig(getPracticeConfig().custom);

export const saveCustomConfig = (custom: CustomConfig) => {
  savePracticeConfig({ ...getPracticeConfig(), custom });
};

// Where each video's next custom session starts, in seconds. Kept apart from the
// record's section progress, which custom practice never touches.
const STORAGE_KEY_CUSTOM_POS = 'linguaclip_custom_pos';

const readCustomPos = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM_POS) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

export const getCustomPos = (videoId: string): number => {
  const n = readCustomPos()[videoId];
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
};

const writeCustomPos = (edit: (all: Record<string, number>) => void) => {
  try {
    const all = readCustomPos();
    edit(all);
    localStorage.setItem(STORAGE_KEY_CUSTOM_POS, JSON.stringify(all));
  } catch { /* only costs where the next session starts */ }
};

export const setCustomPos = (videoId: string, sec: number) => writeCustomPos(all => { all[videoId] = sec; });
export const forgetCustomPos = (videoId: string) => writeCustomPos(all => { delete all[videoId]; });
