import React from 'react';
import * as AI from '../utils/ai';
import { Btn, Field, inputCls } from './ui';

interface SettingsAIProps {
  aiModel: string;
  setAiModel: (value: string) => void;
  aiTemperature: number;
  setAiTemperature: (value: number) => void;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiApiKey: string;
  setAiApiKey: (value: string) => void;
}

const SettingsAI: React.FC<SettingsAIProps> = ({
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  aiPrompt,
  setAiPrompt,
  aiApiKey,
  setAiApiKey,
}) => {
  return (
    <div className="space-y-6">
      <Field
        label="API Key"
        hint={
          <>
            Get a key from{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-green">
              Google AI Studio
            </a>
            . Stored locally in this browser.
          </>
        }
      >
        <input
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          className={`${inputCls} font-mono`}
          placeholder="Enter your Gemini API Key..."
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Model" hint="Choose the model balancing speed vs quality of definitions.">
          <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputCls}>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-flash-lite-latest">Gemini Flash Lite (Fastest)</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro (Best Quality)</option>
          </select>
        </Field>

        <Field
          label="Temperature"
          right={String(aiTemperature)}
          hint="Lower values are more deterministic; higher values are more creative."
        >
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={aiTemperature}
            onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
          />
        </Field>
      </div>

      <Field
        label="Prompt template"
        right={
          <Btn type="button" size="sm" flat onClick={() => setAiPrompt(AI.DEFAULT_PROMPT)}>
            Reset
          </Btn>
        }
        hint="Use {word} and {context} as placeholders. The response must still be compatible with the expected JSON schema (word, definition, partOfSpeech)."
      >
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className={`${inputCls} min-h-32 font-mono`}
          placeholder="Enter prompt..."
        />
      </Field>
    </div>
  );
};

export default SettingsAI;
