import { isBadKey } from './aiConfig';

// Settings → Transcription: how "make subtitles" runs. On this machine with one
// of two model sizes, or on Groq's hosted Whisper with the user's own free key.
// Stored on this machine only, like the AI key.

export type TranscribeMode = 'local' | 'cloud';
export type LocalModel = 'standard' | 'light';
export type TranscribeConfig = { mode: TranscribeMode; localModel: LocalModel; groqKey: string };

export const GROQ_KEYS_URL = 'https://console.groq.com/keys';

const STORAGE_KEY = 'linguaclip_transcribe_config';
const DEFAULTS: TranscribeConfig = { mode: 'local', localModel: 'standard', groqKey: '' };

export function getTranscribeConfig(): TranscribeConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      mode: stored.mode === 'cloud' ? 'cloud' : 'local',
      localModel: stored.localModel === 'light' ? 'light' : 'standard',
      groqKey: typeof stored.groqKey === 'string' ? stored.groqKey : '',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveTranscribeConfig(config: TranscribeConfig): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* localStorage unavailable */ }
}

// Cloud picked but no usable key: the add-video dialog stops here instead of
// starting an import that can only fail.
export function cloudKeyMissing(config = getTranscribeConfig()): boolean {
  const key = config.groqKey.trim();
  return config.mode === 'cloud' && (!key || isBadKey(key));
}

// What start_import needs to know about the engine (src-tauri/src/import.rs).
export function engineArgs(config = getTranscribeConfig()) {
  return config.mode === 'cloud'
    ? { engine: 'cloud', model: null, apiKey: config.groqKey.trim() }
    : { engine: 'local', model: config.localModel, apiKey: null };
}
