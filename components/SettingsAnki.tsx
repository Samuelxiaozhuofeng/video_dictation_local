import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Link, CheckCircle, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { APP_DATA_FIELDS } from '../types';
import { AnkiConnectionStatus } from '../hooks/useAnkiConnection';

interface SettingsAnkiProps {
  // Connection props
  url: string;
  setUrl: (value: string) => void;
  status: AnkiConnectionStatus;
  statusMsg: string;
  onConnect: () => void;
  
  // Data from Anki
  decks: string[];
  models: string[];
  
  // Word Card props
  wordDeckName: string;
  setWordDeckName: (value: string) => void;
  wordModelName: string;
  setWordModelName: (value: string) => void;
  wordFieldMapping: Record<string, string>;
  setWordFieldMapping: (value: Record<string, string>) => void;
  
  // Audio Card props
  audioDeckName: string;
  setAudioDeckName: (value: string) => void;
  audioModelName: string;
  setAudioModelName: (value: string) => void;
  audioFieldMapping: Record<string, string>;
  setAudioFieldMapping: (value: Record<string, string>) => void;
  
  // Field fetching
  fetchModelFields: (modelName: string) => Promise<string[]>;
}

const SettingsAnki: React.FC<SettingsAnkiProps> = ({
  url,
  setUrl,
  status,
  statusMsg,
  onConnect,
  decks,
  models,
  wordDeckName,
  setWordDeckName,
  wordModelName,
  setWordModelName,
  wordFieldMapping,
  setWordFieldMapping,
  audioDeckName,
  setAudioDeckName,
  audioModelName,
  setAudioModelName,
  audioFieldMapping,
  setAudioFieldMapping,
  fetchModelFields,
}) => {
  const [wordModelFields, setWordModelFields] = useState<string[]>([]);
  const [audioModelFields, setAudioModelFields] = useState<string[]>([]);

  // Fetch word model fields when model changes
  useEffect(() => {
    if (wordModelName && status === 'success') {
      fetchModelFields(wordModelName).then(fields => {
        setWordModelFields(fields);
        // Preserve existing mapping where possible
        setWordFieldMapping(prev => {
          const newMapping: Record<string, string> = {};
          fields.forEach(f => {
            if (prev[f]) newMapping[f] = prev[f];
          });
          return newMapping;
        });
      });
    }
  }, [wordModelName, status, fetchModelFields]);

  // Fetch audio model fields when model changes
  useEffect(() => {
    if (audioModelName && status === 'success') {
      fetchModelFields(audioModelName).then(fields => {
        setAudioModelFields(fields);
        // Preserve existing mapping where possible
        setAudioFieldMapping(prev => {
          const newMapping: Record<string, string> = {};
          fields.forEach(f => {
            if (prev[f]) newMapping[f] = prev[f];
          });
          return newMapping;
        });
      });
    }
  }, [audioModelName, status, fetchModelFields]);

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

  return (
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
            onClick={onConnect}
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
  );
};

export default SettingsAnki;

