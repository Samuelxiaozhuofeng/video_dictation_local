# Settings Component Testing Checklist

## 测试清单 (Testing Checklist)

在部署重构后的代码之前，请按照以下清单进行测试：

### ✅ 基础功能测试 (Basic Functionality)

#### General Tab (通用设置)
- [ ] 打开设置页面，默认显示 General Tab
- [ ] 点击 Section Length 按钮，确认选中状态正确显示
- [ ] 修改 Section Length，确认提示文字正确更新
- [ ] 拖动 Start Padding 滑块，确认数值实时更新
- [ ] 拖动 End Padding 滑块，确认数值实时更新
- [ ] 点击 Save，确认设置被保存
- [ ] 刷新页面，确认设置被正确加载

#### AI Tab (AI 设置)
- [ ] 切换到 AI Tab
- [ ] 输入 API Key，确认输入框正常工作
- [ ] 修改 Model 下拉菜单，确认选项正确
- [ ] 拖动 Temperature 滑块，确认数值实时更新
- [ ] 修改 Prompt 文本框，确认可以正常编辑
- [ ] 点击 "Reset to Default"，确认 Prompt 恢复默认值
- [ ] 点击 Save，确认设置被保存
- [ ] 刷新页面，确认设置被正确加载

#### Anki Tab (Anki 设置)
- [ ] 切换到 Anki Tab
- [ ] 输入 AnkiConnect URL
- [ ] 点击 Connect 按钮
  - [ ] 如果 Anki 未运行，显示错误提示
  - [ ] 如果 Anki 运行中，显示成功提示
- [ ] 连接成功后，确认 Card Configuration 区域显示
- [ ] 选择 Word Card 的 Deck，确认下拉菜单正常
- [ ] 选择 Word Card 的 Note Type，确认下拉菜单正常
- [ ] 选择 Note Type 后，确认 Field Mapping 区域显示
- [ ] 配置 Field Mapping，确认可以正常选择
- [ ] 选择 Audio Card 的 Deck，确认下拉菜单正常
- [ ] 选择 Audio Card 的 Note Type，确认下拉菜单正常
- [ ] 选择 Note Type 后，确认 Field Mapping 区域显示
- [ ] 配置 Field Mapping，确认可以正常选择
- [ ] 点击 Save，确认设置被保存
- [ ] 刷新页面，确认设置被正确加载

### ✅ Tab 切换测试 (Tab Switching)
- [ ] 从 General 切换到 AI，确认内容正确显示
- [ ] 从 AI 切换到 Anki，确认内容正确显示
- [ ] 从 Anki 切换到 General，确认内容正确显示
- [ ] 快速连续切换 Tab，确认没有错误

### ✅ 保存功能测试 (Save Functionality)
- [ ] 修改 General 设置，点击顶部 Save 按钮，确认保存成功提示
- [ ] 修改 AI 设置，点击底部 Save Configuration 按钮，确认保存成功提示
- [ ] 修改 Anki 设置，点击 Save 按钮，确认保存成功提示
- [ ] 同时修改多个 Tab 的设置，点击 Save，确认所有设置都被保存
- [ ] 保存成功提示在 2.5 秒后自动消失
- [ ] 点击 Dismiss 按钮，确认提示立即消失

### ✅ 数据持久化测试 (Data Persistence)
- [ ] 配置所有设置，点击 Save
- [ ] 刷新页面，确认所有设置被正确加载
- [ ] 关闭浏览器，重新打开，确认所有设置仍然存在
- [ ] 清除浏览器缓存，确认设置被清除

### ✅ 边界情况测试 (Edge Cases)
- [ ] 不输入 API Key，确认可以保存（可选字段）
- [ ] 输入无效的 AnkiConnect URL，确认显示错误提示
- [ ] 在未连接 Anki 的情况下保存，确认不会报错
- [ ] 选择 Deck 但不选择 Note Type，确认可以保存
- [ ] 选择 Note Type 但不配置 Field Mapping，确认可以保存

### ✅ UI/UX 测试 (UI/UX)
- [ ] 所有按钮的 hover 效果正常
- [ ] 所有输入框的 focus 效果正常
- [ ] Tab 切换动画流畅
- [ ] 保存成功提示样式正确
- [ ] 错误提示样式正确
- [ ] 响应式布局在不同屏幕尺寸下正常显示

### ✅ 性能测试 (Performance)
- [ ] 打开设置页面速度正常
- [ ] Tab 切换无明显延迟
- [ ] 保存操作响应迅速
- [ ] 没有内存泄漏（长时间使用后）

### ✅ 兼容性测试 (Compatibility)
- [ ] Chrome 浏览器正常工作
- [ ] Firefox 浏览器正常工作
- [ ] Edge 浏览器正常工作
- [ ] Safari 浏览器正常工作（如果适用）

### ✅ 控制台检查 (Console Check)
- [ ] 打开浏览器控制台，确认没有错误
- [ ] 确认没有警告（除了预期的警告）
- [ ] 确认没有 TypeScript 类型错误

## 回归测试 (Regression Testing)

确认重构没有破坏其他功能：

- [ ] 从设置页面返回主页面，确认正常
- [ ] 在练习模式中使用设置的配置，确认正常
- [ ] 添加 Anki 卡片，确认使用正确的配置
- [ ] AI 功能正常工作，使用正确的 API Key 和配置

## 已知问题 (Known Issues)

目前没有已知问题。如果发现问题，请在此记录：

1. 

## 测试结果 (Test Results)

- 测试日期: ___________
- 测试人员: ___________
- 测试环境: ___________
- 测试结果: [ ] 通过 / [ ] 失败
- 备注: ___________

