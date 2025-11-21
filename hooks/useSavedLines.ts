import { useState, useCallback, useMemo } from 'react';
import { Subtitle } from '../types';
import * as Storage from '../utils/storage';

export interface UseSavedLinesParams {
  videoId: string | null;
  fullSubtitles: Subtitle[];
  videoFileName: string | null;
}

export interface UseSavedLinesReturn {
  // State
  savedIds: Set<number>;
  showSavedList: boolean;
  savedItems: Subtitle[];
  
  // Actions
  setShowSavedList: (show: boolean) => void;
  toggleSave: (subtitle: Subtitle) => void;
  deleteSavedItem: (id: number, e?: React.MouseEvent) => void;
  isCurrentSaved: (subtitle: Subtitle | null) => boolean;
  
  // Initialization
  loadSavedIds: (subtitles: Subtitle[]) => Set<number>;
  setSavedIds: (ids: Set<number>) => void;
}

export function useSavedLines(params: UseSavedLinesParams): UseSavedLinesReturn {
  const { fullSubtitles, videoFileName } = params;

  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [showSavedList, setShowSavedList] = useState(false);

  // Get saved items from fullSubtitles
  const savedItems = useMemo(() => {
    return fullSubtitles.filter(s => savedIds.has(s.id));
  }, [fullSubtitles, savedIds]);

  // Check if a subtitle is saved
  const isCurrentSaved = useCallback((subtitle: Subtitle | null) => {
    return subtitle ? savedIds.has(subtitle.id) : false;
  }, [savedIds]);

  // Load saved IDs from storage based on subtitle text
  const loadSavedIds = useCallback((subtitles: Subtitle[]) => {
    const storedLines = Storage.getSavedLines();
    const previouslySavedIds = new Set<number>();
    
    subtitles.forEach(sub => {
      if (storedLines.some(l => l.text === sub.text)) {
        previouslySavedIds.add(sub.id);
      }
    });
    
    return previouslySavedIds;
  }, []);

  // Toggle save status of a subtitle
  const toggleSave = useCallback((subtitle: Subtitle) => {
    const isSaved = savedIds.has(subtitle.id);
    
    if (isSaved) {
      setSavedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(subtitle.id);
        return newSet;
      });
      Storage.removeLineFromStorage(subtitle.text);
    } else {
      setSavedIds(prev => {
        const newSet = new Set(prev);
        newSet.add(subtitle.id);
        return newSet;
      });
      Storage.saveLineToStorage(subtitle, videoFileName || 'Unknown Video');
    }
  }, [savedIds, videoFileName]);

  // Delete a saved item
  const deleteSavedItem = useCallback((id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const sub = fullSubtitles.find(s => s.id === id);
    if (sub) {
      setSavedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      Storage.removeLineFromStorage(sub.text);
    }
  }, [fullSubtitles]);

  return {
    savedIds,
    showSavedList,
    savedItems,
    setShowSavedList,
    toggleSave,
    deleteSavedItem,
    isCurrentSaved,
    loadSavedIds,
    setSavedIds
  };
}

