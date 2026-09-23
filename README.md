# LinguaClip

**用你爱看的视频，练出真听力。** 一个 Mac 桌面听写 App：拖进任意视频，自动出字幕，一句一句听、一句一句打。

> A macOS dictation app: drop in any video, get subtitles generated locally, and practice listening sentence by sentence. [English below](#english)

## 它能做什么

- **一句一句听写**：听一句打一句，对答案时只标出你听错的词
- **挖空三档**：轻松（每句只打 2–3 个词）/ 适中（约一半）/ 全写
- **模糊模式**：字幕先糊住，听不出来再看，适合跟读
- **拆开教我**：AI 挑出这句里值得学的搭配和语法，先听标准朗读一块块练，再回到原声里把它听出来
- **点词就查**，一键做成 Anki 单词卡 / 带原声的音频卡
- **按 4 分钟一段练**，进度自动保存，下次接着来
- **视频只存在你自己的电脑上**：不上传、不用注册

## 安装

需要：macOS，Apple 芯片（M1 及以后）。

1. 到 [Releases](https://github.com/Samuelxiaozhuofeng/video_dictation_local/releases) 下载 `LinguaClip.zip`，解压后拖进「应用程序」。
2. App 没有经过苹果付费签名，第一次打开会被拦下（提示「无法验证开发者」或「已损坏」）。打开「终端」运行下面这行，再双击就能打开：

   ```bash
   xattr -dr com.apple.quarantine /Applications/LinguaClip.app
   ```

### 自动生成字幕需要的工具

字幕在你电脑上用 whisper 本地识别，需要先装好这些工具（需要 [Homebrew](https://brew.sh)）：

```bash
brew install ffmpeg whisper-cpp yt-dlp node
```

再下载识别模型（约 1.6 GB）：

```bash
mkdir -p ~/.cache/whisper.cpp && cd ~/.cache/whisper.cpp
curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
curl -LO https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
```

`yt-dlp` 和 `node` 只在粘贴 YouTube 链接时用到，第一次会让你在 App 里登录 YouTube。请只下载你有权使用的视频。

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

**LinguaClip** turns any video into a listening-dictation exercise. Built with Tauri, macOS on Apple Silicon only.

- Sentence-by-sentence dictation; checking highlights only the words you missed
- Cloze levels (easy / medium / full), blur mode for shadowing
- "Break it down": AI picks the useful phrases and grammar in a sentence, you hear them in clear TTS first, then catch them in the original audio
- Click-to-look-up words, one-click Anki word and audio cards
- 4-minute sections with saved progress; videos never leave your machine

**Install:** download `LinguaClip.zip` from Releases, move it to Applications, then run `xattr -dr com.apple.quarantine /Applications/LinguaClip.app` (the app is not notarized). Local subtitle generation needs `brew install ffmpeg whisper-cpp yt-dlp node` plus the two whisper models listed above. AI features take any OpenAI-compatible endpoint and key. Anki cards need the AnkiConnect add-on.

**License:** [AGPL-3.0](LICENSE).
