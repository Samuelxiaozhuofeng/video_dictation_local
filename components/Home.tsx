import React, { useEffect, useRef, useState } from 'react';
import { FileVideo, FileText, Pencil, EyeOff, Trash2, Clock, Loader2, Upload } from 'lucide-react';
import { LearningMode, VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';
import { Btn, Card, Stamp, H } from './ui';
import { dialog } from './Dialog';
import { useT, useLang } from '../utils/i18n';

export interface NewPair { video: File; srt: File; handle?: FileSystemFileHandle }

interface HomeProps {
  onStartNew: (pair: NewPair, mode: LearningMode) => void | Promise<void>;
  onResume: (record: VideoRecord, mode: LearningMode) => void | Promise<void>;
}

const VIDEO_EXT = /\.(mp4|webm|mkv|mov|avi|m4v)$/i;
const SRT_EXT = /\.(srt|txt|vtt)$/i;

// Two mode buttons used both for a fresh upload and for every shelf card.
// With `last` set, the last-used mode is the loud one and the other is an outline.
const ModeButtons: React.FC<{ last?: LearningMode; onPick: (m: LearningMode) => void; size?: 'md' | 'lg' }> = ({ last, onPick, size = 'md' }) => {
  const t = useT();
  const dLoud = last === undefined || last !== LearningMode.BLUR;
  const bLoud = last === undefined || last === LearningMode.BLUR;
  return (
    <div className="flex gap-3">
      <Btn tone={dLoud ? 'green' : 'white'} size={size} onClick={() => onPick(LearningMode.DICTATION)} title={t('home.dictateTitle')}>
        <Pencil size={16} /> {t('home.dictate')}
      </Btn>
      <Btn tone={bLoud ? 'ochre' : 'white'} size={size} onClick={() => onPick(LearningMode.BLUR)} title={t('home.blurTitle')}>
        <EyeOff size={16} /> {t('home.blur')}
      </Btn>
    </div>
  );
};

// One drop zone takes both files; each slot can also be browsed on its own.
const DropZone: React.FC<{ onStart: (pair: NewPair, mode: LearningMode) => void }> = ({ onStart }) => {
  const t = useT();
  const [video, setVideo] = useState<File | null>(null);
  const [srt, setSrt] = useState<File | null>(null);
  const [handle, setHandle] = useState<FileSystemFileHandle | undefined>();
  const [over, setOver] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const srtInput = useRef<HTMLInputElement>(null);

  const take = (files: Iterable<File>) => {
    for (const f of files) {
      if (VIDEO_EXT.test(f.name)) { setVideo(f); setHandle(undefined); }
      else if (SRT_EXT.test(f.name)) setSrt(f);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(Array.from(e.dataTransfer.files));
    // Chrome hands out a handle for dropped files; keep it so Resume never asks for the file again.
    for (const item of Array.from(e.dataTransfer.items)) {
      const anyItem = item as any;
      if (typeof anyItem.getAsFileSystemHandle !== 'function') continue;
      const h = await anyItem.getAsFileSystemHandle();
      if (h?.kind === 'file' && VIDEO_EXT.test(h.name)) setHandle(h);
    }
  };

  const browseVideo = async () => {
    const picker = (window as any).showOpenFilePicker;
    if (!picker) { videoInput.current?.click(); return; }
    try {
      const [h] = await picker({ types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v'] } }] });
      setVideo(await h.getFile());
      setHandle(h);
    } catch { /* cancelled */ }
  };

  const ready = !!video && !!srt;

  return (
    <Card
      flat
      className={`p-5 sm:p-6 border-dashed transition-colors ${over ? 'bg-green-soft border-green' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 lg:w-64 shrink-0">
          <div className="w-12 h-12 rounded-full bg-shade/70 text-mute flex items-center justify-center shrink-0"><Upload size={22} /></div>
          <div>
            <p className="font-serif text-xl font-semibold leading-tight">{t('home.dropLine1')}<br />{t('home.dropLine2')}</p>
            <p className="text-xs text-mute mt-1">{t('home.dropHint')}</p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={browseVideo} className={`flat press p-3 text-left flex items-center gap-3 ${video ? 'bg-green-soft border-green text-green' : 'hover:bg-paper'}`}>
            <FileVideo size={20} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium opacity-70">{video ? t('home.videoLabel') : t('home.chooseVideo')}</span>
              <span className="block text-sm font-medium truncate">{video ? video.name : '.mp4 .webm .mkv'}</span>
            </span>
          </button>
          <button type="button" onClick={() => srtInput.current?.click()} className={`flat press p-3 text-left flex items-center gap-3 ${srt ? 'bg-green-soft border-green text-green' : 'hover:bg-paper'}`}>
            <FileText size={20} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium opacity-70">{srt ? t('home.subtitlesLabel') : t('home.chooseSubtitles')}</span>
              <span className="block text-sm font-medium truncate">{srt ? srt.name : '.srt'}</span>
            </span>
          </button>
          <input ref={videoInput} type="file" accept="video/*,.mp4,.webm,.mkv,.mov,.avi,.m4v" className="hidden" onChange={e => e.target.files && take(Array.from(e.target.files))} />
          <input ref={srtInput} type="file" accept=".srt,.txt,.vtt" className="hidden" onChange={e => e.target.files && take(Array.from(e.target.files))} />
        </div>

        <div className="lg:pl-5 lg:border-l lg:border-line shrink-0">
          {ready ? (
            <ModeButtons size="lg" onPick={m => onStart({ video: video!, srt: srt!, handle }, m)} />
          ) : (
            <span className="text-sm text-mute">{t('home.thenPickMode')}</span>
          )}
        </div>
      </div>
    </Card>
  );
};

const Progress: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-1.5 rounded-full bg-shade overflow-hidden">
    <div className="h-full rounded-full bg-green" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

const Home: React.FC<HomeProps> = ({ onStartNew, onResume }) => {
  const t = useT();
  const lang = useLang();
  const [videos, setVideos] = useState<VideoRecord[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    VideoStorage.getAllVideoRecords().then(setVideos).catch(() => setVideos([]));
  }, []);

  // Reimplements utils/videoStorage.ts's formatLastPracticed with translated output
  // (that file is out of i18n scope, so the formatting logic lives here instead).
  const formatRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('home.timeJustNow');
    if (minutes < 60) return t(minutes > 1 ? 'home.timeMinutesAgo' : 'home.timeMinuteAgo', { n: minutes });
    if (hours < 24) return t(hours > 1 ? 'home.timeHoursAgo' : 'home.timeHourAgo', { n: hours });
    if (days === 1) return t('home.timeYesterday');
    if (days < 7) return t('home.timeDaysAgo', { n: days });
    return new Date(timestamp).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
  };

  const handleDelete = async (v: VideoRecord) => {
    const ok = await dialog.confirm(t('home.deleteTitle'), t('home.deleteBody', { name: v.displayName }), { ok: t('home.deleteOk'), danger: true });
    if (!ok) return;
    setDeletingId(v.id);
    try {
      await VideoStorage.deleteVideoRecord(v.id);
      setVideos(prev => (prev ? prev.filter(x => x.id !== v.id) : prev));
    } catch {
      dialog.alert(t('home.deleteFailTitle'), t('home.deleteFailBody'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-10">
      <DropZone onStart={onStartNew} />

      <section>
        <H sub={t('home.pickModeContinue')} badge={videos && videos.length > 0 && <Stamp tone="ink">{videos.length}</Stamp>}>{t('home.yourVideos')}</H>

        {videos === null ? (
          <div className="flex items-center gap-3 text-mute text-sm"><Loader2 className="animate-spin" size={18} /> {t('home.loading')}</div>
        ) : videos.length === 0 ? (
          <Card tone="paper" flat className="p-10 text-center border-dashed">
            <p className="font-serif text-2xl font-semibold">{t('home.nothingHereYet')}</p>
            <p className="text-sm text-mute mt-2">{t('home.nothingHereHint')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map(v => (
              <Card key={v.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-lg font-semibold leading-tight break-words min-w-0">{v.displayName}</h3>
                  <Stamp tone={v.completionRate >= 100 ? 'green-soft' : 'white'} className="shrink-0">{v.completionRate}%</Stamp>
                </div>
                <Progress pct={v.completionRate} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
                  <span>{t('home.linesCount', { current: v.currentSubtitleIndex, total: v.totalSubtitles })}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {formatRelativeTime(v.lastPracticed)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-line border-dashed">
                  <ModeButtons last={v.learningMode ?? LearningMode.DICTATION} onPick={m => onResume(v, m)} />
                  <Btn square flat tone="white" onClick={() => handleDelete(v)} disabled={deletingId === v.id} title={t('home.deleteRecordTitle')} className="hover:!bg-rose-soft hover:!text-rose">
                    {deletingId === v.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
