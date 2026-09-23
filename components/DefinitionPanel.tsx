import React, { useEffect, useState } from 'react';
import { Loader2, X, Pin, PinOff, Check, PlusCircle, Volume2 } from 'lucide-react';
import * as AI from '../utils/ai';
import { Btn, Stamp } from './ui';
import { useT } from '../utils/i18n';

// Single word-definition surface for both learning modes. Opens on the right when a
// word is looked up; "pin" keeps it open across lines. Holds the only copy of the
// "send this word to Anki" buttons.

export type WordToAnki = (word: string, definition: string, includeAudio?: boolean) => void | Promise<void>;

export interface DefinitionState {
  word: string | null;
  data: AI.WordDefinition | null;
  loading: boolean;
  failed: boolean;
  error?: string;
}

export const emptyDefinition: DefinitionState = { word: null, data: null, loading: false, failed: false };

type AnkiBtnState = 'idle' | 'busy' | 'done' | 'error';

const AnkiWordButtons: React.FC<{ word: string; data: AI.WordDefinition; onWordToAnki: WordToAnki }> = ({ word, data, onWordToAnki }) => {
  const t = useT();
  const [state, setState] = useState<{ which: 'word' | 'audio' | null; s: AnkiBtnState }>({ which: null, s: 'idle' });

  useEffect(() => { setState({ which: null, s: 'idle' }); }, [word]);

  const send = async (includeAudio: boolean) => {
    const which = includeAudio ? 'audio' : 'word';
    setState({ which, s: 'busy' });
    try {
      const def = `<b>${data.word}</b> <i>(${data.partOfSpeech})</i><br/>${data.definition}`;
      await onWordToAnki(word, def, includeAudio);
      setState({ which, s: 'done' });
    } catch {
      setState({ which, s: 'error' });
    } finally {
      setTimeout(() => setState({ which: null, s: 'idle' }), 2000);
    }
  };

  const face = (which: 'word' | 'audio', label: string, Icon: React.FC<{ size?: number }>) => {
    const mine = state.which === which ? state.s : 'idle';
    const tone = mine === 'done' ? 'accent-soft' : mine === 'error' ? 'shade' : which === 'audio' ? 'accent' : 'white';
    return (
      <Btn tone={tone} disabled={state.s === 'busy'} onClick={() => send(which === 'audio')} className="flex-1">
        {mine === 'busy' ? <Loader2 size={16} className="animate-spin" /> : mine === 'done' ? <Check size={16} /> : <Icon size={16} />}
        {mine === 'done' ? t('common.added') : mine === 'error' ? t('common.failed') : label}
      </Btn>
    );
  };

  return (
    <div className="pt-5 border-t border-line border-dashed">
      <p className="text-xs text-mute mb-3">{t('definition.sendToAnki')}</p>
      <div className="flex gap-3">
        {face('word', t('definition.wordOnly'), PlusCircle)}
        {face('audio', t('definition.withAudio'), Volume2)}
      </div>
    </div>
  );
};

const DefinitionPanel: React.FC<{
  def: DefinitionState;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onWordToAnki?: WordToAnki;
}> = ({ def, pinned, onTogglePin, onClose, onWordToAnki }) => {
  const t = useT();
  return (
  <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-page border-l border-line shadow-lift flex flex-col slide-in" aria-label={t('definition.ariaLabel')}>
    <div className="h-14 px-4 flex items-center justify-between border-b border-line">
      <span className="font-serif text-lg">{t('definition.heading')}</span>
      <div className="flex gap-2">
        <Btn square size="sm" flat onClick={onTogglePin} className={pinned ? '!bg-accent-soft !text-accent' : ''} title={pinned ? t('definition.unpin') : t('definition.pin')}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </Btn>
        <Btn square size="sm" flat onClick={onClose} title={t('common.close')}><X size={16} /></Btn>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-5">
      {def.loading ? (
        <div className="flex items-center gap-3 text-sm text-mute"><Loader2 size={18} className="animate-spin" /> {t('definition.asking')}</div>
      ) : def.data ? (
        <div className="space-y-4">
          <div>
            <h4 className="font-serif text-3xl leading-none break-words">{def.data.word}</h4>
            <Stamp tone="shade" className="mt-2">{def.data.partOfSpeech}</Stamp>
          </div>
          <p className="text-[15px] leading-relaxed">{def.data.definition}</p>
          {onWordToAnki && def.word && <AnkiWordButtons word={def.word} data={def.data} onWordToAnki={onWordToAnki} />}
        </div>
      ) : def.failed ? (
        <div className="space-y-3">
          <h4 className="font-serif text-3xl leading-none break-words">{def.word}</h4>
          <div className="rounded-md bg-shade text-ink p-3 text-sm whitespace-pre-wrap break-words">{def.error}</div>
        </div>
      ) : (
        <p className="text-sm text-mute">{t('definition.emptyHint')}</p>
      )}
    </div>
  </aside>
  );
};

export default DefinitionPanel;
