# Practice Record Development Plan

## Overview

Add practice history tracking and statistics to the LinguaClip app, enabling users to review wrong sentences and track their learning progress.

---

## 1. Data Structure Design

### 1.1 Practice Attempt Record

```typescript
// Each sentence practice attempt
interface PracticeAttempt {
  id: string;                  // UUID
  timestamp: number;           // Unix timestamp
  videoName: string;
  subtitle: {
    text: string;
    startTime: number;
    endTime: number;
  };
  userInput: string[];         // User's word inputs
  isCorrect: boolean;          // Whether the entire sentence was correct
  wrongWords: WrongWord[];     // Details of incorrect words
}

interface WrongWord {
  target: string;              // Correct word
  input: string;               // User's input
  index: number;               // Word index in sentence
}

// Storage key: 'linguaclip_practice_history'
// Storage limit: 500 records or 30 days (configurable)
```

### 1.2 Statistics Data

```typescript
interface DailyStats {
  date: string;                // ISO date "2025-01-23"
  totalAttempts: number;       // Total practice attempts
  correctCount: number;        // Correct attempts
  practiceTimeMs: number;      // Practice duration in ms
  uniqueSentences: number;     // Unique sentences practiced
}

interface PracticeStats {
  dailyStats: DailyStats[];    // Daily statistics array
  streak: number;              // Consecutive practice days
  lastPracticeDate: string;    // Last practice date
  totalLifetimeAttempts: number;
  totalLifetimeCorrect: number;
}

// Storage key: 'linguaclip_practice_stats'
```

---

## 2. Data Collection Points

### 2.1 Primary Collection Point

**File**: `hooks/usePracticeActions.ts`

**Location**: `handleInputComplete` function

```typescript
const handleInputComplete = (wasCorrect: boolean, wordInputs: string[]) => {
  // Existing logic
  setMode(PracticeMode.FEEDBACK);

  // NEW: Record practice data
  const currentSubtitle = subtitles[currentSubtitleIndex];
  const tokens = tokenize(currentSubtitle.text);
  const comparisonResults = compareWords(tokens, wordInputs);

  // Save attempt record
  Storage.savePracticeAttempt({
    videoName: videoRecord.name,
    subtitle: {
      text: currentSubtitle.text,
      startTime: currentSubtitle.startTime,
      endTime: currentSubtitle.endTime,
    },
    userInput: wordInputs,
    isCorrect: wasCorrect,
    wrongWords: comparisonResults
      .filter(r => !r.isCorrect)
      .map(r => ({
        target: r.targetWord,
        input: r.inputWord,
        index: r.tokenIndex,
      })),
  });

  // Update daily statistics
  Storage.updateDailyStats(wasCorrect);
};
```

### 2.2 Required Data Flow Changes

```
InputFeedback.tsx
    │
    │ onComplete(wasCorrect)
    │ ⚠️ Need to also pass: wordInputs[]
    ▼
PracticeLayout.tsx
    │
    │ onInputComplete(wasCorrect, wordInputs)
    ▼
usePracticeActions.ts
    │
    │ handleInputComplete(wasCorrect, wordInputs)
    │   └── Storage.savePracticeAttempt()
    │   └── Storage.updateDailyStats()
    ▼
localStorage
```

---

## 3. Storage Utilities

### 3.1 New Functions in `utils/storage.ts`

```typescript
// ============ Practice History ============

export const savePracticeAttempt = (attempt: Omit<PracticeAttempt, 'id' | 'timestamp'>): void => {
  const history = getPracticeHistory();
  const newAttempt: PracticeAttempt = {
    ...attempt,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  history.unshift(newAttempt);

  // Limit to 500 records
  const trimmed = history.slice(0, 500);
  localStorage.setItem('linguaclip_practice_history', JSON.stringify(trimmed));
};

export const getPracticeHistory = (): PracticeAttempt[] => {
  const data = localStorage.getItem('linguaclip_practice_history');
  return data ? JSON.parse(data) : [];
};

export const getWrongSentences = (filter?: {
  videoName?: string;
  dateFrom?: number;
  dateTo?: number;
}): PracticeAttempt[] => {
  let history = getPracticeHistory().filter(a => !a.isCorrect);

  if (filter?.videoName) {
    history = history.filter(a => a.videoName === filter.videoName);
  }
  if (filter?.dateFrom) {
    history = history.filter(a => a.timestamp >= filter.dateFrom);
  }
  if (filter?.dateTo) {
    history = history.filter(a => a.timestamp <= filter.dateTo);
  }

  return history;
};

export const clearPracticeHistory = (): void => {
  localStorage.removeItem('linguaclip_practice_history');
};

// ============ Statistics ============

export const getPracticeStats = (): PracticeStats => {
  const data = localStorage.getItem('linguaclip_practice_stats');
  return data ? JSON.parse(data) : {
    dailyStats: [],
    streak: 0,
    lastPracticeDate: '',
    totalLifetimeAttempts: 0,
    totalLifetimeCorrect: 0,
  };
};

export const updateDailyStats = (wasCorrect: boolean): void => {
  const stats = getPracticeStats();
  const today = new Date().toISOString().split('T')[0];

  // Find or create today's stats
  let todayStats = stats.dailyStats.find(d => d.date === today);
  if (!todayStats) {
    todayStats = {
      date: today,
      totalAttempts: 0,
      correctCount: 0,
      practiceTimeMs: 0,
      uniqueSentences: 0,
    };
    stats.dailyStats.unshift(todayStats);
  }

  // Update counts
  todayStats.totalAttempts++;
  if (wasCorrect) {
    todayStats.correctCount++;
  }

  // Update streak
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (stats.lastPracticeDate === yesterday) {
    stats.streak++;
  } else if (stats.lastPracticeDate !== today) {
    stats.streak = 1;
  }
  stats.lastPracticeDate = today;

  // Update lifetime stats
  stats.totalLifetimeAttempts++;
  if (wasCorrect) {
    stats.totalLifetimeCorrect++;
  }

  // Keep only last 90 days
  stats.dailyStats = stats.dailyStats.slice(0, 90);

  localStorage.setItem('linguaclip_practice_stats', JSON.stringify(stats));
};

export const getTodayStats = (): DailyStats | null => {
  const stats = getPracticeStats();
  const today = new Date().toISOString().split('T')[0];
  return stats.dailyStats.find(d => d.date === today) || null;
};
```

---

## 4. UI Components

### 4.1 Stats Card Component

**File**: `components/StatsCard.tsx`

**Location**: Top of UploadPage

```
┌─────────────────────────────────────────────────┐
│  Today                          3 day streak 🔥 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  15 sentences    │    80% accuracy              │
│                                                 │
│  [View Wrong Sentences →]                       │
└─────────────────────────────────────────────────┘
```

### 4.2 Review Page

**File**: `components/ReviewPage.tsx`

**AppState**: Add `REVIEW` to `AppState` enum

```
┌─────────────────────────────────────────────────┐
│ ← Back              Wrong Sentences             │
├─────────────────────────────────────────────────┤
│ Filter: [All ▼]  [Today] [This Week] [This Month]│
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📺 Friends S01E01              Jan 23, 10:30│ │
│ │                                             │ │
│ │ "How you doin'?"                            │ │
│ │                                             │ │
│ │ Your input: "How you doing?"                │ │
│ │ ❌ doin' → doing                            │ │
│ │                                             │ │
│ │                        [Practice Again]     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📺 TED Talk - The Power...     Jan 23, 09:15│ │
│ │                                             │ │
│ │ "It's not about the money"                  │ │
│ │                                             │ │
│ │ Your input: "Its not about the money"       │ │
│ │ ❌ It's → Its                               │ │
│ │                                             │ │
│ │                        [Practice Again]     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─────────────────────────────────────────────── │
│              Load More (showing 10/45)          │
└─────────────────────────────────────────────────┘
```

### 4.3 Component Props

```typescript
// StatsCard.tsx
interface StatsCardProps {
  onViewWrongSentences: () => void;
}

// ReviewPage.tsx
interface ReviewPageProps {
  onBack: () => void;
  onPracticeAgain: (subtitle: Subtitle, videoName: string) => void;
}
```

---

## 5. File Structure

```
utils/
├── storage.ts              ← Extend with practice history functions
│   ├── savePracticeAttempt()
│   ├── getPracticeHistory()
│   ├── getWrongSentences()
│   ├── clearPracticeHistory()
│   ├── getPracticeStats()
│   ├── updateDailyStats()
│   └── getTodayStats()

components/
├── StatsCard.tsx           ← NEW: Statistics display card
├── ReviewPage.tsx          ← NEW: Wrong sentences review page
├── UploadPage.tsx          ← Integrate StatsCard
└── ...

hooks/
├── usePracticeActions.ts   ← Extend to collect practice data
└── ...

types.ts                    ← Add new interfaces
├── PracticeAttempt
├── WrongWord
├── DailyStats
├── PracticeStats
└── AppState.REVIEW
```

---

## 6. Implementation Phases

### Phase 1: Data Infrastructure (Priority: High)

**Goal**: Enable data collection without UI changes

| Task | File | Complexity |
|------|------|------------|
| Add type definitions | `types.ts` | Low |
| Add storage functions | `utils/storage.ts` | Low |
| Modify data flow to pass wordInputs | `InputFeedback.tsx`, `PracticeLayout.tsx` | Low |
| Add data collection in handleInputComplete | `usePracticeActions.ts` | Low |

**Estimated effort**: 1-2 hours

### Phase 2: Statistics Card (Priority: High)

**Goal**: Show basic stats on upload page

| Task | File | Complexity |
|------|------|------------|
| Create StatsCard component | `components/StatsCard.tsx` | Low |
| Integrate into UploadPage | `components/UploadPage.tsx` | Low |
| Style the component | CSS/Tailwind | Low |

**Estimated effort**: 1 hour

### Phase 3: Review Page (Priority: Medium)

**Goal**: View and filter wrong sentences

| Task | File | Complexity |
|------|------|------------|
| Add REVIEW to AppState | `types.ts` | Low |
| Add routing in App.tsx | `App.tsx` | Low |
| Create ReviewPage component | `components/ReviewPage.tsx` | Medium |
| Add filter functionality | `components/ReviewPage.tsx` | Low |
| Style wrong sentence cards | CSS/Tailwind | Low |

**Estimated effort**: 2-3 hours

### Phase 4: Practice Again Feature (Priority: Medium)

**Goal**: Re-practice wrong sentences

| Task | File | Complexity |
|------|------|------------|
| Design single-sentence practice mode | Architecture | Medium |
| Implement practice again flow | `App.tsx`, hooks | Medium |
| Handle video seeking to timestamp | `useVideoController.ts` | Low |

**Estimated effort**: 2-3 hours

### Phase 5: Enhanced Statistics (Priority: Low)

**Goal**: Add streak display and historical charts

| Task | File | Complexity |
|------|------|------------|
| Streak calculation logic | `utils/storage.ts` | Low |
| Weekly/Monthly stats view | `components/StatsCard.tsx` | Low |
| Optional: Progress chart (using recharts) | New component | Medium |

**Estimated effort**: 1-2 hours

---

## 7. Open Questions

### 7.1 Data Retention

- **Recommended**: Keep 500 records or 30 days, whichever is smaller
- **Alternative**: User-configurable in Settings

### 7.2 Practice Again Mode

**Option A**: Single sentence practice
- Jump directly to INPUT mode for that sentence
- After completion, return to ReviewPage
- Simpler to implement

**Option B**: Create practice queue
- Allow selecting multiple wrong sentences
- Practice them in sequence like normal practice
- More complex but better UX for bulk review

**Recommendation**: Start with Option A

### 7.3 Statistics Display Location

**Option A**: Top of UploadPage (recommended)
- Always visible when starting
- Motivational without being intrusive

**Option B**: Separate Dashboard page
- More detailed statistics
- May reduce engagement due to extra navigation

**Recommendation**: Option A for MVP, consider Option B for future

### 7.4 Duplicate Handling

When the same sentence is practiced multiple times:
- **Store all attempts**: Better for tracking progress over time
- **Store only latest**: Saves space, simpler

**Recommendation**: Store all attempts, show "improved" indicator if later attempt was correct

---

## 8. Future Enhancements

After MVP completion, consider:

1. **Word-level statistics**
   - Track frequently mistaken words
   - Show "difficult words" list

2. **Spaced repetition integration**
   - Auto-schedule wrong sentences for review
   - Use SM-2 algorithm for optimal spacing

3. **Export functionality**
   - Export statistics as CSV
   - Share progress on social media

4. **Gamification**
   - Achievement badges
   - Weekly goals
   - Leaderboard (if multi-user)

5. **Sync across devices**
   - Cloud backup option
   - Account system

---

## 9. Summary

| Phase | Features | Effort | Priority |
|-------|----------|--------|----------|
| P1 | Data collection infrastructure | 1-2h | High |
| P2 | Statistics card on UploadPage | 1h | High |
| P3 | Wrong sentences review page | 2-3h | Medium |
| P4 | Practice again feature | 2-3h | Medium |
| P5 | Streak & enhanced stats | 1-2h | Low |

**Total estimated effort**: 7-11 hours

**Recommended MVP**: Phases 1-3 (4-6 hours)
