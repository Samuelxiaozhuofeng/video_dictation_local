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
