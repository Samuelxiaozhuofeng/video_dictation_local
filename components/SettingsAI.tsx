import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import * as AI from '../utils/ai';

interface SettingsAIProps {
  aiModel: string;
  setAiModel: (value: string) => void;
  aiTemperature: number;
  setAiTemperature: (value: number) => void;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiApiKey: string;
  setAiApiKey: (value: string) => void;
}

const SettingsAI: React.FC<SettingsAIProps> = ({
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  aiPrompt,
  setAiPrompt,
  aiApiKey,
  setAiApiKey,
}) => {
  const resetPrompt = () => {
    setAiPrompt(AI.DEFAULT_PROMPT);
  };

  return (
    <section className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-7 shadow-soft">
      {/* AI Configuration Section */}
      <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
        <div className="p-2 bg-brand-500/10 rounded-xl border border-brand-500/20">
          <Sparkles className="w-5 h-5 text-brand-400" />
        </div>
        AI Configuration
      </h2>

      {/* API Key Input */}
      <div className="mb-6 pb-6 border-b border-neutral-800/50">
        <label className="block text-sm text-neutral-300 mb-3 font-medium">
          Gemini API Key
          <span className="text-red-400 ml-1">*</span>
        </label>
        <input
          type="password"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none font-mono text-sm transition-all"
          placeholder="Enter your Gemini API Key..."
        />
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-xs text-blue-300 mb-3 font-semibold">
            How to get your API Key:
          </p>
          <ol className="text-xs text-blue-200 space-y-1.5 ml-4 list-decimal leading-relaxed">
            <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-white font-medium">Google AI Studio</a></li>
            <li>Sign in with your Google account</li>
            <li>Click "Create API Key"</li>
            <li>Copy and paste it here</li>
          </ol>
          <p className="text-xs text-blue-300 mt-3 bg-blue-500/10 rounded-lg p-2">
            🔒 Your API Key is stored locally in your browser and never sent to our servers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm text-neutral-300 mb-3 font-medium">Model</label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-flash-lite-latest">Gemini Flash Lite (Fastest)</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro (Best Quality)</option>
          </select>
          <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-2">
            Choose the model balancing speed vs quality of definitions.
          </p>
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-3 flex justify-between font-medium">
            <span>Creativity (Temperature)</span>
            <span className="text-brand-400 font-bold">{aiTemperature}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={aiTemperature}
            onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
            className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-2">
            Lower values are more deterministic; higher values are more creative.
          </p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-800/50">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm text-neutral-300 flex items-center gap-2 font-medium">
            <MessageSquare className="w-4 h-4" />
            System Prompt Template
          </label>
          <button onClick={resetPrompt} className="text-xs text-brand-400 hover:text-brand-300 font-semibold px-3 py-1.5 hover:bg-brand-500/10 rounded-lg transition-all">
            Reset to Default
          </button>
        </div>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className="w-full h-32 bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-neutral-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none font-mono text-sm leading-relaxed transition-all"
          placeholder="Enter prompt..."
        />
        <p className="text-xs text-neutral-400 mt-3 bg-neutral-800/30 rounded-lg p-3">
          Use <code className="bg-neutral-700/50 px-1.5 py-0.5 rounded">{'{word}'}</code> and <code className="bg-neutral-700/50 px-1.5 py-0.5 rounded">{'{context}'}</code> as placeholders. The response must still be compatible with the expected JSON schema (word, definition, partOfSpeech).
        </p>
      </div>
    </section>
  );
};

export default SettingsAI;

