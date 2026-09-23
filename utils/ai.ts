import { fetch } from '@tauri-apps/plugin-http';
import { t } from './i18n';
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

export const getWordDefinition = async (word: string, context: string): Promise<WordDefinition> => {
    try {
        const endpoint = getEndpoint();
        const config = getAIConfig();
        if (!endpoint || !config.model?.trim()) throw new Error('API Key missing');

        const prompt = (config.promptTemplate || DEFAULT_PROMPT)
            .replace('{word}', word)
            .replace('{context}', context);

        const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                temperature: config.temperature,
                messages: [{ role: 'user', content: prompt + JSON_RULE }],
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
        return readJson(content);
    } catch (error) {
        console.error("AI Definition Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('API Key')) throw new Error(t('ai.noKeyError'));
        throw new Error(`${t('ai.genericError')}\n${message}`);
    }
};
