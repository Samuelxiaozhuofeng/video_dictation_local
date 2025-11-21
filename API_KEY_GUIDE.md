# 🔑 Gemini API Key 使用指南

本应用使用 Google Gemini AI 来提供单词定义功能。为了使用此功能，您需要提供自己的 Gemini API Key。

---

## 📝 为什么需要 API Key？

- **安全性**：您的 API Key 只存储在您的浏览器本地，不会发送到任何服务器
- **配额控制**：使用您自己的配额，不受他人使用影响
- **免费额度**：Google 提供慷慨的免费额度，足够个人使用

---

## 🎯 如何获取 Gemini API Key

### 步骤 1: 访问 Google AI Studio

打开浏览器，访问：
```
https://aistudio.google.com/app/apikey
```

### 步骤 2: 登录 Google 账号

使用您的 Google 账号登录（Gmail 账号）

### 步骤 3: 创建 API Key

1. 点击页面上的 **"Create API Key"** 按钮
2. 选择一个 Google Cloud 项目（如果没有，系统会自动创建一个）
3. 等待几秒钟，API Key 就会生成

### 步骤 4: 复制 API Key

1. 生成后，您会看到一串类似这样的字符串：
   ```
   AIzaSyD...（约40个字符）
   ```
2. 点击 **"Copy"** 按钮复制 API Key
3. **重要**：妥善保管这个 Key，不要分享给他人

---

## 🔧 如何在应用中使用

### 方法 1: 在 Settings 页面输入（推荐）

1. 打开应用
2. 点击右上角的 **Settings** 图标
3. 在 **AI Configuration** 部分找到 **"Gemini API Key"** 输入框
4. 粘贴您的 API Key
5. 点击 **Save** 保存

### 方法 2: 使用环境变量（开发者）

如果您是开发者，可以在项目根目录创建 `.env` 文件：

```env
GEMINI_API_KEY=your_api_key_here
```

---

## 💰 免费额度说明

Google Gemini API 提供慷慨的免费额度：

- **Gemini 2.5 Flash**（推荐）：
  - 每分钟 15 次请求
  - 每天 1500 次请求
  - 完全免费

- **Gemini Flash Lite**（最快）：
  - 每分钟 15 次请求
  - 每天 1500 次请求
  - 完全免费

对于个人学习使用，这个额度完全足够！

---

## 🔒 安全性说明

### 您的 API Key 是安全的

- ✅ **本地存储**：API Key 存储在您的浏览器 localStorage 中
- ✅ **不会上传**：不会发送到任何第三方服务器
- ✅ **仅用于 AI**：只用于调用 Google Gemini API
- ✅ **可随时删除**：您可以随时在 Settings 中清空或更改

### 最佳实践

1. **不要分享**：不要将您的 API Key 分享给他人
2. **定期更换**：如果担心泄露，可以在 Google AI Studio 中重新生成
3. **监控使用**：在 [Google Cloud Console](https://console.cloud.google.com) 中可以查看 API 使用情况

---

## ❓ 常见问题

### Q: API Key 会过期吗？
A: 不会。除非您手动删除或重新生成，API Key 会一直有效。

### Q: 如果超过免费额度怎么办？
A: 对于个人学习使用，很难超过免费额度。如果真的超过了，API 会返回错误，您可以等到第二天额度重置。

### Q: 可以多个设备使用同一个 API Key 吗？
A: 可以，但要注意共享配额。建议每个设备使用独立的 API Key。

### Q: 忘记保存 API Key 怎么办？
A: 可以在 Google AI Studio 中查看现有的 API Key，或者重新生成一个新的。

### Q: API Key 泄露了怎么办？
A: 立即在 Google AI Studio 中删除该 API Key，并生成一个新的。

---

## 🆘 需要帮助？

如果您在获取或使用 API Key 时遇到问题：

1. 查看 [Google AI Studio 文档](https://ai.google.dev/docs)
2. 检查浏览器控制台（F12）的错误信息
3. 确保 API Key 已正确复制（没有多余的空格）

---

## 📚 相关链接

- [Google AI Studio](https://aistudio.google.com/app/apikey) - 获取 API Key
- [Gemini API 文档](https://ai.google.dev/docs) - 官方文档
- [Google Cloud Console](https://console.cloud.google.com) - 管理项目和配额

---

🎉 **现在您可以开始使用 AI 功能了！**

