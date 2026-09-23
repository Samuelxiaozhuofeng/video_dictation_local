import React from 'react';
import { ACTIONS, formatCombo, useShortcuts } from '../utils/shortcuts';
import { useT } from '../utils/i18n';

// The key table, as the user has set it: in the "…" menu and pinned in the corner.
const ShortcutLegend: React.FC<{ dictation: boolean; className?: string }> = ({ dictation, className = '' }) => {
  const t = useT();
  const combos = useShortcuts();
  return (
    <div className={`grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs ${className}`}>
      {ACTIONS.filter(a => dictation || !a.dictationOnly).map(a => (
        <div key={a.id} className="flex justify-between gap-3 whitespace-nowrap">
          <span className="text-mute">{t(a.label)}</span>
          <span className="text-ink/80">{formatCombo(combos[a.id])}</span>
        </div>
      ))}
    </div>
  );
};

export default ShortcutLegend;
