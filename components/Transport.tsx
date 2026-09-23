import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Bookmark, PlusCircle, Volume2, VolumeX, Mic, Check, X, Loader2, MoreHorizontal } from 'lucide-react';
import { LearningMode } from '../types';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { Btn, Menu, MenuItem, Seg } from './ui';
import { useT } from '../utils/i18n';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

// The remote along the bottom: a hairline progress bar you can seek on, the play
// controls, the key legend, save / Anki / mute, and a "…" menu for the rarer
// settings (speed, plus whatever the page adds: cloze level, breakdown).
const Transport: React.FC<{ lineLabel: string; menuItems: MenuItem[]; menuPanel?: React.ReactNode }> = ({ lineLabel, menuItems, menuPanel }) => {
  const t = useT();
  const { practice, video, saved, anki, actions } = usePracticeContext();
  const { learningMode } = practice;
  const { videoRef, isPlaying, volume, playbackSpeed, progress } = video;
  const { isCurrentSaved } = saved;
  const { ankiConfig, ankiStatus } = anki;

  const ankiReady = !!ankiConfig && !!(ankiConfig.audioCard || ankiConfig.wordCard);
  const recording = ankiStatus === 'recording';
  const cur = videoRef.current ? Storage.formatTimeCode(videoRef.current.currentTime) : '00:00';
  const dur = videoRef.current ? Storage.formatTimeCode(videoRef.current.duration) : '00:00';

  const ankiFace = () => {
    switch (ankiStatus) {
      case 'recording': return { icon: <Mic size={15} />, label: t('transport.rec') };
      case 'adding': return { icon: <Loader2 size={15} className="animate-spin" />, label: t('transport.adding') };
      case 'success': return { icon: <Check size={15} />, label: t('common.added') };
      case 'error': return { icon: <X size={15} />, label: t('common.failed') };
      default: return { icon: <PlusCircle size={15} />, label: 'Anki' };
    }
  };
  const af = ankiFace();

  return (
    <footer className={`relative shrink-0 h-14 px-4 flex items-center gap-4 text-xs text-mute transition-colors ${recording ? 'bg-accent-soft' : ''}`}>
      {/* Progress: a hairline across the top edge, seekable */}
      <div className="absolute left-0 right-0 top-0 h-3 -translate-y-1/2 flex items-center group" title={`${cur} / ${dur}`}>
        <div className="w-full h-[2px] bg-shade group-hover:h-1 transition-all">
          <div className="h-full bg-mute" style={{ width: `${progress}%` }} />
        </div>
        <input type="range" min="0" max="100" step="0.1" value={progress} onChange={actions.onProgressSeek}
          className="absolute inset-0 !h-full opacity-0 cursor-pointer" aria-label={t('transport.seek')} />
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <Btn square size="sm" flat onClick={() => actions.onSkip('prev')} title={t('transport.previousLine')}><SkipBack size={16} /></Btn>
        <Btn square size="sm" flat onClick={() => actions.onReplayCurrent()} title={t('transport.replayLine')}><RotateCcw size={16} /></Btn>
        <Btn square size="sm" flat onClick={actions.onTogglePlay} title={isPlaying ? t('transport.pauseSpace') : t('transport.playSpace')} className="!text-ink">
          {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
        </Btn>
        <Btn square size="sm" flat onClick={() => actions.onSkip('next')} title={t('transport.nextLine')}><SkipForward size={16} /></Btn>
      </div>

      <div className="min-w-0 flex-1 truncate">
        {recording ? (
          <span className="blink text-accent">{t('transport.recordingBanner')}</span>
        ) : (
          <span className="hidden xl:inline">{learningMode === LearningMode.DICTATION ? t('transport.legendDictation') : t('transport.legend')}</span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <span className="px-2">{lineLabel}</span>
        <Btn square size="sm" flat onClick={actions.onToggleSaveCurrent} title={isCurrentSaved ? t('transport.unsaveLine') : t('transport.saveLine')} className={isCurrentSaved ? '!text-accent' : ''}>
          <Bookmark size={16} fill={isCurrentSaved ? 'currentColor' : 'none'} />
        </Btn>
        {ankiReady && (
          <Btn size="sm" flat disabled={ankiStatus !== 'idle'} onClick={actions.onAddToAnki} title={t('transport.sendToAnki')} className={ankiStatus === 'idle' ? '' : '!opacity-100 !text-ink'}>
            {af.icon} <span className="hidden sm:inline">{af.label}</span>
          </Btn>
        )}
        <Btn square size="sm" flat onClick={() => actions.onSetVolume(volume === 0 ? 1 : 0)} title={volume === 0 ? t('transport.unmute') : t('transport.mute')}>
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Btn>
        <Menu up items={menuItems} trigger={(open, toggle) => (
          <Btn square size="sm" flat onClick={toggle} title={t('home.more')} aria-label={t('home.more')} className={open ? '!bg-shade !text-ink' : ''}>
            <MoreHorizontal size={17} />
          </Btn>
        )}>
          <div className="px-3.5 py-2 flex flex-col gap-2">
            <span className="text-xs text-mute">{t('transport.speed')}</span>
            <Seg size="sm" value={playbackSpeed} onChange={actions.onSetPlaybackSpeed} options={SPEEDS.map(s => ({ value: s, label: `${s}×` }))} />
          </div>
          {menuPanel}
          {menuItems.length > 0 && <div className="my-1.5 border-t border-line" />}
        </Menu>
      </div>
    </footer>
  );
};

export default Transport;
