import { GoogleGenAI, Type } from "@google/genai";
import { AIConfig } from '../types';
import { t } from './i18n';

const STORAGE_KEY_AI = 'linguaclip_ai_config';

export const DEFAULT_PROMPT = `Define the word "{word}" as it is used in this sentence: "{context}". Provide a brief definition and its part of speech.`;

const getClient = (userApiKey?: string) => {
    // Priority: 1. User's API Key, 2. Environment variable
    const apiKey = userApiKey || process.env.API_KEY || '';

    if (!apiKey) {
        throw new Error("No API Key provided. Please enter your Gemini API Key in Settings.");
    }

    return new GoogleGenAI({ apiKey });
};

export const getAIConfig = (): AIConfig => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_AI);
        const config = stored ? JSON.parse(stored) : {
            model: 'gemini-2.5-flash',
            temperature: 0.7,
            promptTemplate: DEFAULT_PROMPT,
            apiKey: ''
        };

        // Backwards compatibility: ensure promptTemplate exists
        if (!config.promptTemplate) {
            config.promptTemplate = DEFAULT_PROMPT;
        }

        // Backwards compatibility: ensure apiKey exists
        if (!config.apiKey) {
            config.apiKey = '';
        }

        return config;
    } catch (e) {
        return { model: 'gemini-2.5-flash', temperature: 0.7, promptTemplate: DEFAULT_PROMPT, apiKey: '' };
    }
};

export const saveAIConfig = (config: AIConfig) => {
    localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(config));
};

export interface WordDefinition {
    word: string;
    definition: string;
    partOfSpeech: string;
}

export const getWordDefinition = async (word: string, context: string): Promise<WordDefinition> => {
    try {
        const config = getAIConfig();
        const ai = getClient(config.apiKey);

        const promptTemplate = config.promptTemplate || DEFAULT_PROMPT;
        const prompt = promptTemplate
            .replace('{word}', word)
            .replace('{context}', context);

        const response = await ai.models.generateContent({
            model: config.model,
            contents: prompt,
            config: {
                temperature: config.temperature,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        word: { type: Type.STRING },
                        definition: { type: Type.STRING },
                        partOfSpeech: { type: Type.STRING },
                    },
                    required: ["word", "definition", "partOfSpeech"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as WordDefinition;
        }
        throw new Error("No response text from AI");
    } catch (error) {
        console.error("AI Definition Error:", error);
        const noKey = error instanceof Error && error.message.includes("API Key");
        throw new Error(noKey ? t('ai.noKeyError') : t('ai.genericError'));
    }
};
