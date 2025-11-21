# 📦 Vercel 部署指南

本指南将帮助您将视频字幕学习应用部署到 Vercel，让全世界的人都能访问和使用。

---

## 🎯 部署前准备

### 1. 确保您有以下账号：
- ✅ **GitHub 账号**（推荐）或 GitLab/Bitbucket 账号
- ✅ **Vercel 账号**（可以用 GitHub 账号直接登录）

### 2. 确保您的代码已上传到 Git 仓库：
如果还没有，请按以下步骤操作：

```bash
# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "准备部署到 Vercel"

# 在 GitHub 上创建新仓库，然后关联
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

---

## 🚀 部署步骤

### 步骤 1: 登录 Vercel

1. 访问 [https://vercel.com](https://vercel.com)
2. 点击右上角 **"Sign Up"** 或 **"Login"**
3. 选择 **"Continue with GitHub"**（推荐）
4. 授权 Vercel 访问您的 GitHub 账号

### 步骤 2: 导入项目

1. 登录后，点击 **"Add New..."** → **"Project"**
2. 在 "Import Git Repository" 页面，找到您的项目仓库
3. 点击仓库旁边的 **"Import"** 按钮

### 步骤 3: 配置项目

Vercel 会自动检测到这是一个 Vite 项目，并自动配置：

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

✅ 这些配置通常不需要修改，Vercel 会自动识别。

### 步骤 4: 配置环境变量（可选）

**🎉 好消息：现在不需要配置环境变量了！**

应用已经更新，用户可以在 Settings 页面输入自己的 Gemini API Key，更加安全和灵活。

如果您想为所有用户提供一个默认的 API Key（不推荐），可以：

1. 在配置页面，找到 **"Environment Variables"** 部分
2. 添加环境变量：`GEMINI_API_KEY`
3. 但建议跳过此步骤，让用户使用自己的 API Key

### 步骤 5: 部署

1. 确认所有配置正确
2. 点击 **"Deploy"** 按钮
3. 等待 2-3 分钟，Vercel 会自动：
   - 安装依赖
   - 构建项目
   - 部署到全球 CDN

### 步骤 6: 访问您的应用

部署成功后，您会看到：
- 🎉 **成功页面**，显示您的应用 URL
- 📱 URL 格式类似：`https://your-project-name.vercel.app`
- 🔗 点击 URL 即可访问您的应用

### 步骤 7: 告诉用户如何使用

部署成功后，用户需要：
1. 访问您的应用
2. 点击 Settings（设置）
3. 在 **AI Configuration** 部分输入自己的 Gemini API Key
4. 保存设置

**如何获取 API Key：**
- 访问 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- 登录 Google 账号
- 点击 "Create API Key"
- 复制并粘贴到应用中

详细说明请参考 `API_KEY_GUIDE.md` 文档。

---

## 🔄 后续更新

每次您推送代码到 GitHub，Vercel 会**自动重新部署**：

```bash
# 修改代码后
git add .
git commit -m "更新功能"
git push

# Vercel 会自动检测并重新部署
```

---

## 🎨 自定义域名（可选）

如果您有自己的域名：

1. 在 Vercel 项目页面，点击 **"Settings"** → **"Domains"**
2. 输入您的域名（如 `myapp.com`）
3. 按照提示在您的域名服务商处添加 DNS 记录
4. 等待 DNS 生效（通常几分钟到几小时）

---

## ⚠️ 重要提示

### API Key 安全性

**✅ 当前方案：用户自己输入 API Key（最安全）**

- 每个用户在 Settings 页面输入自己的 Gemini API Key
- API Key 存储在用户浏览器的 localStorage 中
- 不会发送到任何服务器
- 用户使用自己的 API 配额，不会被他人滥用

**优点：**
- 🔒 完全安全，API Key 不会泄露
- 💰 每个用户使用自己的免费配额
- 🎯 无需担心配额被滥用
- 🚀 部署简单，无需配置环境变量

**用户需要做什么：**
- 访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取免费 API Key
- 在应用 Settings 中输入 API Key
- 开始使用 AI 功能

---

## 🐛 常见问题

### Q: 部署失败怎么办？
A: 检查 Vercel 的构建日志，通常是：
- 依赖安装失败：检查 `package.json`
- 构建错误：检查 TypeScript 类型错误
- 环境变量未设置：确保添加了 `GEMINI_API_KEY`

### Q: 应用可以访问但 AI 功能不正常？
A:
- 确保用户已在 Settings 中输入了有效的 Gemini API Key
- 打开浏览器开发者工具（F12）查看控制台错误
- 检查 API Key 是否正确（访问 Google AI Studio 验证）
- 确保 API Key 有足够的配额（免费额度：每天 1500 次请求）

### Q: 如何查看部署日志？
A: 在 Vercel 项目页面，点击 **"Deployments"** 查看所有部署记录和日志

---

## 📞 需要帮助？

如果遇到任何问题，请：
1. 查看 Vercel 的构建日志
2. 检查浏览器控制台错误信息
3. 将错误信息反馈给我，我会帮您解决

---

## ✅ 部署检查清单

在部署前，请确认：

- [ ] 代码已推送到 GitHub/GitLab
- [ ] 已注册 Vercel 账号
- [ ] 已点击 Deploy 按钮
- [ ] 部署成功并可以访问
- [ ] 已告知用户如何获取和输入 API Key（参考 `API_KEY_GUIDE.md`）

---

🎉 **恭喜！您的应用现在已经可以在全球访问了！**

