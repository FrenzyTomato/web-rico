import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/language.js';

export function MobileAreaPicker({ value, options, onChange }: {
  value: string; options: readonly { value: string; label: string }[]; onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return <div ref={root} className={`board-camera mobile-camera${open ? ' is-open' : ''}`} onKeyDown={e => {
    if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
  }}>
    <span>{t('查看区域')}</span>
    <button ref={trigger} className="area-picker-trigger" aria-label={t('查看区域')} aria-expanded={open} aria-controls="mobile-area-options" data-value={value} onClick={() => setOpen(v => !v)}>
      {options.find(o => o.value === value)?.label}<span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="mobile-area-options" className="board-camera area-picker-options" role="group" aria-label={t('棋盘视角')}>
      {options.map(o => <button key={o.value} aria-pressed={o.value === value} onClick={() => { onChange(o.value); setOpen(false); trigger.current?.focus(); }}>{o.label}<span aria-hidden="true">{o.value === value ? '✓' : ''}</span></button>)}
    </div>}
  </div>;
}
