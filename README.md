# LinguaClip

**用你爱看的视频，练出真听力。** 一个 Mac / Windows 桌面听写 App：拖进任意视频，自动出字幕，一句一句听、一句一句打。

> A macOS dictation app: drop in any video, get subtitles generated locally, and practice listening sentence by sentence. [English below](#english)

## 它能做什么

- **一句一句听写**：听一句打一句，对答案时只标出你听错的词
- **挖空三档**：轻松（每句只打 2–3 个词）/ 适中（约一半）/ 全写
- **模糊模式**：字幕先糊住，听不出来再看，适合跟读
- **拆开教我**：AI 挑出这句里值得学的搭配和语法，先听标准朗读一块块练，再回到原声里把它听出来
- **点词就查**，一键做成带原声的 Anki 卡（第一次用点一下就自动建好卡片样式）
- **按 4 分钟一段练**，进度自动保存，下次接着来
- **视频只存在你自己的电脑上**：不上传、不用注册

## 安装

需要：macOS（Apple 芯片，M1 及以后）或 Windows 10 / 11（64 位）。

**Mac**

1. 到 [Releases](https://github.com/Samuelxiaozhuofeng/video_dictation_local/releases) 下载 `LinguaClip.zip`，解压后拖进「应用程序」。
2. App 没有经过苹果付费签名，第一次打开会被拦下。点「完成」，打开「系统设置 → 隐私与安全性」，拉到底点「仍要打开」。
   如果提示「已损坏，无法打开」，打开「终端」运行下面这行再双击：

   ```bash
   xattr -dr com.apple.quarantine /Applications/LinguaClip.app
   ```

**Windows**

1. 到 [Releases](https://github.com/Samuelxiaozhuofeng/video_dictation_local/releases) 下载 `LinguaClip_x.x.x_x64-setup.exe`，双击安装。
2. 安装包没有付费签名，会弹出「Windows 已保护你的电脑」：点「更多信息」→「仍要运行」。
3. Windows 版不支持粘贴 YouTube 链接；字幕识别用 CPU，比 Mac 慢一些。

### 字幕从哪来

- **有 .srt 字幕**：添加视频时把字幕一起选上（或者和视频一起拖进窗口），直接开练，什么都不用装。
- **没有字幕**：点「下载组件并生成字幕」。第一次会先下载转录组件（约 580MB，只下一次，Mac 放在 `~/Library/Application Support/com.linguaclip.app/whisper`，Windows 放在 `%LOCALAPPDATA%\com.linguaclip.app\whisper`），之后字幕在你电脑上用 whisper 识别，断网也能用。国内网络会自动换国内镜像。

### YouTube 链接（进阶，只限 Mac，自己装）

App 不帮你装 YouTube 下载工具。想粘链接直接下载的，用 [Homebrew](https://brew.sh) 装好下面三样，添加视频的弹窗里就会出现网址框：

```bash
brew install yt-dlp ffmpeg node
```

第一次下载会让你在 App 里登录 YouTube。请只下载你有权使用的视频。

### AI 功能（可选）

「设置 → AI」里填任意 OpenAI 兼容接口的地址和 key。不填也能用全写听写和模糊模式；挖空的轻松 / 适中档、拆开教我、查词需要 AI。

### Anki（可选）

装好 [Anki](https://apps.ankiweb.net) 和 [AnkiConnect](https://ankiweb.net/shared/info/2055492159) 插件，练习时开着 Anki 就能一键加卡。

## 从源码运行

需要 Node.js 和 [Rust](https://www.rust-lang.org/tools/install)。

```bash
npm install
npx tauri dev
```

打包：`npx tauri build`。技术细节见 [docs/](docs/README.md)。

## 开源协议

[AGPL-3.0](LICENSE)。可以自由使用、修改、分发；改过的版本（包括做成网络服务）也要以同样协议开源。

---

## English

**LinguaClip** turns any video into a listening-dictation exercise. Built with Tauri, for macOS (Apple Silicon) and Windows 10/11 (x64).

- Sentence-by-sentence dictation; checking highlights only the words you missed
- Cloze levels (easy / medium / full), blur mode for shadowing
- "Break it down": AI picks the useful phrases and grammar in a sentence, you hear them in clear TTS first, then catch them in the original audio
- Click-to-look-up words, one-click Anki cards with the original audio (card style set up for you)
- 4-minute sections with saved progress; videos never leave your machine

**Install (Windows):** run `LinguaClip_x.x.x_x64-setup.exe` from Releases; at "Windows protected your PC" choose More info → Run anyway. No YouTube links on Windows.

**Install (Mac):** download `LinguaClip.zip` from Releases and move it to Applications. The app is not notarized: on first launch go to System Settings → Privacy & Security → Open Anyway (or run `xattr -dr com.apple.quarantine /Applications/LinguaClip.app`).

**Subtitles:** add a video together with its `.srt` to start right away. Without one, the app downloads its transcription parts once (about 580 MB) and transcribes locally with whisper. Pasting YouTube links is for Mac tinkerers: `brew install yt-dlp ffmpeg node` and the link box appears. AI features take any OpenAI-compatible endpoint and key. Anki cards need the AnkiConnect add-on.

**License:** [AGPL-3.0](LICENSE).
