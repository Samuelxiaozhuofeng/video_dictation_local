import React, { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
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
  aiBaseUrl: string;
  setAiBaseUrl: (value: string) => void;
  aiSegmentModel: string;
  setAiSegmentModel: (value: string) => void;
}


// A plain <select> rather than an <input list> datalist: the app's WKWebView
// does not pop a datalist open, so the fetched models were invisible. Typing
// still works for ids the provider does not list.
const ModelPicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  models: string[];
  placeholder: string;
  pickLabel: string;
}> = ({ value, onChange, models, placeholder, pickLabel }) => (
  <div className="flex gap-2">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} font-mono`}
      placeholder={placeholder}
    />
    {models.length > 0 && (
      <select
        value={models.includes(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} w-32 shrink-0`}
      >
        <option value="">{pickLabel}</option>
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    )}
  </div>
);

const SettingsAI: React.FC<SettingsAIProps> = ({
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  aiPrompt,
  setAiPrompt,
  aiApiKey,
  setAiApiKey,
  aiBaseUrl,
  setAiBaseUrl,
  aiSegmentModel,
  setAiSegmentModel,
}) => {
  const t = useT();
  const [models, setModels] = useState<string[]>(() => AI.getCachedModels());
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const fetchModels = async () => {
    setFetching(true);
    setFetchError('');
    try {
      setModels(await AI.listModels(aiBaseUrl, aiApiKey));
    } catch (e) {
      setModels([]);
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Field
        label={t('settingsAI.apiKey')}
        hint={
          <>
            {t('settingsAI.apiKeyHintPre')}{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent"
              onClick={(e) => {
                e.preventDefault();
                void openUrl('https://aistudio.google.com/app/apikey');
              }}
            >
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

      <Field label={t('settingsAI.baseUrl')} hint={t('settingsAI.baseUrlHint')}>
        <input
          type="text"
          value={aiBaseUrl}
          onChange={(e) => setAiBaseUrl(e.target.value)}
          className={`${inputCls} font-mono`}
          placeholder={AI.DEFAULT_BASE_URL}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field
          label={t('settingsAI.model')}
          right={
            <Btn type="button" size="sm" flat disabled={!aiApiKey || fetching} onClick={() => void fetchModels()}>
              {fetching ? t('settingsAI.fetching') : t('settingsAI.fetchModels')}
            </Btn>
          }
          hint={
            fetchError
              ? `${t('settingsAI.fetchFailed')} ${fetchError}`
              : models.length > 0
                ? t('settingsAI.fetchedCount').replace('{n}', String(models.length))
                : t('settingsAI.modelHint')
          }
        >
          <ModelPicker
            value={aiModel}
            onChange={setAiModel}
            models={models}
            placeholder="gemini-2.5-flash"
            pickLabel={t('settingsAI.pickModel')}
          />
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

      <Field label={t('settingsAI.segmentModel')} hint={t('settingsAI.segmentModelHint')}>
        <ModelPicker
          value={aiSegmentModel}
          onChange={setAiSegmentModel}
          models={models}
          placeholder={t('settingsAI.segmentModelPlaceholder')}
          pickLabel={t('settingsAI.pickModel')}
        />
      </Field>

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
