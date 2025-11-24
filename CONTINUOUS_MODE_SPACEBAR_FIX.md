# 连续模式空格键暂停/继续功能优化

## 问题描述

在 Blur 模式的 Continuous（连续播放）模式下，用户按空格键暂停视频后，会出现以下错误：

```
Autoplay blocked AbortError: The play() request was interrupted by a call to pause().
```

这是因为视频的自动播放逻辑与用户手动暂停操作产生了冲突。

## 根本原因

在 `useVideoPlayer.ts` 中，有一个 `useEffect` 监听 `isPlaying` 状态的变化。当用户按空格键暂停视频时：

1. `togglePlay()` 函数将 `isPlaying` 设置为 `false`
2. `useEffect` 检测到 `isPlaying` 变为 `false`
3. `useEffect` 立即尝试重新播放视频（因为它认为应该自动播放）
4. 这导致了 `play()` 和 `pause()` 调用冲突

## 解决方案

### 1. 添加用户暂停状态追踪

在 `useVideoPlayer.ts` 中添加一个 `userPausedRef` 来追踪用户是否在连续模式下手动暂停了视频：

```typescript
const userPausedRef = useRef(false); // Track if user manually paused in continuous mode
```

### 2. 在字幕切换时重置暂停状态

当字幕切换到下一句时，重置用户暂停状态，允许视频继续播放：

```typescript
useEffect(() => {
  blurAutoAdvanceRef.current = false;
  // Reset user pause state when subtitle changes
  userPausedRef.current = false;
}, [currentSubtitleIndex, learningMode, blurPlaybackMode]);
```

### 3. 更新 togglePlay 函数

在 `togglePlay` 函数中，当用户暂停或恢复播放时，更新 `userPausedRef`：

```typescript
const togglePlay = useCallback(() => {
  if (!videoRef.current) return;
  const isBlurContinuous = learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS;
  
  if (isPlaying) {
    videoRef.current.pause();
    setIsPlaying(false);
    // Mark that user manually paused in continuous mode
    if (isBlurContinuous) {
      userPausedRef.current = true;
    }
  } else {
    if (mode === PracticeMode.INPUT || mode === PracticeMode.FEEDBACK) {
      handleReplayCurrent();
    } else {
      videoRef.current.play().catch(e => console.error("Play failed", e));
      setIsPlaying(true);
      // Clear user pause flag when resuming
      if (isBlurContinuous) {
        userPausedRef.current = false;
      }
    }
  }
}, [isPlaying, mode, videoRef, handleReplayCurrent, learningMode, blurPlaybackMode]);
```

### 4. 优化自动播放逻辑

在字幕切换的 `useEffect` 中，尊重用户的暂停偏好：

```typescript
// Auto-play logic:
// - In continuous mode: only auto-play if user hasn't manually paused
// - In other modes: always auto-play when subtitle changes
if (!isPlaying) {
  if (isBlurContinuous) {
    // In continuous mode, respect user's pause preference
    if (!userPausedRef.current) {
      videoRef.current.play().catch(e => console.error("Autoplay blocked", e));
      setIsPlaying(true);
    }
  } else {
    // In other modes, always auto-play
    videoRef.current.play().catch(e => console.error("Autoplay blocked", e));
    setIsPlaying(true);
  }
}
```

### 5. 添加 UI 提示

在 `PracticeLayout.tsx` 中，为播放/暂停按钮添加工具提示，提示用户可以使用空格键：

```typescript
title={learningMode === LearningMode.BLUR && blurPlaybackMode === BlurPlaybackMode.CONTINUOUS 
  ? (isPlaying ? "Pause (Space)" : "Play (Space)") 
  : undefined}
```

## 功能说明

### 连续模式下的空格键行为

1. **暂停视频**：按空格键暂停当前播放的视频
2. **继续播放**：再次按空格键恢复播放
3. **自动切换字幕**：当字幕切换到下一句时，如果用户之前暂停了视频，视频会保持暂停状态
4. **重置暂停状态**：当字幕切换时，暂停状态会被重置，这样用户可以在新的字幕开始时重新决定是否暂停

### 其他快捷键

- **Shift + Space**：重播当前字幕
- **Ctrl/Cmd + Left**：跳到上一句
- **Ctrl/Cmd + Right**：跳到下一句
- **Alt + N**：添加到 Anki

## 测试步骤

1. 进入 Blur 模式，选择 Continuous（连续播放）模式
2. 播放视频，按空格键暂停
3. 验证视频已暂停，且没有控制台错误
4. 再次按空格键，验证视频恢复播放
5. 让视频播放到下一句字幕，验证视频继续播放（因为暂停状态已重置）
6. 在新字幕播放时再次按空格键暂停，验证功能正常

## 修改的文件

1. `hooks/useVideoPlayer.ts` - 核心播放逻辑优化
   - 添加 `userPausedRef` 追踪用户暂停状态
   - 优化 `togglePlay` 函数，处理连续模式下的暂停/继续
   - 改进自动播放逻辑，尊重用户的暂停偏好
   - 修复依赖数组问题

2. `components/PracticeLayout.tsx` - 添加 UI 提示
   - 为播放/暂停按钮添加工具提示，显示空格键快捷键

3. `App.tsx` - 添加注释说明快捷键功能
   - 为键盘快捷键添加清晰的注释

## 技术要点

### 状态管理

使用 `useRef` 而不是 `useState` 来追踪用户暂停状态，因为：
- 不需要触发重新渲染
- 避免在 `useEffect` 依赖数组中引起循环更新
- 提供即时的状态访问

### 自动播放策略

- **连续模式**：只有在用户没有手动暂停时才自动播放
- **其他模式**：字幕切换时总是自动播放
- **字幕切换**：重置暂停状态，允许新字幕开始时的自然播放

### 错误处理

所有 `play()` 调用都使用 `.catch()` 处理可能的自动播放阻止错误，避免未捕获的 Promise 拒绝。

