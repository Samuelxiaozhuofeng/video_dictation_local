import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, Check, Plus, Sparkles } from 'lucide-react';
import * as AI from '../utils/ai';
import { DictEntry, Seg, Sense, senseToAnki } from '../utils/dictionary';
import { Btn, Card, Stamp } from './ui';
import { useT } from '../utils/i18n';

// Single word-definition surface for both learning modes: a centred popup over the
// practice page, closed by Esc, the X or a click outside. A dictionary entry is
// listed meaning by meaning; each has its own "+" that sends just that meaning
// (and its first two examples) to Anki as an audio card. The AI can point at the
// meaning this sentence uses (pick); an AI-only answer (data) gets one "+".

export type WordToAnki = (word: string, definition: string, example?: string) => void | Promise<void>;

export interface DefinitionState {
  word: string | null;
  dict: DictEntry[] | null;
  context?: string; // the line the word was clicked in, for the AI pick
  data: AI.WordDefinition | null;
  loading: boolean;
  aiLoading?: boolean;
  aiError?: string;
  pick?: AI.SensePick; // index counts every meaning across the entries, from 1
  failed: boolean;
  error?: string;
}

export const emptyDefinition: DefinitionState = { word: null, dict: null, data: null, loading: false, failed: false };

const aiHtml = (d: AI.WordDefinition) => `<b>${d.word}</b> <i>(${d.partOfSpeech})</i><br/>${d.definition}`;

const SegText: React.FC<{ line: Seg[] }> = ({ line }) => (
  <>
    {line.map((p, k) => (typeof p === 'string'
      ? <React.Fragment key={k}>{p}</React.Fragment>
      : <img key={k} src={p.img} alt="" className="inline h-[1em] align-[-0.12em] invert mix-blend-screen" />))}
  </>
);

// One "+" per meaning. Sent stays sent while the popup is open (no duplicate
// cards); while one is recording the audio clip, the others wait.
type AddState = { sent: Set<string>; busy: string | null; failed: string | null };

const AddBtn: React.FC<{ id: string; add: AddState; onAdd: (id: string) => void }> = ({ id, add, onAdd }) => {
  const t = useT();
  const sent = add.sent.has(id);
  const busy = add.busy === id;
  const failed = add.failed === id;
  return (
    <Btn
      square size="sm" tone={sent ? 'accent-soft' : 'white'}
      disabled={sent || add.busy !== null}
      onClick={() => onAdd(id)}
      title={sent ? t('common.added') : failed ? t('common.failed') : t('definition.addSense')}
      aria-label={t('definition.addSense')}
      className="shrink-0"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} /> : failed ? <X size={14} /> : <Plus size={14} />}
    </Btn>
  );
};

const SenseRow: React.FC<{ sense: Sense; picked: boolean; note?: string; action: React.ReactNode }> = ({ sense, picked, note, action }) => {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (picked) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [picked]);
  return (
    <li ref={ref} className={`flex gap-3 items-start rounded-lg -mx-2 px-2 py-1.5 ${picked ? 'bg-accent-soft ring-1 ring-accent/60' : ''}`}>
      <div className="flex-1 min-w-0 text-[15px] leading-relaxed whitespace-pre-line">
        {sense.pos && <span className="text-mute italic mr-2">{sense.pos}</span>}
        {sense.phrase && <span className="font-medium mr-2">{sense.phrase}</span>}
        <SegText line={sense.text} />
        {sense.examples[0] && <div className="mt-1 text-sm text-mute"><SegText line={sense.examples[0]} /></div>}
        {picked && note && <div className="mt-1.5 text-sm text-accent">AI：{note}</div>}
      </div>
      {action}
    </li>
  );
};

const DefinitionPanel: React.FC<{
  def: DefinitionState;
  onClose: () => void;
  onWordToAnki?: WordToAnki;
  onExplain?: () => void;
}> = ({ def, onClose, onWordToAnki, onExplain }) => {
  const t = useT();
  const [add, setAdd] = useState<AddState>({ sent: new Set(), busy: null, failed: null });

  // id = "entry:sense" or "ai"; the popup is remounted per word, so ids never clash.
  const send = async (id: string) => {
    if (!onWordToAnki || !def.word) return;
    let fields: { definition: string; example?: string } | null = null;
    if (id === 'ai' && def.data) fields = { definition: aiHtml(def.data) };
    else if (def.dict) {
      const [e, s] = id.split(':').map(Number);
      const entry = def.dict[e];
      if (entry?.senses[s]) fields = senseToAnki(entry, entry.senses[s]);
    }
    if (!fields) return;
    setAdd(a => ({ ...a, busy: id, failed: null }));
    try {
      await onWordToAnki(def.word, fields.definition, fields.example);
      setAdd(a => ({ sent: new Set(a.sent).add(id), busy: null, failed: null }));
    } catch {
      setAdd(a => ({ ...a, busy: null, failed: id }));
    }
  };
  const action = (id: string) => (onWordToAnki ? <AddBtn id={id} add={add} onAdd={send} /> : null);

  let n = 0; // running meaning number, matching pick.index
  const pickIndex = def.pick?.index ?? null;

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
      ) : def.dict ? (
        <div className="space-y-5">
          {onExplain && !def.pick && (
            def.aiLoading ? (
              <div className="flex items-center gap-3 text-sm text-mute"><Loader2 size={18} className="animate-spin" /> {t('definition.explaining')}</div>
            ) : (
              <div className="space-y-2">
                <Btn tone="white" size="sm" onClick={onExplain} className="w-full"><Sparkles size={14} /> {t('definition.explain')}</Btn>
                {def.aiError && <div className="rounded-md bg-shade text-ink p-3 text-sm whitespace-pre-wrap break-words">{def.aiError}</div>}
              </div>
            )
          )}
          {def.pick && pickIndex === null && (
            <p className="text-sm text-accent">{t('definition.noPick')}{def.pick.note && ` ${def.pick.note}`}</p>
          )}
          {def.dict.map((e, ei) => (
            <div key={ei} className="space-y-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h4 className="font-serif text-3xl leading-none break-words">{e.word}</h4>
                {e.phonetic && <span className="text-sm text-mute font-mono">{e.phonetic}</span>}
                {ei === 0 && <Stamp tone="shade" className="ml-auto">{t(`dict.${e.source}`)}</Stamp>}
              </div>
              <ul className="space-y-1">
                {e.senses.map((s, si) => {
                  const picked = ++n === pickIndex;
                  return <SenseRow key={si} sense={s} picked={picked} note={def.pick?.note} action={action(`${ei}:${si}`)} />;
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : def.data ? (
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-3xl leading-none break-words">{def.data.word}</h4>
            <Stamp tone="shade" className="mt-2">{def.data.partOfSpeech}</Stamp>
            <p className="text-[15px] leading-relaxed mt-3">{def.data.definition}</p>
          </div>
          {action('ai')}
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
