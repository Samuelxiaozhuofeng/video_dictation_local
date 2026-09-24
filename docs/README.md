# LinguaClip 技术速览（给 agent 看的）

视频听写 / 遮字跟读练习工具。**只发 Mac 桌面版**（Tauri 2 + WKWebView），网页版已停维护，`npm run dev` 单独跑在浏览器里时由 `dev/browserMock.ts` 冒充 Tauri 外壳，仅供开发验证（见 CLAUDE.md）。

- 开发运行：`npx tauri dev`（自己拉起 vite:3000）
- 打包：`npx tauri build` → `src-tauri/target/release/bundle/macos/LinguaClip.app`
- 类型检查：`npx tsc --noEmit`
- 前端：React 19 + Vite 6 + Tailwind 3（本地打包，见 `tailwind.config.js`），字体走 `@fontsource`，断网可用
- 界面风格：深海夜读（深墨青底 + 奶油字，唯一主色暖黄；句子 Newsreader 衬线、界面 Instrument Sans），令牌在 `tailwind.config.js` / `index.css`，原语全在 `components/ui.tsx`（含「…」菜单 `Menu`）；快捷键提示用 ⌘ ⇧ 符号

## 目录

| 位置 | 管什么 |
|---|---|
| `App.tsx` | 页面状态机（首页 / 练习 / 收藏 / 设置）、开始练习与续练、全局快捷键表 |
| `components/Home.tsx` + `VideoCover.tsx` | 拖入 / 选文件、历史记录货架（列表 / 卡片，卡片封面是现抓的视频一帧，不存盘） |
| `components/Studio.tsx` + `Transport.tsx` + `DictationLine.tsx` / `BlurLine.tsx` | 练习页：视频、字幕条、遥控条 |
| `components/Settings*.tsx` | 通用 / AI 查词 / Anki 设置 |
| `hooks/` | 播放控制、练习会话、收藏、Anki 集成、快捷键 |
| `utils/sections.ts` | 按分钟把字幕切成段。**首页和练习页必须用同一个函数**，否则卡片上的「第几段」会和实际练的对不上 |
| `utils/desktop.ts` | **所有 Tauri 调用的唯一入口**：系统对话框、读字幕、路径是否存在、asset URL、拖放监听 |
| `utils/videoStorage.ts` + `fileSystemAccess.ts` | 练习记录（IndexedDB） |
| `utils/anki.ts` | AnkiConnect 请求（经 Tauri http 插件代发） |
| `utils/aiConfig.ts` + `ai.ts` | AI 设置（用户自填 OpenAI 兼容地址 + key + 模型，无默认地址、无内置通道）与 AI 查词 |
| `utils/dictionary.ts` | 词典查词（不用 AI）：按整段字幕认语言（英 / 西 / 法 / 德），查有道 JSON 或剑桥 / 欧路网页（借鉴 ODH）；每门语言用哪本存 localStorage `linguaclip_dict_choice`。查词顺序在 `Studio.tsx` 的 `lookup`：词典优先，查不到或英文界面且配了 AI 时走 AI。弹窗按条列释义（带例句），每条「＋」单独发 Anki（`senseToAnki`：释义进 definition、前 2 句例句进 example 栏位）；AI 只回答第几条（`ai.ts` 的 `pickSense`），不改写释义。剑桥 / 欧路连不上时自动改查有道 |
| `utils/breakdownPrep.ts` + `clozePrep.ts` | 拆句 / 挖空的后台任务（首页「…」、导入后自动做、练习页共用同一个任务），结果存 `~/Movies/LinguaClip/<id>.breakdown/cloze.json` |
| `components/AddVideo.tsx`（添加视频弹窗）+ `utils/importJob.ts` + `src-tauri/src/import.rs` + `whisper_setup.rs` | 自带字幕 / 本地转录（首次自动下载转录组件）/ YouTube 下载，见 [import.md](import.md) |
| `utils/i18n.*.ts` | 中 / 英文案，两份都要改 |
| `src-tauri/src/paths.rs` + `utils/platform.ts` | Mac / Windows 差异：自有目录（~/Movies 或 ~/Videos 下的 LinguaClip）、起子进程不弹黑窗、快捷键和「废纸篓」文案 |
| `src-tauri/src/decode.rs` | 纯 Rust 抽视频音轨成 16k wav（Windows 用；Mac 用系统 afconvert） |
| `src-tauri/` | Rust 壳子；`tauri.conf.json` 窗口与 asset 协议，`capabilities/default.json` 权限 |

## 桌面版的关键约定（改这些地方前先读）

详见 [desktop.md](desktop.md)。一句话版：视频不读进内存，用 `convertFileSrc(path)` 当 `<video src>`；记录里存绝对路径 `videoPath`；拖放走 Tauri 事件不走 HTML5 `onDrop`；Anki 卡的音频走 Web Audio 录制。

## 本地数据（改结构要过设计门）

- IndexedDB `linguaclip_db`：`videos` 表（VideoRecord，含 `videoPath`、字幕全文、进度）；`fileHandles` 表是网页时代遗留，已不读不写，**不要删表、不要动 DB_VERSION**
- IndexedDB `linguaclip_review`（`utils/review.ts`）：复习卡片，和 `linguaclip_db` 分库——**别把它并进 `linguaclip_db`**（那要升 DB_VERSION，旧版 App 就打不开练习记录了）。`cards` 表一张卡 = 一句（`deck:'line'`，id `视频id|开始秒`）或一个词（`deck:'word'`，id 再加 `|w|单词`），卡里自带句子、时间、视频路径快照和 FSRS 排期（`ts-fsrs`，间隔按天、不走分钟步），删视频记录不删卡；`meta` 表只有 `migrated` 一条，和旧收藏迁移的卡同一事务写入。评分全自动：交卷有错 Again、看提示 / ⌘J 过 Hard、一次全对 Good
- localStorage：`linguaclip_ai_config` / `linguaclip_anki_config` / `audio_padding` / `lang` / `practice_config` / `saved_lines`（**旧收藏，只读**：首次打开复习库时迁移进卡片，之后不再写，留作备份）/ `video_progress` / `import_lang`（添加视频弹窗记住的字幕语言）/ `linguaclip_today`（首页「今天练了几分钟 · 几句」，只存当天一条，`utils/today.ts`）/ `home_view`（首页列表 or 卡片）

## 根目录那些 *.md

`README.md` 以外的 20 多份 `*_FIX.md` / `*_SUMMARY.md` / `拆分计划*.md` 是早期开发日志，不是当前状态，别当规格用。
