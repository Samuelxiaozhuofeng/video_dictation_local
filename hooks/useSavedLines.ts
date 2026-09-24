import { useState, useCallback, useMemo, useEffect } from 'react';
import { Subtitle } from '../types';
import { addLine, savedStarts, unsaveLine } from '../utils/review';

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
}

// Bookmarks live in the review library, keyed by this video + the line's start
// time, so the same words in two videos are two separate bookmarks.
export function useSavedLines(params: UseSavedLinesParams): UseSavedLinesReturn {
  const { videoId, fullSubtitles, videoFileName } = params;

  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [showSavedList, setShowSavedList] = useState(false);

  useEffect(() => {
    setSavedIds(new Set());
    if (!videoId) return;
    let cancelled = false;
    savedStarts(videoId).then(starts => {
      if (!cancelled) setSavedIds(new Set(fullSubtitles.filter(s => starts.has(s.startTime.toFixed(2))).map(s => s.id)));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [videoId, fullSubtitles]);

  const savedItems = useMemo(() => fullSubtitles.filter(s => savedIds.has(s.id)), [fullSubtitles, savedIds]);

  const isCurrentSaved = useCallback((subtitle: Subtitle | null) => (subtitle ? savedIds.has(subtitle.id) : false), [savedIds]);

  const unsave = useCallback((sub: Subtitle) => {
    if (!videoId) return;
    setSavedIds(prev => { const next = new Set(prev); next.delete(sub.id); return next; });
    unsaveLine(videoId, sub.startTime).catch(console.error);
  }, [videoId]);

  const toggleSave = useCallback((sub: Subtitle) => {
    if (!videoId) return;
    if (savedIds.has(sub.id)) return unsave(sub);
    setSavedIds(prev => new Set(prev).add(sub.id));
    addLine({ videoId, videoName: videoFileName || '', text: sub.text, start: sub.startTime, end: sub.endTime }, 'saved').catch(console.error);
  }, [savedIds, videoId, videoFileName, unsave]);

  const deleteSavedItem = useCallback((id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const sub = fullSubtitles.find(s => s.id === id);
    if (sub) unsave(sub);
  }, [fullSubtitles, unsave]);

  return { savedIds, showSavedList, savedItems, setShowSavedList, toggleSave, deleteSavedItem, isCurrentSaved };
}
