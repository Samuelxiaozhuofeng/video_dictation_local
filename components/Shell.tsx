import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppState } from '../types';
import { useT } from '../utils/i18n';
import { IS_WINDOWS } from '../utils/platform';
import { deckCounts, getAllCards, subscribeCards } from '../utils/review';

// Page frame for the non-practice screens: wordmark, a centred pill of tabs (the two
// libraries carry how many cards are due), the one "add video" button, scrolling body.
const Shell: React.FC<{ active: AppState; onNav: (s: AppState) => void; onAdd: () => void; children: React.ReactNode }> = ({ active, onNav, onAdd, children }) => {
  const t = useT();
  const [due, setDue] = useState({ line: 0, word: 0 });
  useEffect(() => {
    const load = () => getAllCards().then(c => { const n = deckCounts(c); setDue({ line: n.line.due, word: n.word.due }); }).catch(() => {});
    load();
    return subscribeCards(load);
  }, []);
  const NAV: { state: AppState; label: string; badge?: number }[] = [
    { state: AppState.UPLOAD, label: t('nav.videos') },
    { state: AppState.LIBRARY, label: t('nav.saved'), badge: due.line },
    { state: AppState.CARDS, label: t('nav.cards'), badge: due.word },
    { state: AppState.SETTINGS, label: t('nav.settings') },
  ];
  return (
  <div className="h-full flex flex-col">
    {/* The Mac's traffic lights sit top-left, so the wordmark starts after them. */}
    <header className={`shrink-0 relative h-[70px] ${IS_WINDOWS ? 'pl-6' : 'pl-24'} pr-6 lg:pr-10 flex items-center justify-between`} data-tauri-drag-region="deep">
      <span className="text-[15px] font-semibold select-none">LinguaClip</span>
      <nav className="absolute left-1/2 top-3.5 -translate-x-1/2 flex gap-0.5 p-1 bg-page border border-line rounded-full">
        {NAV.map(({ state, label, badge }) => {
          const on = active === state;
          return (
            <button
              key={state}
              onClick={() => onNav(state)}
              aria-current={on ? 'page' : undefined}
              className={`h-8 px-4 rounded-full flex items-center gap-1.5 text-[13px] transition-colors
                ${on ? 'bg-ink text-white' : 'text-mute hover:text-ink'}`}
            >
              {label}
              {!!badge && <span className={`text-xs tabular-nums ${on ? 'text-white' : 'text-accent'}`}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <button onClick={onAdd} title={t('home.addVideo')} aria-label={t('home.addVideo')}
        className="press w-[42px] h-[42px] rounded-full bg-accent text-white flex items-center justify-center">
        <Plus size={19} strokeWidth={2.25} />
      </button>
    </header>
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-24 pt-4 pb-12">{children}</div>
    </main>
  </div>
  );
};

export default Shell;
