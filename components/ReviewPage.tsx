import React, { useEffect, useState } from 'react';
import { ReviewCard, Deck, getAllCards, subscribeCards, deckCounts, dueQueue, hasAudio } from '../utils/review';
import { Play } from 'lucide-react';
import { Btn } from './ui';
import CardsPage from './CardsPage';
import ReviewSession from './ReviewSession';
import { useT, getLang } from '../utils/i18n';

// A library page (sentences, or words): start reviewing what is due, the week ahead, every card below.

export const DAY = 86_400_000;
export const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
// Local midnight `i` days after `ms`'s day (calendar days, so a DST day of 23/25h still lands on midnight).
export const dayStart = (ms: number, i: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d.getTime(); };
export const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', o);

// Every card, kept fresh; null until the first read.
export const useCards = () => {
  const [cards, setCards] = useState<ReviewCard[] | null>(null);
  useEffect(() => {
    const load = () => getAllCards().then(setCards).catch(e => { console.error(e); setCards([]); });
    load();
    return subscribeCards(load);
  }, []);
  return cards;
};

// One library per deck: start the due ones, the week ahead, then every card (CardsPage).
const ReviewPage: React.FC<{ deck: Deck }> = ({ deck }) => {
  const t = useT();
  const cards = useCards();
  const [session, setSession] = useState<ReviewCard[] | null>(null);

  const all = cards ?? [];
  const n = deckCounts(all)[deck];
  const now = Date.now();
  const isLine = deck === 'line';

  // This deck's cards (with audio) coming up on each of the next 7 days; today includes overdue.
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = dayStart(now, i), end = dayStart(now, i + 1);
    const count = all.filter(c => c.deck === deck && hasAudio(c) && (i === 0 ? c.fsrs.due < end : c.fsrs.due >= day && c.fsrs.due < end)).length;
    return { label: i === 0 ? t('review.today') : fmt(day, { weekday: 'short' }), n: count };
  });
  const peak = Math.max(1, ...week.map(d => d.n));

  return (
    <div>
      <section className="pt-4 pb-7 border-b border-line grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 md:gap-12 items-end">
        <div>
          <h1 className="text-[34px] font-semibold tracking-[-0.02em] leading-tight">{isLine ? t('nav.saved') : t('nav.cards')}</h1>
          <p className="mt-2 text-sm text-mute">{isLine ? t('review.deckLineHint') : t('review.deckWordHint')}</p>
          <div className="mt-5 flex items-center gap-4">
            <Btn tone="accent" size="lg" disabled={n.due === 0} onClick={() => setSession(dueQueue(all, deck))}>
              {n.due === 0 ? t('review.nothingDue') : <><Play size={15} fill="currentColor" /> {t('review.start')} · {n.due}</>}
            </Btn>
            <span className="text-sm text-mute">{t('review.total', { n: n.total })}</span>
          </div>
        </div>
        <div>
          <h3 className="text-xs text-mute mb-2.5">{t('review.week')}</h3>
          <div className="flex items-end gap-2.5 h-[84px]">
            {week.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={String(d.n)}>
                <span className="text-[11px] text-mute tabular-nums">{d.n || ''}</span>
                <span className={`w-full rounded ${i === 0 && d.n ? 'bg-accent' : 'bg-faint'}`} style={{ height: Math.max(3, (d.n / peak) * 44) }} />
                <span className="text-[11px] text-mute whitespace-nowrap">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CardsPage deck={deck} cards={cards} />

      {session && <ReviewSession cards={session} onClose={() => setSession(null)} />}
    </div>
  );
};

export default ReviewPage;
