import { useState, useCallback } from 'react';
import * as Anki from '../utils/anki';

export type AnkiConnectionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAnkiConnectionReturn {
  // Connection state
  url: string;
  setUrl: (url: string) => void;
  status: AnkiConnectionStatus;
  
  // Data from Anki
  decks: string[];
  models: string[];
  
  // Actions
  connect: () => void;
  fetchModelFields: (modelName: string) => Promise<string[]>;
}

export const useAnkiConnection = (initialUrl: string = 'http://127.0.0.1:8765'): UseAnkiConnectionReturn => {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<AnkiConnectionStatus>('idle');
  const [decks, setDecks] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  const fetchAnkiData = useCallback(async (targetUrl: string) => {
    setStatus('loading');
    try {
      const [d, m] = await Promise.all([
        Anki.getDeckNames(targetUrl),
        Anki.getModelNames(targetUrl)
      ]);
      setDecks(d);
      setModels(m);
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  }, []);

  const connect = useCallback(() => {
    fetchAnkiData(url);
  }, [url, fetchAnkiData]);

  const fetchModelFields = useCallback(async (modelName: string): Promise<string[]> => {
    try {
      return await Anki.getModelFieldNames(modelName, url);
    } catch (err) {
      console.error("Failed to fetch fields", err);
      return [];
    }
  }, [url]);

  return {
    url,
    setUrl,
    status,
    decks,
    models,
    connect,
    fetchModelFields,
  };
};

