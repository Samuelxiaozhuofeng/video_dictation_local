export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PRACTICE = 'PRACTICE',
  LIBRARY = 'LIBRARY',
  SETTINGS = 'SETTINGS',
}

export enum PracticeMode {
  LISTENING = 'LISTENING', // Video is playing, controls active
  INPUT = 'INPUT',         // Video paused at end of line, waiting for user input
  FEEDBACK = 'FEEDBACK',   // User submitted, showing corrections
}

export interface VideoSource {
  url: string;
  file: File;
}

export interface SavedLine {
  id: string;        // Unique ID for storage
  text: string;
  dateSaved: number;
  videoName?: string;
  timeDisplay: string; // e.g. "01:23"
}

// Practice Configuration
export interface PracticeConfig {
  sectionLength: number; // in minutes. 0 means "Full Video" (no sections)
}

export interface VideoSection {
  id: number;
  label: string;
  startTime: number;
  endTime: number;
  subtitleIndices: number[]; // Indices relative to the full subtitle array (optional usage)
  subtitles: Subtitle[];
}

// Anki specific types
export interface AnkiCardTemplateConfig {
  deckName: string;
  modelName: string;
  fieldMapping: Record<string, string>; // Anki Field Name -> App Data Key
}

export interface AnkiConfig {
  url: string;
  wordCard: AnkiCardTemplateConfig | null;
  audioCard: AnkiCardTemplateConfig | null;
}

// AI Configuration
export interface AIConfig {
  model: string;
  temperature: number;
  promptTemplate?: string;
  apiKey?: string; // User's own Gemini API Key
}

// Audio Padding Configuration
export interface AudioPaddingConfig {
  startPadding: number; // in milliseconds
  endPadding: number;   // in milliseconds
}

export const APP_DATA_FIELDS = [
  { key: 'sentence', label: 'Sentence (Subtitle)' },
  { key: 'videoName', label: 'Video Name' },
  { key: 'timestamp', label: 'Timestamp (MM:SS)' },
  { key: 'screenshot', label: 'Screenshot (Image)' },
  { key: 'audio', label: 'Audio (Clip)' },
  { key: 'word', label: 'Selected Word' },
  { key: 'definition', label: 'Word Definition (AI)' },
  { key: 'context', label: 'Context (Sentence)' },
];

// Video History and Progress Types
export interface VideoRecord {
  id: string;                           // UUID
  displayName: string;                  // Display name (from file name)
  videoFileName: string;                // Original video file name
  subtitleFileName: string;             // Original subtitle file name

  // File access (for File System Access API)
  videoFileHandle?: any;                // FileSystemFileHandle (stored separately in IndexedDB)
  subtitleText: string;                 // Subtitle content (stored in IndexedDB)

  // Progress information
  currentSubtitleIndex: number;         // Current subtitle index
  currentSectionIndex: number;          // Current section index
  totalSubtitles: number;               // Total number of subtitles
  completionRate: number;               // Completion percentage (0-100)

  // Metadata
  dateAdded: number;                    // Timestamp when added
  lastPracticed: number;                // Timestamp of last practice
  totalPracticeTime: number;            // Total practice time in seconds
}

export interface PracticeProgress {
  videoId: string;
  currentSubtitleIndex: number;
  currentSectionIndex: number;
  lastUpdated: number;
}
