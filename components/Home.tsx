import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, MoreHorizontal, Loader2, LayoutGrid, List } from 'lucide-react';
import { LearningMode, VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';
import { getPracticeConfig } from '../utils/storage';
import { parseSRT } from '../utils/srtParser';
import { buildSections } from '../utils/sections';
import { fileNameFromPath, listenDragDrop, trashFile, relatedFilePaths } from '../utils/desktop';
import { formatImportError, isCookieError, openYouTubeLogin, retryImport, subscribeImportJobs } from '../utils/importJob';
import { Btn, Menu, MenuItem, Seg } from './ui';
import VideoCover from './VideoCover';
import { dialog } from './Dialog';
import { useT, useLang } from '../utils/i18n';
import AddVideo from './AddVideo';
import { canCloze } from '../utils/aiDrills';
import { cancelPrep, getPrepJob, prepStatus, prepareBreakdowns, subscribePrep } from '../utils/breakdownPrep';
import { cancelCloze, clozeStatus, getClozeJob, linesOf, prepareCloze, subscribeCloze } from '../utils/clozePrep';

// Home does two things: pick up the video you were on, and add a new one.
// As a list the most recent video leads and the rest are quiet rows; as cards
// every video gets a cover frame. Everything else (mode switch, AI prep,
// delete) waits behind hover or the "…" menu.

interface HomeProps {
  onResume: (record: VideoRecord, mode: LearningMode) => void | Promise<void>;
}

const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;
const VIEW_KEY = 'linguaclip_home_view';
type View = 'list' | 'cards';
type PrepInfo = { eligible: number; missing: number };
const SRT_EXT = /\.srt$/i;

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
  const [adding, setAdding] = useState<{ path: string | null; srt?: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // AI prep per video (breakdowns, blanks): how many lines are still unprepared,
  // read from the saved caches so it survives a restart, and a tick that
  // re-renders running jobs' progress.
  const [prep, setPrep] = useState<Map<string, PrepInfo>>(new Map());
  const [cloze, setCloze] = useState<Map<string, PrepInfo>>(new Map());
  const [prepTick, setPrepTick] = useState(0);
  const [view, setViewState] = useState<View>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'; } catch { return 'list'; }
  });
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-device convenience only */ }
  };
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

  // The whole window takes a dropped video and/or .srt; it opens the add dialog
  // with them filled in, keeping whichever half is already there.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listenDragDrop({
      onHover: () => setDragOver(true),
      onLeave: () => setDragOver(false),
      onDrop: (paths) => {
        setDragOver(false);
        const video = paths.find(p => VIDEO_EXT.test(fileNameFromPath(p)));
        const srt = paths.find(p => SRT_EXT.test(fileNameFromPath(p)));
        if (video || srt) setAdding(prev => ({ path: video ?? prev?.path ?? null, srt: srt ?? prev?.srt ?? null }));
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

  useEffect(() => {
    const bump = () => setPrepTick(n => n + 1);
    const offs = [subscribePrep(bump), subscribeCloze(bump)];
    return () => offs.forEach(off => off());
  }, []);
  // A running job ticks faster than a read of every cache finishes, so reads are
  // never cancelled (that starved the shelf until the job stopped): each one
  // lands unless a newer read already has.
  const statusSeq = useRef({ started: 0, applied: 0 });
  useEffect(() => {
    if (!hasAi || !videos) return;
    const seq = statusSeq.current;
    const mine = ++seq.started;
    const ready = videos.filter(v => !v.importJob && v.subtitleText);
    Promise.all(ready.map(async v => [v.id, await prepStatus(v.id, v.subtitleText, lang), await clozeStatus(v.id, v.subtitleText)] as const))
      .then(rows => {
        if (mine < seq.applied) return;
        seq.applied = mine;
        setPrep(new Map(rows.map(([id, b]) => [id, b])));
        setCloze(new Map(rows.map(([id, , c]) => [id, c])));
      })
      .catch(() => {});
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
    await Promise.all([cancelPrep(v.id), cancelCloze(v.id)]);
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
    if (job.stage === 'setup') return t('import.stageSetup', { pct });
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

  // One "…" entry per kind of AI prep: running, start, top up, or done.
  const prepItem = (job: { done: number; total: number } | undefined, info: PrepInfo | undefined, kind: 'Breakdown' | 'Cloze', start: () => Promise<unknown>): MenuItem | null => {
    if (job) return { label: t(`home.prep${kind}Running`, { done: job.done, total: job.total || '…' }), onClick: () => {}, disabled: true };
    if (!info || info.eligible === 0) return null;
    if (info.missing === 0) return { label: t(`home.prep${kind}Ready`), onClick: () => {}, disabled: true };
    return {
      label: info.missing < info.eligible ? t(`home.prep${kind}More`, { n: info.missing }) : t(`home.prep${kind}`),
      title: t(`home.prep${kind}Title`),
      onClick: () => { start().catch(err => console.error(err)); },
    };
  };

  // " · Broken down · Blanks 3/5": where each kind of AI prep stands.
  const prepLine = (v: VideoRecord) => {
    if (!hasAi || v.importJob) return null;
    const parts: string[] = [];
    const one = (job: { done: number; total: number } | undefined, info: PrepInfo | undefined, kind: 'Breakdown' | 'Cloze') => {
      if (job) parts.push(t(`home.prep${kind}Running`, { done: job.done, total: job.total || '…' }));
      else if (info && info.eligible > 0 && info.missing < info.eligible) {
        parts.push(info.missing === 0 ? t(`home.prep${kind}Done`) : t(`home.prep${kind}Part`, { done: info.eligible - info.missing, total: info.eligible }));
      }
    };
    one(getPrepJob(v.id), prep.get(v.id), 'Breakdown');
    one(getClozeJob(v.id), cloze.get(v.id), 'Cloze');
    return parts.length ? <span> · {parts.join(' · ')}</span> : null;
  };

  const menuFor = (v: VideoRecord): MenuItem[] => {
    const items: MenuItem[] = [];
    if (!v.importJob) {
      items.push({ label: t('home.practiceAs', { mode: modeName(otherMode(v)) }), onClick: () => onResume(v, otherMode(v)) });
      if (hasAi) {
        const b = prepItem(getPrepJob(v.id), prep.get(v.id), 'Breakdown', () => prepareBreakdowns(v.id, v.subtitleText, lang));
        const c = prepItem(getClozeJob(v.id), cloze.get(v.id), 'Cloze', () => prepareCloze(v.id, linesOf(v.subtitleText)));
        if (b) items.push(b);
        if (c) items.push(c);
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
        <span className="mx-2 text-faint">·</span><button type="button" onClick={() => handleRetry(v)} disabled={retryingId === v.id} className="text-ink hover:underline underline-offset-4 disabled:opacity-40">{t('home.retry')}</button>
      </p>
    );
  };

  const addBtn = <Btn size="sm" flat className="-mr-3" onClick={() => setAdding({ path: null })}><Plus size={15} /> {t('home.addVideo')}</Btn>;
  const lead = videos?.find(v => !v.importJob);
  const rest = (videos ?? []).filter(v => v !== lead);

  return (
    <div className={`${view === 'cards' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
      {dragOver && (
        <div className="fixed inset-3 z-[70] rounded-2xl border-2 border-dashed border-accent bg-paper/90 flex items-center justify-center pointer-events-none fade-in">
          <p className="font-serif text-3xl text-ink">{t('home.dropRelease')}</p>
        </div>
      )}
      {adding && <AddVideo initialPath={adding.path} initialSrt={adding.srt ?? null} onClose={closeAdd} onPractice={rec => onResume(rec, LearningMode.DICTATION)} />}

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
          <div className="pt-4 flex items-center justify-end gap-3">
            <Seg<View> size="sm" value={view} onChange={setView} options={[
              { value: 'list', label: <List size={14} />, title: t('home.viewList') },
              { value: 'cards', label: <LayoutGrid size={14} />, title: t('home.viewCards') },
            ]} />
            {addBtn}
          </div>

          {view === 'cards' ? (
            <ul className="pt-6 pb-12 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-8">
              {videos.map(v => {
                const w = v.importJob ? null : where(v);
                return (
                  <li key={v.id} className="group relative min-w-0 focus-within:z-10 hover:z-10">
                    <button type="button" disabled={!!v.importJob} onClick={() => onResume(v, lastMode(v))} className="block w-full text-left disabled:cursor-default">
                      <VideoCover path={v.videoPath}>
                        {v.importJob && !v.importJob.error && (
                          <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-xs text-ink bg-black/60">{jobLabel(v.importJob)}</span>
                        )}
                      </VideoCover>
                      <p className={`mt-3 font-serif text-lg leading-snug line-clamp-2 break-words transition-colors ${v.importJob ? 'text-ink/70' : 'group-hover:text-white'}`}>{v.displayName}</p>
                    </button>
                    {v.importJob ? (
                      jobStatus(v) ?? <Line pct={v.importJob.percent ?? 0} className="mt-2" />
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-mute truncate">{w!.text}{prepLine(v)}</p>
                        <Line pct={w!.pct} className="mt-2" />
                      </>
                    )}
                    <div className="absolute top-2 right-2 rounded-lg bg-page/80 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {more(v)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (<>
          {lead && (() => {
            const w = where(lead);
            return (
              <section className="pt-2 pb-12">
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
                </div>
              </section>
            );
          })()}

          <section className="border-t border-line">
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
          </>)}
        </>
      )}
    </div>
  );
};

export default Home;
