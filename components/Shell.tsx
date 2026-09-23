import React from 'react';
import { AppState } from '../types';
import { useT } from '../utils/i18n';

// Page frame for the three non-practice screens: wordmark + three quiet tabs + scrolling body.
const Shell: React.FC<{ active: AppState; onNav: (s: AppState) => void; children: React.ReactNode }> = ({ active, onNav, children }) => {
  const t = useT();
  const NAV: { state: AppState; label: string }[] = [
    { state: AppState.UPLOAD, label: t('nav.videos') },
    { state: AppState.LIBRARY, label: t('nav.saved') },
    { state: AppState.SETTINGS, label: t('nav.settings') },
  ];
  return (
  <div className="h-full flex flex-col">
    <header className="shrink-0 pl-[80px]" data-tauri-drag-region="deep">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <span className="font-serif text-xl select-none">LinguaClip</span>
        <nav className="flex items-center gap-1">
          {NAV.map(({ state, label }) => (
            <button
              key={state}
              onClick={() => onNav(state)}
              aria-current={active === state ? 'page' : undefined}
              className={`h-8 px-3 rounded-md text-[13px] transition-colors
                ${active === state ? 'text-ink bg-shade' : 'text-mute hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
    </main>
  </div>
  );
};

export default Shell;
