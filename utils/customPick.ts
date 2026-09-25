// Custom practice: out of one video, the lines worth practising at the learner's
// level, from where the last custom session stopped until the chosen minutes
// are used up. Pure — the AI labels (utils/levelPrep.ts) come in as data.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = typeof LEVELS[number];
// A level, 'x' = not worth practising, null = not labelled (AI failed / not asked).
export type LineLabel = Level | 'x' | null;
export type Others = 'play' | 'skip';
export type PaceMode = 'dictation' | 'step' | 'flow';

export type CustomConfig = { on: boolean; minutes: number; level: Level | null; others: Others };
export const MINUTE_CHOICES = [10, 15, 20, 30];
export const DEFAULT_CUSTOM: CustomConfig = { on: false, minutes: 15, level: null, others: 'play' };

type Line = { startTime: number; endTime: number; text: string };

const isLevel = (v: unknown): v is Level => (LEVELS as readonly unknown[]).includes(v);

export function parseCustomConfig(v: unknown): CustomConfig {
  const c = (v ?? {}) as Partial<CustomConfig>;
  return {
    on: c.on === true,
    minutes: MINUTE_CHOICES.includes(c.minutes as number) ? c.minutes as number : DEFAULT_CUSTOM.minutes,
    level: isLevel(c.level) ? c.level : null,
    others: c.others === 'skip' ? 'skip' : 'play',
  };
}

export const validateLabel = (v: unknown): LineLabel => (v === 'x' || isLevel(v) ? v : null);

// Without the AI: a line is junk when, sound tags and ♪ aside, it is a single
// word ("Yeah.", "Mike!") — or under three letters in Japanese / Chinese.
export function worthByRule(text: string): boolean {
  const bare = text.replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）|【[^】]*】|[♪♫]/g, ' ').trim();
  if (/[぀-ヿ一-鿿]/.test(bare)) return (bare.match(/\p{L}/gu) ?? []).length >= 3;
  return bare.split(/\s+/).filter(w => /\p{L}/u.test(w)).length >= 2;
}

// ponytail: rough seconds per practised line from its length alone (listen, type,
// check); good enough to size a session, tune if sessions run long or short.
export function lineCost(duration: number, pace: PaceMode): number {
  if (pace === 'flow') return duration;
  if (pace === 'step') return duration * 1.5 + 2;
  return duration * 3 + 4;
}

export type CustomPick = { lines: number[]; practise: number[] };

// lines: every line index the session plays, in order; practise: the ones the
// learner works on (the rest are only watched, and only when others = 'play').
// A level takes that level and the one above it. Unlabelled lines fall back to
// the rule, so a failed AI batch never silently drops lines.
export function pickCustom(
  subs: Line[], labels: LineLabel[] | null, cfg: Pick<CustomConfig, 'minutes' | 'level' | 'others'>,
  fromSec: number, pace: PaceMode,
): CustomPick | null {
  const band = cfg.level ? LEVELS.slice(LEVELS.indexOf(cfg.level), LEVELS.indexOf(cfg.level) + 2) as readonly string[] : null;
  const wanted = (i: number): boolean => {
    const label = labels?.[i] ?? null;
    if (label === 'x') return false;
    if (label && band) return band.includes(label);
    return worthByRule(subs[i].text);
  };
  const budget = cfg.minutes * 60;
  const run = (from: number): CustomPick | null => {
    const lines: number[] = [];
    const practise: number[] = [];
    let spent = 0;
    for (let i = from; i < subs.length && spent < budget; i++) {
      const s = subs[i];
      if (wanted(i)) {
        lines.push(i);
        practise.push(i);
        spent += lineCost(s.endTime - s.startTime, pace);
      } else if (cfg.others === 'play') {
        lines.push(i);
        spent += (subs[i + 1]?.startTime ?? s.endTime) - s.startTime;
      }
    }
    // Nothing to watch after the last line worked on.
    const last = practise[practise.length - 1];
    return practise.length ? { lines: lines.filter(i => i <= last), practise } : null;
  };
  const start = subs.findIndex(s => s.startTime >= fromSec);
  if (start <= 0) return run(0);
  return run(start) ?? run(0);
}
