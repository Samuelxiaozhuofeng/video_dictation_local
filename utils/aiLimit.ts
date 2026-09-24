import { getAIConfig } from './aiConfig';

// How many AI calls each background job may have in flight, set in Settings →
// AI. Each kind has its own cap, shared by every video. A one-off call the user
// clicks and waits on (breakdown on click, AI lookup) never goes through here.

export type AiKind = 'segment' | 'breakdown' | 'cloze';
export const LIMIT_DEFAULTS: Record<AiKind, number> = { segment: 4, breakdown: 8, cloze: 8 };
export const LIMIT_MAX = 64;

export function aiLimit(kind: AiKind): number {
  const n = Math.round(Number(getAIConfig().limits?.[kind]));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, LIMIT_MAX) : LIMIT_DEFAULTS[kind];
}

type Waiter = { urgent: () => boolean; start: () => void };
const active: Record<AiKind, number> = { segment: 0, breakdown: 0, cloze: 0 };
const queues: Record<AiKind, Waiter[]> = { segment: [], breakdown: [], cloze: [] };

// Urgency is read when a slot frees, so a job the user opened after it was
// queued (cloze on the practice page) still jumps ahead of the shelf's.
function pump(kind: AiKind): void {
  const q = queues[kind];
  while (active[kind] < aiLimit(kind) && q.length) {
    const i = Math.max(0, q.findIndex(w => w.urgent()));
    active[kind]++;
    q.splice(i, 1)[0].start();
  }
}

// Runs fn once a slot is free. Deadlines start inside fn, so queueing time
// never counts against a request's timeout.
export async function withAiSlot<T>(kind: AiKind, fn: () => Promise<T>, urgent: () => boolean = () => false): Promise<T> {
  await new Promise<void>(start => { queues[kind].push({ urgent, start }); pump(kind); });
  try {
    return await fn();
  } finally {
    active[kind]--;
    pump(kind);
  }
}
