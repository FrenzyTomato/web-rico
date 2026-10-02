import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RoomState } from '@vibe-rico/protocol';
import { inviteLink, Lobby } from './Lobby.js';
import type { LobbySocket } from '../network/socket.js';

/** Stands in for the server: records requests and answers them from a reply table. */
class FakeSocket {
  connected = true;
  readonly sent: { event: string; payload: { action?: unknown; roomId?: string; token?: string } }[] = [];
  readonly handlers = new Map<string, ((arg?: unknown) => void)[]>();
  constructor(private readonly replies: Record<string, unknown>) {}
  emitWithAck = vi.fn(async (event: string, payload: { action?: { kind: string } }) => {
    this.sent.push({ event, payload });
    return this.replies[event === 'room' ? payload.action!.kind : event];
  });
  on(event: string, handler: (arg?: unknown) => void) { this.handlers.set(event, [...this.handlers.get(event) ?? [], handler]); return this; }
  off(event: string, handler: (arg?: unknown) => void) { this.handlers.set(event, (this.handlers.get(event) ?? []).filter(h => h !== handler)); return this; }
  push(event: string, arg?: unknown) { act(() => { for (const h of this.handlers.get(event) ?? []) h(arg); }); }
}
const granted = { roomId: 'r1', roomCode: 'ABC123', playerId: 'p1', token: 't1' };
const seats = (started: boolean, n = 2): RoomState => ({ roomCode: 'ABC123', hostPlayerId: 'p1', started,
  seats: [{ playerId: 'p1', displayName: 'Ana' }, { playerId: 'p2', displayName: 'Ana' }, { playerId: 'p3', displayName: 'Chen' }].slice(0, n) });
const view = (socket: FakeSocket, onSession = () => {}) => render(<Lobby socket={socket as unknown as LobbySocket} onSession={onSession} />);
const flush = () => act(async () => {});

beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); });
afterEach(cleanup);

describe('lobby', () => {
  it('creates a room, shows the code, invite link and seats, and saves the seat for refresh', async () => {
    const socket = new FakeSocket({ 'create-room': { ok: true, value: granted } });
    const onSession = vi.fn();
    view(socket, onSession);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('创建房间'));
    await flush();
    expect(socket.sent[0]).toEqual({ event: 'room', payload: { protocolVersion: '1', action: { kind: 'create-room', displayName: 'Ana' } } });
    socket.push('room-state', seats(false));
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByRole('link', { name: inviteLink('ABC123') }).getAttribute('href')).toBe(inviteLink('ABC123'));
    expect(inviteLink('ABC123')).toBe(`${location.origin}/?room=ABC123`);
    // Duplicate names are shown as separate seats.
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Ana（房主）（你）', 'Ana']);
    expect(JSON.parse(localStorage.getItem('vibe-rico.seat')!)).toEqual(granted);
    expect(onSession).toHaveBeenCalledTimes(1);
  });

  it('prefills the invitation code from an invite link and joins with it', async () => {
    history.replaceState(null, '', '/?room=ABC123');
    const socket = new FakeSocket({ 'join-room': { ok: true, value: { ...granted, playerId: 'p2' } } });
    view(socket);
    expect((screen.getByLabelText('邀请码') as HTMLInputElement).value).toBe('ABC123');
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('加入房间'));
    await flush();
    expect(socket.sent[0]!.payload.action).toEqual({ kind: 'join-room', roomCode: 'ABC123', displayName: 'Bo' });
    socket.push('room-state', seats(false));
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Ana（房主）', 'Ana（你）']);
    expect(screen.queryByText('开始游戏')).toBeNull();
  });

  it.each([
    ['ROOM_NOT_FOUND', '找不到这个邀请码对应的房间'],
    ['ROOM_FULL', '房间已满（最多 5 人）'],
    ['GAME_STARTED', '游戏已经开始，无法加入'],
  ])('shows why a join failed (%s) and stays on the entry form', async (code, message) => {
    const socket = new FakeSocket({ 'join-room': { ok: false, code } });
    view(socket);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Bo' } });
    fireEvent.click(screen.getByText('加入房间'));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByText('加入房间')).toBeTruthy();
    expect(localStorage.getItem('vibe-rico.seat')).toBeNull();
  });

  it('requires a display name before creating or joining', () => {
    const socket = new FakeSocket({});
    view(socket);
    expect((screen.getByText('创建房间') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '   ' } });
    expect((screen.getByText('加入房间') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    expect((screen.getByText('创建房间') as HTMLButtonElement).disabled).toBe(false);
  });

  it('lets the host start; too few players is explained; a started room says so', async () => {
    const socket = new FakeSocket({ 'create-room': { ok: true, value: granted }, 'start-game': { ok: false, code: 'ILLEGAL_COMMAND' } });
    view(socket);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('创建房间'));
    await flush();
    socket.push('room-state', seats(false));
    fireEvent.click(screen.getByText('开始游戏'));
    await flush();
    expect(socket.sent.at(-1)!.payload.action).toEqual({ kind: 'start-game', roomId: 'r1' });
    expect(screen.getByRole('alert').textContent).toBe('需要 3–5 名玩家才能开始');
    socket.push('room-state', seats(true, 3));
    expect(screen.getByText('游戏已开始')).toBeTruthy();
    expect(screen.queryByText('开始游戏')).toBeNull();
  });

  it('shows a disconnection message, disables actions, and resumes the saved seat on reconnect', async () => {
    localStorage.setItem('vibe-rico.seat', JSON.stringify(granted));
    const socket = new FakeSocket({ resume: { ok: true, value: { playerId: 'p1', revision: null } } });
    const onSession = vi.fn();
    view(socket, onSession);
    await flush();
    expect(socket.sent[0]).toEqual({ event: 'resume', payload: { protocolVersion: '1', roomId: 'r1', token: 't1' } });
    socket.push('room-state', seats(false));
    socket.push('disconnect');
    expect(screen.getByRole('status').textContent).toBe('连接已断开，正在重新连接…');
    expect((screen.getByText('开始游戏') as HTMLButtonElement).disabled).toBe(true);
    socket.push('connect');
    await flush();
    expect(screen.queryByRole('status')).toBeNull();
    expect(socket.sent.filter(s => s.event === 'resume')).toHaveLength(2);
    // The store may resend pending commands only once the session is back.
    expect(onSession).toHaveBeenCalledTimes(2);
  });

  it('tells a replaced connection that the seat was opened elsewhere and disables its actions', async () => {
    const socket = new FakeSocket({ 'create-room': { ok: true, value: granted } });
    view(socket);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('创建房间'));
    await flush();
    socket.push('room-state', seats(false));
    socket.push('session-replaced');
    expect(screen.getByRole('status').textContent).toBe('此座位已在其他窗口中打开');
    expect((screen.getByText('开始游戏') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables actions when the socket connected before the lobby subscribed (no missed connect event)', async () => {
    const socket = new FakeSocket({});
    socket.connected = false;
    // Connects during the first render, before the effect registers its 'connect' listener.
    const Probe = () => { socket.connected = true; return null; };
    render(<><Lobby socket={socket as unknown as LobbySocket} /><Probe /></>);
    await flush();
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    expect((screen.getByText('创建房间') as HTMLButtonElement).disabled).toBe(false);
  });

  it('returns to the entry form when a saved seat can no longer be resumed', async () => {
    localStorage.setItem('vibe-rico.seat', JSON.stringify(granted));
    const socket = new FakeSocket({ resume: { ok: false, code: 'UNAUTHORIZED' } });
    view(socket);
    await flush();
    expect(localStorage.getItem('vibe-rico.seat')).toBeNull();
    expect(screen.getByText('创建房间')).toBeTruthy();
  });
  it('explicitly opens the lobby without resuming or deleting a saved game, including after refresh', async () => {
    localStorage.setItem('vibe-rico.seat', JSON.stringify(granted));
    history.replaceState(null, '', '/?lobby=1');
    const socket = new FakeSocket({});
    const page = view(socket);
    await flush();
    expect(socket.sent).toEqual([]);
    expect(screen.getByText('创建房间')).toBeTruthy();
    expect(screen.getByRole('link', { name: '继续游戏' }).getAttribute('href')).toBe(inviteLink(granted.roomCode));
    socket.push('room-state', seats(true, 3));
    socket.push('connect');
    await flush();
    expect(socket.sent).toEqual([]);
    expect(screen.getByText('创建房间')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('vibe-rico.seat')!)).toEqual(granted);
    page.unmount();
    view(socket);
    await flush();
    expect(screen.getByRole('link', { name: '继续游戏' })).toBeTruthy();
    expect(socket.sent).toEqual([]);
  });

  it('resumes the previous game through the explicit resume link', async () => {
    localStorage.setItem('vibe-rico.seat', JSON.stringify(granted));
    history.replaceState(null, '', '/?lobby=1');
    const socket = new FakeSocket({ resume: { ok: true, value: { playerId: 'p1', revision: 12 } } });
    const page = view(socket);
    const href = screen.getByRole('link', { name: '继续游戏' }).getAttribute('href')!;
    page.unmount();
    history.replaceState(null, '', href);
    const onSession = vi.fn();
    render(<Lobby socket={socket as unknown as LobbySocket} onSession={onSession} game={() => <p>resumed game</p>} />);
    await flush();
    socket.push('room-state', seats(true, 3));
    expect(screen.getByText('resumed game')).toBeTruthy();
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(socket.sent[0]?.event).toBe('resume');
  });

  it('returns to normal reconnect behaviour after creating a room from the explicit lobby', async () => {
    history.replaceState(null, '', '/?lobby=1');
    const socket = new FakeSocket({ 'create-room': { ok: true, value: granted }, resume: { ok: true, value: { playerId: 'p1', revision: null } } });
    view(socket);
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('创建房间'));
    await flush();
    expect(location.search).toBe('?room=ABC123');
    expect(screen.getByRole('link', { name: '返回大厅' }).getAttribute('href')).toBe('/?lobby=1');
    socket.push('connect');
    await flush();
    expect(socket.sent.filter(s => s.event === 'resume')).toHaveLength(1);
  });

});
