import React, { useState } from 'react';
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
  aiAutoBreakdown: boolean;
  setAiAutoBreakdown: (value: boolean) => void;
  aiAutoCloze: boolean;
  setAiAutoCloze: (value: boolean) => void;
}

const Check: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <label className={`flex items-center gap-2.5 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
    <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-accent" />
    {label}
  </label>
);


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
  aiAutoBreakdown,
  setAiAutoBreakdown,
  aiAutoCloze,
  setAiAutoCloze,
}) => {
  const t = useT();
  const [models, setModels] = useState<string[]>(() => AI.getCachedModels());
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const badKey = AI.isBadKey(aiApiKey);
  const aiReady = !!(aiApiKey && !badKey && aiBaseUrl.trim() && (aiModel.trim() || aiSegmentModel.trim()));

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
        hint={badKey ? <span className="text-ink">{t('settingsAI.apiKeyBad')}</span> : t('settingsAI.apiKeyHint')}
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
          placeholder="https://api.openai.com/v1"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field
          label={t('settingsAI.model')}
          right={
            <Btn type="button" size="sm" flat disabled={!aiApiKey || badKey || !aiBaseUrl.trim() || fetching} onClick={() => void fetchModels()}>
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
            placeholder="model-id"
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

      <div>
        <span className="block text-sm font-medium mb-2.5">{t('settingsAI.afterImport')}</span>
        <div className="space-y-2">
          <Check checked={aiAutoBreakdown} onChange={setAiAutoBreakdown} disabled={!aiReady} label={t('settingsAI.autoBreakdown')} />
          <Check checked={aiAutoCloze} onChange={setAiAutoCloze} disabled={!aiReady} label={t('settingsAI.autoCloze')} />
        </div>
        <span className="block mt-1.5 text-xs text-mute leading-relaxed">{aiReady ? t('settingsAI.afterImportHint') : t('settingsAI.afterImportNeedAi')}</span>
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
