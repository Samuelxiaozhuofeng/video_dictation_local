// 配乐和音效全用代码算：读 out/events.json（index.html 的时间轴）→ out/music.wav。
// 分层进场：片头只有铺底和弦 → 钩子加琶音 → 进 App 加贝斯和底鼓 → 练习加踩镲 → 片尾一个长和弦收。
import fs from 'fs';

const SR = 44100;
const { DURATION, EVENTS } = JSON.parse(fs.readFileSync('out/events.json', 'utf8'));
const N = Math.ceil(SR * DURATION);
const L = new Float32Array(N), R = new Float32Array(N);
const at = t => Math.round(t * SR);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1; // 固定种子：每次一样
const hz = m => 440 * 2 ** ((m - 69) / 12);
const put = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };

// 每个声部先各自渲染到自己的轨上，最后混
function voice(t0, dur, fn, gain, pan = 0, buf = null) {
  const s = at(t0), n = at(dur);
  for (let k = 0; k < n; k++) { const v = fn(k / SR) * gain; buf ? (buf[s + k] += v) : put(s + k, v, pan); }
}

// ---------- 音乐 ----------
const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
// Fmaj7 → G6 → Em7 → Am7，每个和弦两小节
const CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]];
const chordAt = t => CHORDS[Math.floor(t / (BAR * 2)) % 4];
const END = DURATION - 5.2; // 片尾长和弦开始
const music = new Float32Array(N);

// 铺底：每个和弦两小节，慢起慢收
for (let c = 0; c * BAR * 2 < END; c++) {
  const t0 = c * BAR * 2, dur = Math.min(BAR * 2 + 0.6, END + 0.8 - t0);
  for (const m of chordAt(t0)) voice(t0, dur, t => {
    const env = Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.6);
    const f = hz(m + 12);
    return env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 1.003 * t + 1) + 0.15 * Math.sin(4 * Math.PI * f * t));
  }, 0.028, 0, music);
}
// 琶音：8 分音符拨弦，3.2s 起
for (let t = 3.2; t < END; t += BEAT / 2) {
  const step = Math.round(t / (BEAT / 2)), ch = chordAt(t);
  const m = ch[[0, 2, 1, 3, 2, 1, 3, 2][step % 8]] + 24;
  voice(t, 0.5, x => Math.exp(-x * 9) * (Math.sin(2 * Math.PI * hz(m) * x) + 0.25 * Math.sin(4 * Math.PI * hz(m) * x)), 0.06, 0, music);
}
// 贝斯 + 底鼓：进 App 后
for (let b = Math.ceil(6.6 / BEAT); b * BEAT < END; b++) {
  const t = b * BEAT;
  if (b % 2 === 0) voice(t, 0.35, x => Math.exp(-x * 14) * Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-x * 30)) * x), 0.5, 0, music);
  if (b % 2 === 0) voice(t, BEAT * 1.8, x => Math.min(1, x / .01) * Math.exp(-x * 1.5) * Math.sin(2 * Math.PI * hz(chordAt(t)[0] - 12) * x), 0.16, 0, music);
}
// 踩镲 + 轻拍手：练习段起
const PRACTICE = EVENTS.find(e => e.type === 'speech')?.t ?? 13;
for (let t = Math.ceil(PRACTICE / (BEAT / 2)) * BEAT / 2; t < END; t += BEAT / 2) {
  let hp = 0;
  voice(t, 0.05, x => { const n = rnd(); const v = n - hp; hp = n; return v * Math.exp(-x * 90); }, 0.05, .2, music);
  const beat = Math.round(t / BEAT);
  if (Math.abs(t / BEAT - beat) < 1e-6 && beat % 2 === 1 && t > PRACTICE + 3) voice(t, 0.15, x => rnd() * Math.exp(-x * 30), 0.07, -.1, music);
}
// 片尾长和弦
for (const m of [...CHORDS[0], 72]) voice(END, 5.2, t => Math.min(1, t / .05) * Math.exp(-t * .7) * Math.sin(2 * Math.PI * hz(m + 12) * t), 0.08, 0, music);

// 人声那一段把音乐压低
const speech = EVENTS.find(e => e.type === 'speech')?.t ?? -99;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const duck = t > speech - .2 && t < speech + 3.2 ? 0.35 : 1;
  const fade = Math.min(1, t / 0.4) * Math.min(1, (DURATION - t) / 1.2);
  L[i] += music[i] * duck * fade; R[i] += music[i] * duck * fade;
}

// ---------- 音效 ----------
const SFX = {
  key: t => voice(t, 0.04, x => (rnd() * .7 + Math.sin(2 * Math.PI * 180 * x) * .5) * Math.exp(-x * 160), 0.2, rnd() * .3),
  space: t => voice(t, 0.06, x => (rnd() * .5 + Math.sin(2 * Math.PI * 110 * x)) * Math.exp(-x * 90), 0.2),
  click: t => { for (const d of [0, .045]) voice(t + d, 0.02, x => rnd() * Math.exp(-x * 400), d ? .12 : .22); },
  enter: t => { SFX.space(t); voice(t + .02, .9, x => Math.exp(-x * 5) * Math.sin(2 * Math.PI * hz(84) * x), .08); },
  ding: t => [88, 95].forEach((m, i) => voice(t + i * .07, 1.2, x => Math.exp(-x * 4) * Math.sin(2 * Math.PI * hz(m) * x), .07)),
  chime: t => [72, 76, 79, 84, 88].forEach((m, i) => voice(t + i * .09, 2.5, x => Math.exp(-x * 1.6) * Math.sin(2 * Math.PI * hz(m) * x), .05, (i - 2) * .15)),
  pop: t => voice(t, .12, x => Math.exp(-x * 40) * Math.sin(2 * Math.PI * (900 - 2500 * x) * x), .12),
  snip: t => { for (const d of [0, .06]) voice(t + d, .05, x => (rnd() * .6 + Math.sin(2 * Math.PI * 2400 * x)) * Math.exp(-x * 120), .14); },
  whoosh: t => { // 带通噪声，音量和亮度先升后降，峰值落在切换那一刻
    let lp = 0; const d = .7;
    voice(t - .45, d, x => { const k = x / d, env = Math.sin(Math.PI * k) ** 2, a = .02 + .25 * env; lp += a * (rnd() - lp); return lp * env; }, 0.9);
  },
  speech: t => { // 样片原声：这句「I overthink a lot and it keeps getting worse.」
    const buf = fs.readFileSync('media/speech.wav'), di = buf.indexOf('data') + 8;
    for (let k = 0; di + k * 2 + 1 < buf.length; k++) put(at(t) + k, buf.readInt16LE(di + k * 2) / 32768 * 0.9);
  },
};
for (const e of EVENTS) SFX[e.type]?.(e.t);

// ---------- 写 WAV ----------
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak, out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
fs.writeFileSync('out/music.wav', out);
console.log(`out/music.wav  ${DURATION}s  峰值归一 ×${g.toFixed(2)}  音效 ${EVENTS.length} 个`);
