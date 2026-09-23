import { useEffect, useRef, useState } from 'react';
import { Subtitle } from '../types';
import { BreakdownStep, askBreakdown, buildSteps, spaceWords } from '../utils/aiDrills';
import { Clip, loadClip, playClip, releaseClip, stopClip } from '../utils/speech';
import { getLang } from '../utils/i18n';

// "Break it down" for the current line: the AI picks 1–3 points, each practised
// on a clean read-aloud clip, then the whole line on the video's own audio.
// It never touches progress: the line index only moves when the user finishes
// the last step and Studio calls onContinue.

const MIN_WORDS = 5;

export type BreakdownState =
  | { status: 'idle' }
  | { status: 'loading'; lineId: number }
  | { status: 'failed'; lineId: number }
  | { status: 'active'; lineId: number; steps: BreakdownStep[]; clips: Clip[]; step: number; reviewing: boolean };

export function useBreakdown(currentSub: Subtitle | undefined) {
  const [state, setState] = useState<BreakdownState>({ status: 'idle' });
  const seq = useRef(0);
  const clips = useRef<Clip[]>([]);

  const reset = () => {
    seq.current++;
    stopClip();
    clips.current.forEach(releaseClip);
    clips.current = [];
    setState({ status: 'idle' });
  };

  const lineId = currentSub?.id;
  useEffect(() => { reset(); }, [lineId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => reset, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tooShort = !!currentSub && spaceWords(currentSub.text).length < MIN_WORDS;

  const start = async () => {
    if (!currentSub || tooShort) return;
    const id = currentSub.id;
    const mine = ++seq.current;
    setState({ status: 'loading', lineId: id });
    const result = await askBreakdown(spaceWords(currentSub.text), getLang());
    if (mine !== seq.current) return;
    if (!result) { setState({ status: 'failed', lineId: id }); return; }
    const steps = buildSteps(currentSub.text, result.points);
    const loaded = await Promise.all(steps.slice(0, -1).map(s => loadClip(s.text, result.lang)));
    if (mine !== seq.current) { loaded.forEach(releaseClip); return; }
    clips.current = loaded;
    setState({ status: 'active', lineId: id, steps, clips: loaded, step: 0, reviewing: false });
  };

  // Plays the current step's clip; false on the last step (the whole line),
  // which the caller plays from the video instead.
  const play = (): boolean => {
    if (state.status !== 'active') return false;
    const clip = state.clips[state.step];
    if (!clip) return false;
    playClip(clip);
    return true;
  };

  const review = () => setState(s => (s.status === 'active' ? { ...s, reviewing: true } : s));
  // Returns false once the last step (the whole line) is done.
  const next = (): boolean => {
    if (state.status !== 'active' || state.step >= state.steps.length - 1) return false;
    stopClip();
    setState({ ...state, step: state.step + 1, reviewing: false });
    return true;
  };

  return { state, tooShort, start, cancel: reset, play, review, next };
}
