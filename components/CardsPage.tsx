import React, { useMemo, useState } from 'react';
import { Search, Trash2, Volume2 } from 'lucide-react';
import { ReviewCard, Deck, deleteCards, hasAudio, isDue, wordIndexIn } from '../utils/review';
import { hasKana } from '../utils/japanese';
import { Btn, H, Seg, Stamp, inputCls } from './ui';
import { dialog } from './Dialog';
import { findVideo, clipOf, useClip } from './ReviewSession';
import { useCards, DAY, startOfDay, fmt } from './ReviewPage';
import { useT } from '../utils/i18n';

// The card library: every sentence / word card, searchable and filterable by
// schedule, with listen and delete (one, or a picked batch).

type Status = 'all' | 'due' | 'later' | 'silent';

const plain = (html?: string) => html ? new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '' : '';

const CardsPage: React.FC = () => {
  const t = useT();
  const cards = useCards();
  const [deck, setDeck] = useState<Deck>('line');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string> | null>(null); // null = not picking
  const clip = useClip();

  const all = cards ?? [];
  const now = Date.now();
  const q = search.trim().toLowerCase();
  const inDeck = all.filter(c => c.deck === deck);
  const list = useMemo(() => inDeck
    .filter(c => status === 'all' || (status === 'silent' ? !hasAudio(c) : hasAudio(c) && isDue(c, now) === (status === 'due')))
    .filter(c => !q || [c.text, c.word, c.videoName].some(s => s?.toLowerCase().includes(q)))
    .sort((a, b) => Number(hasAudio(b)) - Number(hasAudio(a)) || a.fsrs.due - b.fsrs.due), [all, deck, status, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const when = (c: ReviewCard) => {
    if (!hasAudio(c)) return t('review.noAudio');
    if (c.fsrs.due <= now) return t('review.dueToday');
    const days = Math.round((startOfDay(c.fsrs.due) - startOfDay(now)) / DAY);
    return `${fmt(c.fsrs.due, { month: 'short', day: 'numeric' })} · ${days <= 1 ? t('review.dueTomorrow') : t('review.dueInDays', { n: days })}`;
  };

  const listen = async (c: ReviewCard) => {
    const path = await findVideo(c);
    if (!path) return dialog.alert(t('session.missingTitle'));
    clip.play(path, ...clipOf(c));
  };

  const remove = async (c: ReviewCard) => {
    const ok = await dialog.confirm(t('review.removeTitle'), t('review.removeBody'), { ok: t('review.removeOk'), danger: true });
    if (ok) await deleteCards([c.id]).catch(console.error);
  };

  // Only what is still on screen goes, so a filter change never deletes unseen cards.
  const shown = picked ? list.filter(c => picked.has(c.id)) : [];
  const removePicked = async () => {
    const ok = await dialog.confirm(t('cards.removeManyTitle', { n: shown.length }), t(shown.length === 1 ? 'review.removeBody' : 'cards.removeManyBody'), { ok: t('review.removeOk'), danger: true });
    if (!ok) return;
    await deleteCards(shown.map(c => c.id)).catch(console.error);
    setPicked(null);
  };
  const toggle = (id: string) => setPicked(p => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const allPicked = list.length > 0 && shown.length === list.length;

  const text = (c: ReviewCard) => {
    if (c.deck !== 'word' || !c.word) return c.text;
    // Japanese has no spaces: mark the word where it sits in the line.
    const at = hasKana(c.text) ? c.text.indexOf(c.word) : -1;
    if (at >= 0) return <>{c.text.slice(0, at)}<b className="text-accent font-semibold">{c.word}</b>{c.text.slice(at + c.word.length)}</>;
    const parts = c.text.split(/\s+/);
    const wi = wordIndexIn(parts, c.word);
    return parts.map((p, i) => (
      <React.Fragment key={i}>{i > 0 && ' '}{i === wi && p.toLowerCase().includes(c.word!.toLowerCase()) ? <b className="text-accent font-semibold">{p}</b> : p}</React.Fragment>
    ));
  };

  return (
    <div>
      <H>{t('cards.title')}</H>

      <div className="flex items-center gap-3 mb-3">
        <Seg<Deck> value={deck} onChange={setDeck} options={[
          { value: 'line', label: t('review.deckLine') },
          { value: 'word', label: t('review.deckWord') },
        ]} />
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-mute pointer-events-none"><Search size={16} /></span>
          <input type="text" placeholder={t('review.search')} value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-10`} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 min-h-9">
        <Seg<Status> size="sm" value={status} onChange={setStatus} options={[
          { value: 'all', label: t('cards.all') },
          { value: 'due', label: t('cards.due') },
          { value: 'later', label: t('cards.later') },
          { value: 'silent', label: t('cards.silent') },
        ]} />
        <span className="ml-auto flex items-center gap-2 text-sm text-mute">
          {picked ? (
            <>
              <span>{t('cards.picked', { n: shown.length })}</span>
              <Btn size="sm" flat onClick={() => setPicked(allPicked ? new Set() : new Set(list.map(c => c.id)))}>{allPicked ? t('cards.pickNone') : t('cards.pickAll')}</Btn>
              <Btn size="sm" tone="accent" disabled={shown.length === 0} onClick={() => { removePicked().catch(console.error); }}>{t('review.removeOk')}</Btn>
              <Btn size="sm" flat onClick={() => setPicked(null)}>{t('dialog.cancel')}</Btn>
            </>
          ) : list.length > 0 && (
            <Btn size="sm" flat onClick={() => setPicked(new Set())}>{t('cards.pick')}</Btn>
          )}
        </span>
      </div>

      {cards !== null && list.length === 0 ? (
        <p className="py-10 text-center text-sm text-mute">{inDeck.length ? t('cards.noMatch') : deck === 'line' ? t('review.emptyLine') : t('review.emptyWord')}</p>
      ) : (
        <ul>
          {list.map(c => (
            <li key={c.id} className="py-4 border-t border-line first:border-t-0 flex gap-3" onClick={picked ? () => toggle(c.id) : undefined}>
              {picked && (
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} onClick={e => e.stopPropagation()} aria-label={t('cards.pick')} className="mt-2 w-4 h-4 shrink-0 accent-accent" />
              )}
              <div className={`flex-1 min-w-0 ${picked ? 'cursor-pointer' : ''}`}>
                <p className="font-serif text-lg leading-relaxed">{text(c)}</p>
                {c.deck === 'word' && c.definition && <p className="mt-1 text-sm text-ink/80 truncate">{plain(c.definition)}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-mute">
                  <span className="truncate min-w-0">{c.videoName}</span>
                  <span className="shrink-0">{when(c)}</span>
                  {c.fsrs.reps > 0 && <span className="shrink-0">{t('review.reps', { n: c.fsrs.reps })}{c.fsrs.lapses > 0 && ` · ${t('review.lapses', { n: c.fsrs.lapses })}`}</span>}
                  {c.saved && <Stamp tone="shade" className="shrink-0">{t('review.saved')}</Stamp>}
                  {!picked && (
                    <span className="ml-auto shrink-0 flex items-center gap-1">
                      {hasAudio(c) && (
                        <Btn square size="sm" flat onClick={() => { listen(c).catch(console.error); }} title={t('review.play')} aria-label={t('review.play')}><Volume2 size={15} /></Btn>
                      )}
                      <Btn square size="sm" flat onClick={() => { remove(c).catch(console.error); }} title={t('review.remove')} aria-label={t('review.remove')}><Trash2 size={15} /></Btn>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {clip.video('hidden')}
    </div>
  );
};

export default CardsPage;
