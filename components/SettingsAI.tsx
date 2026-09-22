import React from 'react';
import * as AI from '../utils/ai';
import { Btn, Field, inputCls } from './ui';
import { useT } from '../utils/i18n';

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
  const t = useT();
  return (
    <div className="space-y-6">
      <Field
        label={t('settingsAI.apiKey')}
        hint={
          <>
            {t('settingsAI.apiKeyHintPre')}{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-green">
              {t('settingsAI.apiKeyHintLink')}
            </a>
            {t('settingsAI.apiKeyHintPost')}
          </>
        }
      >
        <input
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          className={`${inputCls} font-mono`}
          placeholder={t('settingsAI.apiKeyPlaceholder')}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label={t('settingsAI.model')} hint={t('settingsAI.modelHint')}>
          <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputCls}>
            <option value="gemini-2.5-flash">{t('settingsAI.modelFlash')}</option>
            <option value="gemini-flash-lite-latest">{t('settingsAI.modelFlashLite')}</option>
            <option value="gemini-3-pro-preview">{t('settingsAI.modelPro')}</option>
          </select>
        </Field>

        <Field
          label={t('settingsAI.temperature')}
          right={String(aiTemperature)}
          hint={t('settingsAI.temperatureHint')}
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
        label={t('settingsAI.promptTemplate')}
        right={
          <Btn type="button" size="sm" flat onClick={() => setAiPrompt(AI.DEFAULT_PROMPT)}>
            {t('settingsAI.reset')}
          </Btn>
        }
        hint={t('settingsAI.promptHint')}
      >
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className={`${inputCls} min-h-32 font-mono`}
          placeholder={t('settingsAI.promptPlaceholder')}
        />
      </Field>
    </div>
  );
};

export default SettingsAI;
