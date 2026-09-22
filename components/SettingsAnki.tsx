import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_DATA_FIELDS } from '../types';
import { AnkiConnectionStatus } from '../hooks/useAnkiConnection';
import { Btn, Card, Field, inputCls } from './ui';

type Mapping = Record<string, string>;

interface SettingsAnkiProps {
  url: string;
  setUrl: (value: string) => void;
  status: AnkiConnectionStatus;
  statusMsg: string;
  onConnect: () => void;
  decks: string[];
  models: string[];
  wordDeckName: string;
  setWordDeckName: (value: string) => void;
  wordModelName: string;
  setWordModelName: (value: string) => void;
  wordFieldMapping: Mapping;
  setWordFieldMapping: React.Dispatch<React.SetStateAction<Mapping>>;
  audioDeckName: string;
  setAudioDeckName: (value: string) => void;
  audioModelName: string;
  setAudioModelName: (value: string) => void;
  audioFieldMapping: Mapping;
  setAudioFieldMapping: React.Dispatch<React.SetStateAction<Mapping>>;
  fetchModelFields: (modelName: string) => Promise<string[]>;
  saveAnki: (patch?: {
    wordFieldMapping?: Mapping;
    audioFieldMapping?: Mapping;
  }) => void;
}

function pruneMapping(prev: Mapping, fields: string[]): Mapping {
  const next: Mapping = {};
  fields.forEach((f) => {
    if (prev[f]) next[f] = prev[f];
  });
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) return prev;
  return next;
}

const FieldMap: React.FC<{
  fields: string[];
  mapping: Mapping;
  onChange: (ankiField: string, appDataKey: string) => void;
}> = ({ fields, mapping, onChange }) => (
  <div className="space-y-3">
    <p className="text-[13px] font-medium">Field mapping</p>
    {fields.map((field) => (
      <div key={field} className="flex items-center gap-3">
        <span className="w-1/3 font-mono text-sm truncate" title={field}>{field}</span>
        <select
          value={mapping[field] || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`flex-1 ${inputCls}`}
        >
          <option value="">(Leave Empty)</option>
          {APP_DATA_FIELDS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
    ))}
  </div>
);

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
  saveAnki,
}) => {
  const [wordModelFields, setWordModelFields] = useState<string[]>([]);
  const [audioModelFields, setAudioModelFields] = useState<string[]>([]);

  useEffect(() => {
    if (wordModelName && status === 'success') {
      fetchModelFields(wordModelName).then((fields) => {
        setWordModelFields(fields);
        setWordFieldMapping((prev) => pruneMapping(prev, fields));
      });
    }
  }, [wordModelName, status, fetchModelFields, setWordFieldMapping]);

  useEffect(() => {
    if (audioModelName && status === 'success') {
      fetchModelFields(audioModelName).then((fields) => {
        setAudioModelFields(fields);
        setAudioFieldMapping((prev) => pruneMapping(prev, fields));
      });
    }
  }, [audioModelName, status, fetchModelFields, setAudioFieldMapping]);

  const updateWordMapping = (ankiField: string, appDataKey: string) => {
    const next = { ...wordFieldMapping, [ankiField]: appDataKey };
    setWordFieldMapping(next);
    saveAnki({ wordFieldMapping: next });
  };

  const updateAudioMapping = (ankiField: string, appDataKey: string) => {
    const next = { ...audioFieldMapping, [ankiField]: appDataKey };
    setAudioFieldMapping(next);
    saveAnki({ audioFieldMapping: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-end">
        <Field label="AnkiConnect URL" className="flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputCls}
            placeholder="http://127.0.0.1:8765"
          />
        </Field>
        <Btn type="button" tone="green" onClick={onConnect} disabled={status === 'loading'}>
          {status === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {status === 'success' ? 'Reconnect' : 'Connect'}
        </Btn>
      </div>

      {status === 'error' && (
        <Card flat tone="rose-soft" className="px-4 py-3 text-sm">{statusMsg}</Card>
      )}
      {status === 'success' && (
        <Card flat tone="green-soft" className="px-4 py-3 text-sm">{statusMsg}</Card>
      )}

      {status === 'success' && (
        <div className="space-y-8">
          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">Word card</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Target deck">
                <select value={wordDeckName} onChange={(e) => setWordDeckName(e.target.value)} className={inputCls}>
                  <option value="">Select a Deck...</option>
                  {decks.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Note type">
                <select value={wordModelName} onChange={(e) => setWordModelName(e.target.value)} className={inputCls}>
                  <option value="">Select a Note Type...</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            {wordModelName && wordModelFields.length > 0 && (
              <FieldMap fields={wordModelFields} mapping={wordFieldMapping} onChange={updateWordMapping} />
            )}
          </div>

          <div className="border-t border-line pt-6">
            <h3 className="font-serif text-lg font-semibold mb-4">Audio card</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Target deck">
                <select value={audioDeckName} onChange={(e) => setAudioDeckName(e.target.value)} className={inputCls}>
                  <option value="">Select a Deck...</option>
                  {decks.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Note type">
                <select value={audioModelName} onChange={(e) => setAudioModelName(e.target.value)} className={inputCls}>
                  <option value="">Select a Note Type...</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            {audioModelName && audioModelFields.length > 0 && (
              <FieldMap fields={audioModelFields} mapping={audioFieldMapping} onChange={updateAudioMapping} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsAnki;
