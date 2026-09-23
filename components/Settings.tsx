import React, { useEffect, useRef, useState } from 'react';
import { AnkiConfig, AIConfig, AudioPaddingConfig } from '../types';
import * as Anki from '../utils/anki';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';
import { useAnkiConnection } from '../hooks/useAnkiConnection';
import { Seg, Stamp } from './ui';
import SettingsGeneral from './SettingsGeneral';
import SettingsAI from './SettingsAI';
import SettingsAnki from './SettingsAnki';
import SettingsShortcuts from './SettingsShortcuts';
import { useT, useLang, setLang, Lang } from '../utils/i18n';

type AnkiPatch = {
  url?: string;
  wordDeckName?: string;
  wordModelName?: string;
  wordFieldMapping?: Record<string, string>;
  audioDeckName?: string;
  audioModelName?: string;
  audioFieldMapping?: Record<string, string>;
};

const Settings: React.FC = () => {
  const t = useT();
  const lang = useLang();
  const [wordDeckName, setWordDeckName] = useState('');
  const [wordModelName, setWordModelName] = useState('');
  const [wordFieldMapping, setWordFieldMapping] = useState<Record<string, string>>({});
  const [audioDeckName, setAudioDeckName] = useState('');
  const [audioModelName, setAudioModelName] = useState('');
  const [audioFieldMapping, setAudioFieldMapping] = useState<Record<string, string>>({});

  const [aiModel, setAiModel] = useState('');
  const [aiTemperature, setAiTemperature] = useState(0.7);
  const [aiPrompt, setAiPrompt] = useState(AI.DEFAULT_PROMPT);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiSegmentModel, setAiSegmentModel] = useState('');
  const [aiAutoBreakdown, setAiAutoBreakdown] = useState(false);
  const [aiAutoCloze, setAiAutoCloze] = useState(false);

  const [sectionLength, setSectionLength] = useState(Storage.DEFAULT_SECTION_LENGTH);
  const [audioPadding, setAudioPadding] = useState<AudioPaddingConfig>({ startPadding: 100, endPadding: 200 });

  const [tab, setTab] = useState<'practice' | 'ai' | 'shortcuts' | 'anki'>('practice');
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number>(0);
  const ankiConnection = useAnkiConnection();

  const flashSaved = () => {
    setSavedFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1500);
  };

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  useEffect(() => {
    const savedAnki = Anki.getAnkiConfig();
    if (savedAnki) {
      ankiConnection.setUrl(savedAnki.url);
      if (savedAnki.wordCard) {
        setWordDeckName(savedAnki.wordCard.deckName);
        setWordModelName(savedAnki.wordCard.modelName);
        setWordFieldMapping(savedAnki.wordCard.fieldMapping || {});
      }
      if (savedAnki.audioCard) {
        setAudioDeckName(savedAnki.audioCard.deckName);
        setAudioModelName(savedAnki.audioCard.modelName);
        setAudioFieldMapping(savedAnki.audioCard.fieldMapping || {});
      }
      ankiConnection.connect();
    }

    const savedAI = AI.getAIConfig();
    setAiModel(savedAI.model);
    setAiTemperature(savedAI.temperature);
    setAiPrompt(savedAI.promptTemplate || AI.DEFAULT_PROMPT);
    setAiApiKey(savedAI.apiKey || '');
    setAiBaseUrl(savedAI.baseUrl || '');
    setAiSegmentModel(savedAI.segmentModel || '');
    setAiAutoBreakdown(!!savedAI.autoBreakdown);
    setAiAutoCloze(!!savedAI.autoCloze);

    const savedPractice = Storage.getPracticeConfig();
    setSectionLength(savedPractice.sectionLength);

    const savedAudioPadding = Storage.getAudioPaddingConfig();
    setAudioPadding(savedAudioPadding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildAnkiConfig = (patch: AnkiPatch = {}): AnkiConfig => {
    const url = patch.url ?? ankiConnection.url;
    const wd = patch.wordDeckName ?? wordDeckName;
    const wm = patch.wordModelName ?? wordModelName;
    const wmap = patch.wordFieldMapping ?? wordFieldMapping;
    const ad = patch.audioDeckName ?? audioDeckName;
    const am = patch.audioModelName ?? audioModelName;
    const amap = patch.audioFieldMapping ?? audioFieldMapping;
    return {
      url,
      wordCard: wd && wm ? { deckName: wd, modelName: wm, fieldMapping: wmap } : null,
      audioCard: ad && am ? { deckName: ad, modelName: am, fieldMapping: amap } : null,
    };
  };

  const saveAnki = (patch: AnkiPatch = {}) => {
    Anki.saveAnkiConfig(buildAnkiConfig(patch));
    flashSaved();
  };

  const saveAI = (next: Partial<AIConfig> & { prompt?: string } = {}) => {
    AI.saveAIConfig({
      model: next.model ?? aiModel,
      temperature: next.temperature ?? aiTemperature,
      promptTemplate: next.promptTemplate ?? next.prompt ?? aiPrompt,
      apiKey: next.apiKey ?? aiApiKey,
      baseUrl: next.baseUrl ?? aiBaseUrl,
      segmentModel: next.segmentModel ?? aiSegmentModel,
      autoBreakdown: next.autoBreakdown ?? aiAutoBreakdown,
      autoCloze: next.autoCloze ?? aiAutoCloze,
    });
    flashSaved();
  };

  return (
    <div>
      <Seg<typeof tab> className="mb-8" value={tab} onChange={setTab} options={[
        { value: 'practice', label: t('settings.practice') },
        { value: 'ai', label: 'AI' },
        { value: 'shortcuts', label: t('shortcuts.title') },
        { value: 'anki', label: 'Anki' },
      ]} />

      {tab === 'practice' && (
        <SettingsGeneral
          lang={lang}
          setLang={(v: Lang) => {
            setLang(v);
            flashSaved();
          }}
          sectionLength={sectionLength}
          setSectionLength={(v) => {
            setSectionLength(v);
            Storage.savePracticeConfig({ ...Storage.getPracticeConfig(), sectionLength: v });
            flashSaved();
          }}
          audioPadding={audioPadding}
          setAudioPadding={(v) => {
            setAudioPadding(v);
            Storage.saveAudioPaddingConfig(v);
            flashSaved();
          }}
          onSaved={flashSaved}
        />
      )}

      {tab === 'shortcuts' && <SettingsShortcuts onSaved={flashSaved} />}

      {tab === 'ai' && (
        <SettingsAI
          aiModel={aiModel}
          setAiModel={(v) => {
            setAiModel(v);
            saveAI({ model: v });
          }}
          aiTemperature={aiTemperature}
          setAiTemperature={(v) => {
            setAiTemperature(v);
            saveAI({ temperature: v });
          }}
          aiPrompt={aiPrompt}
          setAiPrompt={(v) => {
            setAiPrompt(v);
            saveAI({ promptTemplate: v });
          }}
          aiApiKey={aiApiKey}
          setAiApiKey={(v) => {
            setAiApiKey(v);
            saveAI({ apiKey: v });
          }}
          aiBaseUrl={aiBaseUrl}
          setAiBaseUrl={(v) => {
            setAiBaseUrl(v);
            saveAI({ baseUrl: v });
          }}
          aiSegmentModel={aiSegmentModel}
          setAiSegmentModel={(v) => {
            setAiSegmentModel(v);
            saveAI({ segmentModel: v });
          }}
          aiAutoBreakdown={aiAutoBreakdown}
          setAiAutoBreakdown={(v) => {
            setAiAutoBreakdown(v);
            saveAI({ autoBreakdown: v });
          }}
          aiAutoCloze={aiAutoCloze}
          setAiAutoCloze={(v) => {
            setAiAutoCloze(v);
            saveAI({ autoCloze: v });
          }}
        />
      )}

      {tab === 'anki' && (
        <SettingsAnki
          url={ankiConnection.url}
          setUrl={(v) => {
            ankiConnection.setUrl(v);
            saveAnki({ url: v });
          }}
          status={ankiConnection.status}
          error={ankiConnection.error}
          onConnect={ankiConnection.connect}
          decks={ankiConnection.decks}
          models={ankiConnection.models}
          wordDeckName={wordDeckName}
          setWordDeckName={(v) => {
            setWordDeckName(v);
            saveAnki({ wordDeckName: v });
          }}
          wordModelName={wordModelName}
          setWordModelName={(v) => {
            setWordModelName(v);
            saveAnki({ wordModelName: v });
          }}
          wordFieldMapping={wordFieldMapping}
          setWordFieldMapping={setWordFieldMapping}
          audioDeckName={audioDeckName}
          setAudioDeckName={(v) => {
            setAudioDeckName(v);
            saveAnki({ audioDeckName: v });
          }}
          audioModelName={audioModelName}
          setAudioModelName={(v) => {
            setAudioModelName(v);
            saveAnki({ audioModelName: v });
          }}
          audioFieldMapping={audioFieldMapping}
          setAudioFieldMapping={setAudioFieldMapping}
          fetchModelFields={ankiConnection.fetchModelFields}
          saveAnki={saveAnki}
        />
      )}

      {savedFlash && (
        <div className="fixed bottom-6 right-6 z-50">
          <Stamp tone="accent-soft" className="shadow-card">{t('settings.savedFlash')}</Stamp>
        </div>
      )}
    </div>
  );
};

export default Settings;
