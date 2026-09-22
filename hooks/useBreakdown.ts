import { useEffect, useRef, useState } from 'react';
import { Subtitle } from '../types';
import type { Word } from '../utils/resegment';
import { askBreakdown } from '../utils/aiDrills';
import { readCacheText } from '../utils/desktop';
import { getLang } from '../utils/i18n';
import { BreakdownStep, LineSpan, buildSteps, mapLinesToWords, parseWords } from '../utils/wordTimings';

// "Break it down" for the current line. It lives beside the normal dictation
// flow and never touches progress: the line index only moves when the user
// finishes the last step (the whole line) and Studio calls onContinue.

const MIN_WORDS = 5;

export type BreakdownState =
  | { status: 'idle' }
  | { status: 'loading'; lineId: number }
  | { status: 'failed'; lineId: number }
  | { status: 'active'; lineId: number; steps: BreakdownStep[]; notes: string[]; step: number; reviewing: boolean };

export function useBreakdown(videoId: string | null, fullSubtitles: Subtitle[], currentSub: Subtitle | undefined) {
  const [timings, setTimings] = useState<{ words: Word[]; spans: (LineSpan | null)[] } | null>(null);
  const [state, setState] = useState<BreakdownState>({ status: 'idle' });
  const seq = useRef(0);

  // No words file (older videos, own subtitles, failed write) = no button.
  useEffect(() => {
    setTimings(null);
    if (!videoId || fullSubtitles.length === 0) return;
    let cancelled = false;
    readCacheText(videoId, 'words').then(raw => {
      const words = raw ? parseWords(raw) : null;
      if (!cancelled && words) setTimings({ words, spans: mapLinesToWords(fullSubtitles, words) });
    });
    return () => { cancelled = true; };
  }, [videoId, fullSubtitles]);

  const lineId = currentSub?.id;
  useEffect(() => { seq.current++; setState({ status: 'idle' }); }, [lineId]);

  const lineIndex = currentSub ? fullSubtitles.findIndex(s => s.id === currentSub.id) : -1;
  const span = timings?.spans[lineIndex] ?? null;
  const available = span !== null;
  const tooShort = !!span && span.end - span.start < MIN_WORDS;

  const start = async () => {
    if (!timings || !span || !currentSub || tooShort) return;
    const id = currentSub.id;
    const mine = ++seq.current;
    setState({ status: 'loading', lineId: id });
    const words = timings.words.slice(span.start, span.end).map(w => w.w);
    const result = await askBreakdown(words, getLang());
    if (mine !== seq.current) return;
    if (!result) { setState({ status: 'failed', lineId: id }); return; }
    const steps = buildSteps(timings.words, span, result.starts, currentSub.endTime);
    setState({ status: 'active', lineId: id, steps, notes: result.notes, step: 0, reviewing: false });
  };

  const cancel = () => { seq.current++; setState({ status: 'idle' }); };
  const review = () => setState(s => (s.status === 'active' ? { ...s, reviewing: true } : s));
  // Returns false once the last step (the whole line) is done.
  const next = (): boolean => {
    if (state.status !== 'active' || state.step >= state.steps.length - 1) return false;
    setState({ ...state, step: state.step + 1, reviewing: false });
    return true;
  };

  return { state, available, tooShort, start, cancel, review, next };
}
