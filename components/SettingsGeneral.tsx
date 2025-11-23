import React from 'react';
import { Scissors, Volume2 } from 'lucide-react';
import { PracticeConfig, AudioPaddingConfig } from '../types';

interface SettingsGeneralProps {
  sectionLength: number;
  setSectionLength: (value: number) => void;
  audioPadding: AudioPaddingConfig;
  setAudioPadding: (value: AudioPaddingConfig) => void;
}

const SettingsGeneral: React.FC<SettingsGeneralProps> = ({
  sectionLength,
  setSectionLength,
  audioPadding,
  setAudioPadding,
}) => {
  return (
    <div className="space-y-6">
      {/* Practice Configuration Section */}
      <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
            <Scissors className="w-5 h-5 text-brand-400" />
          </div>
          Practice Mode
        </h2>

        <div>
          <label className="block text-sm text-neutral-300 mb-4 font-medium">Section Length (Video Segmentation)</label>
          <div className="flex flex-wrap gap-3">
            {[0, 1, 2, 3, 5, 10].map((mins) => (
              <button
                key={mins}
                onClick={() => setSectionLength(mins)}
                className={`px-5 py-2.5 rounded-xl border font-semibold transition-all ${
                  sectionLength === mins
                    ? 'bg-brand-500 border-brand-500/50 text-white shadow-soft'
                    : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600'
                }`}
              >
                {mins === 0 ? 'Full Video' : `${mins} min${mins > 1 ? 's' : ''}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-4 bg-neutral-800/30 rounded-xl p-3 leading-relaxed">
            {sectionLength === 0
              ? "The entire video will be played as one continuous session."
              : `The video will be automatically divided into ${sectionLength}-minute sections to reduce practice fatigue.`}
          </p>
        </div>
      </section>

      {/* Audio Padding Configuration Section */}
      <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
            <Volume2 className="w-5 h-5 text-brand-400" />
          </div>
          Audio Recording Padding
        </h2>

        <div className="space-y-6">
          {/* Start Padding */}
          <div>
            <label className="block text-sm text-neutral-300 mb-4 font-medium">
              Start Padding: <span className="text-brand-400 font-bold">{audioPadding.startPadding}ms</span>
            </label>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={audioPadding.startPadding}
              onChange={(e) => setAudioPadding({ ...audioPadding, startPadding: parseInt(e.target.value) })}
              className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-2 font-medium">
              <span>0ms</span>
              <span>1000ms</span>
            </div>
          </div>

          {/* End Padding */}
          <div>
            <label className="block text-sm text-neutral-300 mb-4 font-medium">
              End Padding: <span className="text-brand-400 font-bold">{audioPadding.endPadding}ms</span>
            </label>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={audioPadding.endPadding}
              onChange={(e) => setAudioPadding({ ...audioPadding, endPadding: parseInt(e.target.value) })}
              className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-2 font-medium">
              <span>0ms</span>
              <span>1000ms</span>
            </div>
          </div>

          <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-xl p-4">
            <p className="text-xs text-neutral-300 leading-relaxed">
              <strong className="text-white">What is this?</strong><br/>
              When adding audio clips to Anki, padding adds extra time before and after the subtitle timing to ensure complete audio capture.
              This prevents cutting off the beginning or end of words.
            </p>
            <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
              <strong className="text-white">Recommended:</strong> Start 100ms, End 200ms
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsGeneral;

