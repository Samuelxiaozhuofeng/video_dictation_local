import React, { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Volume2 } from 'lucide-react';
import { ReviewCard, Deck, getAllCards, subscribeCards, deckCounts, dueQueue, deleteCard, hasAudio, wordIndexIn } from '../utils/review';
import { Btn, Card, H, Seg, Stamp, inputCls } from './ui';
import { dialog } from './Dialog';
import ReviewSession, { findVideo, clipOf, useClip } from './ReviewSession';
import { useT, getLang } from '../utils/i18n';

// The review page: the two decks up top (due now, start), every card below.

const DAY = 86_400_000;
const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', o);
const plain = (html?: string) => html ? new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '' : '';

const ReviewPage: React.FC = () => {
  const t = useT();
  const [cards, setCards] = useState<ReviewCard[] | null>(null);
  const [session, setSession] = useState<ReviewCard[] | null>(null);
  const [deck, setDeck] = useState<Deck>('line');
  const [search, setSearch] = useState('');
  const clip = useClip();

  useEffect(() => {
    const load = () => getAllCards().then(setCards).catch(e => { console.error(e); setCards([]); });
    load();
    return subscribeCards(load);
  }, []);

  const all = cards ?? [];
  const counts = deckCounts(all);
  const now = Date.now();
  const q = search.trim().toLowerCase();
  const list = useMemo(() => all
    .filter(c => c.deck === deck)
    .filter(c => !q || [c.text, c.word, c.videoName].some(s => s?.toLowerCase().includes(q)))
    .sort((a, b) => Number(hasAudio(b)) - Number(hasAudio(a)) || a.fsrs.due - b.fsrs.due), [all, deck, q]); // soonest first, silent old bookmarks last

  const when = (c: ReviewCard) => {
    if (!hasAudio(c)) return t('review.noAudio');
    if (c.fsrs.due <= now) return t('review.dueToday');
    const days = Math.round((startOfDay(c.fsrs.due) - startOfDay(now)) / DAY);
    return `${fmt(c.fsrs.due, { month: 'short', day: 'numeric' })} · ${days <= 1 ? t('review.dueTomorrow') : t('review.dueInDays', { n: days })}`;
  };

  // Cards (both decks, with audio) coming up on each of the next 7 days; today includes overdue.
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(now) + i * DAY; // ponytail: a DST day is 23/25h; off by an hour at most, only around the switch
    const n = all.filter(c => hasAudio(c) && (i === 0 ? c.fsrs.due < day + DAY : c.fsrs.due >= day && c.fsrs.due < day + DAY)).length;
    return { label: i === 0 ? t('review.today') : i === 1 ? t('review.dueTomorrow') : fmt(day, { weekday: 'short' }), n };
  });

  const listen = async (c: ReviewCard) => {
    const path = await findVideo(c);
    if (!path) return dialog.alert(t('session.missingTitle'));
    clip.play(path, ...clipOf(c));
  };

  const remove = async (c: ReviewCard) => {
    const ok = await dialog.confirm(t('review.removeTitle'), t('review.removeBody'), { ok: t('review.removeOk'), danger: true });
    if (ok) await deleteCard(c.id).catch(console.error);
  };

  const text = (c: ReviewCard) => {
    if (c.deck !== 'word' || !c.word) return c.text;
    const parts = c.text.split(/\s+/);
    const wi = wordIndexIn(parts, c.word);
    return parts.map((p, i) => (
      <React.Fragment key={i}>{i > 0 && ' '}{i === wi && p.toLowerCase().includes(c.word!.toLowerCase()) ? <b className="text-accent font-semibold">{p}</b> : p}</React.Fragment>
    ));
  };

  const deckCard = (d: Deck, title: string, hint: string) => {
    const n = counts[d];
    return (
      <Card flat className="p-5 flex flex-col gap-3">
        <div>
          <h3 className="font-serif text-2xl">{title}</h3>
          <p className="mt-1 text-sm text-mute">{hint}</p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`font-serif text-[30px] leading-none ${n.due ? 'text-accent' : 'text-mute'}`}>{t('review.due', { n: n.due })}</span>
          <span className="text-xs text-mute">{t('review.total', { n: n.total })}</span>
        </div>
        <Btn tone="accent" className="self-start" disabled={n.due === 0} onClick={() => setSession(dueQueue(all, d))}>
          {n.due === 0 ? t('review.nothingDue') : t('review.start')}
        </Btn>
      </Card>
    );
  };

  return (
    <div>
      <H>{t('review.title')}</H>
      <div className="mb-6">
        <h3 className="text-xs text-mute mb-2">{t('review.week')}</h3>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d, i) => (
            <div key={i} className="rounded-lg bg-shade/40 py-2 text-center">
              <div className="text-xs text-mute">{d.label}</div>
              <div className={`font-serif text-xl leading-tight ${d.n ? 'text-accent' : 'text-mute'}`}>{d.n}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {deckCard('line', t('review.deckLine'), t('review.deckLineHint'))}
        {deckCard('word', t('review.deckWord'), t('review.deckWordHint'))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Seg<Deck> value={deck} onChange={setDeck} options={[
          { value: 'line', label: t('review.deckLine') },
          { value: 'word', label: t('review.deckWord') },
        ]} />
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-mute pointer-events-none"><Search size={16} /></span>
          <input type="text" placeholder={t('review.search')} value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-10`} />
        </div>
      </div>

      {cards !== null && list.length === 0 ? (
        <p className="py-10 text-center text-sm text-mute">{deck === 'line' ? t('review.emptyLine') : t('review.emptyWord')}</p>
      ) : (
        <ul>
          {list.map(c => (
            <li key={c.id} className="py-4 border-t border-line first:border-t-0">
              <p className="font-serif text-lg leading-relaxed">{text(c)}</p>
              {c.deck === 'word' && c.definition && <p className="mt-1 text-sm text-ink/80 truncate">{plain(c.definition)}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs text-mute">
                <span className="truncate min-w-0">{c.videoName}</span>
                <span className="shrink-0">{when(c)}</span>
                {c.fsrs.reps > 0 && <span className="shrink-0">{t('review.reps', { n: c.fsrs.reps })}{c.fsrs.lapses > 0 && ` · ${t('review.lapses', { n: c.fsrs.lapses })}`}</span>}
                {c.saved && <Stamp tone="shade" className="shrink-0">{t('review.saved')}</Stamp>}
                <span className="ml-auto shrink-0 flex items-center gap-1">
                  {hasAudio(c) && (
                    <Btn square size="sm" flat onClick={() => { listen(c).catch(console.error); }} title={t('review.play')} aria-label={t('review.play')}><Volume2 size={15} /></Btn>
                  )}
                  <Btn square size="sm" flat onClick={() => { remove(c).catch(console.error); }} title={t('review.remove')} aria-label={t('review.remove')}><Trash2 size={15} /></Btn>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {clip.video('hidden')}
      {session && <ReviewSession cards={session} onClose={() => setSession(null)} />}
    </div>
  );
};

export default ReviewPage;
