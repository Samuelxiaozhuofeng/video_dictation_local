// 给介绍用的 slides/ 补拍设置页：转录、AI。先开 npm run dev（项目根）。
import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('slides-shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN' });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000');
await p.evaluate(() => {
  localStorage.setItem('linguaclip_ai_config', JSON.stringify({ apiKey: 'sk-demo-0000000000000000', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', segmentModel: '', temperature: 0.7, autoBreakdown: true, autoCloze: true }));
  localStorage.setItem('linguaclip_ai_models', JSON.stringify(['deepseek-chat', 'deepseek-reasoner']));
  localStorage.setItem('linguaclip_transcribe_config', JSON.stringify({ mode: 'local', localModel: 'standard', groqKey: '', bailianKey: '' }));
});
await p.reload(); await p.waitForTimeout(800);
const shot = n => p.screenshot({ path: `slides-shots/${n}.png` });
await p.getByRole('button', { name: '设置' }).first().click(); await p.waitForTimeout(500);
await p.getByText('转录', { exact: true }).first().click(); await p.waitForTimeout(400);
await shot('set-transcribe-local');
await p.getByText('Groq', { exact: true }).first().click(); await p.waitForTimeout(400);
await shot('set-transcribe-groq');
await p.getByText('阿里云百炼', { exact: true }).first().click(); await p.waitForTimeout(400);
await shot('set-transcribe-bailian');
await p.getByText('AI', { exact: true }).first().click(); await p.waitForTimeout(500);
await shot('set-ai');
await p.mouse.wheel(0, 700); await p.waitForTimeout(400);
await shot('set-ai-2');
console.log(await p.evaluate(() => document.body.innerText.slice(0, 2500)));
await b.close();
