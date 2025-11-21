# 视频历史记录功能开发计划

## 📊 需求总结
1. ✅ 选项 C: 混合存储方案（File System Access API + IndexedDB）
2. ✅ 选项 A: 简单进度追踪
3. ✅ 选项 B: Tab 切换布局
4. ✅ 选项 A: 自动生成标识

---

## 🎯 核心功能

### 功能 1: 视频历史记录存储
- 保存视频和字幕文件的引用
- 记录练习进度（当前字幕索引）
- 显示完成百分比

### 功能 2: 新的 Homepage 布局
- Tab 1: "My Videos" - 显示历史记录
- Tab 2: "Upload New" - 上传新视频

### 功能 3: 进度自动保存和恢复
- 练习过程中自动保存进度
- 从历史记录打开时恢复进度

---

## 📁 文件结构

### 新建文件
```
utils/
  ├── videoStorage.ts          (视频历史记录存储)
  └── fileSystemAccess.ts      (文件访问和 IndexedDB)

components/
  ├── VideoLibrary.tsx         (视频历史列表)
  └── UploadSection.tsx        (上传界面)
```

### 修改文件
```
types.ts                        (添加新类型)
utils/storage.ts                (扩展功能)
App.tsx                         (重构 UPLOAD 状态)
```

---

## 🗂️ 数据结构设计

### 1. VideoRecord (视频记录)
```typescript
interface VideoRecord {
  id: string;                    // UUID
  displayName: string;           // 文件名
  videoFileName: string;         // 原始视频文件名
  subtitleFileName: string;      // 原始字幕文件名
  
  // 文件访问
  videoFileHandle?: FileSystemFileHandle;  // File System Access API
  subtitleText: string;          // 字幕内容（存储在 IndexedDB）
  
  // 进度信息
  currentSubtitleIndex: number;  // 当前字幕索引
  totalSubtitles: number;        // 总字幕数
  completionRate: number;        // 完成百分比 (0-100)
  
  // 元数据
  dateAdded: number;             // 添加时间
  lastPracticed: number;         // 最后练习时间
  totalPracticeTime: number;     // 总练习时长（秒）
}
```

### 2. PracticeProgress (练习进度)
```typescript
interface PracticeProgress {
  videoId: string;
  currentSubtitleIndex: number;
  currentSectionIndex: number;
  lastUpdated: number;
}
```

---

## 🔄 实现步骤

### 阶段 1: 基础设施（1-2小时）✅ 完成
- [x] 创建 `types.ts` 中的新类型定义
- [x] 创建 `utils/fileSystemAccess.ts`
- [x] 创建 `utils/videoStorage.ts`
- [x] 测试存储和读取功能

### 阶段 2: UI 组件（2-3小时）✅ 完成
- [x] 创建 `components/UploadSection.tsx`
- [x] 创建 `components/VideoLibrary.tsx`
- [x] 实现 Tab 切换逻辑

### 阶段 3: 集成到 App.tsx（1-2小时）✅ 完成
- [x] 重构 UPLOAD 状态的渲染
- [x] 添加从历史记录启动练习的逻辑
- [x] 实现进度自动保存

### 阶段 4: 进度管理（1小时）✅ 完成
- [x] 在练习过程中自动保存进度
- [x] 从历史记录恢复进度
- [x] 更新完成百分比

### 阶段 5: 测试和优化（1小时）✅ 完成
- [x] 测试文件访问权限
- [x] 测试进度保存和恢复
- [x] 优化用户体验
- [x] 错误处理

**总预计时间: 6-9 小时** ✅ **已完成！**

---

## 🎨 UI 设计草图

### Homepage - Tab 布局
```
┌─────────────────────────────────────────────────────┐
│  LinguaClip Practice                    [⚙️] [📚]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┬──────────────────┐          │
│  │  📚 My Videos    │  ➕ Upload New   │          │
│  └──────────────────┴──────────────────┘          │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ 📹 spanish_lesson.mp4                       │  │
│  │ ●●●●●●●●○○ 80%                              │  │
│  │ Last practiced: 2 hours ago                 │  │
│  │ 45 / 200 subtitles completed                │  │
│  │                                              │  │
│  │ [Continue Practice]  [🗑️ Delete]            │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ 📹 french_movie.mp4                         │  │
│  │ ●●●○○○○○○○ 30%                              │  │
│  │ Last practiced: Yesterday                   │  │
│  │ 60 / 180 subtitles completed                │  │
│  │                                              │  │
│  │ [Continue Practice]  [🗑️ Delete]            │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔑 关键技术点

### 1. File System Access API
```typescript
// 请求文件访问权限
const fileHandle = await window.showOpenFilePicker({
  types: [{
    description: 'Video files',
    accept: { 'video/*': ['.mp4', '.webm', '.mkv'] }
  }]
});

// 保存 handle 到 IndexedDB
await saveFileHandle(fileHandle);

// 下次使用时读取
const file = await fileHandle.getFile();
```

### 2. IndexedDB 存储
```typescript
// 存储字幕文本和元数据
const db = await openDB('linguaclip', 1, {
  upgrade(db) {
    db.createObjectStore('videos', { keyPath: 'id' });
    db.createObjectStore('fileHandles', { keyPath: 'id' });
  }
});
```

### 3. 进度自动保存
```typescript
// 在 App.tsx 中添加 useEffect
useEffect(() => {
  if (currentVideoId && appState === AppState.PRACTICE) {
    // 每次字幕索引变化时保存进度
    saveProgress(currentVideoId, currentSubtitleIndex);
  }
}, [currentSubtitleIndex, currentVideoId]);
```

---

## ⚠️ 注意事项

### 浏览器兼容性
- File System Access API 仅支持 Chrome/Edge (88+)
- 需要提供降级方案（重新上传文件）

### 权限管理
- 用户需要授权文件访问
- 文件移动后需要重新授权

### 存储限制
- IndexedDB 通常有几 GB 的限制
- 字幕文件很小，不会有问题
- 视频文件不存储，只存引用

---

## ✅ 实现完成总结

### 已创建的文件

1. **utils/fileSystemAccess.ts** (167 行)
   - IndexedDB 初始化和管理
   - 视频记录的 CRUD 操作
   - File System Access API 集成（用于保存文件句柄）

2. **utils/videoStorage.ts** (175 行)
   - 视频记录创建和管理
   - 进度更新和追踪
   - 时间格式化工具函数

3. **components/VideoLibrary.tsx** (169 行)
   - 视频历史记录列表显示
   - 进度条可视化
   - 删除和继续练习功能

4. **components/UploadSection.tsx** (165 行)
   - 文件上传界面
   - 拖放支持
   - 自动检测视频和字幕文件

### 修改的文件

1. **types.ts**
   - 添加 `VideoRecord` 接口
   - 添加 `PracticeProgress` 接口

2. **App.tsx**
   - 添加视频历史记录状态管理
   - 实现 Tab 切换逻辑
   - 集成进度自动保存
   - 添加从历史记录继续练习的功能

### 核心功能

✅ **视频历史记录**
- 自动保存上传的视频信息到 IndexedDB
- 显示视频列表，按最后练习时间排序

✅ **进度自动保存**
- 每次字幕索引变化时自动保存进度
- 保存当前字幕索引、章节索引、完成百分比

✅ **Tab 切换界面**
- "My Videos" 标签：显示历史记录
- "Upload New" 标签：上传新视频

✅ **继续练习**
- 从历史记录点击继续
- 提示用户重新选择视频文件（浏览器限制）
- 自动恢复字幕和进度

### 用户体验改进

1. **友好的提示信息**
   - 解释为什么需要重新选择视频文件
   - 在视频卡片上显示提示

2. **进度可视化**
   - 10 个圆点的进度条
   - 百分比显示
   - 已完成/总字幕数

3. **时间格式化**
   - "Just now", "2 minutes ago", "Yesterday" 等人性化显示

### 技术实现

1. **IndexedDB 存储**
   - 两个对象存储：`videos` 和 `fileHandles`
   - 异步操作，Promise 封装

2. **File System Access API**
   - 尝试保存文件句柄以便下次访问
   - 降级方案：提示用户重新选择文件

3. **React Hooks**
   - `useEffect` 自动保存进度
   - `useState` 管理 Tab 状态

## 🎉 开发完成！

所有功能已实现并测试。请查看 `TESTING_GUIDE.md` 了解如何测试新功能。

