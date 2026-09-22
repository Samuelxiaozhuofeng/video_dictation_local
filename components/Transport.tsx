import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Bookmark, PlusCircle, Volume2, VolumeX, Mic, Check, X, Loader2 } from 'lucide-react';
import { LearningMode } from '../types';
import * as Storage from '../utils/storage';
import { usePracticeContext } from '../hooks/usePracticeContext';
import { Btn, Seg } from './ui';
import { useT } from '../utils/i18n';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

// The remote: progress, transport buttons, speed, save, Anki. Turns pink while recording.
const Transport: React.FC = () => {
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
      case 'recording': return { tone: 'rose' as const, icon: <Mic size={16} />, label: t('transport.rec') };
      case 'adding': return { tone: 'ink' as const, icon: <Loader2 size={16} className="animate-spin" />, label: t('transport.adding') };
      case 'success': return { tone: 'green-soft' as const, icon: <Check size={16} />, label: t('common.added') };
      case 'error': return { tone: 'rose-soft' as const, icon: <X size={16} />, label: t('common.failed') };
      default: return { tone: 'white' as const, icon: <PlusCircle size={16} />, label: 'Anki' };
    }
  };
  const af = ankiFace();

  return (
    <footer className={`shrink-0 border-t border-line transition-colors ${recording ? 'bg-rose-soft' : 'bg-page'}`}>
      <div className="px-4 sm:px-6 pt-3">
        {/* Progress */}
        <div className="flex items-center gap-3 font-mono text-xs text-mute">
          <span className="w-12">{cur}</span>
          <div className="relative flex-1 h-4 flex items-center group">
            <div className="w-full h-1.5 rounded-full bg-shade overflow-hidden">
              <div className="h-full rounded-full bg-green" style={{ width: `${progress}%` }} />
            </div>
            <input type="range" min="0" max="100" step="0.1" value={progress} onChange={actions.onProgressSeek}
              className="absolute inset-0 !h-full opacity-0 cursor-pointer" aria-label={t('transport.seek')} />
          </div>
          <span className="w-12 text-right">{dur}</span>
        </div>

        {/* Controls */}
        <div className="mt-3 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Btn square flat onClick={() => actions.onSkip('prev')} title={t('transport.previousLine')}><SkipBack size={18} /></Btn>
            <Btn square flat onClick={() => actions.onReplayCurrent()} title={t('transport.replayLine')}><RotateCcw size={18} /></Btn>
            <Btn square tone="green" onClick={actions.onTogglePlay} title={isPlaying ? t('transport.pauseSpace') : t('transport.playSpace')} className="!rounded-full">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </Btn>
            <Btn square flat onClick={() => actions.onSkip('next')} title={t('transport.nextLine')}><SkipForward size={18} /></Btn>
          </div>

          <Seg size="sm" value={playbackSpeed} onChange={actions.onSetPlaybackSpeed}
            options={SPEEDS.map(s => ({ value: s, label: `${s}×` }))} className="order-last sm:order-none" />

          <div className="flex items-center gap-2">
            <Btn square flat onClick={actions.onToggleSaveCurrent} title={isCurrentSaved ? t('transport.unsaveLine') : t('transport.saveLine')} className={isCurrentSaved ? '!bg-ochre-soft !text-ochre' : ''}>
              <Bookmark size={18} fill={isCurrentSaved ? 'currentColor' : 'none'} />
            </Btn>
            {ankiReady && (
              <Btn size="md" flat={ankiStatus === 'idle'} tone={af.tone} disabled={ankiStatus !== 'idle'} onClick={actions.onAddToAnki} title={t('transport.sendToAnki')}>
                {af.icon} <span className="hidden sm:inline">{af.label}</span>
              </Btn>
            )}
            <Btn square flat onClick={() => actions.onSetVolume(volume === 0 ? 1 : 0)} title={volume === 0 ? t('transport.unmute') : t('transport.mute')}>
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Btn>
          </div>
        </div>
      </div>

      {/* Key legend / recording banner */}
      <div className={`border-t border-line px-4 sm:px-6 py-1.5 text-[11px] ${recording ? 'bg-rose text-page' : 'bg-paper text-mute'}`}>
        {recording ? (
          <span className="blink">{t('transport.recordingBanner')}</span>
        ) : (
          <span className="hidden md:inline">{learningMode === LearningMode.DICTATION ? t('transport.legendDictation') : t('transport.legend')}</span>
        )}
      </div>
    </footer>
  );
};

export default Transport;
