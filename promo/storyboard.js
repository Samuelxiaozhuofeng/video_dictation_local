// 分镜：几秒出现什么。index.html 只按这里的数据画；音效时间点也从这里出（EVENTS）。
// 坐标都是 App 窗口坐标（1440×900），按钮位置来自 capture.mjs 记下的 shots/manifest.json。
/* global M */
const SB = { screens: [], cur: [], curOn: [], clicks: [], cam: [], caps: [], cards: [], rings: [], wins: [], events: [] };
const ev = (t, type) => SB.events.push({ t: +t.toFixed(4), type });
const at = (t, name, fade = 0) => SB.screens.push([t, name, fade]);
const cam = (t, s, x, y) => SB.cam.push([t, s, x, y]);
const cap = (a, b, html) => SB.caps.push([a, b, html]);
const card = (a, b, id) => { SB.cards.push([a, b, id]); ev(a - .05, 'whoosh'); };
const win = (a, b) => { SB.wins.push([a, b]); ev(a - .05, 'whoosh'); };
const ring = (a, b, box) => SB.rings.push([a, b, box]);
const mid = b => [b.x + b.width / 2, b.y + b.height / 2];
SB.cur.push([0, 1100, 760]);
const move = (t0, t1, box) => SB.cur.push([t0, ...SB.cur.at(-1).slice(1)], [t1, ...mid(box)]);
const click = t => { SB.clicks.push(t); ev(t, 'click'); };
const keys = (t0, n, step = .07) => { for (let i = 0; i < n; i++) ev(t0 + i * step, 'key'); };

// ---- 0 片头：打出 LinguaClip ----
const TITLE = 'LinguaClip', TITLE_T0 = .4, TITLE_STEP = .1;
keys(TITLE_T0, TITLE.length, TITLE_STEP);
SB.cards.push([0, 2.9, 'title']);
// ---- 钩子 ----
card(2.9, 6.1, 'hook');
// ---- 产品介绍 ----
card(6.1, 10.1, 'intro');
[1.2, 1.45, 1.7, 1.95].forEach(d => ev(6.1 + d, 'pop'));

// ---- 添加视频 ----
win(10.1, 15.7);
at(10.1, 'home-empty'); cam(10.1, .95, 720, 420); SB.curOn.push([10.35, 15.4]);
move(10.4, 10.9, M.addBtn); click(11.0); at(11.05, 'add-empty', .18); cam(11.0, .95, 720, 420); cam(11.5, 1.45, 720, 450);
move(11.2, 11.55, M.pickBtn); click(11.62); at(11.67, 'add-picked');
at(12.3, 'add-youtube', .25); ev(12.3, 'pop');
move(12.6, 13.05, M.startBtnYT); click(13.15);
at(13.25, 'import-20', .15); at(13.75, 'import-55', .12); at(14.25, 'import-90', .12); at(14.8, 'home-ready', .25); ev(14.8, 'ding');
cam(13.3, 1.45, 720, 450); cam(13.8, 1.6, 720, 230);
cap(10.3, 12.95, '本机视频、<span class="hl">YouTube 链接</span>都能加');
cap(13.1, 15.5, '本机转录，<span class="hl">字幕自动生成</span>');

// ---- AI 断句 / 为什么听写 ----
card(15.7, 20.2, 'seg');
[1.3, 1.6].forEach(d => ev(15.7 + d, 'snip'));
card(20.2, 23.4, 'why');

// ---- 听写第一句 ----
win(23.4, 55.4);
at(23.4, 'home-ready'); cam(23.4, 1.6, 720, 230); SB.curOn.push([23.5, 24.4]);
move(23.6, 24.05, M.continueBtn); click(24.15);
const PRACTICE = 24.3, CLIP_T0 = 2.6, CLIP_STOP = 5.25; // 视频从 2.6s 播到这句说完
at(PRACTICE, 'listening', .3); ev(PRACTICE, 'speech'); cam(PRACTICE, 1.6, 720, 230); cam(PRACTICE + .6, .95, 720, 430);
at(PRACTICE + 2.6, 'type-000', .15); cam(PRACTICE + 2.6, .95, 720, 430); cam(PRACTICE + 3.3, 1.7, 1000, 290);
let tt = PRACTICE + 3.4;
M.typing.forEach(({ frame, char }, i) => {
  tt += char === ' ' ? .16 : .06 + .04 * Math.abs(Math.sin(i * 12.9898)); // 伪随机节奏，每次一样
  at(tt, 'type-' + String(frame).padStart(3, '0')); ev(tt, char === ' ' ? 'space' : 'key');
});
const ENTER = tt + .4;
at(ENTER, 'feedback', .12); ev(ENTER, 'enter');
cam(ENTER + .4, 1.7, 1000, 290); cam(ENTER + 1, 1.95, 1060, 285);
ring(ENTER + .4, ENTER + 2.3, M.wrongWord);
cap(PRACTICE - .1, ENTER - .15, '先听一句，再<span class="hl">一个词一个词</span>打出来');
cap(ENTER + .1, ENTER + 2.5, '对答案：只标出你<span class="hl">听错的词</span>');

// ---- 偷看 ----
const PEEK = ENTER + 2.7;
at(PEEK, 'line2-input', .25); cam(PEEK, 1.95, 1060, 285); cam(PEEK + .4, 1.75, 1040, 300);
at(PEEK + .8, 'peek', .1); ev(PEEK + .75, 'key'); ev(PEEK + .8, 'pop');
cap(PEEK + .1, PEEK + 2.1, '卡住了？按 <span class="hl">⌘X</span> 偷看一个词');

// ---- AI 挖空 ----
const CLOZE = PEEK + 2.3;
at(CLOZE, 'menu', .2); cam(CLOZE, 1.75, 1040, 300); cam(CLOZE + .4, 1.3, 1000, 520); SB.curOn.push([CLOZE + .1, CLOZE + 1.3]);
move(CLOZE + .2, CLOZE + .75, M.easyBtn); click(CLOZE + .85);
at(CLOZE + .95, 'cloze-easy', .2); cam(CLOZE + 1, 1.3, 1000, 520); cam(CLOZE + 1.5, 1.75, 1040, 290);
at(CLOZE + 2.3, 'cloze-medium', .25); ev(CLOZE + 2.3, 'pop');
cap(CLOZE, CLOZE + 3.2, 'AI 挑出最该练的词挖空：<span class="hl">轻松 · 适中 · 全写</span>');

// ---- 拆开教我 ----
const BD = CLOZE + 3.4;
at(BD, 'menu', .2); cam(BD, 1.75, 1040, 290); cam(BD + .4, 1.3, 1000, 520); SB.curOn.push([BD + .1, BD + 1.1]);
move(BD + .2, BD + .7, M.bdBtn); click(BD + .8);
at(BD + .9, 'bd-1', .2); cam(BD + .9, 1.3, 1000, 520); cam(BD + 1.4, 1.7, 1080, 330);
keys(BD + 1.3, 8, .06); at(BD + 1.9, 'bd-1-review', .15); ev(BD + 1.9, 'ding');
keys(BD + 2.9, 7, .06); at(BD + 3.4, 'bd-2-review', .2);
keys(BD + 4.4, 12, .05); at(BD + 5.0, 'bd-3-review', .2); cam(BD + 5, 1.7, 1080, 330); cam(BD + 5.6, 1.85, 1120, 440);
cap(BD, BD + 3.1, '<span class="hl">拆开教我</span>：AI 挑出这句里的搭配和语法');
cap(BD + 3.2, BD + 6.5, '先用标准发音一块块练，再听<span class="hl">原声</span>打整句');

// ---- 查词 + Anki ----
const LOOK = BD + 6.7;
at(LOOK, 'feedback', .25); cam(LOOK, 1.4, 1030, 330); SB.curOn.push([LOOK + .1, LOOK + 2.6]);
move(LOOK + .1, LOOK + .55, M.wordBtn); click(LOOK + .65); at(LOOK + .75, 'lookup', .22);
move(LOOK + 1.25, LOOK + 1.75, M.ankiBtn); click(LOOK + 1.85); at(LOOK + 1.9, 'anki-added', .1); ev(LOOK + 1.9, 'ding');
cam(LOOK + 2.6, 1.4, 1030, 330);
cap(LOOK, LOOK + 3.1, '生词点一下，<span class="hl">AI 按语境讲</span>，一键进 Anki');

// ---- 模糊模式 / 收藏 ----
const BLUR = LOOK + 3.3;
at(BLUR, 'blur', .25); cam(BLUR + .3, 1.6, 1000, 330);
cap(BLUR, BLUR + 2.1, '<span class="hl">模糊模式</span>：遮住字幕，边听边跟读');
const SAVED = BLUR + 2.3;
at(SAVED, 'saved', .25); cam(SAVED, 1.6, 1000, 330); cam(SAVED + .5, 1.6, 720, 260);
cap(SAVED, SAVED + 1.9, '喜欢的句子<span class="hl">收藏</span>起来，随时回看');

// ---- 片尾 ----
const OUTRO = SAVED + 2.2;
SB.cards.push([OUTRO, 99, 'outro']); ev(OUTRO - .1, 'whoosh'); ev(OUTRO + .2, 'chime');
for (let i = 0; i < 8; i++) ev(OUTRO + 1.2 + i * .12, 'pop');
const DURATION = +(OUTRO + 5.4).toFixed(2);
const FPS = 60;
// 这些时间点 index.html 要用
Object.assign(SB, { TITLE, TITLE_T0, TITLE_STEP, PRACTICE, CLIP_T0, CLIP_STOP, OUTRO, DURATION, FPS });
