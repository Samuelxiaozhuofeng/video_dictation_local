# 宣传视频（横屏 1080p、中文、真 App 界面）

做法：动画是一个网页（`seek(t)` 决定画面）→ Playwright 逐帧截图 → ffmpeg 拼 MP4；配乐 / 音效用代码算出来。

- [x] 1. 摸清 App 能拍的画面（首页、添加视频、练习打字、对答案、收藏 / 查词 / Anki）
- [x] 2. `capture.mjs`：用 Playwright 在浏览器 dev 里把这些画面真实操作一遍、逐状态截图到 `shots/`
- [x] 3. 分镜定稿（约 35 秒）
- [x] 4. `index.html`：动画网页，`seek(t)` 摆放截图、标语、光标、缩放
- [x] 5. `render.mjs`：6 路并行逐帧截图（2 倍截再缩到 1080p）→ ffmpeg 出无声 MP4
- [x] 6. `music.mjs`：代码合成配乐 + 卡点音效 → wav，合进视频
- [x] 7. 自己看一遍成片（抽帧检查），交给用户

## 怎么重做
- 先开 `npm run dev`（项目根），再 `npm run capture` 重拍 App 素材（样片、打的句子在 capture.mjs 顶上）
- 改时间 / 字幕 / 镜头：只动 `storyboard.js`
- `npm run video` → `out/LinguaClip宣传片.mp4`；只看某几秒：`node render.mjs 5 14 23` → `out/still-*.png`
- 直接浏览器打开 index.html（经 render.mjs 那种静态服务）可拖进度条预览

# 第二版：60 秒、讲卖点（只用画面大字）
- [x] 1. capture.mjs 加拍：YouTube 链接导入、⌘X 偷看、「…」菜单、挖空轻松/适中、拆开教我全流程、收藏页、模糊模式
- [x] 2. 分镜：产品介绍卡、为什么听写卡、AI 断句动画卡、各功能段、片尾卖点汇总
- [x] 3. index.html 按新分镜重排（单文件不超 500 行，超了把分镜数据拆出去）
- [x] 4. 音乐时长跟着变，出片、抽帧检查
