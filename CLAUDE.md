# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 先读 docs/

`docs/README.md` 是这个仓库的技术速览（目录表 + 本地数据结构），`docs/desktop.md` 是 Tauri 桌面版的运行时约定，`docs/import.md` 是自动生成字幕那条链路。动手前读对应那份，别只靠代码猜。

根目录除 `README.md`（上游 AI Studio 模板，内容已过时）外的 `*_FIX.md` / `*_SUMMARY.md` / `拆分计划*.md` 是早期开发日志，不是当前规格。

## 命令

```bash
npx tauri dev          # 桌面开发：自己拉起 vite:3000（Claude 验功能走浏览器，见「验证流程」）
npx tsc --noEmit       # 类型检查
npm run release        # tauri build --bundles app，然后装进 /Applications
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 侧（import.rs 有单测）
node test-resegment.mjs   # 切句逻辑自检（bundle 真模块，不是复制逻辑）
node test-sections.mjs    # 分段逻辑自检（同上）
node test-cloze.mjs       # 挖空逻辑 + 缓存自检（同上）
```

前端没有测试框架，逻辑自检就是根目录那几个 `node` 脚本（`test-tokenizer.js` / `test-flexible-case.js` 是早期的复制逻辑版，参考价值有限）。

## 验证流程（改完功能必须走）

**只发 Mac 桌面版**，用户验收在正式包里；交给用户之前，Claude 先在浏览器里把改动走一遍，拿到真实运行证据。顺序：

1. `npx tsc --noEmit` + 相关 `node test-*.mjs`（碰 Rust 再跑 `cargo test`）。
2. **浏览器实测**：`preview_start` 启 `.claude/launch.json` 的 `dev`（= `npm run dev`），在内置浏览器里按用户会做的操作走一遍改动，外加改动碰过的原有操作；截图给用户当证据。
3. `npm run release` 打正式包装进 /Applications，给用户验收路径（打开哪里 → 做什么 → 应该看到什么），并写明哪些是浏览器验不到、需要真机确认的。

浏览器模式怎么运作（`dev/browserMock.ts` 冒充 Tauri 外壳，只在浏览器 dev 下加载，正式包和 `tauri dev` 里都没有）：

- 本地文件经 vite `/@fs` 读真文件（允许 `~/Movies`、`~/Downloads`、项目目录；cookies / `.yt-login` 已屏蔽）。
- 文件对话框默认返回 `~/Movies/LinguaClip/Me at the zoo` 样片（视频或 .srt 看过滤器）；`window.__MOCK__.pick = '绝对路径'` 指定下一次返回值。
- Rust 命令不执行，只记到 `window.__MOCK__.calls`；`write_cache` 存内存，刷新即清。
- 导入进度手动发：`window.__MOCK__.emit('import-progress', { id, stage: 'done', videoPath, subtitleText })`，`id` 从 `__MOCK__.calls` 里的 `start_import` 取。
- AI / Anki 请求经 vite `/__proxy` 转发（浏览器有 CORS，Tauri 没有），能打到真实 AI 端点。
- 浏览器里的 IndexedDB 和桌面 App 是两份，测试数据不会污染用户记录。

**新增 Rust 命令或 Tauri 插件调用时，同步在 `dev/browserMock.ts` 的 `handle` 里补一条**，否则浏览器里该功能静默返回 null。

浏览器验不到的：真实导入（yt-dlp / whisper）、系统对话框、Finder 拖放、WKWebView 独有的渲染 / 行为差异——这些在交付时明确列给用户真机验。

内置浏览器的坑：pane 隐藏时截图可能是旧帧，读状态优先 `get_page_text` / `javascript_tool`；`computer` 按空格 / 回车会发空 key，按键改用 `javascript_tool` 往 `document.activeElement` 派发 `KeyboardEvent`；输入框改值用原生 value setter + `input` 事件。React StrictMode 下 dev 的副作用会跑两遍（如 AI 请求发两次），正式包只发一次，别误判为 bug。

## 架构要点（跨文件才看得出来的）

- **Tauri 调用只准从 `utils/desktop.ts` 走**：系统对话框、读字幕、路径存在性、asset URL、拖放监听都在那儿收口。组件里直接 `invoke` 是错的。
- **视频永不读进内存**：记录里存绝对路径 `videoPath`，`<video src>` = `convertFileSrc(path)`。跨源，所以 `<video crossOrigin="anonymous">` 不能丢，掉了会让截图和 Anki 音频静默坏掉。
- **练习状态**：`App.tsx` 是页面状态机 + 全局快捷键表；练习期的状态在 `hooks/usePracticeContext.tsx` 及同族 hooks 里，组件只渲染。
- **导入任务的监听挂在 `App.tsx`，不是首页**：用户在练习页时首页已卸载，挂错地方会漏进度事件。
- **文案两份都要改**：`utils/i18n.zh.ts` 和 `utils/i18n.en.ts`。
- **视频扩展名有两处**：`components/Home.tsx` 的 `VIDEO_EXT` 和 `utils/desktop.ts` 的 `VIDEO_FILTER`，必须一致。
- **UI 原语全在 `components/ui.tsx`**，风格是深海夜读（深底、一个暖黄主色 + 灰阶，别加第二种颜色），新界面用这些原语，不要另起一套。

## 碰数据前

IndexedDB `linguaclip_db`：`videos` 表是练习记录本体；`fileHandles` 表是网页时代遗留，已不读不写——**不要删表、不要动 DB_VERSION**。改记录用 `patchVideoRecord(id, {...})` 按字段更新，别整条覆盖。结构变更要先过设计门。
