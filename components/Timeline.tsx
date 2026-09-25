import React from 'react';
import { Subtitle } from '../types';

// The part's lines as one strip, each as wide as it is long: done lines ink, the
// current one accent and taller, the rest hairline. Click a line to go to it.
const Timeline: React.FC<{ lines: Subtitle[]; current: number; watch?: Set<number> | null; onPick: (id: number) => void; title: (i: number) => string }> = ({ lines, current, watch, onPick, title }) => (
  <div className="flex items-center gap-[3px] h-3">
    {lines.map((s, i) => (
      <button
        key={s.id}
        type="button"
        onClick={e => { e.currentTarget.blur(); onPick(s.id); }}
        title={title(i)}
        aria-label={title(i)}
        className="group h-full flex items-center min-w-[3px]"
        style={{ flex: `${Math.max(0.3, s.endTime - s.startTime)} 1 0` }}
      >
        <span className={`block w-full rounded-full transition-[height] group-hover:h-2
          ${i === current ? 'h-2 bg-accent' : `h-1 ${i < current ? 'bg-ink' : 'bg-line'}`}
          ${watch?.has(s.id) && i !== current ? 'opacity-40' : ''}`} />
      </button>
    ))}
  </div>
);

export default Timeline;
