import React, { useEffect, useState } from 'react';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { isBadKey } from '../utils/aiConfig';
import { openExternal, revealInFolder, transcribeLocation } from '../utils/desktop';
import {
  CLOUD,
  LocalModel,
  TranscribeConfig,
  TranscribeMode,
  getTranscribeConfig,
  saveTranscribeConfig,
} from '../utils/transcribeConfig';
import { useT } from '../utils/i18n';
import { Btn, Field, Seg, inputCls } from './ui';

// Settings → Transcription: this machine (standard / light model, where its
// parts live) or a cloud service (link to get a key, the key itself).
const SettingsTranscribe: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const t = useT();
  const [config, setConfig] = useState<TranscribeConfig>(getTranscribeConfig);
  const [location, setLocation] = useState<{ dir: string; model: string | null } | null>(null);
  const cloud = config.mode === 'local' ? null : CLOUD[config.mode];
  const key = cloud ? config[cloud.keyField] : '';
  const badKey = !!key && isBadKey(key.trim());

  const update = (patch: Partial<TranscribeConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveTranscribeConfig(next);
    onSaved();
  };

  useEffect(() => {
    if (config.mode !== 'local') return;
    let cancelled = false;
    transcribeLocation(config.localModel)
      .then(loc => { if (!cancelled) setLocation(loc); })
      .catch(err => console.error(err));
    return () => { cancelled = true; };
  }, [config.mode, config.localModel]);

  return (
    <div className="space-y-6">
      <Field label={t('transcribe.mode')} hint={t(config.mode === 'cloud' ? 'transcribe.cloudHint' : config.mode === 'bailian' ? 'transcribe.bailianHint' : 'transcribe.localHint')}>
        <Seg<TranscribeMode>
          value={config.mode}
          onChange={mode => update({ mode })}
          options={[
            { value: 'local', label: t('transcribe.local') },
            { value: 'cloud', label: t('transcribe.cloud') },
            { value: 'bailian', label: t('transcribe.bailian') },
          ]}
        />
      </Field>

      {config.mode === 'local' && (
        <>
          <Field label={t('transcribe.model')} hint={t('transcribe.modelHint')}>
            <Seg<LocalModel>
              value={config.localModel}
              onChange={localModel => update({ localModel })}
              options={[
                { value: 'standard', label: t('transcribe.standard') },
                { value: 'light', label: t('transcribe.light') },
              ]}
            />
          </Field>

          {location && (
            <Field
              label={t('transcribe.location')}
              right={location.model && (
                <Btn type="button" size="sm" flat onClick={() => revealInFolder(location.model!).catch(err => console.error(err))}>
                  <FolderOpen size={14} /> {t('transcribe.reveal')}
                </Btn>
              )}
              hint={location.model ? undefined : t('transcribe.notDownloaded')}
            >
              <p className="text-xs font-mono text-mute break-all">{location.model ?? location.dir}</p>
            </Field>
          )}
        </>
      )}

      {cloud && (
        <Field
          key={config.mode}
          label={t('transcribe.cloudKey', { name: t(cloud.name) })}
          right={
            <Btn type="button" size="sm" flat onClick={() => openExternal(cloud.keysUrl).catch(err => console.error(err))}>
              <ExternalLink size={14} /> {t(config.mode === 'cloud' ? 'transcribe.getKey' : 'transcribe.getBailianKey')}
            </Btn>
          }
          hint={badKey ? <span className="text-ink">{t('settingsAI.apiKeyBad')}</span> : t(config.mode === 'cloud' ? 'transcribe.groqKeyHint' : 'transcribe.bailianKeyHint')}
        >
          <input
            type="password"
            value={key}
            onChange={e => update({ [cloud.keyField]: e.target.value })}
            className={`${inputCls} font-mono`}
            placeholder={cloud.placeholder}
          />
        </Field>
      )}
    </div>
  );
};

export default SettingsTranscribe;
