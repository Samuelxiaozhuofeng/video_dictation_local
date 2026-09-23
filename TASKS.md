# 快捷键：常驻提示 + 拆句快捷键 + 自定义

用户拍板（2026-09-23）：
- 练习页加一个小按钮，点开后快捷键表常驻在角落，再点收起
- 「拆开教我」默认 ⌘B（Windows Ctrl+B）；用不了时按下要提示原因
- 设置里只允许改带 ⌘/Ctrl 的组合键；空格、回车、打字时跳词固定
- 录到被占用的键（系统或其他功能）当场拦下
- 自定义存本机，Mac 显示 ⌘、Windows 显示 Ctrl

- [x] 转录进度一直 0%（whisper 输出「progress =  42%」多一个空格）
- [x] 快捷键清单收成一份（按键、菜单说明、角落表、按钮提示都从这里读）
- [x] 练习页：角落常驻表 + 开关按钮
- [x] 拆开教我快捷键 + 用不了时提示
- [x] 设置页：快捷键自定义（拦撞键、恢复默认）
- [x] tsc / 浏览器实测 / codex-review / npm run release

# Windows 版（GitHub CI 打包，用户在 Windows 虚拟机里验）

- 用户 2026-09-23 同意为此推送到 GitHub；公开 Release 仍需另外点头
- Windows 不做 YouTube（Chrome 127+ 在 Windows 上加密 cookies，yt-dlp 读不了）
- 转录组件：官方 whisper-bin-x64.zip（4MB）+ 同一套模型；抽声音用内置解码（symphonia），不下 ffmpeg

- [x] Rust：家目录 / 视频目录 / 组件目录按系统分；find_bin 认 .exe；子进程不弹黑窗
- [x] Rust：Windows 组件 = 官方 zip 下载后用系统 tar 解压；import_tools 在 Windows 报 youtube=false
- [x] Rust：内置解码 mp4/mov/m4v 音频 → 16k wav（Windows 用；Mac 仍用 afconvert），带样片测试
- [x] Rust：删除到回收站（Windows）
- [x] 前端：视频目录按系统分；⌘/⇧ 在 Windows 显示成 Ctrl/Shift，快捷键认 Ctrl；标题栏留白
- [x] CI：windows 打 NSIS 安装包 + 跑 cargo test（含下载 whisper 并运行）→ 上传为 artifact
- [x] Mac 侧回归：cargo test / tsc / 浏览器 / npm run release
- [x] codex-review
- [x] push，看 CI 绿，给用户 Windows 验收路径

# 开源发布：自带字幕 + 一键下载转录组件

用户拍板（2026-09-23）：
- 加回「视频 + 自带 .srt」直接开练，不用装任何东西
- 只有视频：首次生成字幕前说明 → 一键下载转录组件（识别程序 3MB + 压缩版模型 550MB + VAD 1MB）到 ~/Library/Application Support，不打进 App
- YouTube 不做一键；本机没装 yt-dlp 就不显示网址框，GitHub 上写进阶说明
- 公开安装包不能带作者的 AI 密钥

- [x] Rust：组件目录 + 查找顺序（我们下的 → Homebrew/旧 ~/.cache，完整版和压缩版模型都认）
- [x] Rust：抽声音改用系统 afconvert，失败再退 ffmpeg
- [x] Rust：缺组件时导入流程先下载（setup 阶段进度、断点续传、官方源→国内镜像、sha256 校验）
- [x] Rust：import_tools 命令（转录组件在不在、yt-dlp 在不在）+ browserMock
- [x] 前端：弹窗加选字幕（只 .srt）、拖放认 .srt、选了字幕→「开始练习」直进练习页
- [x] 前端：缺组件时弹窗写明大小和位置，按钮「下载组件并生成字幕」；没 yt-dlp 隐藏网址框
- [x] 前端：卡片显示「下载转录组件 x%」；任何失败都能重试（本地视频不再只能删卡）
- [x] 中英文案、README、docs/import.md
- [x] 公开包：不带密钥的打包方式 + ad-hoc 完整签名
- [x] tsc / cargo test / 浏览器实测 / 干净环境实测下载+转录
- [x] codex-review → npm run release → 验收路径
- [ ] （需用户许可）push + 发 Release（whisper-cli 和 App 安装包）

# 界面重做（D1 · 深海夜读 双栏）

设计稿：https://claude.ai/artifact/NSw8GzoJEEofdbpms9Ub3v（NightSplit 那张）
主页分工：列表 + 「添加视频」为主角；链接/语言/画质进弹窗；模式按钮悬停出现；拆句/删除进「…」；拖放整窗；删选字幕、重复的选本地按钮、生成字幕按钮、上次时间；进度合并成「第 x/y 段」+ 细线。

- [x] 读懂现有 UI 代码（ui.tsx / index.css / tailwind / 各页面）
- [x] 新配色和字体令牌（1 主色 + 灰阶），字体离线打包
- [x] 重写 ui.tsx 原语
- [x] 主页按分工表重做（添加视频弹窗、整窗拖放、行悬停、… 菜单）
- [x] 练习页 D1 双栏（视频左、文字稿右、底栏快捷键、… 菜单）
- [x] 收藏 / 设置 / 弹窗 / 查词面板跟新令牌
- [x] tsc + node test-*.mjs
- [x] 浏览器实测 + 截图，评审第 1 轮
- [x] 评审第 2 / 3 轮（8.5 分停）
- [x] 第四步做减法（删非听写元素、只留 1 主色、统一字号间距）
- [x] npm run release + 验收路径
