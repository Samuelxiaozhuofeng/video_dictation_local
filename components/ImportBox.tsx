import React, { useEffect, useState } from 'react';
import { FileVideo, Link2 } from 'lucide-react';
import { pickVideoPath } from '../utils/desktop';
import {
  IMPORT_QUALITIES,
  ImportQuality,
  isYouTubeUrl,
  probeImportSizes,
  startLocalImport,
  startUrlImport,
} from '../utils/importJob';
import { useT } from '../utils/i18n';
import { dialog } from './Dialog';
import { Btn, Card, inputCls } from './ui';

const LANGS = [
  { value: 'en', key: 'import.langEn' },
  { value: 'es', key: 'import.langEs' },
  { value: 'ja', key: 'import.langJa' },
  { value: 'zh', key: 'import.langZh' },
  { value: 'auto', key: 'import.langAuto' },
] as const;

const QUALITY_KEYS = {
  1080: 'import.quality1080',
  720: 'import.quality720',
  480: 'import.quality480',
} as const;

function formatMb(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1_000_000));
}

const ImportBox: React.FC = () => {
  const t = useT();
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('en');
  const [quality, setQuality] = useState<ImportQuality>(1080);
  const [busy, setBusy] = useState(false);
  const [sizes, setSizes] = useState<Partial<Record<ImportQuality, number>>>({});
  const [sizesState, setSizesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const trimmed = url.trim();
  const valid = isYouTubeUrl(trimmed);

  useEffect(() => {
    if (!valid) {
      setSizes({});
      setSizesState('idle');
      return;
    }
    setSizes({});
    setSizesState('loading');
    let cancelled = false;
    const handle = window.setTimeout(() => {
      probeImportSizes(trimmed)
        .then(result => {
          if (cancelled) return;
          const next: Partial<Record<ImportQuality, number>> = {};
          for (const q of IMPORT_QUALITIES) {
            const n = result[q];
            if (typeof n === 'number' && n > 0) next[q] = n;
          }
          setSizes(next);
          setSizesState('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setSizes({});
          setSizesState('error');
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, valid]);

  const qualityLabel = (q: ImportQuality): string => {
    const label = t(QUALITY_KEYS[q]);
    if (sizesState === 'loading') return `${label} · ${t('import.qualityQuerying')}`;
    const bytes = sizes[q];
    if (bytes) return t('import.qualityWithSize', { label, size: formatMb(bytes) });
    return label;
  };

  const fail = (err: unknown) => {
    console.error(err);
    dialog.alert(t('import.startFailTitle'), t('import.startFailBody'));
  };

  const runUrl = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await startUrlImport(trimmed, lang, quality);
      setUrl('');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runLocal = async () => {
    if (busy) return;
    const path = await pickVideoPath();
    if (!path) return;
    setBusy(true);
    try {
      await startLocalImport(path, lang);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card flat className="p-5 sm:p-6 border-dashed">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 lg:w-64 shrink-0">
          <div className="w-12 h-12 rounded-full bg-shade/70 text-mute flex items-center justify-center shrink-0">
            <Link2 size={22} />
          </div>
          <div>
            <p className="font-serif text-xl font-semibold leading-tight">{t('import.heading')}</p>
            <p className="text-xs text-mute mt-1">{t('import.hint')}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={t('import.placeholder')}
              className={`flex-1 ${inputCls}`}
            />
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              className={`sm:w-40 ${inputCls}`}
            >
              {LANGS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
            <select
              value={quality}
              onChange={e => setQuality(Number(e.target.value) as ImportQuality)}
              className={`sm:w-52 ${inputCls}`}
            >
              {IMPORT_QUALITIES.map(q => (
                <option key={q} value={q}>{qualityLabel(q)}</option>
              ))}
            </select>
            <Btn tone="green" disabled={!valid || busy} onClick={runUrl}>
              {t('import.download')}
            </Btn>
          </div>
          {trimmed && !valid && (
            <p className="text-xs text-mute">{t('import.invalidUrl')}</p>
          )}
          {valid && sizesState === 'error' && (
            <p className="text-xs text-mute">{t('import.qualitySizeFail')}</p>
          )}
          <div>
            <Btn tone="white" disabled={busy} onClick={runLocal}>
              <FileVideo size={16} /> {t('import.pickLocal')}
            </Btn>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ImportBox;
