import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { createSocket } from './socket.js';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('uses the configured backend for a separately hosted frontend', () => {
  vi.stubEnv('VITE_SERVER_URL', ' https://backend.example.com ');
  createSocket();
  expect(io).toHaveBeenCalledWith('https://backend.example.com');
});

it('keeps same-origin connections when no backend is configured', () => {
  vi.stubEnv('VITE_SERVER_URL', '');
  createSocket();
  expect(io).toHaveBeenCalledWith(undefined);
});
