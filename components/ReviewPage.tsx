import React, { useEffect, useState } from 'react';
import { ReviewCard, Deck, getAllCards, subscribeCards, deckCounts, dueQueue, hasAudio } from '../utils/review';
import { Btn, Card, H } from './ui';
import ReviewSession from './ReviewSession';
import { useT, getLang } from '../utils/i18n';

// The review page: the week ahead, then the two decks (due now, start). The cards themselves live on the Cards page.

export const DAY = 86_400_000;
export const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
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

const ReviewPage: React.FC = () => {
  const t = useT();
  const cards = useCards();
  const [session, setSession] = useState<ReviewCard[] | null>(null);

  const all = cards ?? [];
  const counts = deckCounts(all);
  const now = Date.now();

  // Cards (both decks, with audio) coming up on each of the next 7 days; today includes overdue.
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(now) + i * DAY; // ponytail: a DST day is 23/25h; off by an hour at most, only around the switch
    const n = all.filter(c => hasAudio(c) && (i === 0 ? c.fsrs.due < day + DAY : c.fsrs.due >= day && c.fsrs.due < day + DAY)).length;
    return { label: i === 0 ? t('review.today') : i === 1 ? t('review.dueTomorrow') : fmt(day, { weekday: 'short' }), n };
  });

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deckCard('line', t('review.deckLine'), t('review.deckLineHint'))}
        {deckCard('word', t('review.deckWord'), t('review.deckWordHint'))}
      </div>

      {session && <ReviewSession cards={session} onClose={() => setSession(null)} />}
    </div>
  );
};

export default ReviewPage;
