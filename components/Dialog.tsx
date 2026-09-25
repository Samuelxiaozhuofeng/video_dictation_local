import React, { useEffect, useState } from 'react';
import { Btn, Card } from './ui';
import { t } from '../utils/i18n';

// In-app replacement for window.alert / window.confirm.
// Call `dialog.alert(...)` / `dialog.confirm(...)` from anywhere (hooks included);
// <DialogHost /> mounted once at the root renders them. A confirm resolves
// null when dismissed (Esc / click outside) rather than answered.

type Pending = {
  kind: 'alert' | 'confirm';
  title: string;
  body?: string;
  ok?: string;
  cancel?: string;
  tone?: 'accent' | 'shade';
  resolve: (v: boolean | null) => void;
};

let listener: ((p: Pending | null) => void) | null = null;

function open(p: Omit<Pending, 'resolve'>): Promise<boolean | null> {
  return new Promise(resolve => {
    listener?.({ ...p, resolve });
  });
}

export const dialog = {
  alert: (title: string, body?: string, ok?: string) => open({ kind: 'alert', title, body, ok: ok ?? t('dialog.ok') }),
  confirm: (title: string, body?: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}) =>
    open({ kind: 'confirm', title, body, ok: opts.ok ?? t('dialog.confirm'), cancel: opts.cancel ?? t('dialog.cancel'), tone: opts.danger ? 'shade' : 'accent' }),
};

export const DialogHost: React.FC = () => {
  const [p, setP] = useState<Pending | null>(null);

  useEffect(() => {
    listener = setP;
    return () => { listener = null; };
  }, []);

  const close = (v: boolean | null) => { p?.resolve(v); setP(null); };
  const dismiss = () => close(p?.kind === 'alert' ? true : null);

  useEffect(() => {
    if (!p) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopPropagation(); // nothing underneath the dialog should react to keys
      if (e.key === 'Escape') dismiss();
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!p) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 fade-in" onClick={dismiss}>
      <Card className="w-full max-w-md shadow-lift" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-xl font-semibold leading-tight">{p.title}</h3>
        </div>
        {p.body && <p className="px-6 pb-5 text-sm text-mute leading-relaxed whitespace-pre-line">{p.body}</p>}
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-line">
          {p.kind === 'confirm' && <Btn onClick={() => close(false)}>{p.cancel}</Btn>}
          <Btn tone={p.kind === 'confirm' && p.tone === 'shade' ? 'ink' : 'accent'} onClick={() => close(true)} autoFocus>{p.ok}</Btn>
        </div>
      </Card>
    </div>
  );
};
