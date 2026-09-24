/**
 * Checks the per-kind AI request cap in utils/aiLimit.ts.
 * Run with: node test-ailimit.mjs
 *
 * Bundles the real module (stubbing Tauri's fetch) instead of re-typing it.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const setLimits = limits => { store.linguaclip_ai_config = JSON.stringify({ limits }); };

const out = join(tmpdir(), `ailimit-${process.pid}.mjs`);
await build({
  entryPoints: ['utils/aiLimit.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  plugins: [{
    name: 'stub-tauri-http',
    setup(b) {
      b.onResolve({ filter: /^@tauri-apps\/plugin-http$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const fetch = globalThis.fetch;' }));
    },
  }],
});
const { withAiSlot, aiLimit } = await import(out);
const tick = () => new Promise(r => setTimeout(r, 5));

// Defaults, clamping, junk.
setLimits({});
assert.deepEqual([aiLimit('segment'), aiLimit('breakdown'), aiLimit('cloze')], [4, 8, 8]);
setLimits({ segment: 999, breakdown: 0, cloze: 'x' });
assert.deepEqual([aiLimit('segment'), aiLimit('breakdown'), aiLimit('cloze')], [64, 8, 8]);

// Cap holds, kinds are independent, urgent jumps the queue.
setLimits({ segment: 2, cloze: 3 });
let inSeg = 0, peakSeg = 0, inCloze = 0, peakCloze = 0;
const order = [];
const job = (kind, name) => async () => {
  if (kind === 'segment') { inSeg++; peakSeg = Math.max(peakSeg, inSeg); } else { inCloze++; peakCloze = Math.max(peakCloze, inCloze); }
  order.push(name);
  await tick();
  if (kind === 'segment') inSeg--; else inCloze--;
};
let urgent = false;
await Promise.all([
  ...Array.from({ length: 6 }, (_, i) => withAiSlot('segment', job('segment', `s${i}`))),
  ...Array.from({ length: 6 }, (_, i) => withAiSlot('cloze', job('cloze', `bg${i}`))),
  // Queued last, but flagged urgent after queueing (the practice page opened late).
  withAiSlot('cloze', job('cloze', 'studio'), () => urgent),
  (async () => { urgent = true; })(),
]);
assert.equal(peakSeg, 2);
assert.equal(peakCloze, 3);
const clozeOrder = order.filter(n => !/^s\d/.test(n));
assert.equal(clozeOrder.indexOf('studio'), 3, `studio should run as soon as a slot frees: ${clozeOrder}`);

// A failing call frees its slot.
setLimits({ breakdown: 1 });
await assert.rejects(withAiSlot('breakdown', async () => { throw new Error('boom'); }));
assert.equal(await withAiSlot('breakdown', async () => 'ok'), 'ok');

console.log('ailimit: all checks passed');
