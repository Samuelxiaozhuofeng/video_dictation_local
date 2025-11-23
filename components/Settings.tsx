import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Settings as SettingsIcon, CheckCircle } from 'lucide-react';
import { AnkiConfig, AIConfig, PracticeConfig, AudioPaddingConfig } from '../types';
import * as Anki from '../utils/anki';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';
import { useAnkiConnection } from '../hooks/useAnkiConnection';
import SettingsGeneral from './SettingsGeneral';
import SettingsAI from './SettingsAI';
import SettingsAnki from './SettingsAnki';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'anki'>('general');

  // Anki Configuration State
  const [wordDeckName, setWordDeckName] = useState('');
  const [wordModelName, setWordModelName] = useState('');
  const [wordFieldMapping, setWordFieldMapping] = useState<Record<string, string>>({});
  const [audioDeckName, setAudioDeckName] = useState('');
  const [audioModelName, setAudioModelName] = useState('');
  const [audioFieldMapping, setAudioFieldMapping] = useState<Record<string, string>>({});

  // AI Configuration State
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiTemperature, setAiTemperature] = useState(0.7);
  const [aiPrompt, setAiPrompt] = useState(AI.DEFAULT_PROMPT);
  const [aiApiKey, setAiApiKey] = useState('');

  // Practice Configuration State
  const [sectionLength, setSectionLength] = useState(0);

  // Audio Padding Configuration State
  const [audioPadding, setAudioPadding] = useState<AudioPaddingConfig>({ startPadding: 100, endPadding: 200 });

  // UI State
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Use Anki Connection Hook
  const ankiConnection = useAnkiConnection();

  // Load existing config on mount
  useEffect(() => {
    // Load Anki Config
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
      // If we have a saved URL, try to fetch lists immediately
      ankiConnection.connect();
    }

    // Load AI Config
    const savedAI = AI.getAIConfig();
    setAiModel(savedAI.model);
    setAiTemperature(savedAI.temperature);
    setAiPrompt(savedAI.promptTemplate || AI.DEFAULT_PROMPT);
    setAiApiKey(savedAI.apiKey || '');

    // Load Practice Config
    const savedPractice = Storage.getPracticeConfig();
    setSectionLength(savedPractice.sectionLength);

    // Load Audio Padding Config
    const savedAudioPadding = Storage.getAudioPaddingConfig();
    setAudioPadding(savedAudioPadding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleSave = () => {
    // Save Anki
    const config: AnkiConfig = {
      url: ankiConnection.url,
      wordCard: wordDeckName && wordModelName
        ? {
            deckName: wordDeckName,
            modelName: wordModelName,
            fieldMapping: wordFieldMapping,
          }
        : null,
      audioCard: audioDeckName && audioModelName
        ? {
            deckName: audioDeckName,
            modelName: audioModelName,
            fieldMapping: audioFieldMapping,
          }
        : null,
    };
    Anki.saveAnkiConfig(config);

    // Save AI
    const aiConfig: AIConfig = {
        model: aiModel,
        temperature: aiTemperature,
        promptTemplate: aiPrompt,
        apiKey: aiApiKey
    };
    AI.saveAIConfig(aiConfig);

    // Save Practice
    const practiceConfig: PracticeConfig = {
        sectionLength
    };
    Storage.savePracticeConfig(practiceConfig);

    // Save Audio Padding
    Storage.saveAudioPaddingConfig(audioPadding);

    // Show a lightweight success message (without leaving Settings)
    setSaveNotice('Settings saved successfully.');
    setTimeout(() => setSaveNotice(null), 2500);
  };

  return (
    <div className="h-full bg-neutral-950 text-neutral-200 flex flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 bg-gradient-to-b from-neutral-950 to-neutral-900 border-b border-neutral-800/50 px-6 py-5 flex items-center justify-between shadow-soft shrink-0 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-xl transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>
        <button
             onClick={handleSave}
             className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-soft transition-all transform active:scale-95 flex items-center gap-2"
           >
             <Save className="w-5 h-5" />
             Save
        </button>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto p-6 pb-20">
        {saveNotice && (
          <div className="mb-6 px-5 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-sm text-emerald-300 flex items-center justify-between shadow-soft">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-medium">{saveNotice}</span>
            </div>
            <button
              onClick={() => setSaveNotice(null)}
              className="text-emerald-300 hover:text-emerald-100 text-xs font-semibold px-3 py-1 hover:bg-emerald-500/10 rounded-lg transition-all"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mb-6 flex gap-2 p-1.5 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 w-fit">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'general'
                ? 'bg-brand-500 text-white shadow-soft'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'ai'
                ? 'bg-brand-500 text-white shadow-soft'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            AI
          </button>
          <button
            onClick={() => setActiveTab('anki')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'anki'
                ? 'bg-brand-500 text-white shadow-soft'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            Anki
          </button>
        </div>

        {activeTab === 'general' && (
          <SettingsGeneral
            sectionLength={sectionLength}
            setSectionLength={setSectionLength}
            audioPadding={audioPadding}
            setAudioPadding={setAudioPadding}
          />
        )}

        {activeTab === 'ai' && (
          <SettingsAI
            aiModel={aiModel}
            setAiModel={setAiModel}
            aiTemperature={aiTemperature}
            setAiTemperature={setAiTemperature}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiApiKey={aiApiKey}
            setAiApiKey={setAiApiKey}
          />
        )}

        {activeTab === 'anki' && (
          <SettingsAnki
            url={ankiConnection.url}
            setUrl={ankiConnection.setUrl}
            status={ankiConnection.status}
            statusMsg={ankiConnection.statusMsg}
            onConnect={ankiConnection.connect}
            decks={ankiConnection.decks}
            models={ankiConnection.models}
            wordDeckName={wordDeckName}
            setWordDeckName={setWordDeckName}
            wordModelName={wordModelName}
            setWordModelName={setWordModelName}
            wordFieldMapping={wordFieldMapping}
            setWordFieldMapping={setWordFieldMapping}
            audioDeckName={audioDeckName}
            setAudioDeckName={setAudioDeckName}
            audioModelName={audioModelName}
            setAudioModelName={setAudioModelName}
            audioFieldMapping={audioFieldMapping}
            setAudioFieldMapping={setAudioFieldMapping}
            fetchModelFields={ankiConnection.fetchModelFields}
          />
        )}

        <div className="flex justify-end pb-10">
             <button 
                 onClick={handleSave}
                 className="px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-900/20 transition-all transform active:scale-95 flex items-center gap-2"
               >
                 <Save className="w-5 h-5" />
                 Save Configuration
            </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
