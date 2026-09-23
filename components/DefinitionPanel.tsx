import React, { useEffect, useState } from 'react';
import { Loader2, X, Check, PlusCircle, Volume2, Sparkles } from 'lucide-react';
import * as AI from '../utils/ai';
import { DictEntry, entriesToHtml } from '../utils/dictionary';
import { Btn, Card, Stamp } from './ui';
import { useT } from '../utils/i18n';

// Single word-definition surface for both learning modes: a centred popup over the
// practice page, closed by Esc, the X or a click outside. Holds the only copy of
// the "send this word to Anki" buttons. A dictionary entry comes first; the
// AI's reading of the word in this sentence (data) is optional and, once asked
// for, is what goes to Anki.

export type WordToAnki = (word: string, definition: string, includeAudio?: boolean) => void | Promise<void>;

export interface DefinitionState {
  word: string | null;
  dict: DictEntry[] | null;
  context?: string; // the line the word was clicked in, for "explain in this sentence"
  data: AI.WordDefinition | null;
  loading: boolean;
  aiLoading?: boolean;
  aiError?: string;
  failed: boolean;
  error?: string;
}

export const emptyDefinition: DefinitionState = { word: null, dict: null, data: null, loading: false, failed: false };

const aiHtml = (d: AI.WordDefinition) => `<b>${d.word}</b> <i>(${d.partOfSpeech})</i><br/>${d.definition}`;

const DictView: React.FC<{ entries: DictEntry[] }> = ({ entries }) => {
  const t = useT();
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h4 className="font-serif text-3xl leading-none break-words">{e.word}</h4>
            {e.phonetic && <span className="text-sm text-mute font-mono">{e.phonetic}</span>}
            {i === 0 && <Stamp tone="shade" className="ml-auto">{t(`dict.${e.source}`)}</Stamp>}
          </div>
          <ul className="space-y-2">
            {e.senses.map((s, j) => (
              <li key={j} className="text-[15px] leading-relaxed whitespace-pre-line">
                {s.pos && <span className="text-mute italic mr-2">{s.pos}</span>}
                {s.text.map((p, k) => (typeof p === 'string'
                  ? <React.Fragment key={k}>{p}</React.Fragment>
                  : <img key={k} src={p.img} alt="" className="inline h-[1em] align-[-0.12em] invert mix-blend-screen" />))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

type AnkiBtnState = 'idle' | 'busy' | 'done' | 'error';

const AnkiWordButtons: React.FC<{ word: string; html: string; onWordToAnki: WordToAnki }> = ({ word, html, onWordToAnki }) => {
  const t = useT();
  const [state, setState] = useState<{ which: 'word' | 'audio' | null; s: AnkiBtnState }>({ which: null, s: 'idle' });

  useEffect(() => { setState({ which: null, s: 'idle' }); }, [word]);

  const send = async (includeAudio: boolean) => {
    const which = includeAudio ? 'audio' : 'word';
    setState({ which, s: 'busy' });
    try {
      await onWordToAnki(word, html, includeAudio);
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
  onClose: () => void;
  onWordToAnki?: WordToAnki;
  onExplain?: () => void;
}> = ({ def, onClose, onWordToAnki, onExplain }) => {
  const t = useT();
  return (
  <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4 fade-in" onMouseDown={onClose}>
  <Card className="w-full max-w-md max-h-[80vh] shadow-lift flex flex-col" role="dialog" aria-label={t('definition.ariaLabel')} onMouseDown={e => e.stopPropagation()}>
    <div className="h-14 px-5 flex items-center justify-between border-b border-line">
      <span className="font-serif text-lg">{t('definition.heading')}</span>
      <Btn square size="sm" flat onClick={onClose} title={t('common.close')}><X size={16} /></Btn>
    </div>

    <div className="flex-1 overflow-y-auto p-5">
      {def.loading ? (
        <div className="flex items-center gap-3 text-sm text-mute"><Loader2 size={18} className="animate-spin" /> {t('definition.asking')}</div>
      ) : def.dict || def.data ? (
        <div className="space-y-5">
          {def.dict && <DictView entries={def.dict} />}
          {def.data ? (
            <div className={def.dict ? 'pt-5 border-t border-line border-dashed' : ''}>
              {def.dict && <p className="text-xs text-mute mb-2">{t('definition.inSentence')}</p>}
              <h4 className={`font-serif leading-none break-words ${def.dict ? 'text-xl' : 'text-3xl'}`}>{def.data.word}</h4>
              <Stamp tone="shade" className="mt-2">{def.data.partOfSpeech}</Stamp>
              <p className="text-[15px] leading-relaxed mt-3">{def.data.definition}</p>
            </div>
          ) : def.aiLoading ? (
            <div className="flex items-center gap-3 text-sm text-mute"><Loader2 size={18} className="animate-spin" /> {t('definition.explaining')}</div>
          ) : onExplain && (
            <div className="space-y-2">
              <Btn tone="white" onClick={onExplain} className="w-full"><Sparkles size={16} /> {t('definition.explain')}</Btn>
              {def.aiError && <div className="rounded-md bg-shade text-ink p-3 text-sm whitespace-pre-wrap break-words">{def.aiError}</div>}
            </div>
          )}
          {onWordToAnki && def.word && !def.aiLoading && (
            <AnkiWordButtons word={def.word} html={def.data ? aiHtml(def.data) : entriesToHtml(def.dict!)} onWordToAnki={onWordToAnki} />
          )}
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
  </Card>
  </div>
  );
};

export default DefinitionPanel;
