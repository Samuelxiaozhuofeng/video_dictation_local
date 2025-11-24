import React, { useState } from 'react';
import { Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { VideoRecord, LearningMode, BlurPlaybackMode } from '../types';
import VideoLibrary from './VideoLibrary';
import UploadSection from './UploadSection';

interface UploadPageProps {
  onStartPractice: (videoFile: File, subtitleFile: File, learningMode: LearningMode, blurPlaybackMode?: BlurPlaybackMode) => void | Promise<void>;
  onContinuePractice: (record: VideoRecord) => void | Promise<void>;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({
  onStartPractice,
  onContinuePractice,
  onOpenSettings,
  onOpenLibrary,
}) => {
  const [uploadTab, setUploadTab] = useState<'library' | 'upload'>('library');

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col relative">
      {/* Header */}
      <div className="w-full border-b border-neutral-800/50 bg-neutral-900/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-soft-lg">
                LC
              </div>
              <h1 className="text-xl font-semibold text-white">LinguaClip</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 rounded-xl text-neutral-300 hover:text-white transition-all"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={onOpenLibrary}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 rounded-xl text-neutral-300 hover:text-white transition-all"
              >
                <Bookmark className="w-4 h-4" />
                <span className="hidden sm:inline">Collection</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="w-full max-w-6xl mx-auto px-6 mt-8">
        <div className="flex gap-1 p-1 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 w-fit">
          <button
            onClick={() => setUploadTab('library')}
            className={`px-6 py-2.5 font-medium rounded-xl transition-all ${
              uploadTab === 'library'
                ? 'bg-brand-500 text-white shadow-soft'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            📚 My Videos
          </button>
          <button
            onClick={() => setUploadTab('upload')}
            className={`px-6 py-2.5 font-medium rounded-xl transition-all ${
              uploadTab === 'upload'
                ? 'bg-brand-500 text-white shadow-soft'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            ➕ Upload New
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full max-w-6xl mx-auto flex-1 overflow-auto px-6 py-8">
        {uploadTab === 'library' ? (
          <VideoLibrary onContinuePractice={onContinuePractice} />
        ) : (
          <UploadSection onStartPractice={onStartPractice} />
        )}
      </div>
    </div>
  );
};

export default UploadPage;

