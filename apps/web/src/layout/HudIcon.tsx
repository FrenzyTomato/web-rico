/** Small, dependency-free toolbar symbols; buttons provide localized accessible names. */
export function HudIcon({ kind }: { kind: 'players' | 'history' | 'settings' | 'language' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'players' && <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" /></>}
    {kind === 'history' && <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>}
    {kind === 'settings' && <><path d="m10 3-.6 2.3-2 .9-2.2-.6-2 3.4 1.6 1.7v2.6L3.2 15l2 3.4 2.2-.6 2 .9L10 21h4l.6-2.3 2-.9 2.2.6 2-3.4-1.6-1.7v-2.6L20.8 9l-2-3.4-2.2.6-2-.9L14 3Z" /><circle cx="12" cy="12" r="3" /></>}
    {kind === 'language' && <><path d="M6 3v2M2 6h11M5 6c.5 4 3 7 7 9M11 6c-.7 4-3.5 7.5-8 10M13 21l4-10 4 10M14.5 17h5M13 4l-2 16" /></>}
  </svg>;
}
