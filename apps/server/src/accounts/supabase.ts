import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

/** The signed-in user a Supabase access token proves (docs/ACCOUNTS_PLAN.md Part 1). */
export interface AccountUser { readonly userId: string; /** Token expiry, ms since epoch. */ readonly expiresAt: number }

/**
 * Optional sign-in. Tokens are checked locally against the project's public keys (or, for older projects, the
 * shared JWT secret); the client never sends a user id, only the token.
 */
export interface Accounts {
  verify(accessToken: string): Promise<AccountUser | null>;
  /** Removes the Supabase user; game data is unlinked separately. */
  deleteUser(userId: string): Promise<void>;
}

export function supabaseAccounts({ url, serviceRoleKey, jwtSecret, keys, fetchImpl = fetch }: {
  url: string; serviceRoleKey?: string | undefined; jwtSecret?: string | undefined;
  /** Tests inject a local key set instead of the project's JWKS endpoint. */
  keys?: JWTVerifyGetKey; fetchImpl?: typeof fetch;
}): Accounts {
  const base = url.replace(/\/+$/, '');
  const key = keys ?? (jwtSecret ? undefined : createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)));
  const secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : undefined;
  return {
    async verify(accessToken) {
      try {
        const options = { issuer: `${base}/auth/v1`, audience: 'authenticated' };
        const { payload } = key ? await jwtVerify(accessToken, key, options) : await jwtVerify(accessToken, secret!, options);
        return typeof payload.sub === 'string' && payload.sub ? { userId: payload.sub, expiresAt: (payload.exp ?? 0) * 1000 } : null;
      } catch {
        return null;
      }
    },
    async deleteUser(userId) {
      if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
      const response = await fetchImpl(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE', headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      if (!response.ok && response.status !== 404) throw new Error(`Supabase delete failed: ${response.status}`);
    },
  };
}
