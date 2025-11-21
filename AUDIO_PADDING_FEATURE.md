# Audio Padding Feature Implementation

## 概述
此功能解决了在添加音频到 Anki 时，音频录制不完整的问题（特别是结尾部分被截断）。通过添加可配置的 padding 时间，确保音频的开头和结尾都能完整录制。

## 实现的功能

### 1. 核心功能
- ✅ 在音频录制时自动添加 padding 时间（开头和结尾）
- ✅ 默认值：开头 100ms，结尾 200ms
- ✅ 边界检查：如果 padding 导致超出视频范围，会提示用户错误
- ✅ 只影响录制，不影响用户在练习时听到的内容

### 2. 用户界面

#### 播放器界面（实时调整）
- 在播放器控制栏右侧添加了一个低调的设置图标按钮
- 点击后弹出小面板，可以实时调整 padding 值
- 范围：0-1000ms，步进 50ms
- 位置：不抢眼，与其他控制按钮保持一致的风格

#### 设置页面（默认值配置）
- 添加了 "Audio Recording Padding" 配置区域
- 包含详细的说明文字，帮助用户理解功能
- 推荐值提示：开头 100ms，结尾 200ms
- 滑块控制，范围 0-1000ms

### 3. 技术实现

#### 修改的文件

1. **types.ts**
   - 添加 `AudioPaddingConfig` 接口
   ```typescript
   export interface AudioPaddingConfig {
     startPadding: number; // in milliseconds
     endPadding: number;   // in milliseconds
   }
   ```

2. **utils/storage.ts**
   - 添加 `getAudioPaddingConfig()` 函数
   - 添加 `saveAudioPaddingConfig()` 函数
   - 默认值：`{ startPadding: 100, endPadding: 200 }`

3. **hooks/useAnkiIntegration.ts**
   - 修改 `captureAudioClip()` 函数
   - 应用 padding 到录制的开始和结束时间
   - 添加边界检查，防止超出视频范围
   - 如果超出范围，抛出详细的错误信息

4. **components/PracticeLayout.tsx**
   - 添加 padding 控制状态
   - 在控制栏添加设置按钮
   - 添加弹出式 padding 控制面板
   - 实时保存用户的调整

5. **components/Settings.tsx**
   - 添加 "Audio Recording Padding" 配置区域
   - 包含开头和结尾 padding 的滑块控制
   - 添加说明文字和推荐值提示

## 使用方法

### 方法 1：在播放器中实时调整
1. 在练习视频时，点击控制栏右侧的设置图标（⚙️）
2. 在弹出的面板中调整 "Start" 和 "End" padding 值
3. 调整会立即保存并应用到下次录制

### 方法 2：在设置页面配置默认值
1. 进入设置页面
2. 找到 "Audio Recording Padding" 区域
3. 使用滑块调整开头和结尾的 padding 时间
4. 点击 "Save" 保存设置

## 错误处理

如果 padding 导致录制时间超出视频范围，系统会显示友好的错误提示：

- **开头超出**：`Audio padding error: Start time (-0.05s) is before video start. Please reduce start padding.`
- **结尾超出**：`Audio padding error: End time (125.30s) exceeds video duration (120.00s). Please reduce end padding.`

## 技术细节

### 边界检查逻辑
```typescript
const paddedStart = start - startPaddingSec;
const paddedEnd = end + endPaddingSec;

if (paddedStart < 0) {
  throw new Error(`Audio padding error: Start time (${paddedStart.toFixed(2)}s) is before video start. Please reduce start padding.`);
}
if (paddedEnd > video.duration) {
  throw new Error(`Audio padding error: End time (${paddedEnd.toFixed(2)}s) exceeds video duration (${video.duration.toFixed(2)}s). Please reduce end padding.`);
}
```

### 录制时间计算
```typescript
const duration = (paddedEnd - paddedStart) * 1000;
// 额外添加 50ms buffer 确保录制完整
setTimeout(() => {
  if (recorder.state !== 'inactive') {
    recorder.stop();
    video.pause();
  }
}, duration + 50);
```

## 测试建议

1. **基本功能测试**
   - 使用默认 padding 值录制音频，验证开头和结尾是否完整
   - 调整 padding 值，验证是否生效

2. **边界测试**
   - 在视频开头的字幕上添加音频，测试 start padding 边界检查
   - 在视频结尾的字幕上添加音频，测试 end padding 边界检查

3. **UI 测试**
   - 验证播放器中的 padding 控制面板显示正常
   - 验证设置页面的 padding 配置区域显示正常
   - 验证滑块控制和数值显示同步

## 未来改进建议

1. 可以考虑添加 "自动检测" 功能，根据字幕时间间隔自动调整 padding
2. 可以为不同的视频保存不同的 padding 设置
3. 可以添加 "预览" 功能，让用户在录制前听一下带 padding 的音频效果

