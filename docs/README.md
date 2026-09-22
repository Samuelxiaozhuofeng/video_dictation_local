# LinguaClip 技术速览（给 agent 看的）

视频听写 / 遮字跟读练习工具。**只发 Mac 桌面版**（Tauri 2 + WKWebView），网页版已停维护，`npm run dev` 单独跑在浏览器里会因为 Tauri API 缺失而报错。

- 开发运行：`npx tauri dev`（自己拉起 vite:3000）
- 打包：`npx tauri build` → `src-tauri/target/release/bundle/macos/LinguaClip.app`
- 类型检查：`npx tsc --noEmit`
- 前端：React 19 + Vite 6 + Tailwind 3（本地打包，见 `tailwind.config.js`），字体走 `@fontsource`，断网可用
- 界面风格：笔记本纸感（安静、浅色），原语全在 `components/ui.tsx`；快捷键提示用 ⌘ ⇧ 符号

## 目录

| 位置 | 管什么 |
|---|---|
| `App.tsx` | 页面状态机（首页 / 练习 / 收藏 / 设置）、开始练习与续练、全局快捷键表 |
| `components/Home.tsx` | 拖入 / 选文件、历史记录货架 |
| `components/Studio.tsx` + `Transport.tsx` + `DictationLine.tsx` / `BlurLine.tsx` | 练习页：视频、字幕条、遥控条 |
| `components/Settings*.tsx` | 通用 / AI 查词 / Anki 设置 |
| `hooks/` | 播放控制、练习会话、收藏、Anki 集成、快捷键 |
| `utils/sections.ts` | 按分钟把字幕切成段。**首页和练习页必须用同一个函数**，否则卡片上的「第几段」会和实际练的对不上 |
| `utils/desktop.ts` | **所有 Tauri 调用的唯一入口**：系统对话框、读字幕、路径是否存在、asset URL、拖放监听 |
| `utils/videoStorage.ts` + `fileSystemAccess.ts` | 练习记录（IndexedDB） |
| `utils/anki.ts` | AnkiConnect 请求（经 Tauri http 插件代发） |
| `utils/ai.ts` | Gemini 查词 |
| `components/ImportBox.tsx` + `utils/importJob.ts` + `src-tauri/src/import.rs` | YouTube 下载 / 本地转录出字幕，见 [import.md](import.md) |
| `utils/i18n.*.ts` | 中 / 英文案，两份都要改 |
| `src-tauri/` | Rust 壳子；`tauri.conf.json` 窗口与 asset 协议，`capabilities/default.json` 权限 |

## 桌面版的关键约定（改这些地方前先读）

详见 [desktop.md](desktop.md)。一句话版：视频不读进内存，用 `convertFileSrc(path)` 当 `<video src>`；记录里存绝对路径 `videoPath`；拖放走 Tauri 事件不走 HTML5 `onDrop`；Anki 音频卡走 Web Audio 录制。

## 本地数据（改结构要过设计门）

- IndexedDB `linguaclip_db`：`videos` 表（VideoRecord，含 `videoPath`、字幕全文、进度）；`fileHandles` 表是网页时代遗留，已不读不写，**不要删表、不要动 DB_VERSION**
- localStorage：`linguaclip_ai_config` / `anki_config` / `audio_padding` / `lang` / `practice_config` / `saved_lines` / `video_progress`

## 根目录那些 *.md

`README.md` 以外的 20 多份 `*_FIX.md` / `*_SUMMARY.md` / `拆分计划*.md` 是早期开发日志，不是当前状态，别当规格用。
