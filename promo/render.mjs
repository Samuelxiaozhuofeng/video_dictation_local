// 逐帧渲染：6 个无头浏览器各截一段，seek(t) → 2 倍截图 → ffmpeg 缩到 1080p 出 MP4。
//   node render.mjs            整片 → out/silent.mp4 + out/events.json
//   node render.mjs 3.5 14 22  只截这几个时间点 → out/still-*.png（检查画面用）
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve('..'); // 项目根：index.html 要引 ../node_modules 里的字体
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/promo/index.html`;

const browser = await chromium.launch();
async function openPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(URL_);
  await p.evaluate(() => window.ready);
  return p;
}
fs.mkdirSync('out', { recursive: true });

const first = await openPage();
const { FPS, DURATION, EVENTS } = await first.evaluate(() => ({ FPS, DURATION, EVENTS }));
fs.writeFileSync('out/events.json', JSON.stringify({ DURATION, EVENTS }, null, 1));
const stills = process.argv.slice(2).map(Number);
if (stills.length) {
  const p = first;
  for (const t of stills) { await p.evaluate(t => seek(t), t); await p.screenshot({ path: `out/still-${t}.png`, scale: 'css' }); }
} else {
  await first.close();
  const total = Math.round(FPS * DURATION), WORKERS = 6, per = Math.ceil(total / WORKERS);
  fs.rmSync('frames', { recursive: true, force: true }); fs.mkdirSync('frames');
  const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const p = await openPage();
    for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
      await p.evaluate(t => seek(t), f / FPS);
      await p.screenshot({ path: `frames/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 95 });
      if (f % 300 === 0) console.log(`frame ${f}/${total}`);
    }
  }));
  console.log(`截图 ${total} 帧，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', 'frames/%05d.jpg',
    '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', 'out/silent.mp4'], { stdio: 'inherit' });
  console.log('out/silent.mp4');
}
await browser.close();
server.close();
