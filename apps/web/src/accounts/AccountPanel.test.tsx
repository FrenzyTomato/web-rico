import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLanguage } from '../i18n/language.js';
import type { LobbySocket } from '../network/socket.js';

const auth = vi.hoisted(() => ({ sendEmailCode: vi.fn(async () => ({ error: null })), verifyEmailCode: vi.fn(async () => ({ error: null })),
  signInWithGoogle: vi.fn(async () => ({ error: null })), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock('./account.js', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { ...auth, supabase: {}, accountStore: createStore(() => ({ session: null, linked: false, failed: false })) };
});
const { accountStore } = await import('./account.js');
const { AccountPanel } = await import('./AccountPanel.js');

const game = { roomId: 'r1', roomCode: 'ABC123', status: 'playing', players: ['Ana', 'Bot Bea'], you: 'Ana', round: 4 };
const socket = (replies: Record<string, unknown>) => ({
  connected: true,
  emitWithAck: vi.fn(async (_event: string, payload: { action: { kind: string } }) => replies[payload.action.kind]),
}) as unknown as LobbySocket & { emitWithAck: ReturnType<typeof vi.fn> };

beforeEach(() => { setLanguage('en'); accountStore.setState({ session: null, linked: false, failed: false }); });
afterEach(cleanup);

describe('account panel', () => {
  it('signs in with an emailed code', async () => {
    render(<AccountPanel socket={socket({})} connected onRejoin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send code' })); });
    expect(auth.sendEmailCode).toHaveBeenCalledWith('ana@example.com');
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: '12 34 56' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })); });
    expect(auth.verifyEmailCode).toHaveBeenCalledWith('ana@example.com', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(auth.signInWithGoogle).toHaveBeenCalled();
  });

  it('lists my games once the server knows the account, and rejoins one', async () => {
    const s = socket({ 'my-games': { ok: true, value: [game] }, 'resume-account': { ok: true, value: { roomId: 'r1', roomCode: 'ABC123', playerId: 'p1', token: 't2' } } });
    const onRejoin = vi.fn();
    accountStore.setState({ session: { user: { email: 'ana@example.com' } } as never, linked: true });
    await act(async () => { render(<AccountPanel socket={s} connected onRejoin={onRejoin} />); });
    expect(screen.getByText('Signed in: ana@example.com')).toBeTruthy();
    expect(screen.getByText('Room ABC123')).toBeTruthy();
    expect(screen.getByText('Round 4 · Ana, Bot Bea')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
    expect(s.emitWithAck).toHaveBeenLastCalledWith('room', expect.objectContaining({ action: { kind: 'resume-account', roomId: 'r1' } }));
    expect(onRejoin).toHaveBeenCalledWith({ roomId: 'r1', roomCode: 'ABC123', playerId: 'p1', token: 't2' });
  });

  it('says so instead of loading forever when the game server cannot confirm the sign-in', async () => {
    accountStore.setState({ session: { user: { email: 'ana@example.com' } } as never, linked: false, failed: true });
    await act(async () => { render(<AccountPanel socket={socket({})} connected onRejoin={vi.fn()} />); });
    expect(screen.getByRole('alert').textContent).toBe("The game server couldn't confirm your sign-in. Please try again later.");
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
