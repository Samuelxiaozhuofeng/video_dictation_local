import { AnkiConfig, AnkiCardTemplateConfig } from '../types';

const STORAGE_KEY_ANKI = 'linguaclip_anki_config';
const DEFAULT_URL = 'http://127.0.0.1:8765';

export const getAnkiConfig = (): AnkiConfig | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ANKI);
    if (!stored) return null;

    const parsed: any = JSON.parse(stored);

    // Backwards compatibility: old shape was a single template
    if (parsed && typeof parsed === 'object' && 'deckName' in parsed && 'modelName' in parsed) {
      const url = parsed.url || DEFAULT_URL;
      const template: AnkiCardTemplateConfig = {
        deckName: parsed.deckName,
        modelName: parsed.modelName,
        fieldMapping: parsed.fieldMapping || {},
      };
      return {
        url,
        // 默认将旧配置同时作为两种卡片的模板，避免用户升级后不能用
        wordCard: template,
        audioCard: template,
      };
    }

    // New shape
    if (parsed && typeof parsed === 'object' && 'url' in parsed) {
      return {
        url: parsed.url || DEFAULT_URL,
        wordCard: parsed.wordCard || null,
        audioCard: parsed.audioCard || null,
      };
    }

    return null;
  } catch (e) {
    return null;
  }
};

export const saveAnkiConfig = (config: AnkiConfig) => {
  localStorage.setItem(STORAGE_KEY_ANKI, JSON.stringify(config));
};

// Helper to invoke AnkiConnect actions
export const invokeAnki = async (action: string, params: any = {}, url: string = DEFAULT_URL) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.result;
  } catch (e) {
    console.error(`AnkiConnect Error (${action}):`, e);
    throw e;
  }
};

export const getDeckNames = async (url: string) => {
  return invokeAnki('deckNames', {}, url);
};

export const getModelNames = async (url: string) => {
  return invokeAnki('modelNames', {}, url);
};

export const getModelFieldNames = async (modelName: string, url: string) => {
  return invokeAnki('modelFieldNames', { modelName }, url);
};

export const addNote = async (
  url: string,
  template: AnkiCardTemplateConfig,
  data: { 
    sentence: string; 
    videoName: string; 
    timestamp: string; 
    screenshotBase64?: string;
    audioBase64?: string;
    word?: string;
    definition?: string;
  }
) => {
  const fields: Record<string, string> = {};
  const picture: any[] = [];
  const audio: any[] = [];

  // Map app data to Anki fields
  Object.entries(template.fieldMapping).forEach(([ankiField, appKey]) => {
    if (!appKey) return;

    if (appKey === 'sentence') fields[ankiField] = data.sentence;
    else if (appKey === 'videoName') fields[ankiField] = data.videoName;
    else if (appKey === 'timestamp') fields[ankiField] = data.timestamp;
    else if (appKey === 'word') fields[ankiField] = data.word || '';
    else if (appKey === 'definition') fields[ankiField] = data.definition || '';
    else if (appKey === 'context') fields[ankiField] = data.sentence; // Context is usually the full sentence
    else if (appKey === 'screenshot' && data.screenshotBase64) {
        picture.push({
            data: data.screenshotBase64.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""),
            filename: `linguaclip_img_${Date.now()}.png`,
            fields: [ankiField]
        });
    }
    else if (appKey === 'audio' && data.audioBase64) {
        audio.push({
            data: data.audioBase64,
            filename: `linguaclip_audio_${Date.now()}.webm`,
            fields: [ankiField]
        });
    }
  });

  const note = {
    deckName: template.deckName,
    modelName: template.modelName,
    fields: fields,
    options: {
      allowDuplicate: true, // Fix for "cannot create note because it is a duplicate"
      duplicateScope: "deck",
    },
    picture: picture.length > 0 ? picture : undefined,
    audio: audio.length > 0 ? audio : undefined,
  };

  return invokeAnki('addNote', { note }, url);
};

// Re-export types for convenience in hooks/components
export type { AnkiConfig, AnkiCardTemplateConfig };
