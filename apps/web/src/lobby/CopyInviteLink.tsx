import { useEffect, useState } from 'react';
import { t } from '../i18n/language.js';

export function CopyInviteLink({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return <>
    <button type="button" className="lobby-copy-link" onClick={copy} aria-label={t('复制邀请链接')} title={t('复制邀请链接')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {status === 'copied' ? <path d="m5 12 4 4 10-10" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" /></>}
      </svg>
    </button>
    <span className="lobby-copy-status" role={status === 'idle' ? undefined : 'status'} aria-live="polite">{status === 'copied' ? t('链接已复制') : status === 'failed' ? t('无法复制，请手动复制链接') : ''}</span>
  </>;
}
