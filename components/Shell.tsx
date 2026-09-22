import React from 'react';
import { Film, Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { AppState } from '../types';
import { useT } from '../utils/i18n';

// Page frame for the three non-practice screens: wordmark + three tabs + scrolling body.
const Shell: React.FC<{ active: AppState; onNav: (s: AppState) => void; children: React.ReactNode }> = ({ active, onNav, children }) => {
  const t = useT();
  const NAV: { state: AppState; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { state: AppState.UPLOAD, label: t('nav.videos'), Icon: Film },
    { state: AppState.LIBRARY, label: t('nav.saved'), Icon: Bookmark },
    { state: AppState.SETTINGS, label: t('nav.settings'), Icon: SettingsIcon },
  ];
  return (
  <div className="h-full flex flex-col">
    <header className="shrink-0 border-b border-line bg-page pl-[80px]" data-tauri-drag-region="deep">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 select-none">
          <span className="w-3 h-3 rounded-sm bg-green" aria-hidden />
          <span className="font-serif text-xl font-semibold tracking-tight">LinguaClip</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(({ state, label, Icon }) => (
            <button
              key={state}
              onClick={() => onNav(state)}
              aria-current={active === state ? 'page' : undefined}
              className={`h-9 px-3 rounded-md inline-flex items-center gap-2 text-sm font-medium transition-colors
                ${active === state ? 'bg-shade/80 text-ink' : 'text-mute hover:text-ink hover:bg-shade/50'}`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
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
