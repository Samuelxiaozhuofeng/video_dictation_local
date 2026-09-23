import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, MoreHorizontal, Loader2 } from 'lucide-react';
import { LearningMode, VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';
import { getPracticeConfig } from '../utils/storage';
import { parseSRT } from '../utils/srtParser';
import { buildSections } from '../utils/sections';
import { fileNameFromPath, listenDragDrop, trashFile, relatedFilePaths } from '../utils/desktop';
import { formatImportError, isCookieError, openYouTubeLogin, retryImport, subscribeImportJobs } from '../utils/importJob';
import { Btn, Menu, MenuItem } from './ui';
import { dialog } from './Dialog';
import { useT, useLang } from '../utils/i18n';
import AddVideo from './AddVideo';
import { canCloze } from '../utils/aiDrills';
import { cancelPrep, getPrepJob, prepStatus, prepareBreakdowns, subscribePrep } from '../utils/breakdownPrep';

// Home does two things: pick up the video you were on, and add a new one.
// The most recent video leads; the rest are quiet rows. Everything else
// (mode switch, breakdown prep, delete) waits behind hover or the "…" menu.

interface HomeProps {
  onResume: (record: VideoRecord, mode: LearningMode) => void | Promise<void>;
}

const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;

const Line: React.FC<{ pct: number; className?: string }> = ({ pct, className = '' }) => (
  <div className={`h-[2px] bg-line ${className}`}>
    <div className="h-full bg-mute" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

const Home: React.FC<HomeProps> = ({ onResume }) => {
  const t = useT();
  const lang = useLang();
  const [videos, setVideos] = useState<VideoRecord[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ path: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Breakdown prep per video: how many lines are still unprepared, and a tick
  // that re-renders running jobs' progress.
  const [prep, setPrep] = useState<Map<string, { eligible: number; missing: number }>>(new Map());
  const [prepTick, setPrepTick] = useState(0);
  const hasAi = canCloze();

  // Where each record sits in sections rather than in percent: "part 3 of 12"
  // is something you can finish, where "24%" of a long video never moves.
  // Computed the same way the practice page cuts the video, so the two agree.
  const sectionLength = getPracticeConfig().sectionLength;
  const shelfPosition = useMemo(() => {
    const byId = new Map<string, { part: number; parts: number; line: number; lines: number }>();
    for (const v of videos ?? []) {
      if (v.importJob || !v.subtitleText) continue;
      try {
        const sections = buildSections(parseSRT(v.subtitleText), sectionLength);
        if (sections.length === 0) continue;
        const part = Math.min(Math.max(v.currentSectionIndex, 0), sections.length - 1);
        const lines = sections[part].subtitles.length;
        byId.set(v.id, {
          part,
          parts: sections.length,
          line: Math.min(Math.max(v.currentSubtitleIndex, 0), lines),
          lines,
        });
      } catch { /* a record we cannot parse just falls back to percent */ }
    }
    return byId;
  }, [videos, sectionLength]);

  useEffect(() => {
    const load = () => {
      VideoStorage.getAllVideoRecords().then(setVideos).catch(() => setVideos([]));
    };
    load();
    return subscribeImportJobs(load);
  }, []);

  // The whole window takes a dropped video; it opens the add dialog with it filled in.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listenDragDrop({
      onHover: () => setDragOver(true),
      onLeave: () => setDragOver(false),
      onDrop: (paths) => {
        setDragOver(false);
        const video = paths.find(p => VIDEO_EXT.test(fileNameFromPath(p)));
        if (video) setAdding({ path: video });
      },
    }).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => subscribePrep(() => setPrepTick(n => n + 1)), []);
  useEffect(() => {
    if (!hasAi || !videos) return;
    let cancelled = false;
    const ready = videos.filter(v => !v.importJob && v.subtitleText && !getPrepJob(v.id));
    Promise.all(ready.map(async v => [v.id, await prepStatus(v.id, v.subtitleText, lang)] as const))
      .then(rows => { if (!cancelled) setPrep(new Map(rows)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videos, lang, hasAi, prepTick]);

  const closeAdd = useCallback(() => setAdding(null), []);

  const handleYouTubeLogin = async () => {
    try {
      await openYouTubeLogin();
      dialog.alert(t('home.ytLoginTitle'), t('home.ytLoginBody'));
    } catch (e) {
      const missing = String(e).includes('missing:');
      dialog.alert(t('home.ytLoginFailTitle'), missing ? t('home.ytLoginNoChrome') : t('home.ytLoginFailBody'));
    }
  };

  const handleRetry = async (v: VideoRecord) => {
    setRetryingId(v.id);
    try {
      await retryImport(v.id);
    } catch (e) {
      console.error(e);
      dialog.alert(t('home.retryFailTitle'), t('home.retryFailBody'));
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (v: VideoRecord) => {
    const ok = await dialog.confirm(t('home.deleteTitle'), t('home.deleteBody', { name: v.displayName }), { ok: t('home.deleteOk'), danger: true });
    if (!ok) return;
    const trash = !!v.videoPath && await dialog.confirm(
      t('home.deleteFileTitle'),
      t('home.deleteFileBody', { file: fileNameFromPath(v.videoPath) }),
      { ok: t('home.deleteFileOk'), cancel: t('home.deleteFileKeep'), danger: true },
    );
    setDeletingId(v.id);
    await cancelPrep(v.id);
    try {
      await VideoStorage.deleteVideoRecord(v.id);
      setVideos(prev => (prev ? prev.filter(x => x.id !== v.id) : prev));
    } catch {
      dialog.alert(t('home.deleteFailTitle'), t('home.deleteFailBody'));
      setDeletingId(null);
      return;
    }
    try {
      if (trash) {
        const paths = [v.videoPath!, ...await relatedFilePaths(v.id, v.videoPath!, v.subtitleFileName)];
        const results = await Promise.allSettled(paths.map(trashFile));
        if (results[0].status === 'rejected') throw results[0].reason;
      }
    } catch {
      dialog.alert(t('home.deleteFileFailTitle'), t('home.deleteFileFailBody'));
    } finally {
      setDeletingId(null);
    }
  };

  const jobLabel = (job: NonNullable<VideoRecord['importJob']>) => {
    const pct = job.percent ?? 0;
    if (job.stage === 'download') return t('import.stageDownload', { pct });
    if (job.stage === 'transcribe') return t('import.stageTranscribe', { pct });
    if (job.stage === 'segment') return t('import.stageSegment');
    return t('import.stageExtract');
  };

  const modeName = (m: LearningMode) => (m === LearningMode.BLUR ? t('home.blur') : t('home.dictate'));
  const lastMode = (v: VideoRecord) => v.learningMode ?? LearningMode.DICTATION;
  const otherMode = (v: VideoRecord) => (lastMode(v) === LearningMode.BLUR ? LearningMode.DICTATION : LearningMode.BLUR);

  // "Part 2 of 5" and how far into that part, or lines when there is only one part.
  const where = (v: VideoRecord) => {
    const pos = shelfPosition.get(v.id);
    if (!pos) return { text: `${v.completionRate}%`, pct: v.completionRate };
    const pct = pos.lines ? (pos.line / pos.lines) * 100 : 0;
    if (pos.parts > 1) return { text: t('home.partOf', { current: pos.part + 1, total: pos.parts }), pct };
    return { text: t('home.linesCount', { current: pos.line, total: pos.lines }), pct };
  };

  const menuFor = (v: VideoRecord): MenuItem[] => {
    const items: MenuItem[] = [];
    if (!v.importJob) {
      items.push({ label: t('home.practiceAs', { mode: modeName(otherMode(v)) }), onClick: () => onResume(v, otherMode(v)) });
      const prepJob = hasAi ? getPrepJob(v.id) : undefined;
      const info = hasAi && !prepJob ? prep.get(v.id) : undefined;
      if (prepJob) {
        items.push({ label: t('home.prepBreakdownRunning', { done: prepJob.done, total: prepJob.total || '…' }), onClick: () => {}, disabled: true });
      } else if (info && info.eligible > 0) {
        items.push(info.missing > 0
          ? { label: info.missing < info.eligible ? t('home.prepBreakdownMore', { n: info.missing }) : t('home.prepBreakdown'), title: t('home.prepBreakdownTitle'), onClick: () => { prepareBreakdowns(v.id, v.subtitleText, lang).catch(err => console.error(err)); } }
          : { label: t('home.prepBreakdownReady'), onClick: () => {}, disabled: true });
      }
      items.push('divider');
    }
    items.push({ label: t('home.deleteRecordTitle'), onClick: () => handleDelete(v), disabled: deletingId === v.id });
    return items;
  };

  const more = (v: VideoRecord, size: 'sm' | 'lg' = 'sm') => (
    <Menu items={menuFor(v)} trigger={(open, toggle) => (
      <Btn square size={size} flat onClick={toggle} title={t('home.more')} aria-label={t('home.more')} className={open ? '!bg-shade !text-ink' : ''}>
        {deletingId === v.id ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
      </Btn>
    )} />
  );

  // A running import, or one that failed: its own status instead of a position.
  const jobStatus = (v: VideoRecord) => {
    const job = v.importJob!;
    if (!job.error) return null;
    return (
      <p className="mt-1 text-sm text-mute">
        {formatImportError(job.error)}
        {isCookieError(job.error) && <><span className="mx-2 text-faint">·</span><button type="button" onClick={handleYouTubeLogin} className="text-ink hover:underline underline-offset-4">{t('home.ytLogin')}</button></>}
        {job.stage === 'download' && <><span className="mx-2 text-faint">·</span><button type="button" onClick={() => handleRetry(v)} disabled={retryingId === v.id} className="text-ink hover:underline underline-offset-4 disabled:opacity-40">{t('home.retry')}</button></>}
      </p>
    );
  };

  const prepLine = (v: VideoRecord) => {
    const job = hasAi && !v.importJob ? getPrepJob(v.id) : undefined;
    return job ? <span> · {t('home.prepBreakdownRunning', { done: job.done, total: job.total || '…' })}</span> : null;
  };

  const addBtn = <Btn size="sm" flat className="-mr-3" onClick={() => setAdding({ path: null })}><Plus size={15} /> {t('home.addVideo')}</Btn>;
  const lead = videos?.find(v => !v.importJob);
  const rest = (videos ?? []).filter(v => v !== lead);

  return (
    <div className="max-w-3xl mx-auto">
      {dragOver && (
        <div className="fixed inset-3 z-[70] rounded-2xl border-2 border-dashed border-accent bg-paper/90 flex items-center justify-center pointer-events-none fade-in">
          <p className="font-serif text-3xl text-ink">{t('home.dropRelease')}</p>
        </div>
      )}
      {adding && <AddVideo initialPath={adding.path} onClose={closeAdd} />}

      {videos === null ? (
        <div className="pt-24 flex justify-center text-mute"><Loader2 className="animate-spin" size={20} /></div>
      ) : videos.length === 0 ? (
        <div className="pt-28 flex flex-col items-center text-center">
          <p className="font-serif text-[40px] leading-tight">{t('home.nothingHereYet')}</p>
          <p className="mt-3 text-sm text-mute max-w-sm leading-relaxed">{t('home.nothingHereHint')}</p>
          <Btn tone="accent" size="lg" className="mt-8" onClick={() => setAdding({ path: null })}><Plus size={18} /> {t('home.addVideo')}</Btn>
        </div>
      ) : (
        <>
          {lead && (() => {
            const w = where(lead);
            return (
              <section className="pt-6 pb-12">
                <button type="button" onClick={() => onResume(lead, lastMode(lead))} className="block text-left font-serif text-[40px] leading-[1.15] hover:text-white transition-colors break-words">
                  {lead.displayName}
                </button>
                <div className="mt-4 flex items-center gap-4 text-sm text-mute">
                  <span>{w.text}{prepLine(lead)}</span>
                  <Line pct={w.pct} className="w-[120px]" />
                </div>
                <div className="mt-8 flex items-center gap-2">
                  <Btn tone="accent" size="lg" onClick={() => onResume(lead, lastMode(lead))}>
                    {t('home.continueMode', { mode: modeName(lastMode(lead)) })}
                  </Btn>
                  {more(lead, 'lg')}
                  <span className="flex-1" />
                  {addBtn}
                </div>
              </section>
            );
          })()}

          <section className="border-t border-line">
            {!lead && <div className="h-14 flex items-center justify-end">{addBtn}</div>}
            {rest.length === 0 ? (
              <p className="py-6 text-sm text-faint">{t('home.onlyOne')}</p>
            ) : (
              <ul>
                {rest.map(v => {
                  const w = v.importJob ? null : where(v);
                  return (
                    <li key={v.id} className="group relative flex items-center gap-6 py-3.5 border-t border-line first:border-t-0 focus-within:z-10 hover:z-10">
                      <div className="min-w-0 flex-1">
                        {v.importJob ? (
                          <p className="font-serif text-lg leading-snug text-ink/70 truncate">{v.displayName}</p>
                        ) : (
                          <button type="button" onClick={() => onResume(v, lastMode(v))} className="block max-w-full text-left font-serif text-lg leading-snug hover:text-white transition-colors truncate">
                            {v.displayName}
                          </button>
                        )}
                        {v.importJob && jobStatus(v)}
                      </div>
                      {/* Where you are, at the right edge; on hover the "…" takes its place. */}
                      <div className="relative shrink-0 w-[230px] h-8 flex items-center justify-end">
                        <div className="flex items-center justify-end gap-4 text-sm text-mute group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity">
                          {v.importJob ? (
                            !v.importJob.error && <><span>{jobLabel(v.importJob)}</span><Line pct={v.importJob.percent ?? 0} className="w-[120px] shrink-0" /></>
                          ) : (
                            <>
                              <span className="truncate">{w!.text}{prepLine(v)}</span>
                              <Line pct={w!.pct} className="w-[120px] shrink-0" />
                            </>
                          )}
                        </div>
                        <div className="absolute right-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {more(v)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Home;
