# 待攒一批再送 codex-review（用户 2026-09-24：攒够一批再审）

- [ ] e36d182 复习里查词（useLookup 抽出、ReviewSession 接查词 / 记下这个词 / Esc 顺序）
- [ ] 8150370 复习页：接下来一周预告 + 卡片具体日期、复习次数、忘过次数

# App 内复习（句子 / 单词两个牌组，FSRS）

用户拍板（2026-09-24）：卡住的句子自动进复习 + 收藏也进；单词一起做；句子、单词分开两个牌组各一个入口；自动评分，不自评；Anki 保留。
设计说明：scratchpad/design-review.md（设计门审）

- [x] 探索 + 产品门
- [x] 设计门（reviewer）：可动工；补「记录删了也能重新选文件」、迁移标记进同一库、复习库出错不挡练习
- [x] 地基：utils/review.ts（库、FSRS、评分、迁移、队列）+ test-review.mjs + 全部文案 key
- [x] 路 A 采集：DictationLine 报结果 / Studio 接卡住 / 拆开教我 / 模糊点开 / 收藏按视频+句 / 查词「记下这个词」/ 段末「再练卡住的 N 句」
- [x] 路 B 复习：ReviewSession（放原声片段 + 听写 + 自动评分）/ 复习页（两个牌组入口 + 列表）/ 首页到期提示 / 导航改名 / 删视频提示
- [x] 合流：tsc + node test-*.mjs + 浏览器实测整条链（顺修：全对自动重播后跳过一句——旧版同样复现）
- [x] codex-review（修：AI 释义当网页渲染可被注入；迁移与建卡竞态；老收藏读坏时误标迁移完成。未修：装回旧版后两边收藏各记各的——已知限制）
- [x] 更新 docs/README.md + CLAUDE.md 数据段
- [x] npm run release + 验收路径 + commit

# 六项优化（2026-09-23 用户拍板）

- API 地址必须自己填，留空不再默认连 Google；去掉正式包里内置的作者通道，统一用自己填的 key

- [x] 产品门 pm
- [x] 6 去 Google/Gemini 字样 + 去内置通道 + 地址必填
- [x] 4 设置页分标签（通用 / AI / 快捷键 / Anki）
- [x] 1 练习页视频:练习区比例（7:3 / 6:4 / 5:5 / 4:6，记住）
- [x] 2 查词改居中弹窗
- [x] 3 首页卡片/列表切换（卡片有视频画面封面）；··· 菜单「拆句」「挖空」
- [x] 5 AI 标签勾选：转录后自动拆句 / 自动挖空；首页显示拆句、挖空进度
- [x] tsc / node 自检 / 浏览器实测（本地假 AI 服务）
- [x] codex-review（修：挖空写盘失败时删视频会卡住）
- [x] npm run release

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

# 查词：词典打底，AI 做补充（2026-09-23 用户拍板）

- 点单词先查词典（不配 AI 也能用）；视频语言按整段字幕自动认
- 英语：有道 / 剑桥；西、法、德：有道 / 欧路；设置里每门语言选一本（默认有道）
- 查不到：配了 AI 自动转问 AI；没配 → 「词典里没有这个词」+ 去配 AI 的提示
- 英文界面 + 配了 AI → 直接问 AI
- 弹窗「结合这句解释」按钮（配了 AI 才有）；点过再发 Anki 就发 AI 那份
- 日语：字幕点下去是一整串，词典查不了，照旧走 AI

- [x] 产品门 pm
- [x] utils/dictionary.ts：认语言 + 有道 / 剑桥 / 欧路 解析 + 选择存本机
- [x] Studio 查词流程 + DefinitionPanel 显示词典 / 「结合这句解释」/ Anki
- [x] 设置页：每门语言选词典；文案两份（加载中、没配 AI、Anki 字段名、提示词说明）
- [x] tsc / node 自检（认语言 + 解析）/ 浏览器实测
- [x] codex-review
- [x] npm run release

# 查词：按条加入 Anki（2026-09-23 用户拍板）

- 每条释义末尾「＋」，点了直接发「带音频」卡片（只这一条 + 前 2 句例句）；撤掉底部「仅单词 / 带音频」；AI 兜底那段末尾也有「＋」
- 弹窗每条下只显示第 1 句例句；Anki 新增「例句」栏位（设置 → Anki 里选对应格）
- 「结合这句解释」→ AI 指出第几条（亮起 + 滚到眼前）+ 一句说明；说明不进卡片
- 英语有道 → 柯林斯双解（没有就退回简明）；西法德默认词典改欧路（已选过的不变）
- 顺手：同一条加过显示 ✓ 不能再点、录音时其他「＋」锁住；欧路固定搭配带上短语；例句 ~ 换回原词；挤一行的两条拆开

- [x] 产品门 pm
- [x] dictionary.ts：例句 / 搭配 / 拆条 / ~ / 柯林斯 / 默认欧路 / 单条转 HTML
- [x] Anki：新「例句」栏位（types / anki.ts / useAnkiIntegration / SettingsAnki / 文案）
- [x] AI 挑第几条（ai.ts）+ Studio explain
- [x] DefinitionPanel：每条「＋」、例句、亮起滚动、撤底部按钮
- [x] tsc / test-dictionary / 浏览器实测
- [x] codex-review（修：欧路例句嵌在释义里被混进释义；单条带例句的柯林斯被丢）
- [x] npm run release

# Anki：只剩一种卡 + 一键创建 LinguaClip 卡（2026-09-24 用户拍板）

- 设置 → Anki 只有「卡片」一套（牌组 / 笔记类型 / 字段）；播放条加整句、查词 ＋ 都用它，默认带音频
- 老配置沿用原「音频卡片」（没有就用「单词卡片」）
- 「一键创建 LinguaClip 卡」：建 LinguaClip 牌组 + 笔记类型（已有就直接用，不覆盖），字段自动对上
- 卡面：正面原声 + 截图（单词卡多一个单词）；背面句子（单词加粗）、释义、例句；空的整块不显示

- [x] 产品门 pm + 用户拍板（先听后看、自动建牌组）
- [x] anki.ts：配置合一 + 兼容旧格式 + 一键创建 + 加粗
- [x] useAnkiIntegration / 调用链去掉 includeAudio
- [x] Settings / SettingsAnki 合成一块 + 按钮；文案两份；README / docs
- [x] test-anki.mjs + tsc
- [x] 浏览器实测（真 Anki）
- [x] codex-review（修：Anki 里已有且改过字段名的 LinguaClip 卡，一键创建后提示手动补「句子」「音频」）
- [x] npm run release
