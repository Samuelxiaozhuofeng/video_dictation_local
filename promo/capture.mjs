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

// AI 和 Anki 都不打真服务：界面是真的，回答是写死的（按提示词分辨是哪种请求）。
const STOP = new Set(['i', 'a', 'to', 'the', 'and', 'it', 'so', 'do', 'of', 'in', 'on', 'we', 'you', 'is', 'are', 'but', 'that', 'this']);
const listing = block => [...block.matchAll(/^(\d+)\t(.+)$/gm)].map(m => m[2]);
function aiReply(prompt) {
  if (prompt.includes('最值得学')) { // 拆开教我
    const w = listing(prompt).map(x => x.toLowerCase().replace(/[^a-z']/g, ''));
    const span = (phrase, note) => { const ws = phrase.split(' '); const from = w.findIndex((_, i) => ws.every((x, k) => w[i + k] === x)); return from < 0 ? null : { from, to: from + ws.length - 1, note }; };
    const points = [
      span('take the chance to', 'take the chance to do：抓住机会做某事。chance 前面用 the，后面接动词原形。'),
      span('do a brain dump', 'do a brain dump：把脑子里的想法一股脑倒出来，口语里常用来说「随便聊聊、倾诉一下」。'),
      span('overthink a lot', 'overthink a lot：overthink 是「想太多」，a lot 修饰动词，表示「经常、很多」。'),
      span('keeps getting worse', 'keep + doing 表示一直在持续；get worse 是「变糟」，合起来就是「越来越糟」。'),
    ].filter(Boolean);
    return { lang: 'en', points };
  }
  if (prompt.includes('最该练习听写')) { // 挖空：给每句的词按「值得练」排序，只回下标
    const blocks = prompt.split(/第 \d+ 句/).slice(1);
    return { lines: blocks.map(b => listing(b).map((x, i) => [i, x.toLowerCase()])
      .sort((a, c) => (STOP.has(a[1]) - STOP.has(c[1])) || (c[1].length - a[1].length) || (a[0] - c[0])).map(x => x[0])) };
  }
  return { word: 'overthink', partOfSpeech: 'verb 动词', definition: '想太多，过度思考。在这句里是说「我总爱想太多，而且越来越严重」。' };
}
await p.route('**/__proxy', r => {
  const prompt = JSON.parse(r.request().postData() || '{}').messages?.[0]?.content ?? '';
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiReply(prompt)) } }] }) });
});
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

// ---------- 第二句：⌘X 偷看、「…」菜单、挖空三档、拆开教我 ----------
const btn = name => p.getByRole('button', { name });
const box = loc => loc.boundingBox();
const waitInput = () => p.locator('form input').first().waitFor({ timeout: 20000 });
const typeWords = async words => { for (const w of words) { await p.keyboard.type(w, { delay: 25 }); await p.waitForTimeout(260); } };
const escape = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); };

await btn('关闭').first().click();
await p.waitForTimeout(300);
manifest.saveBtn = await box(btn('收藏这句'));
await btn('收藏这句').click();
await btn('下一句').first().click();
await waitInput(); await p.waitForTimeout(400);
await shot('line2-input');
await typeWords(['So', 'I', 'want', 'to']);
await p.keyboard.press('Meta+x');
await p.waitForTimeout(350);
await shot('peek');
manifest.peekInput = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
await btn('收藏这句').click();
await p.waitForTimeout(2200); // 等偷看气泡自己消失

const more = btn('更多').last();
manifest.moreBtn = await box(more);
for (const [level, name] of [['轻松', 'cloze-easy'], ['适中', 'cloze-medium']]) {
  await more.click(); await p.waitForTimeout(350);
  if (level === '轻松') { await shot('menu'); manifest.easyBtn = await box(p.getByRole('radio', { name: '轻松' })); manifest.bdBtn = await box(p.getByText('拆开教我', { exact: true })); }
  await p.getByRole('radio', { name: level }).click(); await p.waitForTimeout(1500);
  await escape(); await waitInput(); await p.waitForTimeout(400);
  await shot(name);
}
await more.click(); await p.waitForTimeout(300); await p.getByRole('radio', { name: '全写' }).click(); await p.waitForTimeout(1200); await escape();
await waitInput(); await p.waitForTimeout(300);

await more.click(); await p.waitForTimeout(300);
await p.getByText('拆开教我', { exact: true }).click();
await p.getByText(/拆开练/).first().waitFor({ timeout: 15000 });
await p.waitForTimeout(600);
const steps = [['take', 'the', 'chance', 'to'], ['do', 'a', 'brain', 'dump'], ['So', 'I', 'want', 'to', 'take', 'the', 'chance', 'to', 'do', 'a', 'brain', 'dump', 'here']];
for (let i = 0; i < steps.length; i++) {
  await p.locator('form input').first().focus();
  await shot(`bd-${i + 1}`);
  await typeWords(steps[i]);
  await p.waitForTimeout(900);
  await shot(`bd-${i + 1}-review`);
  if (i < steps.length - 1) { manifest[`bdNext${i + 1}`] = await box(btn('下一步')); await btn('下一步').click(); await p.waitForTimeout(700); }
}

// ---------- 收藏页、YouTube 链接、模糊模式 ----------
await btn('回到你的视频列表').click(); await p.waitForTimeout(800);
await shot('home-progress');
await p.getByRole('button', { name: '收藏' }).first().click(); await p.waitForTimeout(700);
await shot('saved');
await p.getByRole('button', { name: '视频' }).first().click(); await p.waitForTimeout(600);
await btn('添加视频').first().click(); await p.waitForTimeout(300);
await p.getByPlaceholder('粘贴 YouTube 网址').fill('https://www.youtube.com/watch?v=H0HwFqBG9KE');
await p.waitForTimeout(1200);
await shot('add-youtube');
manifest.startBtnYT = await box(btn('开始生成字幕'));
await escape();
await btn('更多').first().click(); await p.waitForTimeout(300);
await shot('home-menu');
await p.getByText(/换成模糊练/).click();
await p.waitForTimeout(6500); // 放完一句自动停
for (const w of ['want', 'chance', 'brain', 'dump']) {
  const loc = p.getByRole('button', { name: '隐藏的单词' }).nth(0);
  void loc; // 按原文找更稳：模糊块里文字是透明的，但仍在 DOM 里
  await p.locator('button', { hasText: new RegExp(`^${w}`) }).first().click().catch(() => {});
  await p.waitForTimeout(150);
}
await shot('blur');

fs.writeFileSync('shots/manifest.json', JSON.stringify(manifest, null, 1));
console.log('frames', n, 'anki', !!manifest.ankiBtn);
console.log(await p.evaluate(() => document.body.innerText.slice(0, 1500)));
await b.close();
