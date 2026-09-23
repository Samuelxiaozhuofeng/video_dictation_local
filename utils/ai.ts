import { fetch } from '@tauri-apps/plugin-http';
import { t, getLang } from './i18n';
import { getAIConfig, getEndpoint, readJsonBody, DEFAULT_PROMPT } from './aiConfig';

export { getAIConfig, saveAIConfig, listModels, getCachedModels, isBadKey, DEFAULT_PROMPT } from './aiConfig';

export interface WordDefinition {
    word: string;
    definition: string;
    partOfSpeech: string;
}

// The prompt template is the user's, so the JSON contract is pinned here
// instead — whatever they write, the reply still has to parse.
// Appended to the user message, not sent as a system message: gateways vary in
// how much attention a system role gets, and a trailing instruction is the one
// models follow most reliably. Keys are fixed in English whatever the language
// of the answer.
const JSON_RULE = '\n\nReply with a single JSON object and nothing else (no markdown fence). Use exactly these keys, in English: {"word": string, "definition": string, "partOfSpeech": string}.';

const readJson = (content: string): WordDefinition => {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`model did not return JSON: ${content.slice(0, 120)}`);
    const parsed = JSON.parse(match[0]) as Partial<WordDefinition>;
    if (typeof parsed.definition !== 'string') {
        throw new Error(`model returned unexpected keys: ${Object.keys(parsed).join(', ')}`);
    }
    return { word: parsed.word ?? '', definition: parsed.definition, partOfSpeech: parsed.partOfSpeech ?? '' };
};

// Word lookup can use AI: the same check chat() makes before asking.
export const aiReady = (): boolean => !!getEndpoint() && !!getAIConfig().model?.trim();

// One user message to the configured model; returns the reply text. Errors come
// out already worded for the user.
const chat = async (prompt: string): Promise<string> => {
    try {
        const endpoint = getEndpoint();
        const config = getAIConfig();
        if (!endpoint || !config.model?.trim()) throw new Error('API Key missing');

        const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                temperature: config.temperature,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) {
            // The provider's own message (unknown model, no quota, bad key) is
            // the only thing that tells the user what to change, so carry it up.
            const detail = (await res.text().catch(() => '')).slice(0, 200);
            throw new Error(`HTTP ${res.status} ${detail}`);
        }
        const body = await readJsonBody<{ choices?: { message?: { content?: string } }[] }>(res);
        const content = body?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('No response text from AI');
        return content;
    } catch (error) {
        console.error("AI Definition Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('API Key')) throw new Error(t('ai.noKeyError'));
        throw new Error(`${t('ai.genericError')}\n${message}`);
    }
};

// A reply that does not parse is worded like any other failure.
const orGeneric = <T,>(parse: () => T): T => {
    try {
        return parse();
    } catch (e) {
        throw new Error(`${t('ai.genericError')}\n${e instanceof Error ? e.message : String(e)}`);
    }
};

const jsonOf = (content: string): Record<string, unknown> => {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`model did not return JSON: ${content.slice(0, 120)}`);
    return JSON.parse(match[0]);
};

export const getWordDefinition = async (word: string, context: string): Promise<WordDefinition> => {
    const config = getAIConfig();
    const prompt = (config.promptTemplate || DEFAULT_PROMPT)
        .replace('{word}', word)
        .replace('{context}', context);
    const content = await chat(prompt + JSON_RULE);
    return orGeneric(() => readJson(content));
};

export interface SensePick { index: number | null; note: string }

// Which of the dictionary's numbered meanings the sentence uses. The model only
// answers with a number (1-based) into the list it was shown, so it cannot
// reword the dictionary; a number outside the list counts as "none fits".
export const pickSense = async (word: string, context: string, lines: string[]): Promise<SensePick> => {
    const language = getLang() === 'zh' ? 'Simplified Chinese' : 'English';
    const prompt = `The word "${word}" appears in this sentence: "${context}".\n`
        + `Its dictionary meanings, numbered:\n${lines.join('\n')}\n\n`
        + `Which single number is the meaning used in this sentence? Reply with a single JSON object and nothing else (no markdown fence): `
        + `{"index": <that number, or 0 if none fits>, "note": "<one short sentence in ${language} on what it means here>"}`;
    const content = await chat(prompt);
    const parsed = orGeneric(() => jsonOf(content));
    const n = Number(parsed.index);
    return {
        index: Number.isInteger(n) && n >= 1 && n <= lines.length ? n : null,
        note: typeof parsed.note === 'string' ? parsed.note : '',
    };
};
