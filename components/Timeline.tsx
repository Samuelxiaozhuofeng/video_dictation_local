import React from 'react';
import { Subtitle } from '../types';

// The part's lines as one strip, each as wide as it is long: done lines ink, the
// current one accent and taller, the rest hairline. Click a line to go to it.
// Past MAX lines (a whole unsplit video) the segments would be too thin to hit,
// so it becomes one bar and a click goes to the line at that point in time.
const MAX = 100;

type Props = { lines: Subtitle[]; current: number; watch?: Set<number> | null; onPick: (id: number) => void; title: (i: number) => string };

const Timeline: React.FC<Props> = ({ lines, current, watch, onPick, title }) => {
  if (lines.length === 0) return <div className="h-3" />;
  if (lines.length > MAX) {
    const start = lines[0].startTime, span = Math.max(0.001, lines[lines.length - 1].endTime - start);
    const at = (i: number) => i >= lines.length ? 100 : (lines[i].startTime - start) / span * 100;
    const pick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const t = start + ((e.clientX - r.left) / r.width) * span;
      const i = lines.findIndex(s => s.endTime >= t);
      e.currentTarget.blur();
      onPick(lines[i < 0 ? lines.length - 1 : i].id);
    };
    return (
      <button type="button" onClick={pick} title={title(current)} aria-label={title(current)} className="group relative block w-full h-3">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-line group-hover:h-1.5" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-ink group-hover:h-1.5" style={{ width: `${at(current)}%` }} />
        {current < lines.length && <span className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2 rounded-full bg-accent" style={{ left: `${at(current)}%` }} />}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-[3px] h-3">
      {lines.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={e => { e.currentTarget.blur(); onPick(s.id); }}
          title={title(i)}
          aria-label={title(i)}
          className="group h-full flex items-center min-w-[2px]"
          style={{ flex: `${Math.max(0.3, s.endTime - s.startTime)} 1 0` }}
        >
          <span className={`block w-full rounded-full transition-[height] group-hover:h-2
            ${i === current ? 'h-2 bg-accent' : `h-1 ${i < current ? 'bg-ink' : 'bg-line'}`}
            ${watch?.has(s.id) && i !== current ? 'opacity-40' : ''}`} />
        </button>
      ))}
    </div>
  );
};

export default Timeline;
