import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProtocolErrorCode, RoomState } from '@vibe-rico/protocol';
import { clearSeat, loadSeat, saveSeat, sendResume, sendRoom } from '../network/socket.js';
import type { LobbySocket, SavedSeat } from '../network/socket.js';

// Chinese display text (ARCHITECTURE "Goals and current decisions").
const JOIN_ERRORS: Partial<Record<ProtocolErrorCode, string>> = {
  ROOM_NOT_FOUND: '找不到这个邀请码对应的房间',
  ROOM_FULL: '房间已满（最多 5 人）',
  GAME_STARTED: '游戏已经开始，无法加入',
  BAD_SCHEMA: '请输入昵称',
  STALE_REVISION: '房间刚刚有变化，请重试',
};
const START_ERRORS: Partial<Record<ProtocolErrorCode, string>> = {
  ILLEGAL_COMMAND: '需要 3–5 名玩家才能开始',
  STALE_REVISION: '房间刚刚有变化，请重试',
};
const failure = (messages: Partial<Record<ProtocolErrorCode, string>>, code: ProtocolErrorCode) => messages[code] ?? `操作失败（${code}）`;
export const inviteLink = (roomCode: string) => `${location.origin}${location.pathname}?room=${roomCode}`;

/** `onSession` runs whenever this connection holds a seat's session (create, join or resume). */
/** `game` renders the in-game screen once the room has started. */
export function Lobby({ socket, onSession = () => {}, game }: {
  socket: LobbySocket; onSession?: () => void; game?: (seat: SavedSeat, room: RoomState) => ReactNode;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [seat, setSeat] = useState<SavedSeat | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState('');
  const [replaced, setReplaced] = useState(false);
  // Latest callback without re-running the socket effect when the parent passes a new function.
  const sessionRef = useRef(onSession);
  sessionRef.current = onSession;

  useEffect(() => {
    // After a refresh or reconnect, reclaim the saved seat; a rejected token returns to the entry form.
    const resume = async () => {
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
    if (socket.connected) void resume();
    return () => {
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off('room-state', setRoom); socket.off('session-replaced', onReplaced);
    };
  }, [socket]);

  const enter = async (action: { kind: 'create-room'; displayName: string } | { kind: 'join-room'; roomCode: string; displayName: string }) => {
    setError('');
    const reply = await sendRoom(socket, action);
    if (!reply.ok) return setError(failure(JOIN_ERRORS, reply.code));
    saveSeat(reply.value);
    setSeat(reply.value);
    sessionRef.current();
  };
  const start = async () => {
    setError('');
    const reply = await sendRoom(socket, { kind: 'start-game', roomId: seat!.roomId });
    if (!reply.ok) setError(failure(START_ERRORS, reply.code));
  };

  const notices = (
    <>
      {!connected && <p role="status">连接已断开，正在重新连接…</p>}
      {replaced && <p role="status">此座位已在其他窗口中打开</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
  // A started game takes the whole screen, keeping the connection and seat notices above it.
  if (seat && room?.started && game) return <>{notices}{game(seat, room)}</>;
  return (
    <main className="lobby">
      <h1>波多黎各</h1>
      {notices}
      {!seat ? (
        <section>
          <label>昵称 <input value={name} onChange={e => setName(e.target.value)} /></label>
          <button disabled={!connected || !name.trim()} onClick={() => void enter({ kind: 'create-room', displayName: name })}>创建房间</button>
          <label>邀请码 <input value={code} onChange={e => setCode(e.target.value)} /></label>
          <button disabled={!connected || !name.trim()} onClick={() => void enter({ kind: 'join-room', roomCode: code, displayName: name })}>加入房间</button>
        </section>
      ) : (
        <section>
          <p>邀请码：<strong>{seat.roomCode}</strong></p>
          <p>邀请链接：<a href={inviteLink(seat.roomCode)}>{inviteLink(seat.roomCode)}</a></p>
          <ol aria-label="座位">
            {room?.seats.map(s => (
              <li key={s.playerId}>
                {s.displayName}{s.playerId === room.hostPlayerId && '（房主）'}{s.playerId === seat.playerId && '（你）'}
              </li>
            ))}
          </ol>
          {room?.started ? (game ? game(seat, room) : <p>游戏已开始</p>)
            : room?.hostPlayerId === seat.playerId && <button disabled={!connected || replaced} onClick={() => void start()}>开始游戏</button>}
        </section>
      )}
    </main>
  );
}
