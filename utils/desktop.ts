/**
 * Tauri desktop helpers: pick files, read subtitles, check paths, listen for drops.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, readTextFile } from '@tauri-apps/plugin-fs';

const VIDEO_FILTER = { name: 'Video', extensions: ['mp4', 'mov', 'm4v'] };
const SUBTITLE_FILTER = { name: 'Subtitles', extensions: ['srt'] }; // parseSRT reads nothing else

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function videoSrcFromPath(path: string): string {
  return convertFileSrc(path);
}

export async function pickVideoPath(): Promise<string | null> {
  const selected = await open({ multiple: false, filters: [VIDEO_FILTER] });
  return typeof selected === 'string' ? selected : null;
}

export async function pickSubtitlePath(): Promise<string | null> {
  const selected = await open({ multiple: false, filters: [SUBTITLE_FILTER] });
  return typeof selected === 'string' ? selected : null;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

export async function readSubtitleFile(path: string): Promise<File> {
  const text = await readTextFile(path);
  return new File([text], fileNameFromPath(path), { type: 'text/plain' });
}

export type DragDropHandler = {
  onHover?: () => void;
  onLeave?: () => void;
  onDrop?: (paths: string[]) => void;
};

export async function listenDragDrop(handler: DragDropHandler): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    const { type } = event.payload;
    if (type === 'enter' || type === 'over') handler.onHover?.();
    else if (type === 'leave') handler.onLeave?.();
    else if (type === 'drop') handler.onDrop?.(event.payload.paths);
  });
}

export type CacheKind = 'words' | 'cloze' | 'breakdown';

export async function cacheFilePath(id: string, kind: CacheKind): Promise<string> {
  const home = await homeDir();
  return join(home, 'Movies', 'LinguaClip', `${id}.${kind}.json`);
}

export async function readCacheText(id: string, kind: CacheKind): Promise<string | null> {
  try {
    const path = await cacheFilePath(id, kind);
    if (!(await exists(path))) return null;
    return await readTextFile(path);
  } catch {
    return null;
  }
}

export async function writeCacheText(id: string, kind: CacheKind, text: string): Promise<void> {
  await invoke('write_cache', { id, kind, text });
}

// Files that belong to a record besides the video: its .srt (generated ones sit
// in ~/Movies/LinguaClip, hand-picked ones usually beside the video) and our
// word/cloze/breakdown caches. Only paths that exist.
export async function relatedFilePaths(id: string, videoPath: string, subtitleFileName: string): Promise<string[]> {
  const home = await homeDir();
  const ours = await join(home, 'Movies', 'LinguaClip');
  const videoDir = videoPath.slice(0, videoPath.lastIndexOf('/'));
  const candidates = [
    await cacheFilePath(id, 'words'),
    await cacheFilePath(id, 'cloze'),
    await cacheFilePath(id, 'breakdown'),
    ...(subtitleFileName ? [await join(ours, subtitleFileName), await join(videoDir, subtitleFileName)] : []),
  ];
  const unique = [...new Set(candidates)];
  const found = await Promise.all(unique.map(pathExists));
  return unique.filter((_, i) => found[i]);
}

// Moves the file to the macOS Trash (user can put it back).
export async function trashFile(path: string): Promise<void> {
  await invoke('trash_file', { path });
}

// Edge "Read aloud" voice through Rust (src-tauri/src/tts.rs). MP3 bytes, or
// null when it fails (offline, blocked, Microsoft changed the check).
export async function synthesizeSpeech(text: string, voice: string): Promise<ArrayBuffer | null> {
  try {
    const bytes = await invoke<ArrayBuffer | null>('tts', { text, voice });
    return bytes && bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}

// AnkiConnect through Rust (src-tauri/src/anki.rs), which skips the system
// proxy. Resolves to the raw response text; rejects with "HTTP 502: …" etc.
export async function ankiRequest(url: string, body: string): Promise<string> {
  return invoke<string>('anki_request', { url, body });
}
