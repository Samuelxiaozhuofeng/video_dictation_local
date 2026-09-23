import React from 'react';
import { Bookmark, X, Trash2, Play } from 'lucide-react';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { Btn, Stamp } from './ui';
import { useT } from '../utils/i18n';

// Lines saved from this video; jump back to any of them.
const SavedDrawer: React.FC = () => {
  const t = useT();
  const { saved, actions } = usePracticeContext();
  const { savedItems } = saved;
  const close = () => actions.onToggleSavedList(false);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={close} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[360px] bg-page border-l border-line shadow-lift flex flex-col slide-in" aria-label={t('common.savedLines')}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-line">
          <span className="font-serif text-lg inline-flex items-center gap-2"><Bookmark size={18} className="text-accent" /> {t('common.savedLines')}</span>
          <Btn square size="sm" flat onClick={close} title={t('common.close')}><X size={16} /></Btn>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {savedItems.length === 0 ? (
            <p className="text-sm text-mute">{t('savedDrawer.emptyHint')}</p>
          ) : savedItems.map(item => (
            <div key={item.id} className="flat p-3">
              <p className="font-serif text-[15px] leading-relaxed">“{item.text}”</p>
              <div className="mt-3 flex items-center justify-between">
                <Stamp>{Storage.formatTimeCode(item.startTime)}</Stamp>
                <div className="flex gap-2">
                  <Btn square size="sm" flat onClick={e => actions.onDeleteSavedItem(item.id, e)} title={t('savedDrawer.remove')} className="hover:!bg-shade hover:!text-ink"><Trash2 size={14} /></Btn>
                  <Btn size="sm" tone="accent" onClick={() => actions.onJumpToSaved(item.id)}><Play size={14} fill="currentColor" /> {t('savedDrawer.go')}</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default SavedDrawer;
