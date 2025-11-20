import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  FileVideo,
  FileText,
  RotateCcw,
  AlertCircle,
  Bookmark,
  X,
  Trash2,
  PlayCircle,
  Library,
  Settings as SettingsIcon,
  PlusCircle,
  Check,
  Mic,
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2
} from 'lucide-react';
import { AppState, PracticeMode, Subtitle, VideoSection } from './types';
import { parseSRT } from './utils/srtParser';
import * as Storage from './utils/storage';
import * as Anki from './utils/anki';
import InputFeedback from './components/InputFeedback';
import SavedLibrary from './components/SavedLibrary';
import Settings from './components/Settings';

// --- Helper Component: File Upload ---
const FileDropZone = ({ 
    accept, 
    label, 
    icon: Icon, 
    onFileSelect, 
    selectedFile 
}: { 
    accept: string, 
    label: string, 
    icon: any, 
    onFileSelect: (f: File) => void,
    selectedFile: File | null
}) => {
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files?.[0]) onFileSelect(e.dataTransfer.files[0]);
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
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            />
            <div className={`p-4 rounded-full mb-3 transition-colors ${selectedFile ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}`}>
                <Icon className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-slate-200">{selectedFile ? selectedFile.name : label}</p>
            <p className="text-sm text-slate-500 mt-1">{selectedFile ? 'Click or drag to replace' : 'Click to browse or drag file here'}</p>
        </div>
    );
};

export default function App() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  
  // Resources
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  
  // Subtitles & Sections
  const [fullSubtitles, setFullSubtitles] = useState<Subtitle[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]); // Currently active list
  const [sections, setSections] = useState<VideoSection[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Playback State
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progress, setProgress] = useState(0); // 0 to 100
  
  // Practice Mode State
  const [mode, setMode] = useState<PracticeMode>(PracticeMode.LISTENING);
  const [showSectionComplete, setShowSectionComplete] = useState(false);
  const [shouldAutoAdvance, setShouldAutoAdvance] = useState(false);

  // Saved Lines State
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [showSavedList, setShowSavedList] = useState(false);

  // Anki State
  const [ankiConfig, setAnkiConfig] = useState(Anki.getAnkiConfig());
  const [ankiStatus, setAnkiStatus] = useState<'idle' | 'recording' | 'adding' | 'success' | 'error'>('idle');

  // Config
  const [practiceConfig, setPracticeConfig] = useState(Storage.getPracticeConfig());

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>();

  // --- Effects & Logic ---

  // Load configs
  useEffect(() => {
    setPracticeConfig(Storage.getPracticeConfig());
    if (appState !== AppState.SETTINGS) {
      setAnkiConfig(Anki.getAnkiConfig());
    }
  }, [appState]);

  // Video Loop for pausing at end of subtitle
  const checkVideoTime = useCallback(() => {
    if (!videoRef.current || subtitles.length === 0) return;
    
    const video = videoRef.current;
    const currentSub = subtitles[currentSubtitleIndex];
    
    // If we don't have a valid subtitle index (e.g. empty section), do nothing
    if (!currentSub) return;

    // We check paused state via isPlaying to avoid fighting manual controls
    if (isPlaying) {
      // If we passed the end time of the current subtitle
      if (video.currentTime >= currentSub.endTime) {
        video.pause();
        setIsPlaying(false);

        // Snap to end exactly to look clean
        video.currentTime = currentSub.endTime;

        // Only switch mode if we were in LISTENING.
        // If we were in INPUT/FEEDBACK (replaying), we stay there.
        if (mode === PracticeMode.LISTENING) {
            setMode(PracticeMode.INPUT);
        }
        // If we should auto-advance after replay (all words correct)
        else if (shouldAutoAdvance) {
            setShouldAutoAdvance(false);
            // Auto-advance to next subtitle
            if (currentSubtitleIndex < subtitles.length - 1) {
              setCurrentSubtitleIndex(prev => prev + 1);
              setMode(PracticeMode.LISTENING);
              setAnkiStatus('idle');
            } else {
              // End of current section
              if (currentSectionIndex < sections.length - 1) {
                  setShowSectionComplete(true);
              } else {
                  alert("Practice Complete! You have finished the video.");
                  setAppState(AppState.UPLOAD);
              }
            }
        }
      }
    }
    
    // Update Progress Bar
    if (video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }

    requestRef.current = requestAnimationFrame(checkVideoTime);
  }, [subtitles, currentSubtitleIndex, mode, isPlaying]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(checkVideoTime);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [checkVideoTime]);

  // Handle Volume/Speed changes directly on ref
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed]);

  // Initial Seek when index changes (Subtitle Change)
  useEffect(() => {
    if (videoRef.current && subtitles.length > 0 && mode === PracticeMode.LISTENING && subtitles[currentSubtitleIndex]) {
       const currentSub = subtitles[currentSubtitleIndex];
       
       // Check if we are way off (e.g. user clicked next/prev)
       const tolerance = 0.5; // 0.5s tolerance
       if (videoRef.current.currentTime < currentSub.startTime - tolerance || videoRef.current.currentTime > currentSub.endTime) {
         videoRef.current.currentTime = currentSub.startTime;
       }
       
       if (!isPlaying && !showSectionComplete) {
         videoRef.current.play().catch(e => console.error("Autoplay blocked", e));
         setIsPlaying(true);
       }
    }
  }, [currentSubtitleIndex, subtitles, mode, showSectionComplete]); 

  // Change current active subtitles when section changes
  const switchSection = (index: number) => {
      if (index < 0 || index >= sections.length) return;
      
      const newSection = sections[index];
      setCurrentSectionIndex(index);
      setSubtitles(newSection.subtitles);
      setCurrentSubtitleIndex(0);
      setMode(PracticeMode.LISTENING);
      setShowSectionComplete(false);
      setIsPlaying(false);
      
      // Seek to start of section
      if (videoRef.current) {
          // If the section has subtitles, jump to first sub start.
          // Otherwise jump to section logical start.
          const startTime = newSection.subtitles.length > 0 ? newSection.subtitles[0].startTime : newSection.startTime;
          videoRef.current.currentTime = startTime;
      }
  };


  // --- Handlers ---

  const handleStartPractice = async () => {
    if (videoFile && subtitleFile) {
      try {
        const subText = await subtitleFile.text();
        const parsed = parseSRT(subText);
        if (parsed.length === 0) {
            alert("No subtitles found in file. Please check the format.");
            return;
        }
        
        const storedLines = Storage.getSavedLines();
        const previouslySavedIds = new Set<number>();
        parsed.forEach(sub => {
           if (storedLines.some(l => l.text === sub.text)) {
               previouslySavedIds.add(sub.id);
           }
        });

        // 1. Setup Sections
        const computedSections: VideoSection[] = [];
        const pConfig = Storage.getPracticeConfig();
        
        if (pConfig.sectionLength > 0) {
            const sectionDuration = pConfig.sectionLength * 60;
            const lastTime = parsed[parsed.length - 1].endTime;
            
            let currentTime = 0;
            let secId = 1;
            
            while (currentTime < lastTime) {
                const endTime = currentTime + sectionDuration;
                const sectionSubs = parsed.filter(s => s.startTime >= currentTime && s.startTime < endTime);
                
                // Only add section if it has content or it's the first one
                if (sectionSubs.length > 0 || secId === 1) {
                    computedSections.push({
                        id: secId,
                        label: `Section ${secId}`,
                        startTime: currentTime,
                        endTime: endTime,
                        subtitleIndices: [], 
                        subtitles: sectionSubs
                    });
                }
                
                currentTime = endTime;
                secId++;
            }
        } else {
            // Single Section
            computedSections.push({
                id: 1,
                label: "Full Video",
                startTime: 0,
                endTime: parsed[parsed.length - 1].endTime + 10,
                subtitleIndices: [],
                subtitles: parsed
            });
        }

        setFullSubtitles(parsed);
        setSections(computedSections);
        setCurrentSectionIndex(0);
        setSubtitles(computedSections[0].subtitles);
        setSavedIds(previouslySavedIds);
        setVideoSrc(URL.createObjectURL(videoFile));
        setAppState(AppState.PRACTICE);
        setCurrentSubtitleIndex(0);
        setMode(PracticeMode.LISTENING);
        
      } catch (e) {
        alert("Error parsing subtitle file.");
        console.error(e);
      }
    }
  };

  const handleInputComplete = (wasCorrect: boolean) => {
     setMode(PracticeMode.FEEDBACK);
  };

  const handleContinue = () => {
     if (currentSubtitleIndex < subtitles.length - 1) {
       setCurrentSubtitleIndex(prev => prev + 1);
       setMode(PracticeMode.LISTENING);
       setAnkiStatus('idle'); 
     } else {
       // End of current section
       if (currentSectionIndex < sections.length - 1) {
           setShowSectionComplete(true);
       } else {
           alert("Practice Complete! You have finished the video.");
           setAppState(AppState.UPLOAD);
       }
     }
  };

  const handleNextSection = () => {
      switchSection(currentSectionIndex + 1);
  };

  const handleReplayCurrent = useCallback((autoAdvanceAfter: boolean = false) => {
    if (videoRef.current && subtitles[currentSubtitleIndex]) {
        videoRef.current.currentTime = subtitles[currentSubtitleIndex].startTime;
        videoRef.current.play();
        setIsPlaying(true);
        setShouldAutoAdvance(autoAdvanceAfter);
    }
  }, [subtitles, currentSubtitleIndex]);

  const handleSkip = useCallback((direction: 'prev' | 'next') => {
      if (direction === 'prev' && currentSubtitleIndex > 0) {
          setCurrentSubtitleIndex(prev => prev - 1);
          setMode(PracticeMode.LISTENING);
          setAnkiStatus('idle');
      } else if (direction === 'next' && currentSubtitleIndex < subtitles.length - 1) {
          setCurrentSubtitleIndex(prev => prev + 1);
          setMode(PracticeMode.LISTENING);
          setAnkiStatus('idle');
      }
  }, [currentSubtitleIndex, subtitles.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        handleReplayCurrent();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowLeft') {
         e.preventDefault();
         handleSkip('prev');
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'ArrowRight') {
         e.preventDefault();
         handleSkip('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReplayCurrent, handleSkip]);

  const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
      } else {
          if (mode === PracticeMode.INPUT || mode === PracticeMode.FEEDBACK) {
             handleReplayCurrent();
          } else {
            videoRef.current.play();
            setIsPlaying(true);
          }
      }
  };

  const handleProgressSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current && videoRef.current.duration) {
       const newTime = (Number(e.target.value) / 100) * videoRef.current.duration;
       videoRef.current.currentTime = newTime;
       setProgress(Number(e.target.value));
       
       // When seeking globally, we might jump out of current section bounds.
       // Find which section this time belongs to.
       const targetSectionIndex = sections.findIndex(s => newTime >= s.startTime && newTime < s.endTime);
       
       if (targetSectionIndex !== -1) {
           if (targetSectionIndex !== currentSectionIndex) {
               const newSection = sections[targetSectionIndex];
               setCurrentSectionIndex(targetSectionIndex);
               setSubtitles(newSection.subtitles);
               // Find subtitle in that section
               const subIndex = newSection.subtitles.findIndex(s => newTime >= s.startTime && newTime <= s.endTime);
               setCurrentSubtitleIndex(subIndex !== -1 ? subIndex : 0);
           } else {
               // Same section, just find subtitle
               const subIndex = subtitles.findIndex(s => newTime >= s.startTime && newTime <= s.endTime);
               if (subIndex !== -1) setCurrentSubtitleIndex(subIndex);
           }
           setMode(PracticeMode.LISTENING);
           setAnkiStatus('idle');
       }
    }
  };

  const toggleSaveCurrent = () => {
      const currentSub = subtitles[currentSubtitleIndex];
      if (!currentSub) return;
      
      const isSaved = savedIds.has(currentSub.id);
      
      if (isSaved) {
          setSavedIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(currentSub.id);
              return newSet;
          });
          Storage.removeLineFromStorage(currentSub.text);
      } else {
          setSavedIds(prev => {
              const newSet = new Set(prev);
              newSet.add(currentSub.id);
              return newSet;
          });
          Storage.saveLineToStorage(currentSub, videoFile?.name || 'Unknown Video');
      }
  };

  // --- Anki Integration ---

  const captureAudioClip = async (start: number, end: number): Promise<string | null> => {
    const video = videoRef.current;
    if (!video) return null;

    // Check for browser support
    const stream: MediaStream | null = (video as any).captureStream ? (video as any).captureStream() : 
                                       (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
    
    if (!stream) return null;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return null;

    const recorder = new MediaRecorder(new MediaStream([audioTrack]), { mimeType: 'audio/webm' });
    const chunks: BlobPart[] = [];
    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;

    return new Promise((resolve) => {
        recorder.ondataavailable = e => { 
            if (e.data.size > 0) chunks.push(e.data); 
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                
                // Restore state
                video.currentTime = originalTime;
                if (!wasPlaying) video.pause();
                
                resolve(base64);
            }
        };

        // Start recording sequence
        video.currentTime = start;
        recorder.start();
        video.play().catch(e => console.error("Record playback failed", e));

        const duration = (end - start) * 1000;
        
        // Stop slightly after duration to ensure we catch the end
        setTimeout(() => {
            if (recorder.state !== 'inactive') {
                recorder.stop();
                video.pause();
            }
        }, duration + 50); // 50ms buffer
    });
  };

  const captureMedia = async (currentSub: Subtitle) => {
      let screenshotBase64 = undefined;
      let audioBase64 = undefined;

      if (!ankiConfig) return { screenshotBase64, audioBase64 };

      const mappingValues = Object.values(ankiConfig.fieldMapping);
      const needsScreenshot = mappingValues.includes('screenshot');
      const needsAudio = mappingValues.includes('audio');

      // 1. Capture Screenshot
      if (videoRef.current && needsScreenshot) {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  screenshotBase64 = canvas.toDataURL('image/jpeg', 0.8);
              }
          } catch (e) {
              console.error("Screenshot capture failed", e);
          }
      }

      // 2. Capture Audio
      if (needsAudio && videoRef.current) {
          try {
              const result = await captureAudioClip(currentSub.startTime, currentSub.endTime);
              if (result) audioBase64 = result;
          } catch (e) {
              console.error("Audio capture failed", e);
          }
      }

      return { screenshotBase64, audioBase64 };
  };

  const handleAddToAnki = async () => {
    if (!ankiConfig) {
      alert("Please configure Anki settings first.");
      return;
    }
    if (ankiStatus !== 'idle') return;

    const currentSub = subtitles[currentSubtitleIndex];
    if (!currentSub) return;

    const needsAudio = Object.values(ankiConfig.fieldMapping).includes('audio');
    if (needsAudio) setAnkiStatus('recording');
    else setAnkiStatus('adding');

    const { screenshotBase64, audioBase64 } = await captureMedia(currentSub);

    setAnkiStatus('adding');
    try {
        await Anki.addNote(ankiConfig, {
            sentence: currentSub.text,
            videoName: videoFile?.name || 'Unknown',
            timestamp: Storage.formatTimeCode(currentSub.startTime),
            screenshotBase64,
            audioBase64
        });
        setAnkiStatus('success');
        setTimeout(() => setAnkiStatus('idle'), 2000);
    } catch (e: any) {
        console.error(e);
        setAnkiStatus('error');
        alert("Failed to add to Anki: " + e.message);
        setTimeout(() => setAnkiStatus('idle'), 3000);
    }
  };

  const handleWordToAnki = async (word: string, definition: string) => {
      if (!ankiConfig || !subtitles[currentSubtitleIndex]) return;
      
      const currentSub = subtitles[currentSubtitleIndex];
      
      const { screenshotBase64, audioBase64 } = await captureMedia(currentSub);
      
      await Anki.addNote(ankiConfig, {
          sentence: currentSub.text,
          videoName: videoFile?.name || 'Unknown',
          timestamp: Storage.formatTimeCode(currentSub.startTime),
          screenshotBase64,
          audioBase64,
          word,
          definition
      });
  };

  const deleteSavedItem = (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const sub = fullSubtitles.find(s => s.id === id);
      if (sub) {
          setSavedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          Storage.removeLineFromStorage(sub.text);
      }
  };

  const jumpToSaved = (id: number) => {
      const sub = fullSubtitles.find(s => s.id === id);
      if (sub) {
         const sectionIdx = sections.findIndex(sec => sub.startTime >= sec.startTime && sub.startTime < sec.endTime);
         if (sectionIdx !== -1) {
             if (sectionIdx !== currentSectionIndex) {
                 switchSection(sectionIdx);
                 const newSectionSubs = sections[sectionIdx].subtitles;
                 const subIndex = newSectionSubs.findIndex(s => s.id === id);
                 if (subIndex !== -1) setCurrentSubtitleIndex(subIndex);
             } else {
                 const subIndex = subtitles.findIndex(s => s.id === id);
                 if (subIndex !== -1) setCurrentSubtitleIndex(subIndex);
             }
             setMode(PracticeMode.LISTENING);
             setAnkiStatus('idle');
             setShowSavedList(false);
         }
      }
  };

  // --- Render ---

  if (appState === AppState.SETTINGS) {
      return <Settings onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.LIBRARY) {
      return <SavedLibrary onBack={() => setAppState(AppState.UPLOAD)} />;
  }

  if (appState === AppState.UPLOAD) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
        </div>

        <div className="absolute top-6 right-6 z-20 flex gap-3">
           <button 
             onClick={() => setAppState(AppState.SETTINGS)}
             className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
             title="Settings"
           >
              <SettingsIcon className="w-5 h-5" />
           </button>
           <button 
             onClick={() => setAppState(AppState.LIBRARY)}
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors shadow-lg"
           >
              <Bookmark className="w-4 h-4 text-brand-400" />
              <span>My Collection</span>
           </button>
        </div>

        <div className="relative z-10 w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-10 rounded-3xl shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-white tracking-tight mb-3">LinguaClip Practice</h1>
            <p className="text-slate-400 text-lg">Master language listening by typing what you hear from your favorite videos.</p>
          </div>

          <div className="space-y-6">
            <FileDropZone 
                accept="video/mp4" 
                label="Upload Video (.mp4)" 
                icon={FileVideo} 
                selectedFile={videoFile}
                onFileSelect={setVideoFile}
            />
            <FileDropZone 
                accept=".srt,.txt" 
                label="Upload Subtitles (.srt)" 
                icon={FileText} 
                selectedFile={subtitleFile}
                onFileSelect={setSubtitleFile}
            />
          </div>

          <div className="mt-10">
            <button 
                onClick={handleStartPractice}
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
          </div>
        </div>
      </div>
    );
  }

  // PRACTICE MODE
  const currentSub = subtitles[currentSubtitleIndex];
  const isCurrentSaved = currentSub && savedIds.has(currentSub.id);
  const savedItems = fullSubtitles.filter(s => savedIds.has(s.id));

  return (
    <div className="h-screen w-screen bg-black text-slate-200 overflow-hidden relative flex flex-col">
      
      {/* --- Top Floating Header --- */}
      <header className="absolute top-0 left-0 right-0 h-20 z-40 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-start pt-4 px-6 justify-between transition-opacity hover:opacity-100 opacity-0 sm:opacity-100">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600/90 backdrop-blur rounded-lg flex items-center justify-center font-bold text-white shadow-lg">LC</div>
            
            {/* Section Selector */}
            {sections.length > 1 && (
                <div className="flex items-center gap-1 ml-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg p-1">
                    <button 
                        onClick={() => switchSection(currentSectionIndex - 1)}
                        disabled={currentSectionIndex === 0}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className="px-2 text-xs font-medium text-slate-300 flex items-center gap-2">
                         <span className="hidden sm:inline">Section</span>
                         <span>{currentSectionIndex + 1} / {sections.length}</span>
                    </div>
                    <button 
                        onClick={() => switchSection(currentSectionIndex + 1)}
                        disabled={currentSectionIndex === sections.length - 1}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={() => setShowSavedList(true)}
                className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-brand-400 transition-colors bg-black/50 hover:bg-black/70 backdrop-blur px-3 py-1.5 rounded-full border border-white/10"
            >
                <Bookmark size={14} className={savedIds.size > 0 ? "fill-brand-400 text-brand-400" : ""} />
                <span className="hidden sm:inline">Saved ({savedIds.size})</span>
            </button>

            <button onClick={() => setAppState(AppState.UPLOAD)} className="text-xs font-medium text-slate-400 hover:text-white transition-colors bg-black/50 hover:bg-red-900/30 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur">
                Exit
            </button>
        </div>
      </header>

      {/* --- Main Fullscreen Video Layer --- */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
             {videoSrc && (
                 <video 
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full object-contain"
                    playsInline
                    onClick={togglePlay}
                    crossOrigin="anonymous"
                 />
             )}
             
             {/* Overlays */}
             {ankiStatus === 'recording' && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                     <div className="p-4 rounded-full bg-red-500/20 mb-4 animate-pulse">
                         <Mic className="w-10 h-10 text-red-500" />
                     </div>
                     <p className="text-white font-medium text-lg">Capturing Audio...</p>
                 </div>
             )}

             {showSectionComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl text-center max-w-md shadow-2xl">
                        <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Section Complete!</h2>
                        <p className="text-slate-400 mb-6">Great job. You've finished all lines in this section.</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleNextSection}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all"
                            >
                                Continue to Next Section
                            </button>
                            <button 
                                onClick={() => setShowSectionComplete(false)}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all"
                            >
                                Review Current Section
                            </button>
                        </div>
                    </div>
                </div>
             )}
             
             {!isPlaying && mode === PracticeMode.LISTENING && ankiStatus !== 'recording' && !showSectionComplete && (
                 <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10 group">
                     <div className="p-6 bg-black/40 backdrop-blur-sm rounded-full shadow-2xl transform transition-all group-hover:scale-110 group-hover:bg-brand-600/80 border border-white/10">
                        <Play className="w-12 h-12 text-white fill-current ml-1" />
                     </div>
                 </button>
             )}
      </div>

      {/* --- Bottom Interaction Layer --- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent pt-32 pb-6 px-4 flex flex-col items-center justify-end transition-all duration-300 pointer-events-none">
        
        <div className="w-full max-w-4xl pointer-events-auto">
            {/* Input / Feedback Zone */}
            <div className="mb-6 min-h-[80px] flex items-end justify-center">
                {currentSub ? (
                    mode === PracticeMode.LISTENING ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 animate-pulse pb-4">
                            <p className="text-xs uppercase tracking-[0.2em] font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">Listen Carefully</p>
                        </div>
                    ) : (
                        <InputFeedback 
                            targetText={currentSub.text}
                            mode={mode}
                            onComplete={(correct) => correct ? handleContinue() : handleInputComplete(correct)}
                            onReplay={handleReplayCurrent}
                            onWordToAnki={handleWordToAnki}
                        />
                    )
                ) : (
                        <div className="text-slate-500">End of content.</div>
                )}
            </div>

            {/* Progress & Controls */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
                {/* Progress Bar */}
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mb-3">
                    <span>{videoRef.current ? Storage.formatTimeCode(videoRef.current.currentTime) : "00:00"}</span>
                    <div className="flex-1 relative h-1.5 bg-white/10 rounded-full overflow-hidden group">
                         <div 
                            className="absolute top-0 left-0 h-full bg-brand-500 transition-all duration-100" 
                            style={{ width: `${progress}%` }}
                         />
                         <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={progress} 
                            onChange={handleProgressSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <span>{videoRef.current ? Storage.formatTimeCode(videoRef.current.duration) : "00:00"}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 w-24">
                         <button onClick={() => setVolume(v => v === 0 ? 1 : 0)} className="text-slate-400 hover:text-white transition-colors">
                            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={() => handleSkip('prev')} className="text-slate-400 hover:text-white hover:scale-110 transition-all" title="Previous (Ctrl+Left)">
                            <SkipBack size={20} />
                        </button>
                        
                        <button onClick={handleReplayCurrent} className="text-slate-400 hover:text-brand-400 hover:rotate-[-90deg] transition-all" title="Replay (Shift+Space)">
                            <RotateCcw size={18} />
                        </button>

                        <button 
                            onClick={togglePlay} 
                            className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:bg-brand-400 hover:text-white transition-all shadow-lg transform active:scale-95"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <button 
                            onClick={toggleSaveCurrent} 
                            className={`transition-all hover:scale-110 ${isCurrentSaved ? 'text-brand-500 fill-current' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Bookmark size={18} />
                        </button>

                        <button onClick={() => handleSkip('next')} className="text-slate-400 hover:text-white hover:scale-110 transition-all" title="Next (Ctrl+Right)">
                            <SkipForward size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-24 justify-end">
                        {/* Anki Button Mini */}
                        {ankiConfig && (
                             <button 
                                onClick={handleAddToAnki} 
                                disabled={ankiStatus !== 'idle'}
                                className={`mr-2 transition-all ${
                                    ankiStatus === 'success' ? 'text-green-400' : 
                                    ankiStatus === 'error' ? 'text-red-400' :
                                    'text-slate-400 hover:text-white'
                                }`}
                                title="Add to Anki"
                            >
                                <PlusCircle size={18} />
                            </button>
                        )}
                        <select 
                            value={playbackSpeed} 
                            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-transparent text-slate-400 text-xs font-medium focus:outline-none focus:text-white cursor-pointer"
                        >
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1">1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Saved Items Drawer (Overlay) */}
      {showSavedList && (
            <>
                <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setShowSavedList(false)}
                />
                <div className="absolute top-0 right-0 h-full w-80 sm:w-96 bg-slate-900/95 backdrop-blur border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bookmark className="w-5 h-5 text-brand-500 fill-brand-500" />
                            <h2 className="text-lg font-bold text-white">Saved Lines</h2>
                        </div>
                        <button 
                            onClick={() => setShowSavedList(false)}
                            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {savedItems.length === 0 ? (
                            <div className="text-center mt-20 text-slate-500">
                                <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No lines saved from this video.</p>
                            </div>
                        ) : (
                            savedItems.map(item => (
                                <div key={item.id} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 transition-all group">
                                    <p className="text-sm text-slate-200 font-medium mb-2 line-clamp-2 font-serif">
                                        "{item.text}"
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs font-mono text-slate-500">
                                            {Storage.formatTimeCode(item.startTime)}
                                        </span>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => deleteSavedItem(item.id, e)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => jumpToSaved(item.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all"
                                            >
                                                <PlayCircle size={14} />
                                                Go
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )}

    </div>
  );
}