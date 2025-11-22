import React, { useState } from 'react';
import { Bookmark, Settings as SettingsIcon } from 'lucide-react';
import { VideoRecord } from '../types';
import VideoLibrary from './VideoLibrary';
import UploadSection from './UploadSection';

interface UploadPageProps {
  onStartPractice: (videoFile: File, subtitleFile: File) => void;
  onContinuePractice: (record: VideoRecord) => void;
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
    <div className="min-h-screen bg-slate-900 flex flex-col p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">LinguaClip Practice</h1>
            <p className="text-slate-400 text-lg">Master language listening by typing what you hear from your favorite videos.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onOpenSettings}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenLibrary}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
            >
              <Bookmark className="w-4 h-4 text-brand-400" />
              <span>My Collection</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mb-6">
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setUploadTab('library')}
            className={`px-6 py-3 font-medium transition-all relative ${
              uploadTab === 'library'
                ? 'text-brand-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📚 My Videos
            {uploadTab === 'library' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400"></div>
            )}
          </button>
          <button
            onClick={() => setUploadTab('upload')}
            className={`px-6 py-3 font-medium transition-all relative ${
              uploadTab === 'upload'
                ? 'text-brand-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ➕ Upload New
            {uploadTab === 'upload' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400"></div>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 overflow-auto pb-6">
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

