import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/language.js';

export function AutoProduceHelp() {
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(14, Math.min(rect.left, window.innerWidth - 344)), top: Math.max(14, Math.min(rect.bottom + 8, window.innerHeight - 220)) });
  };
  return <><button type="button" className="setting-help" aria-label={t('自动生产说明')} aria-describedby={position ? id : undefined}
    onMouseEnter={e => show(e.currentTarget)} onMouseLeave={() => setPosition(null)}
    onFocus={e => show(e.currentTarget)} onBlur={() => setPosition(null)}
    onClick={e => show(e.currentTarget)} onKeyDown={e => { if (e.key === 'Escape') setPosition(null); }}>ⓘ</button>
    {position && createPortal(<div id={id} role="tooltip" className="model-tooltip" style={{ position: 'fixed', ...position, right: 'auto', zIndex: 100 }}>
      <strong>{t('自动生产（仅自己）')}</strong>
      <p>{t('自动接受生产及工厂收益；额外货物仍由你选择。此设置保存在当前浏览器。')}</p>
      <small>{t('仅在你连接游戏且轮到你生产时执行。关闭后可手动生产或放弃，不影响其他玩家。')}</small>
    </div>, document.body)}
  </>;
}
