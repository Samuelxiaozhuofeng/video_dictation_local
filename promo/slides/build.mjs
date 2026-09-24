// 把 deck.html + deck.js + img/ 打成一个自带所有图片和声音的 HTML：out/LinguaClip介绍.html
import fs from 'fs';
import { fileURLToPath } from 'url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const mime = { jpg: 'image/jpeg', mp3: 'audio/mpeg' };
const assets = Object.fromEntries(fs.readdirSync(dir + 'img').map(f =>
  [`img/${f}`, `data:${mime[f.split('.').pop()]};base64,${fs.readFileSync(dir + 'img/' + f).toString('base64')}`]));
let html = fs.readFileSync(dir + 'deck.html', 'utf8');
html = html.replace(/src="(img\/[^"]+)"/g, (_, p) => `src="${assets[p]}"`);
const js = fs.readFileSync(dir + 'deck.js', 'utf8');
html = html.replace('<script src="deck.js"></script>', () => `<script>window.ASSETS = ${JSON.stringify(assets)};\n${js}</script>`);
fs.mkdirSync(dir + '../out', { recursive: true });
const out = dir + '../out/LinguaClip介绍.html';
fs.writeFileSync(out, html);
console.log(out, (html.length / 1e6).toFixed(2) + 'MB');
