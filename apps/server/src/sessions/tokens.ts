import { createHash, randomBytes } from 'node:crypto';

/** Unpredictable reconnect token; only its hash is stored (PROTOCOL.md "Rooms and recovery"). */
export function issueToken(): { readonly token: string; readonly tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
