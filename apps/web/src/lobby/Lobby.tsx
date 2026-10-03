import { CopyInviteLink } from './CopyInviteLink.js';
import { t, useLanguage, LanguageToggle } from '../i18n/language.js';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProtocolErrorCode, RoomState } from '@vibe-rico/protocol';
import { clearSeat, loadSeat, saveSeat, sendResume, sendRoom, lobbyLink } from '../network/socket.js';
import type { LobbySocket, SavedSeat } from '../network/socket.js';

// Resolve errors in the current language, including notices already on screen.
const JOIN_ERRORS: Partial<Record<ProtocolErrorCode, string>> = {
  get ROOM_NOT_FOUND() { return t("找不到这个邀请码对应的房间"); },
  get ROOM_FULL() { return t("房间已满（最多 5 人）"); },
  get GAME_STARTED() { return t("游戏已经开始，无法加入"); },
  get BAD_SCHEMA() { return t("请输入昵称"); },
  get STALE_REVISION() { return t("房间刚刚有变化，请重试"); },
};
const START_ERRORS: Partial<Record<ProtocolErrorCode, string>> = {
  get ILLEGAL_COMMAND() { return t("需要 3–5 名玩家才能开始"); },
  get STALE_REVISION() { return t("房间刚刚有变化，请重试"); },
};
const failure = (messages: Partial<Record<ProtocolErrorCode, string>>, code: ProtocolErrorCode) => messages[code] ?? t('操作失败，请重试');
export const inviteLink = (roomCode: string) => `${location.origin}${location.pathname}?room=${roomCode}`;

/** `onSession` runs whenever this connection holds a seat's session (create, join or resume). */
/** `game` renders the in-game screen once the room has started. */
export function Lobby({ socket, onSession = () => {}, game }: {
  socket: LobbySocket; onSession?: () => void; game?: (seat: SavedSeat, room: RoomState) => ReactNode;
}) {
  useLanguage();
  useEffect(() => {
    // Let the entry form paint first; no hidden canvas or GPU context is needed.
    const timer = window.setTimeout(() => {
      void import('../scene/assetDownloads.js').then(({ preloadBoardModels }) =>
        preloadBoardModels(new URLSearchParams(location.search).get('art') === 'original' ? 'runtime' : 'runtime-ktx2')
      ).catch(() => { /* Board loading can retry if this optional warmup fails. */ });
    }, 750);
    return () => window.clearTimeout(timer);
  }, []);
  const manualLobby = useRef(new URLSearchParams(location.search).get('lobby') === '1');
  const [savedGame] = useState(() => manualLobby.current ? loadSeat() : null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const passwordRequired = import.meta.env.VITE_ROOM_CREATION_PASSWORD_ENABLED === 'true';
  const createPassword = import.meta.env.VITE_ROOM_CREATION_PASSWORD as string | undefined;
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [seat, setSeat] = useState<SavedSeat | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<{ source: 'join' | 'start'; code: ProtocolErrorCode } | null>(null);
  const [replaced, setReplaced] = useState(false);
  // Latest callback without re-running the socket effect when the parent passes a new function.
  const sessionRef = useRef(onSession);
  sessionRef.current = onSession;

  useEffect(() => {
    // After a refresh or reconnect, reclaim the saved seat; a rejected token returns to the entry form.
    const resume = async () => {
      if (manualLobby.current) return;
      const saved = loadSeat();
      if (!saved) return;
      const reply = await sendResume(socket, saved.roomId, saved.token);
      if (reply.ok) { setSeat(saved); sessionRef.current(); } else { clearSeat(); setSeat(null); setRoom(null); }
    };
    const onConnect = () => { setConnected(true); void resume(); };
    const onDisconnect = () => setConnected(false);
    // PROTOCOL.md: another connection resumed this seat; this one no longer controls it.
    const onReplaced = () => setReplaced(true);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', setRoom);
    socket.on('session-replaced', onReplaced);
    // The socket may have connected between the first render and this effect, missing 'connect'.
    setConnected(socket.connected);
    if (socket.connected) void resume();
    return () => {
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off('room-state', setRoom); socket.off('session-replaced', onReplaced);
    };
  }, [socket]);

  const enter = async (action: { kind: 'create-room'; displayName: string } | { kind: 'join-room'; roomCode: string; displayName: string }) => {
    setError(null);
    if (action.kind === 'create-room' && passwordRequired && (!createPassword || password !== createPassword)) {
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
    const reply = await sendRoom(socket, action);
    if (!reply.ok) return setError({ source: 'join', code: reply.code });
    saveSeat(reply.value);
    manualLobby.current = false;
    // A subsequent refresh/reconnect should restore this newly selected room normally.
    history.replaceState(null, '', inviteLink(reply.value.roomCode));
    setSeat(reply.value);
    sessionRef.current();
  };
  const start = async () => {
    setError(null);
    const reply = await sendRoom(socket, { kind: 'start-game', roomId: seat!.roomId });
    if (!reply.ok) setError({ source: 'start', code: reply.code });
  };

  const notices = (
    <>
      {!connected && <p role="status">{t("连接已断开，正在重新连接…")}</p>}
      {replaced && <p role="status">{t("此座位已在其他窗口中打开")}</p>}
      {error && <p role="alert">{failure(error.source === 'join' ? JOIN_ERRORS : START_ERRORS, error.code)}</p>}
    </>
  );
  // A started game takes the whole screen, keeping the connection and seat notices above it.
  if (seat && room?.started && game) return <>{notices}{game(seat, room)}</>;
  return (
    <div className="lobby-page">
    <main className="lobby">
      <header className="lobby-header">
        <div className="lobby-brand">
          <h1>Web Rico</h1>
          <p>{t('私人桌游，与好友共赴海岛。')}</p>
        </div>
        <LanguageToggle />
      </header>
      <div className="lobby-meta">
        <span>{t('三至五位玩家 · 私人房间')}</span>
        <span className={`connection-badge ${connected ? 'is-online' : 'is-offline'}`}>
          <i aria-hidden="true" />{connected ? t('已连接') : t('正在重连')}
        </span>
      </div>
      <div className="lobby-notices">{notices}</div>
      {!seat ? (
        <section className="lobby-entry">
          {savedGame && <div className="lobby-resume">
            <div><strong>{t('返回之前的房间')}</strong><p>{t('房间 {0}', [savedGame.roomCode])}</p></div>
            <a className="lobby-resume-link" href={inviteLink(savedGame.roomCode)}>{t('继续游戏')}</a>
          </div>}
          <label className="lobby-field lobby-name">{t("昵称 ")}
            <input autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <a className="lobby-resume-link lobby-demo" href="?demo=1">{t('查看演示')}</a>
          <div className="lobby-choices">
            <form className="lobby-choice" onSubmit={e => { e.preventDefault(); if (connected && name.trim()) void enter({ kind: 'create-room', displayName: name }); }}>
              <h2>{t('开启新游戏')}</h2>
              <p>{t('创建一张新桌，分享邀请码，邀请好友加入。')}</p>
              {passwordRequired && <label className="lobby-field">{t('创建房间密码')}
                <input type="password" autoComplete="off" value={password} aria-invalid={passwordError} aria-describedby={passwordError ? 'create-password-error' : undefined} onChange={e => { setPassword(e.target.value); setPasswordError(false); }} />
              </label>}
              {passwordRequired && passwordError && <p id="create-password-error" role="alert">{createPassword ? t('密码不正确，请重试') : t('暂时无法创建房间，请联系房主')}</p>}
              <button className="lobby-primary" type="submit" disabled={!connected || !name.trim()}>{t("创建房间")}<span aria-hidden="true">↗</span></button>
            </form>
            <form className="lobby-choice" onSubmit={e => { e.preventDefault(); if (connected && name.trim()) void enter({ kind: 'join-room', roomCode: code, displayName: name }); }}>
              <h2>{t('加入好友')}</h2>
              <label className="lobby-field">{t("邀请码 ")}
                <input className="lobby-code-input" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} />
              </label>
              <button type="submit" disabled={!connected || !name.trim()}>{t("加入房间")}<span aria-hidden="true">→</span></button>
            </form>
          </div>
        </section>
      ) : (
        <section className="lobby-room">
          <a className="back-to-lobby" href={lobbyLink()}>{t('返回大厅')}</a>
          <div className="lobby-invite"><span>{t("邀请码：")}</span><strong>{seat.roomCode}</strong></div>
          <div className="lobby-invite-link"><span>{t("邀请链接：")}</span><div className="lobby-invite-url"><a href={inviteLink(seat.roomCode)}>{inviteLink(seat.roomCode)}</a><CopyInviteLink key={seat.roomCode} url={inviteLink(seat.roomCode)} /></div></div>
          <ol className="lobby-seats" aria-label={t("座位")}>
            {room?.seats.map(s => (
              <li key={s.playerId}>
                {s.displayName}{s.playerId === room.hostPlayerId && t("（房主）")}{s.playerId === seat.playerId && t("（你）")}
              </li>
            ))}
          </ol>
          {room?.started ? (game ? game(seat, room) : <p>{t("游戏已开始")}</p>)
            : room?.hostPlayerId === seat.playerId && <button className="lobby-primary lobby-start" disabled={!connected || replaced} onClick={() => void start()}>{t("开始游戏")}</button>}
        </section>
      )}
    </main>
    </div>
  );
}
