# 自动生成字幕（YouTube 下载 + 本地转录）

首页「没有字幕？让 app 生成」区块。只给作者本机用，三个工具不随 app 分发。

## 链路

`components/ImportBox.tsx` → `utils/importJob.ts`（先建一条带 `importJob` 的 VideoRecord 占位，再 `invoke('start_import')`）→ `src-tauri/src/import.rs`（独立线程：yt-dlp → ffmpeg → whisper-cli，`app.emit("import-progress")` 推进度）→ `importJob.ts` 常驻监听（在 `App.tsx` 挂，不在首页挂，否则用户在练习页时会漏事件）写回记录；完成时删 `importJob` 并填 `videoPath / subtitleText / totalSubtitles`。

## 运行时事实

- 工具查找顺序 `/opt/homebrew/bin` → `~/.local/bin` → `/usr/local/bin` → PATH。**Finder 启动的 app 不继承终端 PATH**，所以子进程一律注入这份 PATH：yt-dlp 需要 `node` 解 YouTube 校验，缺了就「下载失败」。
- 模型：`~/.cache/whisper.cpp/ggml-large-v3-turbo.bin` + `ggml-silero-v5.1.2.bin`（VAD）。
- YouTube 必须带**登录过账号**的 cookies（纯访客 cookies 实测不够）。拦截文案有好几种（"Sign in to confirm you're not a bot"、"The page needs to be reloaded"），`isCookieError()` 一并认。
- 登录状态来源，二选一，**不能同时传**（实测空 profile 会把好的 cookies.txt 污染成「已失效」）：
  1. `~/Movies/LinguaClip/.yt-login/` —— app 自己的 Chrome 配置目录，`open_youtube_login` 命令用 `open -na "Google Chrome" --args --user-data-dir=<它>` 开第二个 Chrome 实例让用户登录，之后走 `--cookies-from-browser chrome:<它>`。**优先**。用户自己的 Chrome 目录被 macOS app 数据保护挡着（报「找不到 cookies 数据库」），所以必须用我们自己的目录。
  2. `~/Movies/LinguaClip/cookies.txt`（手工导出）—— 回落，保住老用法。静态快照，YouTube 一用就轮换，实测二十分钟就失效，别当长期方案。
- 判断「登录了没」不能看 Cookies 文件存不存在：Chrome 一启动就建好空库，会误判成已登录、把能用的 cookies.txt 撇下。改为在 sqlite 文件里搜 `LOGIN_INFO` 这个 cookie **名字**（名字是明文，值才加密），登录后才出现。见 `db_shows_login()` 和它的测试。
- 产物全部落 `~/Movies/LinguaClip/`：下载的 mp4、`<stem>.srt`；中间 wav 用完即删。**本地视频转录也写这里，不写视频旁边**（用户旁边可能有手做的同名 srt）。
- yt-dlp 下载封顶：`-f bv*[height<=H]+ba/b[height<=H]`（H 为所选 1080 / 720 / 480），再加 `-S vcodec:h264,res:1080,acodec:m4a --merge-output-format mp4` 在上限内优先苹果能放的编码。Mac 内核放不了 webm，超过 1080p 只提供另一套编码，下完会打不开。`--print after_move:filepath` 本会让 yt-dlp 安静掉，但加了 `--progress --newline`，下载阶段能看到 `[download]` 百分比。
- 画质下拉三档 1080p / 720p / 480p，默认 1080p，不写入练习记录、不记忆上次选择。粘贴合法网址约 600ms 后，用一次 `yt-dlp -J --no-playlist`（同一套登录/cookies）算出各档预计大小；失败只在下拉下方提示，不挡下载。
- 文件名模板带 `[视频ID]`，识别最终路径那行只看「以 `/` 开头 + 视频扩展名」，别再加「排除 `[`」之类的启发式。

## 状态与兼容

- `VideoRecord.importJob?: { stage, percent?, error?, source }`。`error` 存**原始报错**，渲染时才过 `formatImportError()`，所以切语言会跟着重译；老记录里存的是已翻译好的句子，匹配不上任何规则、原样显示，不用迁移。老记录没有这个字段；`handleResume` 见到它直接返回，卡片不渲染模式按钮。
- app 启动时 `markInterruptedJobs()` 把所有「生成中且无 error」的记录标成「上次生成被中断」——新进程里后台线程必然已死。
- 没有「取消」：删掉生成中的卡片后台照跑到底，写回时记录不存在就跳过。
- 语言下拉 `en / es / ja / zh / auto`，对应 whisper `-l`。旁边是画质下拉 1080 / 720 / 480。
