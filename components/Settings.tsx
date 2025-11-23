import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, RefreshCw, Link, CheckCircle, AlertCircle, Settings as SettingsIcon, Sparkles, MessageSquare, Scissors, Volume2 } from 'lucide-react';
import { AppState, AnkiConfig, AIConfig, APP_DATA_FIELDS, PracticeConfig, AudioPaddingConfig } from '../types';
import * as Anki from '../utils/anki';
import * as AI from '../utils/ai';
import * as Storage from '../utils/storage';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'anki'>('general');
  // Anki Configuration State
  const [url, setUrl] = useState('http://127.0.0.1:8765');
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

  // Data from Anki
  const [decks, setDecks] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [wordModelFields, setWordModelFields] = useState<string[]>([]);
  const [audioModelFields, setAudioModelFields] = useState<string[]>([]);
  
  // UI State
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Load existing config on mount
  useEffect(() => {
    // Load Anki Config
    const savedAnki = Anki.getAnkiConfig();
    if (savedAnki) {
      setUrl(savedAnki.url);

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
      fetchAnkiData(savedAnki.url);
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
  }, []);

  // When model changes, fetch its fields (Word card)
  useEffect(() => {
    if (wordModelName && status === 'success') {
      Anki.getModelFieldNames(wordModelName, url)
        .then(fields => {
           setWordModelFields(fields);
           // Preserve existing mapping where possible
           setWordFieldMapping(prev => {
             const newMapping: Record<string, string> = {};
             fields.forEach(f => {
               if (prev[f]) newMapping[f] = prev[f];
             });
             return newMapping;
           });
        })
        .catch(err => console.error("Failed to fetch fields", err));
    }
  }, [wordModelName, status, url]);

  // When model changes, fetch its fields (Audio card)
  useEffect(() => {
    if (audioModelName && status === 'success') {
      Anki.getModelFieldNames(audioModelName, url)
        .then(fields => {
           setAudioModelFields(fields);
           // Preserve existing mapping where possible
           setAudioFieldMapping(prev => {
             const newMapping: Record<string, string> = {};
             fields.forEach(f => {
               if (prev[f]) newMapping[f] = prev[f];
             });
             return newMapping;
           });
        })
        .catch(err => console.error("Failed to fetch fields", err));
    }
  }, [audioModelName, status, url]);

  const fetchAnkiData = async (targetUrl: string) => {
    setStatus('loading');
    try {
      const [d, m] = await Promise.all([
        Anki.getDeckNames(targetUrl),
        Anki.getModelNames(targetUrl)
      ]);
      setDecks(d);
      setModels(m);
      setStatus('success');
      setStatusMsg('Connected to Anki!');
    } catch (e) {
      setStatus('error');
      setStatusMsg('Could not connect. Ensure Anki is running with AnkiConnect installed.');
    }
  };

  const handleConnect = () => {
    fetchAnkiData(url);
  };

  const handleSave = () => {
    // Save Anki
    const config: AnkiConfig = {
      url,
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

  const updateWordMapping = (ankiField: string, appDataKey: string) => {
    setWordFieldMapping(prev => ({
      ...prev,
      [ankiField]: appDataKey
    }));
  };

  const updateAudioMapping = (ankiField: string, appDataKey: string) => {
    setAudioFieldMapping(prev => ({
      ...prev,
      [ankiField]: appDataKey
    }));
  };

  const resetPrompt = () => {
      setAiPrompt(AI.DEFAULT_PROMPT);
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
          <div className="space-y-6">
        {/* Practice Configuration Section */}
        <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
             <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
                  <Scissors className="w-5 h-5 text-brand-400" />
                </div>
                Practice Mode
             </h2>

             <div>
                 <label className="block text-sm text-neutral-300 mb-4 font-medium">Section Length (Video Segmentation)</label>
                 <div className="flex flex-wrap gap-3">
                     {[0, 1, 2, 3, 5, 10].map((mins) => (
                         <button
                             key={mins}
                             onClick={() => setSectionLength(mins)}
                             className={`px-5 py-2.5 rounded-xl border font-semibold transition-all ${
                                 sectionLength === mins
                                 ? 'bg-brand-500 border-brand-500/50 text-white shadow-soft'
                                 : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600'
                             }`}
                         >
                             {mins === 0 ? 'Full Video' : `${mins} min${mins > 1 ? 's' : ''}`}
                         </button>
                     ))}
                 </div>
                 <p className="text-xs text-neutral-400 mt-4 bg-neutral-800/30 rounded-xl p-3 leading-relaxed">
                     {sectionLength === 0
                         ? "The entire video will be played as one continuous session."
                         : `The video will be automatically divided into ${sectionLength}-minute sections to reduce practice fatigue.`}
                 </p>
             </div>
        </section>

        {/* Audio Padding Configuration Section */}
        <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
             <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
                  <Volume2 className="w-5 h-5 text-brand-400" />
                </div>
                Audio Recording Padding
             </h2>

             <div className="space-y-6">
                 {/* Start Padding */}
                 <div>
                     <label className="block text-sm text-neutral-300 mb-4 font-medium">
                         Start Padding: <span className="text-brand-400 font-bold">{audioPadding.startPadding}ms</span>
                     </label>
                     <input
                         type="range"
                         min="0"
                         max="1000"
                         step="50"
                         value={audioPadding.startPadding}
                         onChange={(e) => setAudioPadding({ ...audioPadding, startPadding: parseInt(e.target.value) })}
                         className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                     />
                     <div className="flex justify-between text-xs text-neutral-500 mt-2 font-medium">
                         <span>0ms</span>
                         <span>1000ms</span>
                     </div>
                 </div>

                 {/* End Padding */}
                 <div>
                     <label className="block text-sm text-neutral-300 mb-4 font-medium">
                         End Padding: <span className="text-brand-400 font-bold">{audioPadding.endPadding}ms</span>
                     </label>
                     <input
                         type="range"
                         min="0"
                         max="1000"
                         step="50"
                         value={audioPadding.endPadding}
                         onChange={(e) => setAudioPadding({ ...audioPadding, endPadding: parseInt(e.target.value) })}
                         className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                     />
                     <div className="flex justify-between text-xs text-neutral-500 mt-2 font-medium">
                         <span>0ms</span>
                         <span>1000ms</span>
                     </div>
                 </div>

                 <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-xl p-4">
                     <p className="text-xs text-neutral-300 leading-relaxed">
                         <strong className="text-white">What is this?</strong><br/>
                         When adding audio clips to Anki, padding adds extra time before and after the subtitle timing to ensure complete audio capture.
                         This prevents cutting off the beginning or end of words.
                     </p>
                     <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
                         <strong className="text-white">Recommended:</strong> Start 100ms, End 200ms
                     </p>
                 </div>
               </div>
          </section>
          </div>
        )}

        {activeTab === 'ai' && (
          <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
          {/* AI Configuration Section */}
             <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
                  <Sparkles className="w-5 h-5 text-brand-400" />
                </div>
                AI Configuration
             </h2>

             {/* API Key Input */}
             <div className="mb-6 pb-6 border-b border-neutral-800/50">
                <label className="block text-sm text-neutral-300 mb-3 font-medium">
                   Gemini API Key
                   <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                   type="password"
                   value={aiApiKey}
                   onChange={(e) => setAiApiKey(e.target.value)}
                   className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none font-mono text-sm transition-all"
                   placeholder="Enter your Gemini API Key..."
                />
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                   <p className="text-xs text-blue-300 mb-3 font-semibold">
                      How to get your API Key:
                   </p>
                   <ol className="text-xs text-blue-200 space-y-1.5 ml-4 list-decimal leading-relaxed">
                      <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-white font-medium">Google AI Studio</a></li>
                      <li>Sign in with your Google account</li>
                      <li>Click "Create API Key"</li>
                      <li>Copy and paste it here</li>
                   </ol>
                   <p className="text-xs text-blue-300 mt-3 bg-blue-500/10 rounded-lg p-2">
                      🔒 Your API Key is stored locally in your browser and never sent to our servers.
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm text-neutral-300 mb-3 font-medium">Model</label>
                   <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all"
                   >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                      <option value="gemini-flash-lite-latest">Gemini Flash Lite (Fastest)</option>
                      <option value="gemini-3-pro-preview">Gemini 3 Pro (Best Quality)</option>
                   </select>
                   <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-2">
                      Choose the model balancing speed vs quality of definitions.
                   </p>
                </div>
                <div>
                   <label className="block text-sm text-neutral-300 mb-3 flex justify-between font-medium">
                       <span>Creativity (Temperature)</span>
                       <span className="text-brand-400 font-bold">{aiTemperature}</span>
                   </label>
                   <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiTemperature}
                      onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full"
                   />
                   <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-2">
                      Lower values are more deterministic; higher values are more creative.
                   </p>
                </div>
             </div>

             <div className="mt-6 pt-6 border-t border-neutral-800/50">
                 <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm text-neutral-300 flex items-center gap-2 font-medium">
                        <MessageSquare className="w-4 h-4" />
                        System Prompt Template
                    </label>
                    <button onClick={resetPrompt} className="text-xs text-brand-400 hover:text-brand-300 font-semibold px-3 py-1.5 hover:bg-brand-500/10 rounded-lg transition-all">
                        Reset to Default
                    </button>
                 </div>
                 <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full h-32 bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none font-mono text-sm leading-relaxed transition-all"
                    placeholder="Enter prompt..."
                 />
                 <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-3">
                    Use <code className="bg-neutral-700/50 px-1.5 py-0.5 rounded">{'{word}'}</code> and <code className="bg-neutral-700/50 px-1.5 py-0.5 rounded">{'{context}'}</code> as placeholders. The response must still be compatible with the expected JSON schema (word, definition, partOfSpeech).
                 </p>
               </div>
          </section>
        )}

        {activeTab === 'anki' && (
          <>
          {/* Anki Connection Section */}
          <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-3">
            <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
              <Link className="w-5 h-5 text-brand-400" />
            </div>
            AnkiConnect Setup
          </h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm text-neutral-300 mb-2 font-medium">AnkiConnect URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all"
                placeholder="http://127.0.0.1:8765"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={status === 'loading'}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {status === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {status === 'success' ? 'Reconnect' : 'Connect'}
            </button>
          </div>

          {status === 'error' && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {statusMsg}
            </div>
          )}
          {status === 'success' && (
             <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
               <CheckCircle className="w-4 h-4" />
               {statusMsg}
             </div>
          )}
        </section>

        {/* Anki Configuration Section (Only visible if connected) */}
        {status === 'success' && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 shadow-md">
             <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-brand-400" />
                Card Configuration
             </h2>
             
             {/* Word Card Configuration */}
             <div className="mb-8">
               <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Word Card</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                     <label className="block text-sm text-slate-400 mb-2">Target Deck</label>
                     <select 
                        value={wordDeckName}
                        onChange={(e) => setWordDeckName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:border-brand-500 outline-none"
                     >
                        <option value="">Select a Deck...</option>
                        {decks.map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm text-slate-400 mb-2">Note Type</label>
                     <select 
                        value={wordModelName}
                        onChange={(e) => setWordModelName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:border-brand-500 outline-none"
                     >
                        <option value="">Select a Note Type...</option>
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
               </div>

               {wordModelName && wordModelFields.length > 0 && (
                 <div className="border-t border-slate-800 pt-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Field Mapping</h4>
                    <div className="space-y-4">
                      {wordModelFields.map(field => (
                        <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                           <div className="w-full sm:w-1/3 text-sm font-medium text-slate-400 truncate" title={field}>{field}</div>
                           <ArrowLeft className="hidden sm:block w-4 h-4 text-slate-600" />
                           <select 
                             value={wordFieldMapping[field] || ''}
                             onChange={(e) => updateWordMapping(field, e.target.value)}
                             className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-brand-500 outline-none w-full"
                           >
                             <option value="">(Leave Empty)</option>
                             {APP_DATA_FIELDS.map(opt => (
                               <option key={opt.key} value={opt.key}>{opt.label}</option>
                             ))}
                           </select>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
             </div>

             {/* Audio Card Configuration */}
             <div>
               <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Audio Card</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                     <label className="block text-sm text-slate-400 mb-2">Target Deck</label>
                     <select 
                        value={audioDeckName}
                        onChange={(e) => setAudioDeckName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:border-brand-500 outline-none"
                     >
                        <option value="">Select a Deck...</option>
                        {decks.map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm text-slate-400 mb-2">Note Type</label>
                     <select 
                        value={audioModelName}
                        onChange={(e) => setAudioModelName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:border-brand-500 outline-none"
                     >
                        <option value="">Select a Note Type...</option>
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
               </div>

               {audioModelName && audioModelFields.length > 0 && (
                 <div className="border-t border-slate-800 pt-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Field Mapping</h4>
                    <div className="space-y-4">
                      {audioModelFields.map(field => (
                        <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                           <div className="w-full sm:w-1/3 text-sm font-medium text-slate-400 truncate" title={field}>{field}</div>
                           <ArrowLeft className="hidden sm:block w-4 h-4 text-slate-600" />
                           <select 
                             value={audioFieldMapping[field] || ''}
                             onChange={(e) => updateAudioMapping(field, e.target.value)}
                             className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-brand-500 outline-none w-full"
                           >
                             <option value="">(Leave Empty)</option>
                             {APP_DATA_FIELDS.map(opt => (
                               <option key={opt.key} value={opt.key}>{opt.label}</option>
                             ))}
                           </select>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
             </div>
          </section>
        )}
          </>
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
