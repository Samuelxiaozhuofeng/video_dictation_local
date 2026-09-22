import React from 'react';

// Shared paper/notebook primitives. Every screen builds from these four shapes:
// Btn (pressable), Card (a sheet), Stamp (margin note), Seg (segmented switch).

export type Tone = 'white' | 'green' | 'ochre' | 'highlight' | 'rose' | 'shade' | 'paper' | 'ink' | 'green-soft' | 'rose-soft' | 'ochre-soft';

export const toneBg: Record<Tone, string> = {
  white: 'bg-page text-ink',
  paper: 'bg-paper text-ink',
  green: 'bg-green text-page',
  ochre: 'bg-ochre text-page',
  highlight: 'bg-highlight text-ink',
  rose: 'bg-rose text-page',
  shade: 'bg-shade text-ink',
  ink: 'bg-ink text-page',
  'green-soft': 'bg-green-soft text-green',
  'rose-soft': 'bg-rose-soft text-rose',
  'ochre-soft': 'bg-ochre-soft text-ochre',
};

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  flat?: boolean; // ghost: no border, just a hover tint
  square?: boolean; // icon-only square
};

const btnSize = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};
const sqSize = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

// Three weights: solid (any colour tone), outline (tone="white"), ghost (flat).
export const Btn: React.FC<BtnProps> = ({
  tone = 'white', size = 'md', flat = false, square = false, className = '', children, onClick, ...rest
}) => {
  const skin = flat
    ? 'bg-transparent text-ink hover:bg-shade/70 border border-transparent'
    : tone === 'white'
      ? 'bg-page text-ink border border-line shadow-sm hover:bg-paper'
      : `${toneBg[tone]} border border-transparent shadow-sm`;
  return (
    <button
      {...rest}
      // Drop focus after a mouse click so Space/Enter shortcuts don't re-fire this button.
      onClick={e => { onClick?.(e); e.currentTarget.blur(); }}
      className={`press rounded-md ${skin} ${square ? sqSize[size] : btnSize[size]}
        inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none
        disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
};

type CardProps = React.HTMLAttributes<HTMLDivElement> & { tone?: Tone; flat?: boolean };

export const Card: React.FC<CardProps> = ({ tone = 'white', flat = false, className = '', children, ...rest }) => (
  <div {...rest} className={`${flat ? 'border border-line rounded-[10px]' : 'card'} ${toneBg[tone]} ${className}`}>
    {children}
  </div>
);

export const Stamp: React.FC<React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }> = ({
  tone = 'white', className = '', children, ...rest
}) => (
  <span
    {...rest}
    className={`${toneBg[tone]} ${tone === 'white' ? 'border border-line' : ''} inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-wider leading-tight ${className}`}
  >
    {children}
  </span>
);

export function Seg<T extends string | number>({
  options, value, onChange, size = 'md', className = '',
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`inline-flex p-0.5 gap-0.5 bg-shade/70 rounded-md ${className}`} role="radiogroup">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm'} rounded font-medium transition-colors
            ${o.value === value ? 'bg-page text-ink shadow-sm' : 'text-mute hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Section heading used across settings / library pages.
export const H: React.FC<{ children: React.ReactNode; sub?: React.ReactNode; badge?: React.ReactNode; className?: string }> = ({ children, sub, badge, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    <h2 className="font-serif text-2xl font-semibold tracking-tight leading-none flex items-center gap-3">{children}{badge}</h2>
    {sub && <p className="mt-1.5 text-sm text-mute">{sub}</p>}
  </div>
);

export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  label, hint, right, children, className = '',
}) => (
  <label className={`block ${className}`}>
    <span className="flex items-baseline justify-between mb-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {right && <span className="font-mono text-xs text-mute">{right}</span>}
    </span>
    {children}
    {hint && <span className="block mt-1.5 text-xs text-mute leading-relaxed">{hint}</span>}
  </label>
);

export const inputCls = 'flat w-full px-3 py-2 text-sm placeholder:text-mute/60 focus:border-green';
