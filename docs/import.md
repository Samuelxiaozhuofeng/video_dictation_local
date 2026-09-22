# 自动生成字幕（YouTube 下载 + 本地转录）

首页「没有字幕？让 app 生成」区块。只给作者本机用，三个工具不随 app 分发。

## 链路

`components/ImportBox.tsx` → `utils/importJob.ts`（先建一条带 `importJob` 的 VideoRecord 占位，再 `invoke('start_import')`）→ `src-tauri/src/import.rs`（独立线程：yt-dlp → ffmpeg → whisper-cli，`app.emit("import-progress")` 推进度）→ `importJob.ts` 常驻监听（在 `App.tsx` 挂，不在首页挂，否则用户在练习页时会漏事件）写回记录；完成时删 `importJob` 并填 `videoPath / subtitleText / totalSubtitles`。

## 运行时事实

- 工具查找顺序 `/opt/homebrew/bin` → `~/.local/bin` → `/usr/local/bin` → PATH。**Finder 启动的 app 不继承终端 PATH**，所以子进程一律注入这份 PATH：yt-dlp 需要 `node` 解 YouTube 校验，缺了就「下载失败」。
- 模型：`~/.cache/whisper.cpp/ggml-large-v3-turbo.bin` + `ggml-silero-v5.1.2.bin`（VAD）。
- YouTube 现在没登录直接拒（"Sign in to confirm you're not a bot"）。cookies 放 `~/Movies/LinguaClip/cookies.txt`（Chrome 扩展 "Get cookies.txt LOCALLY" 导出），存在才传 `--cookies`。Chrome 的 cookie 目录被 macOS TCC 挡着，`--cookies-from-browser` 走不通。
- 产物全部落 `~/Movies/LinguaClip/`：下载的 mp4、`<stem>.srt`；中间 wav 用完即删。**本地视频转录也写这里，不写视频旁边**（用户旁边可能有手做的同名 srt）。
- yt-dlp 参数钉死 h264 + aac + mp4（`-S vcodec:h264,res:1080,acodec:m4a --merge-output-format mp4`），Mac 内核放不了 webm。`--print after_move:filepath` 让 yt-dlp 进入安静模式，不再有 `[download]` 进度行，所以下载阶段实际只会看到 0%。
- 文件名模板带 `[视频ID]`，识别最终路径那行只看「以 `/` 开头 + 视频扩展名」，别再加「排除 `[`」之类的启发式。

## 状态与兼容

- `VideoRecord.importJob?: { stage, percent?, error?, source }`。老记录没有这个字段；`handleResume` 见到它直接返回，卡片不渲染模式按钮。
- app 启动时 `markInterruptedJobs()` 把所有「生成中且无 error」的记录标成「上次生成被中断」——新进程里后台线程必然已死。
- 没有「取消」：删掉生成中的卡片后台照跑到底，写回时记录不存在就跳过。
- 语言下拉 `en / es / ja / zh / auto`，对应 whisper `-l`。
