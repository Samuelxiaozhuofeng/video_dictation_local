import React, { useEffect, useState } from 'react';
import { FileText, FileVideo } from 'lucide-react';
import { VideoRecord } from '../types';
import { fileNameFromPath, pickSubtitlePath, pickVideoPath, readSubtitleFile } from '../utils/desktop';
import {
  IMPORT_QUALITIES,
  ImportQuality,
  ImportTools,
  importTools,
  isYouTubeUrl,
  probeImportSizes,
  startLocalImport,
  startUrlImport,
} from '../utils/importJob';
import { parseSRT } from '../utils/srtParser';
import * as VideoStorage from '../utils/videoStorage';
import { useT } from '../utils/i18n';
import { dialog } from './Dialog';
import { Btn, Card, inputCls } from './ui';

// The one way in: a local video (picked or dropped), optionally with its own .srt,
// or a YouTube link. With a .srt it goes straight to practice. Otherwise starting
// hands off to the import job (which first downloads the transcription parts on a
// Mac that lacks them); the new video shows up in the list with its own progress.
// The link box only shows where yt-dlp is installed by hand.

const LANGS = [
  { value: 'en', key: 'import.langEn' },
  { value: 'es', key: 'import.langEs' },
  { value: 'ja', key: 'import.langJa' },
  { value: 'zh', key: 'import.langZh' },
  { value: 'auto', key: 'import.langAuto' },
] as const;

const QUALITY_KEYS = {
  1080: 'import.quality1080',
  720: 'import.quality720',
  480: 'import.quality480',
} as const;

const LANG_KEY = 'import_lang';
const loadLang = () => { try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; } };

function formatMb(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1_000_000));
}

type Props = {
  initialPath: string | null;
  initialSrt: string | null;
  onClose: () => void;
  onPractice: (record: VideoRecord) => void | Promise<void>;
};

const AddVideo: React.FC<Props> = ({ initialPath, initialSrt, onClose, onPractice }) => {
  const t = useT();
  const [path, setPath] = useState<string | null>(initialPath);
  const [srt, setSrt] = useState<string | null>(initialSrt);
  const [tools, setTools] = useState<ImportTools | null>(null);
  const [url, setUrl] = useState('');
  const [lang, setLangState] = useState(loadLang);
  const [quality, setQuality] = useState<ImportQuality>(1080);
  const [busy, setBusy] = useState(false);
  const [sizes, setSizes] = useState<Partial<Record<ImportQuality, number>>>({});
  const [sizesState, setSizesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const trimmed = url.trim();
  const valid = isYouTubeUrl(trimmed);
  const ownSubtitles = !!path && !!srt;
  const ready = !!path || (valid && !!tools?.youtube);
  const needsSetup = !ownSubtitles && ready && tools?.whisper === false;

  useEffect(() => setPath(initialPath), [initialPath]);
  useEffect(() => setSrt(initialSrt), [initialSrt]);
  useEffect(() => {
    importTools().then(setTools).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!valid) {
      setSizes({});
      setSizesState('idle');
      return;
    }
    setSizes({});
    setSizesState('loading');
    let cancelled = false;
    const handle = window.setTimeout(() => {
      probeImportSizes(trimmed)
        .then(result => {
          if (cancelled) return;
          const next: Partial<Record<ImportQuality, number>> = {};
          for (const q of IMPORT_QUALITIES) {
            const n = result[q];
            if (typeof n === 'number' && n > 0) next[q] = n;
          }
          setSizes(next);
          setSizesState('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setSizes({});
          setSizesState('error');
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, valid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const qualityLabel = (q: ImportQuality): string => {
    const label = t(QUALITY_KEYS[q]);
    if (sizesState === 'loading') return `${label} · ${t('import.qualityQuerying')}`;
    const bytes = sizes[q];
    if (bytes) return t('import.qualityWithSize', { label, size: formatMb(bytes) });
    return label;
  };

  const setLang = (v: string) => {
    setLangState(v);
    try { localStorage.setItem(LANG_KEY, v); } catch { /* localStorage unavailable */ }
  };

  const browse = async () => {
    const p = await pickVideoPath();
    if (p) { setPath(p); setUrl(''); }
  };

  const browseSrt = async () => {
    const p = await pickSubtitlePath();
    if (p) setSrt(p);
  };

  // Video + own .srt: a finished record right away, then into practice.
  const practiceWithSubtitles = async (video: string, srtPath: string) => {
    const file = await readSubtitleFile(srtPath);
    const text = await file.text();
    const count = parseSRT(text).length;
    if (!count) {
      dialog.alert(t('app.noSubtitlesTitle'), t('app.noSubtitlesBody', { name: file.name }));
      return;
    }
    const record = await VideoStorage.createVideoRecord(fileNameFromPath(video), file, text, count, { videoPath: video });
    onClose();
    await onPractice(record);
  };

  const start = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      if (path && srt) await practiceWithSubtitles(path, srt);
      else if (path) await startLocalImport(path, lang);
      else await startUrlImport(trimmed, lang, quality);
      if (!(path && srt)) onClose();
    } catch (err) {
      console.error(err);
      dialog.alert(t('import.startFailTitle'), t('import.startFailBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <Card className="w-full max-w-lg" role="dialog" aria-modal="true" aria-label={t('add.title')} onClick={e => e.stopPropagation()}>
        <div className="px-7 pt-7 pb-6 space-y-6">
          <div>
            <h3 className="font-serif text-[30px] leading-tight">{t('add.title')}</h3>
            <p className="mt-1 text-sm text-mute">{t('home.dropHint')}</p>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <Btn onClick={browse} className="shrink-0"><FileVideo size={16} /> {path ? t('add.change') : t('add.pickLocal')}</Btn>
            <span className={`min-w-0 truncate text-sm ${path ? 'text-ink' : 'text-faint'}`}>{path ? fileNameFromPath(path) : t('add.dragHint')}</span>
          </div>

          {!trimmed && (
            <div className="flex items-center gap-3 min-w-0">
              <Btn onClick={browseSrt} className="shrink-0"><FileText size={16} /> {srt ? t('add.change') : t('add.pickSubtitle')}</Btn>
              <span className={`min-w-0 truncate text-sm ${srt ? 'text-ink' : 'text-faint'}`}>{srt ? fileNameFromPath(srt) : t('add.subtitleHint')}</span>
              {srt && <button type="button" onClick={() => setSrt(null)} className="shrink-0 text-sm text-mute hover:text-ink">{t('add.clearSubtitle')}</button>}
            </div>
          )}

          {tools?.youtube && <div className="space-y-2">
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); if (e.target.value.trim()) { setPath(null); setSrt(null); } }}
              placeholder={t('import.placeholder')}
              className={inputCls}
            />
            {trimmed && !valid && <p className="text-xs text-mute">{t('import.invalidUrl')}</p>}
            {valid && (
              <select value={quality} onChange={e => setQuality(Number(e.target.value) as ImportQuality)} className={inputCls} aria-label={t('add.quality')}>
                {IMPORT_QUALITIES.map(q => <option key={q} value={q}>{qualityLabel(q)}</option>)}
              </select>
            )}
            {valid && sizesState === 'error' && <p className="text-xs text-mute">{t('import.qualitySizeFail')}</p>}
          </div>}

          {!ownSubtitles && <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-mute">{t('add.lang')}</span>
            <select value={lang} onChange={e => setLang(e.target.value)} className={`${inputCls} !w-40`}>
              {LANGS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.key)}</option>)}
            </select>
          </label>}

          {needsSetup && <p className="text-sm text-mute">{t('add.setupNote')}</p>}
        </div>

        <div className="px-7 py-4 border-t border-line flex items-center justify-end gap-3">
          <div className="flex gap-2">
            <Btn flat onClick={onClose}>{t('dialog.cancel')}</Btn>
            <Btn tone="accent" disabled={!ready || busy} onClick={start}>{t(ownSubtitles ? 'add.startPractice' : needsSetup ? 'add.startSetup' : 'add.start')}</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AddVideo;
