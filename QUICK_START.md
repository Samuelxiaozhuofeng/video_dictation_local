# 快速开始指南

## 🚀 启动应用

### 1. 安装依赖
```bash
npm install
```

### 2. 配置 API Key（可选）
编辑 `.env.local` 文件，设置 Gemini API Key（用于 AI 单词定义功能）:
```
GEMINI_API_KEY=your_api_key_here
```

### 3. 启动开发服务器
```bash
npm run dev
```

应用将在 http://localhost:3000 或 http://localhost:3001 启动

## 📝 使用流程

### 基础练习流程
1. **上传文件**
   - 上传视频文件 (.mp4)
   - 上传字幕文件 (.srt)
   - 点击 "Start Practice Session"

2. **观看和听**
   - 视频自动播放当前字幕片段
   - 专注听清楚每个单词

3. **输入练习**
   - 视频暂停后，输入框出现
   - 只需输入单词，标点符号会自动显示
   - 输入正确的单词会自动跳到下一个（绿色高亮）

4. **自动进度**
   - 所有单词输入正确后，视频自动重播该片段
   - 重播完成后自动进入下一个字幕

### 快捷键
- **空格键**: 跳到下一个输入框
- **回车键**: 提交当前输入
- **退格键**: 在空输入框时返回上一个
- **方向键**: 在输入框间导航

## 🌍 多语言支持

### 支持的语言
应用现在支持所有 Unicode 字符，包括：

#### 西班牙语 (Español)
- 特殊字符: ñ, á, é, í, ó, ú, ü
- 测试字幕: `TEST_SPANISH_SUBTITLES.srt`
- 示例: "¿Cómo estás? El niño está en España."

#### 法语 (Français)
- 特殊字符: à, â, ç, è, é, ê, ë, î, ï, ô, ù, û, ü, ÿ
- 示例: "C'est très intéressant!"

#### 德语 (Deutsch)
- 特殊字符: ä, ö, ü, ß
- 示例: "Ich möchte ein Stück Käse."

#### 其他语言
- ✅ 中文、日文、韩文
- ✅ 阿拉伯语、希伯来语
- ✅ 俄语、希腊语
- ✅ 所有使用 Unicode 字符的语言

## 🎯 功能特性

### 1. 智能输入
- ✨ 标点符号自动显示
- ✨ 正确输入自动跳转
- ✨ 实时视觉反馈（绿色高亮）
- ✨ 自动完成和重播

### 2. 视频分段
- 可选择分段长度: 1/2/3/5/10 分钟或完整视频
- 每段完成后显示进度
- 减少学习疲劳

### 3. Anki 集成
- 一键添加句子到 Anki
- 支持截图和音频
- 自定义字段映射
- 需要安装 AnkiConnect 插件

### 4. AI 单词定义
- 点击单词查看 AI 定义
- 使用 Google Gemini AI
- 显示词性和释义
- 可直接添加到 Anki

### 5. 收藏功能
- 收藏有趣的句子
- 在 Library 中查看和管理
- 本地存储，永久保存

## 🧪 测试文件

### 英语测试
使用 `TEST_SUBTITLES.srt`:
```
Hello, world! How are you?
I'm fine, thank you.
Don't worry, it's okay.
```

### 西班牙语测试
使用 `TEST_SPANISH_SUBTITLES.srt`:
```
¡Hola! ¿Cómo estás?
El niño está en España.
José y María están en Bogotá.
```

## ⚙️ 设置配置

### 练习模式
- **Section Length**: 选择视频分段长度
- 0 = 完整视频（不分段）
- 1-10 分钟 = 自动分段

### AI 配置
- **Model**: 选择 Gemini 模型
  - gemini-2.5-flash (推荐)
  - gemini-flash-lite-latest (最快)
  - gemini-3-pro-preview (最佳质量)
- **Temperature**: 调整创造性 (0-2)
- **Prompt Template**: 自定义提示词

### Anki 配置
1. 确保 Anki 正在运行
2. 安装 AnkiConnect 插件
3. 在设置中连接到 Anki
4. 选择目标 Deck 和 Note Type
5. 映射字段

## 🔧 故障排除

### 应用无法启动
```bash
# 清除 node_modules 重新安装
rm -rf node_modules
npm install
npm run dev
```

### 端口被占用
应用会自动尝试其他端口（3001, 3002 等）

### Anki 连接失败
1. 确保 Anki 正在运行
2. 确保安装了 AnkiConnect 插件
3. 检查 URL 是否正确（默认: http://127.0.0.1:8765）

### AI 定义不工作
1. 检查 `.env.local` 中的 API Key
2. 确保有网络连接
3. 检查 API 配额

### 字符显示为标点符号
✅ 已修复！现在支持所有 Unicode 字符
- 如果仍有问题，请刷新页面
- 确保使用最新版本的代码

## 📚 文档

- `FEATURE_UPDATE.md` - 新功能详细说明
- `IMPLEMENTATION_SUMMARY.md` - 技术实现总结
- `UNICODE_FIX.md` - Unicode 支持修复说明
- `README.md` - 项目基本信息

## 🧪 运行测试

### 测试分词器
```bash
node test-tokenizer.js
```

应该看到:
```
📊 Results: 6 passed, 0 failed out of 6 tests
🎉 All tests passed! Unicode support is working correctly.
```

## 💡 使用技巧

### 提高学习效率
1. **选择合适的分段长度**: 初学者建议 2-3 分钟
2. **重复练习**: 对于难的片段，可以重复练习
3. **使用收藏功能**: 收藏重要的句子，定期复习
4. **结合 Anki**: 将难词添加到 Anki，系统化复习

### 最佳实践
1. **专注听**: 第一遍专注听，不要急于输入
2. **逐字输入**: 不要复制粘贴，手动输入加深记忆
3. **利用 AI**: 遇到生词点击查看定义
4. **定期复习**: 在 Library 中复习收藏的句子

## 🎉 开始学习

现在你已经准备好开始学习了！

1. 准备你喜欢的视频和字幕
2. 启动应用
3. 开始练习
4. 享受学习过程！

祝学习愉快！🚀

