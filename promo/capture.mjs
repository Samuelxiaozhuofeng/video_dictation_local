// 在浏览器 dev（npm run dev，localhost:3000）里把真 App 操作一遍，逐状态截图到 shots/。
// 视频画面不靠截图：记下 <video> 的位置写进 shots/manifest.json，成片里另放一个 <video> 按时间 seek。
import { chromium } from 'playwright';
import fs from 'fs';

const CLIP = `${process.cwd()}/media/I'm Tired of Pretending`;
const SENTENCE = ['I', 'overthink', 'a', 'lot', 'and', 'it', 'keep', 'getting', 'worse']; // 故意把 keeps 打成 keep
const W = 1440, H = 900;

fs.rmSync('shots', { recursive: true, force: true });
fs.mkdirSync('shots');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'zh-CN' });
p.on('pageerror', e => console.log('PAGEERR', e.message));

// AI 查词和 Anki 都不打真服务：界面是真的，回答是写死的。
await p.route('**/__proxy', r => r.fulfill({
  contentType: 'application/json',
  body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    word: 'overthink', partOfSpeech: 'verb 动词',
    definition: '想太多，过度思考。在这句里是说「我总爱想太多，而且越来越严重」。',
  }) } }] }),
}));
await p.route('**/127.0.0.1:8765/**', r => {
  const { action } = JSON.parse(r.request().postData() || '{}');
  const result = action === 'deckNames' ? ['English'] : action === 'modelNames' ? ['Basic'] : action === 'addNote' ? 1 : action === 'version' ? 6 : [];
  return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ result, error: null }) });
});

const shot = name => p.screenshot({ path: `shots/${name}.png` });
const manifest = { viewport: [W, H], typing: [] };

await p.goto('http://localhost:3000');
await p.evaluate(() => { localStorage.setItem('linguaclip_ai_config', JSON.stringify({ apiKey: 'demo', model: 'demo' }));
  localStorage.setItem('linguaclip_anki_config', JSON.stringify({ url: 'http://127.0.0.1:8765',
    wordCard: { deckName: 'English', modelName: 'Basic', fieldMapping: { Front: 'word', Back: 'definition' } }, audioCard: null }));
});
await p.reload();
await p.waitForTimeout(800);
await shot('home-empty');
manifest.addBtn = await p.getByRole('button', { name: '添加视频' }).first().boundingBox();

// 添加视频
await p.getByRole('button', { name: '添加视频' }).first().click();
await p.waitForTimeout(400);
await shot('add-empty');
await p.evaluate(c => { window.__MOCK__.pick = c + '.mp4'; }, CLIP);
manifest.pickBtn = await p.getByRole('button', { name: '选择本机视频' }).boundingBox();
await p.getByRole('button', { name: '选择本机视频' }).click();
await p.waitForTimeout(300);
await shot('add-picked');
manifest.startBtn = await p.getByRole('button', { name: '开始生成字幕' }).boundingBox();
await p.getByRole('button', { name: '开始生成字幕' }).click();
await p.waitForTimeout(500);
const id = await p.evaluate(() => window.__MOCK__.calls.find(x => x.cmd === 'start_import').args.id);
const emit = payload => p.evaluate(pl => window.__MOCK__.emit('import-progress', pl), { id, ...payload });
for (const percent of [20, 55, 90]) {
  await emit({ stage: 'transcribe', percent });
  await p.waitForTimeout(300);
  await shot(`import-${percent}`);
}
await emit({ stage: 'done', videoPath: CLIP + '.mp4', subtitleText: fs.readFileSync(CLIP + '.srt', 'utf8') });
await p.waitForTimeout(2500);
await shot('home-ready');
manifest.continueBtn = await p.getByRole('button', { name: '继续听写' }).boundingBox();

// 练习页：视频停在一帧，成片里用真视频盖住这块
await p.getByRole('button', { name: '继续听写' }).click();
await p.waitForTimeout(700);
await shot('listening'); // 这句正在播，还没到打字
await p.locator('form input').first().waitFor({ timeout: 20000 }); // 这句放完才进入打字
await p.evaluate(() => { const v = document.querySelector('video'); v.pause(); v.currentTime = 3; });
await p.waitForTimeout(500);
manifest.video = await p.locator('video').boundingBox();
await p.locator('form input').first().focus();
await p.waitForTimeout(200);
await shot('type-000');

// 逐键截图：打对的词 App 会自己跳到下一格，打错的词按空格跳
let n = 0;
const typed = async () => { n++; await shot(`type-${String(n).padStart(3, '0')}`); };
for (let w = 0; w < SENTENCE.length; w++) {
  const word = SENTENCE[w];
  for (const ch of word) {
    await p.keyboard.type(ch);
    await p.waitForTimeout(40);
    await typed();
    manifest.typing.push({ frame: n, char: ch });
  }
  await p.waitForTimeout(250); // 等自动跳格
  if (word === 'keep') { await p.keyboard.press('Space'); await p.waitForTimeout(150); }
  await typed();
  manifest.typing.push({ frame: n, char: ' ' });
}
const caret = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
manifest.lastInput = caret;
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
await shot('feedback');
manifest.wrongWord = await p.locator('span.underline').first().boundingBox();

// 点生词 → AI 查词 → 加进 Anki
const word = p.getByRole('button', { name: 'overthink' });
manifest.wordBtn = await word.boundingBox();
await word.click();
await p.waitForTimeout(1200);
await shot('lookup');
const ankiBtn = p.getByRole('button', { name: /仅单词|单词/ }).first();
manifest.ankiBtn = await ankiBtn.boundingBox().catch(() => null);
if (manifest.ankiBtn) { await ankiBtn.click(); await p.waitForTimeout(1200); await shot('anki-added'); }

fs.writeFileSync('shots/manifest.json', JSON.stringify(manifest, null, 1));
console.log('frames', n, 'anki', !!manifest.ankiBtn);
console.log(await p.evaluate(() => document.body.innerText.slice(0, 1500)));
await b.close();
