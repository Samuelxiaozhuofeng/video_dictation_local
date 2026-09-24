// LinguaClip 介绍页的交互：翻页 + 每页的小演示。图片 / 音频路径写成 img/xxx，build.mjs 打包时换成内嵌数据。
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const asset = p => window.ASSETS?.[p] ?? p; // 打包后是内嵌数据，开发时直接读文件
const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox';

// ---------- 翻页 ----------
const slides = $$('.slide');
const dots = $('#dots');
let cur = 0;
slides.forEach((_, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', `第 ${i + 1} 页`); b.onclick = () => go(i); dots.append(b); });
function go(i) {
  cur = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => { s.classList.toggle('active', k === cur); s.classList.toggle('past', k < cur); });
  $$('button', dots).forEach((d, k) => d.classList.toggle('on', k === cur));
  $('#count').textContent = `${cur + 1} / ${slides.length}`;
  history.replaceState(null, '', `#${cur + 1}`);
  document.activeElement?.blur?.();
}
$('#prev').onclick = () => go(cur - 1);
$('#next').onclick = () => go(cur + 1);
document.addEventListener('keydown', e => {
  if (typing()) return;
  if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(cur + 1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(slides.length - 1);
  else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  }
});
go((parseInt(location.hash.slice(1), 10) || 1) - 1);

// 分段按钮：点哪个亮哪个，回调里换内容
function seg(el, onPick) {
  const pick = k => { $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.k === k)); onPick(k); };
  $$('button', el).forEach(b => (b.onclick = () => pick(b.dataset.k)));
  pick($('button', el).dataset.k);
}

// ---------- 两条路 ----------
$$('#paths .card').forEach(c => (c.onclick = () => c.classList.toggle('pick')));

// ---------- 配置转录 ----------
const TR = {
  local: '在你的电脑上转录，<b>不需要转录 key</b>。第一次生成字幕时自动下载转录模型（标准约 580MB 最准，轻量约 190MB 更快），只下这一次，之后断网也能用。',
  groq: '声音上传到 Groq 转录，不用下载模型，电脑慢也很快。去 Groq 免费拿一个密钥粘贴进来，免费账号每天约能转 8 小时声音。国内可能需要翻墙。',
  bailian: '声音上传到阿里云百炼转录，<b>国内直连不用翻墙</b>，也不用下载模型。用阿里云账号在百炼创建一个 API Key 粘贴进来，按音频时长计费。',
};
seg($('#trSeg'), k => { $('#trText').innerHTML = TR[k]; $('#trImg').src = asset(`img/tr-${k}.jpg`); });

// ---------- 配置 AI：鼠标移到哪条，截图上框出哪块 ----------
const marks = $$('#aiFrame .mark');
$$('#aiSteps li').forEach(li => {
  const on = v => { li.classList.toggle('on', v); marks[li.dataset.m].classList.toggle('on', v); };
  li.onmouseenter = () => on(true);
  li.onmouseleave = () => on(false);
  li.onclick = () => { const was = li.classList.contains('on'); $$('#aiSteps li').forEach(x => { x.classList.remove('on'); marks[x.dataset.m].classList.remove('on'); }); on(!was); };
});

// ---------- 自动断句演示 ----------
const SEG_LINES = [
  "I'm just exhausted by all the noise in the tech industry,",
  'been doom scrolling on Reddit and trying to avoid looking at LinkedIn.',
  "Let's start with the work culture.",
  "Most work advocate the idea that we are a family and we all know it's not real.",
];
$('#segBtn').onclick = () => {
  $('#segOut').innerHTML = SEG_LINES.map((l, i) => `<div style="animation-delay:${i * 0.35}s"><span>第 ${i + 1} 句</span>${l}</div>`).join('');
  $('#rawText').style.opacity = 0.45;
  $('#segBtn').disabled = true;
};
$('#segReset').onclick = () => { $('#segOut').innerHTML = ''; $('#rawText').style.opacity = 1; $('#segBtn').disabled = false; };

// ---------- 等待流水线演示 ----------
const PLAN = [ // [阶段, 开始秒, 结束秒]
  [0, 0, 2.4], [1, 2.4, 3.4], [2, 3.4, 5.6], [3, 3.6, 5.2],
];
let pipeTimer = 0;
$('#pipeBtn').onclick = () => {
  cancelAnimationFrame(pipeTimer);
  const stages = $$('#pipe .stage');
  const t0 = performance.now();
  $('#ready').textContent = '';
  const tick = now => {
    const t = (now - t0) / 1000;
    for (const [i, a, b] of PLAN) {
      const p = Math.max(0, Math.min(1, (t - a) / (b - a)));
      const s = stages[i];
      s.classList.toggle('run', p > 0 && p < 1);
      s.classList.toggle('done', p >= 1);
      $('.fill', s).style.width = `${p * 100}%`;
      $('.pct', s).textContent = p >= 1 ? '完成' : p > 0 ? `${Math.round(p * 100)}%` : '';
    }
    if (t >= 3.4) $('#ready').textContent = t >= 5.6 ? '✓ 全部备好，点「继续听写」开练' : '✓ 字幕好了，已经能点进去练；拆句、挖空在后台接着做';
    if (t < 5.7) pipeTimer = requestAnimationFrame(tick);
  };
  pipeTimer = requestAnimationFrame(tick);
};

// ---------- 听写小练习（第 8 页整句、第 9 页各模式共用） ----------
const LINE1 = { audio: 'img/line1.mp3', text: 'I overthink a lot and it keeps getting worse.' };
const LINE2 = { audio: 'img/line2.mp3', text: 'So I want to take the chance to do a brain dump here.' };
const bare = w => w.toLowerCase().replace(/[^a-z']/g, '');

function dictation(box, line, blanks) { // blanks: 要打的词序号；'blur' = 模糊模式
  const words = line.text.split(' ');
  const wrap = $('[data-words]', box), msg = $('[data-msg]', box);
  const audio = new Audio(asset(line.audio));
  $('[data-play]', box).onclick = () => { audio.currentTime = 0; audio.play(); $('input', wrap)?.focus(); };
  wrap.innerHTML = ''; msg.textContent = '';
  if (blanks === 'blur') {
    words.forEach(w => { const s = document.createElement('span'); s.className = 'given blur'; s.textContent = w; s.onclick = () => s.classList.toggle('show'); wrap.append(s); });
    msg.textContent = '点模糊的词，单独揭开核对。';
    return;
  }
  const inputs = [];
  words.forEach((w, i) => {
    if (!blanks.includes(i)) { const s = document.createElement('span'); s.className = 'given'; s.textContent = w; wrap.append(s); return; }
    const inp = document.createElement('input');
    inp.style.width = `${Math.max(2, bare(w).length) * 0.52 + 0.3}em`;
    inp.dataset.answer = w;
    inp.autocomplete = 'off'; inp.spellcheck = false;
    const trail = w.match(/[^A-Za-z']+$/)?.[0];
    const cell = document.createElement('span');
    cell.append(inp);
    if (trail) cell.append(trail);
    wrap.append(cell);
    inputs.push(inp);
  });
  const next = inp => inputs[inputs.indexOf(inp) + 1]?.focus();
  inputs.forEach(inp => {
    inp.oninput = () => { inp.classList.remove('ok', 'bad'); if (bare(inp.value) && bare(inp.value) === bare(inp.dataset.answer)) next(inp); };
    inp.onkeydown = e => {
      if (e.key === ' ') { e.preventDefault(); next(inp); }
      if (e.key === 'Enter') { e.preventDefault(); check(); }
      if (e.key === 'Backspace' && !inp.value) { e.preventDefault(); inputs[inputs.indexOf(inp) - 1]?.focus(); }
    };
  });
  function check() {
    $$('.fix', wrap).forEach(f => f.remove());
    let wrong = 0;
    inputs.forEach(inp => {
      const ok = bare(inp.value) === bare(inp.dataset.answer);
      inp.classList.toggle('ok', ok); inp.classList.toggle('bad', !ok);
      if (!ok) { wrong++; const f = document.createElement('span'); f.className = 'fix'; f.textContent = bare(inp.dataset.answer); inp.after(f); }
    });
    msg.textContent = wrong ? `错了 ${wrong} 个词，黄色是正确答案。在 App 里这时可以点词查意思，或者按 ⌘B 拆开练。` : '全对！在 App 里按回车就进下一句。';
  }
}
dictation($('[data-dict="full"]'), LINE1, LINE1.text.split(' ').map((_, i) => i));

const MODES = {
  full: { blanks: [...Array(13).keys()], img: 'line2-input', tip: '每个词都要打',
    text: '每个词都要打，最练耳朵。想认真精听的时候用。', path: '练习页右下角「…」→ 挖空程度 → 全写' },
  medium: { blanks: [2, 4, 6, 8, 10, 11, 12], img: 'cloze-medium', tip: '大约一半的词要打',
    text: 'AI 挑出大约一半最值得听的词挖掉，其余直接给出。', path: '练习页右下角「…」→ 挖空程度 → 适中（需要配好 AI）' },
  easy: { blanks: [2, 6, 10], img: 'cloze-easy', tip: '只打 2–3 个词',
    text: '只挖 2–3 个关键词，其余直接给出。刚开始练、或者视频太难的时候用，不容易劝退。', path: '练习页右下角「…」→ 挖空程度 → 轻松（需要配好 AI）' },
  blur: { blanks: 'blur', img: 'blur', tip: '只听不打字',
    text: '字幕先模糊着，不用打字，听完点模糊的词揭开核对。适合快速过一遍、练反应。', path: '首页视频旁边的「…」→ 换成模糊练' },
};
seg($('#modeSeg'), k => {
  const m = MODES[k];
  $('#modeText').textContent = m.text;
  $('#modePath').textContent = m.path;
  $('#modeImg').src = asset(`img/${m.img}.jpg`);
  $('#modeDict [data-tip]').textContent = `试一试：${m.tip}`;
  dictation($('#modeDict'), LINE2, m.blanks);
});

// ---------- 拆句教我 ----------
const BD = [
  ['bd-1', '<b>第 1 块</b>：先听标准发音的一小块，把它打出来。'],
  ['bd-1-review', '对完答案，下面是 AI 的讲解：<b>take the chance to do</b> = 抓住机会做某事。'],
  ['bd-2-review', '<b>第 2 块</b>：<b>do a brain dump</b> = 把脑子里的想法一股脑倒出来。'],
  ['bd-3-review', '<b>最后一步</b>：回到视频原声，打出整句。前面的讲解都留在下面，随时回看。'],
];
let bd = 0;
BD.forEach((_, i) => { const b = document.createElement('button'); b.textContent = i < BD.length - 1 ? `第 ${i + 1} 步` : '整句'; b.onclick = () => showBd(i); $('#bdSteps').append(b); });
function showBd(i) {
  bd = i;
  $('#bdImg').src = asset(`img/${BD[i][0]}.jpg`);
  $('#bdCap').innerHTML = BD[i][1];
  $$('#bdSteps button').forEach((b, k) => b.classList.toggle('on', k === i));
  $('#bdPrev').disabled = i === 0;
  $('#bdNext').disabled = i === BD.length - 1;
}
$('#bdPrev').onclick = () => showBd(bd - 1);
$('#bdNext').onclick = () => showBd(bd + 1);
showBd(0);

// ---------- 小帮手 ----------
const HELP = {
  peek: ['peek', '某个词实在听不出来？按 <kbd>⌘X</kbd> 偷看当前这个词，看完接着打。'],
  lookup: ['lookup', '对完答案，点句子里任意一个词，弹出释义（先查词典，查不到再问 AI），一键加进 Anki 背单词。'],
  review: ['home-menu', '答错、看过提示、拆开练过的句子可以加入「复习」，App 按遗忘规律提醒你哪天再听一遍。首页顶上会写今天有几句该复习了。'],
};
seg($('#helpSeg'), k => { $('#helpImg').src = asset(`img/${HELP[k][0]}.jpg`); $('#helpText').innerHTML = HELP[k][1]; });
