# 字幕输入判断逻辑修复

## 📋 问题描述

原有的字幕输入判断逻辑存在以下问题：

1. **标点符号被错误纳入判断**：用户只需输入单词，但反馈界面将标点符号也纳入比较，导致所有标点符号位置都被标记为错误
2. **逐字符比较导致位置错位**：使用 `wordInputs.join(' ')` 重构用户输入时丢失了标点符号，导致与原文逐字符比较时位置错位
3. **大小写判断不合理**：原逻辑完全不区分大小写，但用户需要首字母可以不同大小写，其他字母必须一致

### 用户示例
- **原文**：`"Oigan, miren aquí en la entrada dice que los tacos,"`
- **用户输入**：`"Oigan Miren aquí en la entrada dicen que los tacos"`

**期望结果**：
- ✅ `Oigan` - 正确
- ✅ `Miren` - 正确（首字母大小写不同，但应该接受）
- ✅ `aquí` - 正确
- ✅ `en` - 正确
- ✅ `la` - 正确
- ✅ `entrada` - 正确
- ❌ `dicen` - 错误（应该是 `dice`）
- ✅ `que` - 正确
- ✅ `los` - 正确
- ✅ `tacos` - 正确
- 标点符号（`,`）不应纳入判断

---

## 🔧 修复方案

### 1. 新增灵活大小写比较函数

在 `utils/textTokenizer.ts` 中添加：

#### `isInputCorrectFlexibleCase()`
```typescript
/**
 * Check if input matches target with flexible first letter case
 * First letter can be different case, but rest must match exactly
 */
export const isInputCorrectFlexibleCase = (input: string, target: string): boolean => {
  const trimmedInput = input.trim();
  const trimmedTarget = target.trim();
  
  if (trimmedInput.length !== trimmedTarget.length) {
    return false;
  }
  
  // Compare first letter (case-insensitive)
  if (trimmedInput[0].toLowerCase() !== trimmedTarget[0].toLowerCase()) {
    return false;
  }
  
  // Compare rest of the word (case-sensitive)
  if (trimmedInput.length > 1) {
    return trimmedInput.slice(1) === trimmedTarget.slice(1);
  }
  
  return true;
};
```

#### `compareWords()`
```typescript
/**
 * Compare user inputs with target words and return detailed results
 * Uses flexible case matching (first letter case-insensitive, rest case-sensitive)
 */
export const compareWords = (tokens: Token[], wordInputs: string[]): WordComparisonResult[] => {
  const wordTokens = getWordTokens(tokens);
  const results: WordComparisonResult[] = [];
  
  for (let i = 0; i < wordTokens.length; i++) {
    const targetWord = wordTokens[i].value;
    const inputWord = wordInputs[i] || '';
    const isCorrect = inputWord && isInputCorrectFlexibleCase(inputWord, targetWord);
    
    results.push({
      targetWord,
      inputWord,
      isCorrect,
      tokenIndex: wordTokens[i].index
    });
  }
  
  return results;
};
```

### 2. 重写反馈显示逻辑

在 `components/InputFeedback.tsx` 中修改 `renderDetailedFeedback()` 函数：

**核心改进**：
- 使用 `compareWords()` 按单词比较，而不是逐字符比较
- 使用 `reconstructText()` 重构完整文本（包含标点符号）
- 按单词高亮错误，标点符号显示为灰色（不参与判断）

```typescript
const renderDetailedFeedback = () => {
  // 按单词比较
  const comparisonResults = compareWords(tokens, wordInputs);
  
  return (
    <div>
      {tokens.map((token, idx) => {
        if (token.type === TokenType.WORD) {
          const wordResult = comparisonResults.find(r => r.tokenIndex === token.index);
          const isCorrect = wordResult.isCorrect;
          
          return (
            <span className={isCorrect ? 'text-emerald-400' : 'text-rose-400 bg-rose-500/20'}>
              {wordResult.inputWord}
            </span>
          );
        } else if (token.type === TokenType.PUNCTUATION) {
          // 标点符号不参与判断，显示为灰色
          return <span className="text-slate-400">{token.value}</span>;
        }
      })}
    </div>
  );
};
```

### 3. 更新所有相关函数

- `handleInputChange()` - 使用 `isInputCorrectFlexibleCase()` 进行实时验证
- `handleSubmit()` - 使用 `areAllWordsCorrectFlexibleCase()` 判断是否全部正确
- 输入框视觉反馈 - 使用 `isInputCorrectFlexibleCase()` 显示绿色边框

---

## ✅ 测试结果

运行 `node test-flexible-case.js`：

```
📊 Results: 7 passed, 0 failed out of 7 tests

🎯 Testing User's Example:
✅ Target: "Oigan" | User: "Oigan" | CORRECT
✅ Target: "miren" | User: "Miren" | CORRECT (首字母大小写不同)
✅ Target: "aquí" | User: "aquí" | CORRECT
✅ Target: "en" | User: "en" | CORRECT
✅ Target: "la" | User: "la" | CORRECT
✅ Target: "entrada" | User: "entrada" | CORRECT
❌ Target: "dice" | User: "dicen" | WRONG (正确识别错误)
✅ Target: "que" | User: "que" | CORRECT
✅ Target: "los" | User: "los" | CORRECT
✅ Target: "tacos" | User: "tacos" | CORRECT
```

---

## 📁 修改的文件

1. **utils/textTokenizer.ts**
   - 新增 `isInputCorrectFlexibleCase()` - 灵活大小写比较
   - 新增 `compareWords()` - 按单词比较并返回详细结果
   - 新增 `areAllWordsCorrectFlexibleCase()` - 检查所有单词是否正确
   - 新增 `WordComparisonResult` 接口

2. **components/InputFeedback.tsx**
   - 更新导入语句
   - 重写 `renderDetailedFeedback()` - 按单词高亮，忽略标点符号
   - 更新 `handleInputChange()` - 使用灵活大小写比较
   - 更新 `handleSubmit()` - 使用灵活大小写比较
   - 更新输入框视觉反馈 - 使用灵活大小写比较

3. **test-flexible-case.js** (新增)
   - 测试灵活大小写匹配逻辑
   - 验证用户示例场景

---

## 🎯 功能特性

### ✅ 已实现
1. **标点符号完全忽略** - 只比较单词，标点符号不参与判断
2. **首字母大小写灵活** - `Miren` 和 `miren` 都被认为是正确的
3. **其他字母大小写严格** - `mirEn` 和 `miren` 被认为是错误的
4. **按单词高亮错误** - 整个错误单词标红，而不是逐字符标红
5. **实时视觉反馈** - 输入框在输入正确时显示绿色边框
6. **自动跳转** - 输入正确单词后自动跳转到下一个输入框

---

## 🚀 使用方法

1. 启动应用：`npm run dev`
2. 上传视频和字幕文件
3. 开始练习，输入单词
4. 提交后查看反馈界面，只有错误的单词会被标红

---

## 📝 注意事项

- 标点符号会自动显示，用户无需输入
- 首字母可以大写或小写，但其他字母必须与原文一致
- 错误的单词会以红色背景高亮显示
- 鼠标悬停在错误单词上可以看到期望的正确单词

