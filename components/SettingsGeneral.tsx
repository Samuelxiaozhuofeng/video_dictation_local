import React from 'react';
import { AudioPaddingConfig } from '../types';
import { Field, Seg } from './ui';

interface SettingsGeneralProps {
  sectionLength: number;
  setSectionLength: (value: number) => void;
  audioPadding: AudioPaddingConfig;
  setAudioPadding: (value: AudioPaddingConfig) => void;
}

const SECTION_OPTS = [
  { value: 0, label: 'Full' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 10, label: '10 min' },
];

const SettingsGeneral: React.FC<SettingsGeneralProps> = ({
  sectionLength,
  setSectionLength,
  audioPadding,
  setAudioPadding,
}) => {
  return (
    <div className="space-y-6">
      <Field
        label="Section length"
        hint={
          sectionLength === 0
            ? 'The entire video will be played as one continuous session.'
            : `The video will be automatically divided into ${sectionLength}-minute sections to reduce practice fatigue.`
        }
      >
        <Seg options={SECTION_OPTS} value={sectionLength} onChange={setSectionLength} className="flex-wrap" />
      </Field>

      <Field
        label="Start padding"
        right={`${audioPadding.startPadding}ms`}
        hint="Extra time before the subtitle timing so the start of a word is not cut off."
      >
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={audioPadding.startPadding}
          onChange={(e) => setAudioPadding({ ...audioPadding, startPadding: parseInt(e.target.value, 10) })}
        />
        <div className="flex justify-between text-xs text-mute font-mono mt-1">
          <span>0ms</span>
          <span>1000ms</span>
        </div>
      </Field>

      <Field
        label="End padding"
        right={`${audioPadding.endPadding}ms`}
        hint="Extra time after the subtitle timing. Recommended: start 100ms, end 200ms."
      >
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={audioPadding.endPadding}
          onChange={(e) => setAudioPadding({ ...audioPadding, endPadding: parseInt(e.target.value, 10) })}
        />
        <div className="flex justify-between text-xs text-mute font-mono mt-1">
          <span>0ms</span>
          <span>1000ms</span>
        </div>
      </Field>
    </div>
  );
};

export default SettingsGeneral;
