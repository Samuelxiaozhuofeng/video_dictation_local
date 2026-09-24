import { useEffect } from 'react';

// "Today: 12 min · 18 lines" on the home screen. One small localStorage entry for
// the current day, on this machine only; a new day starts from zero.

const KEY = 'linguaclip_today';
const TICK = 5;      // seconds per clock tick
const IDLE = 60_000; // no key / click / playing video for this long = not practising

export interface Today { date: string; sec: number; lines: number }

const dayOf = (now: number) => new Date(now).toLocaleDateString('sv'); // local YYYY-MM-DD

export const getToday = (now = Date.now()): Today => {
  const date = dayOf(now);
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (t?.date === date) return { date, sec: +t.sec || 0, lines: +t.lines || 0 };
  } catch { /* unreadable → start the day fresh */ }
  return { date, sec: 0, lines: 0 };
};

const bump = (sec: number, lines: number) => {
  try {
    const t = getToday();
    localStorage.setItem(KEY, JSON.stringify({ ...t, sec: t.sec + sec, lines: t.lines + lines }));
  } catch { /* storage off: the stat just doesn't count */ }
};

export const countLine = () => bump(0, 1);

// One clock for the whole app: the practice page and a review round opened on
// top of it both hold it, and time still only counts once.
let holders = 0;
let timer: number | undefined;
let lastInput = 0;
const onInput = () => { lastInput = Date.now(); };
const tick = () => {
  const playing = Array.from(document.querySelectorAll('video')).some(v => !v.paused);
  if (document.hasFocus() && (playing || Date.now() - lastInput < IDLE)) bump(TICK, 0);
};

export const usePracticeClock = () => {
  useEffect(() => {
    if (holders++ === 0) {
      lastInput = Date.now();
      window.addEventListener('keydown', onInput, true);
      window.addEventListener('pointerdown', onInput, true);
      timer = window.setInterval(tick, TICK * 1000);
    }
    return () => {
      if (--holders === 0) {
        window.removeEventListener('keydown', onInput, true);
        window.removeEventListener('pointerdown', onInput, true);
        window.clearInterval(timer);
      }
    };
  }, []);
};
