# 字幕从哪来（自带 .srt / 本地转录 / YouTube 下载）

「添加视频」弹窗的三条路：

- **视频 + 自带 .srt**：`AddVideo.tsx` 直接 `createVideoRecord` 建好记录，交给 `onPractice` 进练习页，不走导入任务。拖进窗口的 .srt 也会填进弹窗。只收 .srt（`parseSRT` 读不懂别的格式）。
- **只有视频**：走导入任务。转录组件（whisper-cli + large-v3-turbo q5_0 模型 + VAD 模型，约 580MB）**不打进 App**，第一次导入时由 `src-tauri/src/whisper_setup.rs` 下载到 `~/Library/Application Support/com.linguaclip.app/whisper/`，卡片显示 `setup` 阶段进度。弹窗先用 `import_tools` 命令查组件在不在，不在就写明大小、按钮改成「下载组件并生成字幕」。
- **转录方式**（设置 → 转录，`utils/transcribeConfig.ts`，localStorage `linguaclip_transcribe_config`）：本机（默认）分「标准」large-v3-turbo q5_0 和「轻量」small q5_1（约 190MB，DTW 预设 `small`）；或云端 Groq（用户自填免费密钥，不下载任何组件）。`start_import` 多带 `engine / model / apiKey`，老前端不带 = 本机标准。重试按**当前**设置走，不按卡片当初的方式。
- **YouTube 链接**：只给自己装了 yt-dlp（+ ffmpeg、node）的人。`import_tools` 查不到 yt-dlp 就不显示网址框。

## 链路

`components/AddVideo.tsx`（主页「添加视频」弹窗，拖入视频也打开它）→ `utils/importJob.ts`（先建一条带 `importJob` 的 VideoRecord 占位，再 `invoke('start_import')`）→ `src-tauri/src/import.rs`（独立线程：yt-dlp → ffmpeg → whisper-cli，`app.emit("import-progress")` 推进度）→ `importJob.ts` 常驻监听（在 `App.tsx` 挂，不在首页挂，否则用户在练习页时会漏事件）写回记录；完成时删 `importJob` 并填 `videoPath / subtitleText / totalSubtitles`。

## 转录组件（whisper_setup.rs）

- 查找顺序：我们下载的目录 → whisper-cli 回落到 Homebrew（`find_bin`），模型回落到 `~/.cache/whisper.cpp`（完整版和 q5_0 都认）。作者本机的老安装不用重下。
- whisper-cli 由 `scripts/build-whisper-cli.sh` 静态编译（只链接系统框架），挂在 GitHub Release `whisper-cli-1.8.4`。换一版就要改 `WHISPER_CLI` 里的 sha256 和大小。
- 下载：`.part` 文件断点续传（Range），30 秒没数据算卡死换下一个地址；模型先试 huggingface.co 再试 hf-mirror.com；下完校验大小 + sha256，不对就删掉 `.part` 从头来。一把全局锁，两个导入不会同时写同一个文件。
- 抽声音：Mac 用系统自带 `/usr/bin/afconvert`，Windows 用 `decode.rs`（symphonia，AAC in mp4/mov/m4v；同一段 7 分钟英语，转写结果和 afconvert 版只差标点和断行），失败且装了 ffmpeg 才退回 ffmpeg。
- Windows：识别程序是 whisper.cpp 官方 `whisper-bin-x64.zip`（CPU 版），下载校验后用系统 `tar.exe` 解压到组件目录的 `Release/`；不做 YouTube（Chrome 在 Windows 上加密 cookies，yt-dlp 读不了），`import_tools` 恒报 youtube=false。
- 任何失败的卡片都有「重试」：网址回到 download 阶段，本地视频回到 extract 阶段，同一条记录。

## 运行时事实

- 工具查找顺序 `/opt/homebrew/bin` → `~/.local/bin` → `/usr/local/bin` → PATH。**Finder 启动的 app 不继承终端 PATH**，所以子进程一律注入这份 PATH：yt-dlp 需要 `node` 解 YouTube 校验，缺了就「下载失败」。
- 模型：`~/.cache/whisper.cpp/ggml-large-v3-turbo.bin` + `ggml-silero-v5.1.2.bin`（VAD）。
- YouTube 必须带**登录过账号**的 cookies（纯访客 cookies 实测不够）。拦截文案有好几种（"Sign in to confirm you're not a bot"、"The page needs to be reloaded"），`isCookieError()` 一并认。
- 登录状态**只有一个来源**：`~/Movies/LinguaClip/.yt-login/` —— app 自己的 Chrome 配置目录，`open_youtube_login` 命令用 `open -na "Google Chrome" --args --user-data-dir=<它>` 开第二个 Chrome 实例让用户登录，之后走 `--cookies-from-browser chrome:<它>`。用户自己的 Chrome 目录被 macOS app 数据保护挡着（报「找不到 cookies 数据库」），所以必须用我们自己的目录。
- 手工导出的 `~/Movies/LinguaClip/cookies.txt` **已不再读取**（2026-09-22 去掉）。它原本是回落，但一旦用户在 app 里登录过，这条分支就永远够不着——哪怕那个登录已经过期——于是过期登录会悄悄遮蔽一份好用的 cookies.txt。留一个来源就没有遮蔽问题；登录过期的出路是卡片上的「登录 YouTube」按钮，不是换 cookies 文件。老用户目录里的 cookies.txt 不删，只是不再被用到。
- 判断「登录了没」不能看 Cookies 文件存不存在：Chrome 一启动就建好空库，会误判成已登录。改为在 sqlite 文件里搜 `LOGIN_INFO` 这个 cookie **名字**（名字是明文，值才加密），登录后才出现。见 `db_shows_login()` 和它的测试。**没登录过就一个 cookies 参数都不传**：让 YouTube 自己报「要登录」，`isCookieError()` 认得这句、卡片才会给出登录按钮；硬塞一个空 profile 会让 yt-dlp 报「找不到 cookies 数据库」，那句谁也不认，用户就没出路了。
- 失败的卡片都带「重试」按钮：`retryImport(id)` 把 `importJob` 改回 download/0（本地视频 extract/0）、清掉 error，**沿用同一条记录 id** 再调一次 `start_import`，历史里不会多出一张卡片。为此 `importJob` 记下了当时的 `lang` / `quality`（可选字段；这之前的老卡片没有，重试回落 `en` / 1080）。前端用一个内存 Set 挡住连点，避免两个 yt-dlp 往同一个文件名写。
- **不替用户关登录用的 Chrome**：那个实例只要是机器上唯一的 Chrome，用户从程序坞点 Chrome 开的新标签页就会落在它里面，替他关窗会连标签页一起关掉。所以文案改成让用户自己关那个窗口（关窗才会把 cookies 落盘），再回来点「重试」。
- 产物全部落 `~/Movies/LinguaClip/`：下载的 mp4、`<stem>.srt`；中间 wav 用完即删。**本地视频转录也写这里，不写视频旁边**（用户旁边可能有手做的同名 srt）。
- yt-dlp 下载封顶：`-f bv*[height<=H]+ba/b[height<=H]`（H 为所选 1080 / 720 / 480），再加 `-S vcodec:h264,res:1080,acodec:m4a --merge-output-format mp4` 在上限内优先苹果能放的编码。Mac 内核放不了 webm，超过 1080p 只提供另一套编码，下完会打不开。`--print after_move:filepath` 本会让 yt-dlp 安静掉，但加了 `--progress --newline`，下载阶段能看到 `[download]` 百分比。
- 画质下拉三档 1080p / 720p / 480p，默认 1080p，不写入练习记录、不记忆上次选择。粘贴合法网址约 600ms 后，用一次 `yt-dlp -J --no-playlist`（同一套登录/cookies）算出各档预计大小；失败只在下拉下方提示，不挡下载。
- 文件名模板带 `[视频ID]`，识别最终路径那行只看「以 `/` 开头 + 视频扩展名」，别再加「排除 `[`」之类的启发式。

## 状态与兼容

- `VideoRecord.importJob?: { stage, percent?, error?, source }`。`error` 存**原始报错**，渲染时才过 `formatImportError()`，所以切语言会跟着重译；老记录里存的是已翻译好的句子，匹配不上任何规则、原样显示，不用迁移。老记录没有这个字段；`handleResume` 见到它直接返回，卡片不渲染模式按钮。
- app 启动时 `markInterruptedJobs()` 把所有「生成中且无 error」的记录标成「上次生成被中断」——新进程里后台线程必然已死。
- 没有「取消」：删掉生成中的卡片后台照跑到底，写回时记录不存在就跳过。
- 语言下拉 `en / es / ja / zh / auto`，对应 whisper `-l`。旁边是画质下拉 1080 / 720 / 480。

## 云端转录（cloud_asr.rs）

- Groq `whisper-large-v3-turbo`，`verbose_json` + 词级、句级时间戳。免费账号单次 25MB、每天约 8 小时声音、每分钟 20 次。
- 抽出的 16k wav 按段上传：Mac 每段 60 分钟、先用 afconvert 压成 AAC（约 16MB/小时）；Windows 没有编码器，每段 11 分钟原样传 wav（约 21MB）。切口在名义位置 ±3 秒内找最静的 50ms；末尾不足 2 秒的尾巴并进上一段。
- Groq 的逐词结果不带标点、中日文可能一字一条：按句子文本逐字对齐，把标点和原拼写补回，没有空格隔开的并进前一个词（和本机规则一样）。SRT 用句级结果拼。
- 报错码 `cloud:key`（401）/ `cloud:quota:…`（429）/ `cloud:toolarge`（413）/ `cloud:denied:…`（403，常见于地区不支持）/ `cloud:network:…` / `cloud:empty`，前端 `formatImportError` 翻译。失败不自动换本机。
- 真调一次：`GROQ_API_KEY=… cargo test --manifest-path src-tauri/Cargo.toml -- --ignored groq`
- 设置页「转录组件位置」= `transcribe_location` 命令：实际在用的那份模型（可能在 `~/.cache/whisper.cpp`），没下载时显示我们的下载目录。
