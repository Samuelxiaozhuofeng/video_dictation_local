import React from 'react';
import { AudioPaddingConfig } from '../types';
import { Field, Seg } from './ui';
import { useT, Lang } from '../utils/i18n';

interface SettingsGeneralProps {
  lang: Lang;
  setLang: (value: Lang) => void;
  sectionLength: number;
  setSectionLength: (value: number) => void;
  audioPadding: AudioPaddingConfig;
  setAudioPadding: (value: AudioPaddingConfig) => void;
}

// Always shown as "中文" / "English" in their own language, regardless of the current UI language.
const LANG_OPTS: { value: Lang; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

const SettingsGeneral: React.FC<SettingsGeneralProps> = ({
  lang,
  setLang,
  sectionLength,
  setSectionLength,
  audioPadding,
  setAudioPadding,
}) => {
  const t = useT();
  const SECTION_OPTS = [
    { value: 0, label: t('settingsGeneral.optFull') },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 5, label: '5' },
    { value: 10, label: t('settingsGeneral.opt10min') },
  ];
  return (
    <div className="space-y-6">
      <Field label="Language / 语言">
        <Seg options={LANG_OPTS} value={lang} onChange={setLang} />
      </Field>

      <Field
        label={t('settingsGeneral.sectionLength')}
        hint={
          sectionLength === 0
            ? t('settingsGeneral.sectionLengthHintFull')
            : t('settingsGeneral.sectionLengthHint', { n: sectionLength })
        }
      >
        <Seg options={SECTION_OPTS} value={sectionLength} onChange={setSectionLength} className="flex-wrap" />
      </Field>

      <Field
        label={t('settingsGeneral.startPadding')}
        right={`${audioPadding.startPadding}ms`}
        hint={t('settingsGeneral.startPaddingHint')}
      >
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={audioPadding.startPadding}
          onChange={(e) => setAudioPadding({ ...audioPadding, startPadding: parseInt(e.target.value, 10) })}
        />
        <div className="flex justify-between text-xs text-mute font-mono mt-1">
          <span>0ms</span>
          <span>1000ms</span>
        </div>
      </Field>

      <Field
        label={t('settingsGeneral.endPadding')}
        right={`${audioPadding.endPadding}ms`}
        hint={t('settingsGeneral.endPaddingHint')}
      >
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={audioPadding.endPadding}
          onChange={(e) => setAudioPadding({ ...audioPadding, endPadding: parseInt(e.target.value, 10) })}
        />
        <div className="flex justify-between text-xs text-mute font-mono mt-1">
          <span>0ms</span>
          <span>1000ms</span>
        </div>
      </Field>
    </div>
  );
};

export default SettingsGeneral;
