import React, { useEffect, useState } from 'react';
import { Btn } from './ui';
import { useT } from '../utils/i18n';
import { ACTIONS, ActionId, checkNewCombo, formatCombo, resetCombos, setCombo, useShortcuts } from '../utils/shortcuts';

// Click a key, press the new combo. Only ⌘/Ctrl combos can change; a combo the
// system or another action already uses is refused on the spot.
const SettingsShortcuts: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const t = useT();
  const combos = useShortcuts();
  const [recording, setRecording] = useState<ActionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecording(null); setError(null); return; }
      const r = checkNewCombo(e, recording);
      if (!r) return;
      if ('combo' in r) {
        setCombo(recording, r.combo);
        setRecording(null);
        setError(null);
        onSaved();
      } else if ('taken' in r) {
        setError(t('shortcuts.taken', { name: t(ACTIONS.find(a => a.id === r.taken)!.label) }));
      } else {
        setError(t(r.error === 'needMod' ? 'shortcuts.needMod' : 'shortcuts.reserved'));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, onSaved, t]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-mute">{t('shortcuts.hint')}</p>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
        {ACTIONS.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-3 h-9 text-sm">
            <span className="text-ink/80">{t(a.label)}</span>
            {a.fixed ? (
              <span className="text-mute px-3" title={t('shortcuts.fixed')}>{formatCombo(combos[a.id])}</span>
            ) : (
              <Btn size="sm" flat onClick={() => { setRecording(recording === a.id ? null : a.id); setError(null); }}
                className={recording === a.id ? '!bg-accent-soft !text-accent' : '!text-ink'}>
                {recording === a.id ? t('shortcuts.recording') : formatCombo(combos[a.id])}
              </Btn>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
      <Btn size="sm" flat onClick={() => { resetCombos(); setRecording(null); setError(null); onSaved(); }}>{t('shortcuts.reset')}</Btn>
    </div>
  );
};

export default SettingsShortcuts;
