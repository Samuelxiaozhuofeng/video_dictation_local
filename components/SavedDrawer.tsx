import React from 'react';
import { Bookmark, X, Trash2, Play } from 'lucide-react';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { Btn, Stamp } from './ui';

// Lines saved from this video; jump back to any of them.
const SavedDrawer: React.FC = () => {
  const { saved, actions } = usePracticeContext();
  const { savedItems } = saved;
  const close = () => actions.onToggleSavedList(false);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/60" onClick={close} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[360px] bg-page border-l border-line shadow-lift flex flex-col slide-in" aria-label="Saved lines">
        <div className="h-14 px-4 flex items-center justify-between border-b border-line">
          <span className="font-serif font-semibold text-lg inline-flex items-center gap-2"><Bookmark size={18} className="text-ochre" /> Saved lines</span>
          <Btn square size="sm" flat onClick={close} title="Close"><X size={16} /></Btn>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {savedItems.length === 0 ? (
            <p className="text-sm text-mute">Nothing saved from this video yet. Press the bookmark while a line plays.</p>
          ) : savedItems.map(item => (
            <div key={item.id} className="flat p-3">
              <p className="font-serif text-[15px] leading-relaxed">“{item.text}”</p>
              <div className="mt-3 flex items-center justify-between">
                <Stamp>{Storage.formatTimeCode(item.startTime)}</Stamp>
                <div className="flex gap-2">
                  <Btn square size="sm" flat onClick={e => actions.onDeleteSavedItem(item.id, e)} title="Remove" className="hover:!bg-rose-soft hover:!text-rose"><Trash2 size={14} /></Btn>
                  <Btn size="sm" tone="green" onClick={() => actions.onJumpToSaved(item.id)}><Play size={14} fill="currentColor" /> Go</Btn>
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
