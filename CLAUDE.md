# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 先读 docs/

`docs/README.md` 是这个仓库的技术速览（目录表 + 本地数据结构），`docs/desktop.md` 是 Tauri 桌面版的运行时约定，`docs/import.md` 是自动生成字幕那条链路。动手前读对应那份，别只靠代码猜。

根目录除 `README.md`（上游 AI Studio 模板，内容已过时）外的 `*_FIX.md` / `*_SUMMARY.md` / `拆分计划*.md` 是早期开发日志，不是当前规格。

## 命令

```bash
npx tauri dev          # 开发：自己拉起 vite:3000，必须走这个
npx tsc --noEmit       # 类型检查
npm run release        # tauri build --bundles app，然后装进 /Applications
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 侧（import.rs 有单测）
node test-resegment.mjs   # 切句逻辑自检（bundle 真模块，不是复制逻辑）
```

`npm run dev` 单跑浏览器会因为缺 Tauri API 报错——**只发 Mac 桌面版**，验收一律在 `npx tauri dev` 里。前端没有测试框架，逻辑自检就是根目录那几个 `node` 脚本（`test-tokenizer.js` / `test-flexible-case.js` 是早期的复制逻辑版，参考价值有限）。

## 架构要点（跨文件才看得出来的）

- **Tauri 调用只准从 `utils/desktop.ts` 走**：系统对话框、读字幕、路径存在性、asset URL、拖放监听都在那儿收口。组件里直接 `invoke` 是错的。
- **视频永不读进内存**：记录里存绝对路径 `videoPath`，`<video src>` = `convertFileSrc(path)`。跨源，所以 `<video crossOrigin="anonymous">` 不能丢，掉了会让截图和 Anki 音频静默坏掉。
- **练习状态**：`App.tsx` 是页面状态机 + 全局快捷键表；练习期的状态在 `hooks/usePracticeContext.tsx` 及同族 hooks 里，组件只渲染。
- **导入任务的监听挂在 `App.tsx`，不是首页**：用户在练习页时首页已卸载，挂错地方会漏进度事件。
- **文案两份都要改**：`utils/i18n.zh.ts` 和 `utils/i18n.en.ts`。
- **视频扩展名有两处**：`components/Home.tsx` 的 `VIDEO_EXT` 和 `utils/desktop.ts` 的 `VIDEO_FILTER`，必须一致。
- **UI 原语全在 `components/ui.tsx`**，风格是笔记本纸感（安静、浅色），新界面用这些原语，不要另起一套。

## 碰数据前

IndexedDB `linguaclip_db`：`videos` 表是练习记录本体；`fileHandles` 表是网页时代遗留，已不读不写——**不要删表、不要动 DB_VERSION**。改记录用 `patchVideoRecord(id, {...})` 按字段更新，别整条覆盖。结构变更要先过设计门。
