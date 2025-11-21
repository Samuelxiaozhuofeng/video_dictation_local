import React, { useState, useEffect } from 'react';
import { Play, Trash2, Film, Clock, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { VideoRecord } from '../types';
import * as VideoStorage from '../utils/videoStorage';

interface VideoLibraryProps {
  onContinuePractice: (record: VideoRecord) => void;
}

const VideoLibrary: React.FC<VideoLibraryProps> = ({ onContinuePractice }) => {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const records = await VideoStorage.getAllVideoRecords();
      setVideos(records);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this video record? This cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      await VideoStorage.deleteVideoRecord(id);
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video record.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleContinue = (record: VideoRecord) => {
    onContinuePractice(record);
  };

  // Render progress bar
  const renderProgressBar = (completionRate: number) => {
    const filledDots = Math.round(completionRate / 10);
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < filledDots ? 'bg-brand-500' : 'bg-slate-700'
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium text-slate-400">{completionRate}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-slate-400">Loading your videos...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Film className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-xl font-medium text-slate-300 mb-2">No videos yet</h3>
        <p className="text-slate-500 mb-6">
          Upload your first video to start practicing!
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 max-w-md mx-auto text-left">
          <p className="text-sm text-slate-400">
            💡 <strong className="text-slate-300">Tip:</strong> Your practice progress and subtitles will be saved automatically.
            You may need to re-select the video file when continuing practice.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">My Videos</h2>
        <p className="text-slate-400">Continue where you left off</p>
      </div>

      <div className="space-y-4">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-600 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-brand-500/10 rounded-lg">
                    <Film className="w-5 h-5 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white truncate">
                    {video.displayName}
                  </h3>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  {renderProgressBar(video.completionRate)}
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>
                      {video.currentSubtitleIndex} / {video.totalSubtitles} subtitles
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{VideoStorage.formatLastPracticed(video.lastPracticed)}</span>
                  </div>
                </div>

                {/* Info message */}
                <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>You may need to select the video file again to continue</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleContinue(video)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-all shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {video.completionRate === 0 ? 'Start' : 'Continue'}
                </button>
                <button
                  onClick={(e) => handleDelete(video.id, e)}
                  disabled={deletingId === video.id}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {deletingId === video.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoLibrary;

