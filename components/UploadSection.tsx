import React, { useState } from 'react';
import { FileVideo, FileText, AlertCircle, Check, Play } from 'lucide-react';

interface UploadSectionProps {
  onStartPractice: (videoFile: File, subtitleFile: File) => void;
}

// File Upload Component
const FileDropZone = ({
    accept,
    label,
    icon: Icon,
    onFileSelect,
    selectedFile,
    allowMultiple = false,
    onMultipleFilesSelect
}: {
    accept: string,
    label: string,
    icon: any,
    onFileSelect: (f: File) => void,
    selectedFile: File | null,
    allowMultiple?: boolean,
    onMultipleFilesSelect?: (files: FileList) => void
}) => {
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (allowMultiple && onMultipleFilesSelect && e.dataTransfer.files.length > 0) {
            onMultipleFilesSelect(e.dataTransfer.files);
        } else if (e.dataTransfer.files?.[0]) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (allowMultiple && onMultipleFilesSelect && e.target.files && e.target.files.length > 0) {
            onMultipleFilesSelect(e.target.files);
        } else if (e.target.files?.[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group
                ${selectedFile
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-brand-400 hover:bg-slate-800'
                }`}
        >
            <input
                type="file"
                accept={accept}
                multiple={allowMultiple}
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
            />
            <div className={`p-4 rounded-full mb-3 transition-colors ${selectedFile ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}`}>
                <Icon className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-slate-200">{selectedFile ? selectedFile.name : label}</p>
            <p className="text-sm text-slate-500 mt-1">
                {selectedFile ? 'Click or drag to replace' : allowMultiple ? 'Select video + subtitle together or separately' : 'Click to browse or drag file here'}
            </p>
        </div>
    );
};

const UploadSection: React.FC<UploadSectionProps> = ({ onStartPractice }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [autoDetectedSubtitle, setAutoDetectedSubtitle] = useState(false);

  const handleVideoFileSelect = async (file: File) => {
    setVideoFile(file);
    setAutoDetectedSubtitle(false);
  };

  const handleMultipleFilesSelect = (files: FileList) => {
    // Auto-detect video and subtitle files from multiple selection
    let detectedVideo: File | null = null;
    let detectedSubtitle: File | null = null;

    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.mp4') || fileName.endsWith('.webm') || fileName.endsWith('.mkv')) {
        detectedVideo = file;
      } else if (fileName.endsWith('.srt') || fileName.endsWith('.txt')) {
        detectedSubtitle = file;
      }
    });

    if (detectedVideo) {
      setVideoFile(detectedVideo);
    }

    if (detectedSubtitle) {
      setSubtitleFile(detectedSubtitle);
      if (detectedVideo) {
        setAutoDetectedSubtitle(true);
      }
    }
  };

  const handleStart = () => {
    if (videoFile && subtitleFile) {
      onStartPractice(videoFile, subtitleFile);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-3">Upload New Video</h2>
        <p className="text-slate-400 text-lg">Start a new practice session with your video and subtitles.</p>
      </div>

      <div className="space-y-6">
        <FileDropZone
            accept="video/*,.mp4,.webm,.mkv"
            label="Upload Video (.mp4)"
            icon={FileVideo}
            selectedFile={videoFile}
            onFileSelect={handleVideoFileSelect}
            allowMultiple={true}
            onMultipleFilesSelect={handleMultipleFilesSelect}
        />
        <FileDropZone
            accept=".srt,.txt"
            label="Upload Subtitles (.srt)"
            icon={FileText}
            selectedFile={subtitleFile}
            onFileSelect={setSubtitleFile}
        />
      </div>

      {autoDetectedSubtitle && (
        <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>Subtitle file automatically detected!</span>
        </div>
      )}

      <div className="mt-10">
        <button
            onClick={handleStart}
            disabled={!videoFile || !subtitleFile}
            className="w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-900/20 hover:shadow-brand-500/20"
        >
            Start Practice Session
            <Play className="w-5 h-5 fill-current" />
        </button>

        {(!videoFile || !subtitleFile) && (
            <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Both video and subtitle files are required to start.</span>
            </div>
        )}

        {!subtitleFile && videoFile && (
            <div className="mt-3 text-center text-xs text-slate-600">
                💡 Tip: You can select video and subtitle files together for auto-detection
            </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;

