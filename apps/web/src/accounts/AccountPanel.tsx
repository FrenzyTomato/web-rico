import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { MyGame } from '@vibe-rico/protocol';
import { t, useLanguage } from '../i18n/language.js';
import { sendRoom } from '../network/socket.js';
import type { LobbySocket, SavedSeat } from '../network/socket.js';
import { accountStore, sendEmailCode, signInWithGoogle, signOut, supabase, verifyEmailCode } from './account.js';

/**
 * Lobby sign-in and "My games" (docs/ACCOUNTS_PLAN.md). Signing in is optional: guests keep playing as before.
 * `onRejoin` receives the seat the server handed this device for a game the account is in.
 */
export function AccountPanel({ socket, connected, onRejoin }: { socket: LobbySocket; connected: boolean; onRejoin: (seat: SavedSeat) => void }) {
  useLanguage();
  const { session, linked } = useStore(accountStore);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'closed' | 'email' | 'code'>('closed');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [games, setGames] = useState<MyGame[] | null>(null);
  useEffect(() => {
    if (!linked || !connected) { setGames(null); return; }
    void sendRoom(socket, { kind: 'my-games' }).then(reply => setGames(reply.ok ? reply.value : []));
  }, [linked, connected, socket]);
  if (!supabase) return null;
  const run = async (task: () => Promise<{ error: { message: string } | null } | void>, done?: () => void) => {
    setBusy(true); setMessage(null);
    const result = await task();
    setBusy(false);
    if (result && result.error) setMessage(result.error.message); else done?.();
  };

  if (!session) return <section className="lobby-account" aria-label={t('账号')}>
    {step === 'closed' ? <div className="lobby-account-row">
      <p>{t('登录后可在任何设备上继续你的游戏。')}</p>
      <button type="button" onClick={() => setStep('email')}>{t('登录')}</button>
    </div> : <div className="lobby-account-form">
      <button type="button" className="lobby-google" disabled={busy} onClick={() => void run(signInWithGoogle)}>{t('使用 Google 登录')}</button>
      <span className="lobby-account-or">{t('或')}</span>
      {step === 'email' ? <form onSubmit={e => { e.preventDefault(); void run(() => sendEmailCode(email.trim()), () => setStep('code')); }}>
        <label className="lobby-field">{t('邮箱')}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button type="submit" disabled={busy || !email.includes('@')}>{t('发送验证码')}</button>
      </form> : <form onSubmit={e => { e.preventDefault(); void run(() => verifyEmailCode(email.trim(), code.trim())); }}>
        <label className="lobby-field">{t('验证码（已发送至 {0}）', [email.trim()])}
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <button type="submit" disabled={busy || code.length < 6}>{t('登录')}</button>
        <button type="button" className="lobby-account-link" onClick={() => { setCode(''); setStep('email'); }}>{t('换个邮箱')}</button>
      </form>}
      <button type="button" className="lobby-account-link" onClick={() => { setStep('closed'); setMessage(null); }}>{t('取消')}</button>
      {message && <p role="alert">{message}</p>}
    </div>}
  </section>;

  const rejoin = async (game: MyGame) => {
    const reply = await sendRoom(socket, { kind: 'resume-account', roomId: game.roomId });
    if (reply.ok) onRejoin(reply.value); else setMessage(t('无法回到这个房间，请稍后再试'));
  };
  const remove = async () => {
    if (!window.confirm(t('删除账号后，你的游戏会保留为访客座位，且无法撤销。确定删除吗？'))) return;
    const reply = await sendRoom(socket, { kind: 'delete-account' });
    if (reply.ok) await signOut(); else setMessage(t('删除失败，请稍后再试'));
  };
  const status = (g: MyGame) => g.status === 'lobby' ? t('等待开始') : g.status === 'ended' ? t('已结束') : t('第 {0} 轮', [g.round ?? 1]);
  return <section className="lobby-account" aria-label={t('账号')}>
    <div className="lobby-account-row">
      <p>{t('已登录：{0}', [session.user.email ?? ''])}</p>
      <button type="button" className="lobby-account-link" onClick={() => void signOut()}>{t('退出登录')}</button>
    </div>
    <h2>{t('我的游戏')}</h2>
    {games === null ? <p className="lobby-account-note">{t('正在载入…')}</p>
      : games.length === 0 ? <p className="lobby-account-note">{t('还没有游戏。创建或加入房间后会出现在这里。')}</p>
      : <ul className="lobby-games">{games.map(g => <li key={g.roomId}>
        <div><strong>{t('房间 {0}', [g.roomCode])}</strong><span>{status(g)} · {g.players.join(t('、'))}</span></div>
        <button type="button" disabled={!connected} onClick={() => void rejoin(g)}>{g.status === 'ended' ? t('查看') : t('继续')}</button>
      </li>)}</ul>}
    {message && <p role="alert">{message}</p>}
    <button type="button" className="lobby-account-link lobby-account-delete" onClick={() => void remove()}>{t('删除账号')}</button>
  </section>;
}
