import { ankiRequest } from './desktop';
import { AnkiConfig, AnkiCardTemplateConfig } from '../types';

const STORAGE_KEY_ANKI = 'linguaclip_anki_config';
const DEFAULT_URL = 'http://127.0.0.1:8765';

export const getAnkiConfig = (): AnkiConfig | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ANKI);
    if (!stored) return null;

    const parsed: any = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;

    // Oldest shape: one template at the top level
    if ('deckName' in parsed && 'modelName' in parsed) {
      return {
        url: parsed.url || DEFAULT_URL,
        card: { deckName: parsed.deckName, modelName: parsed.modelName, fieldMapping: parsed.fieldMapping || {} },
      };
    }

    if ('url' in parsed) {
      // Before 2026-09 there were word + audio cards; both add buttons already
      // preferred the audio one, so keep that and nothing changes for the user.
      const card = parsed.card || parsed.audioCard || parsed.wordCard || null;
      return { url: parsed.url || DEFAULT_URL, card };
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
    const raw = await ankiRequest(url, JSON.stringify({ action, version: 6, params }));
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(`not AnkiConnect: ${raw.slice(0, 120) || '(empty body)'}`);
    }

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
    audioExt?: string;
    word?: string;
    definition?: string;
    example?: string;
  }
) => {
  const fields: Record<string, string> = {};
  const sentence = data.word ? boldWord(data.sentence, data.word) : data.sentence;
  const picture: any[] = [];
  const audio: any[] = [];

  // Map app data to Anki fields
  Object.entries(template.fieldMapping).forEach(([ankiField, appKey]) => {
    if (!appKey) return;

    if (appKey === 'sentence') fields[ankiField] = sentence;
    else if (appKey === 'videoName') fields[ankiField] = data.videoName;
    else if (appKey === 'timestamp') fields[ankiField] = data.timestamp;
    else if (appKey === 'word') fields[ankiField] = data.word || '';
    else if (appKey === 'definition') fields[ankiField] = data.definition || '';
    else if (appKey === 'example') fields[ankiField] = data.example || '';
    else if (appKey === 'context') fields[ankiField] = sentence; // Context is usually the full sentence
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
            filename: `linguaclip_audio_${Date.now()}.${data.audioExt || 'webm'}`,
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

// Wrap the looked-up word in <b> where it sits in the sentence. Whole-word match
// first (so "a" doesn't light up inside "want"); scripts without spaces (Japanese)
// fall back to the first plain occurrence.
export const boldWord = (sentence: string, word: string): string => {
  const w = word.trim();
  if (!w) return sentence;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const whole = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu');
  const re = whole.test(sentence) ? whole : new RegExp(esc, 'iu');
  return sentence.replace(re, (m) => `<b>${m}</b>`);
};

// --- One-click LinguaClip card: a deck + note type made for this app ---

export const LINGUACLIP_NAME = 'LinguaClip';

// Anki field -> app data key. Sentence goes first: Anki refuses notes whose
// first field is empty, and both add buttons always send a sentence.
export const LINGUACLIP_FIELDS: Record<string, string> = {
  Sentence: 'sentence',
  Audio: 'audio',
  Image: 'screenshot',
  Word: 'word',
  Definition: 'definition',
  Example: 'example',
  Video: 'videoName',
  Time: 'timestamp',
};

const LINGUACLIP_FRONT = `{{Audio}}
<div class="shot">{{Image}}</div>
{{#Word}}<div class="word">{{Word}}</div>{{/Word}}`;

const LINGUACLIP_BACK = `{{FrontSide}}
<hr id="answer">
<div class="sentence">{{Sentence}}</div>
{{#Definition}}<div class="def">{{Definition}}</div>{{/Definition}}
{{#Example}}<div class="ex">{{Example}}</div>{{/Example}}
<div class="src">{{Video}}{{#Time}} · {{Time}}{{/Time}}</div>`;

const LINGUACLIP_CSS = `.card { font-family: -apple-system, "PingFang SC", sans-serif; font-size: 20px; line-height: 1.5; text-align: center; color: #1f2328; background: #fff; }
.nightMode.card, .night_mode .card { color: #e6e1d6; background: #16202a; }
.shot img { max-width: 100%; max-height: 50vh; border-radius: 6px; }
.word { margin-top: 12px; font-size: 30px; font-weight: 600; }
.sentence { font-size: 22px; }
.sentence b { color: #d9a441; }
.def, .ex { margin-top: 12px; font-size: 16px; text-align: left; }
.ex { opacity: .75; }
.src { margin-top: 16px; font-size: 12px; opacity: .5; }`;

// Create the LinguaClip deck and note type if missing (an existing note type
// is used as-is, so edits the user made in Anki survive), then return the card
// config pointing at them.
export const setupLinguaClipCard = async (url: string): Promise<AnkiCardTemplateConfig> => {
  await invokeAnki('createDeck', { deck: LINGUACLIP_NAME }, url);
  const models: string[] = await getModelNames(url);
  if (!models.includes(LINGUACLIP_NAME)) {
    await invokeAnki('createModel', {
      modelName: LINGUACLIP_NAME,
      inOrderFields: Object.keys(LINGUACLIP_FIELDS),
      css: LINGUACLIP_CSS,
      isCloze: false,
      cardTemplates: [{ Name: LINGUACLIP_NAME, Front: LINGUACLIP_FRONT, Back: LINGUACLIP_BACK }],
    }, url);
  }
  const fields: string[] = await getModelFieldNames(LINGUACLIP_NAME, url);
  const fieldMapping: Record<string, string> = {};
  fields.forEach((f) => { if (LINGUACLIP_FIELDS[f]) fieldMapping[f] = LINGUACLIP_FIELDS[f]; });
  return { deckName: LINGUACLIP_NAME, modelName: LINGUACLIP_NAME, fieldMapping };
};

// Re-export types for convenience in hooks/components
export type { AnkiConfig, AnkiCardTemplateConfig };
