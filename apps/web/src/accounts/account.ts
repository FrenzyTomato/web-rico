import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createStore } from 'zustand/vanilla';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { RoomReply } from '@vibe-rico/protocol';
import type { LobbySocket } from '../network/socket.js';

/**
 * Optional sign-in (docs/ACCOUNTS_PLAN.md). Supabase only proves who the player is; games stay on our server.
 * Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app runs guest-only and shows no sign-in.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export interface AccountState {
  readonly session: Session | null;
  /** True once the game server has verified the current session's token on this connection. */
  readonly linked: boolean;
}
export const accountStore = createStore<AccountState>(() => ({ session: null, linked: false }));

/** A display name to pre-fill: the Google name, else the start of the email address. */
export function suggestedName(session: Session | null): string {
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  return (meta?.full_name ?? meta?.name ?? session?.user.email?.split('@')[0] ?? '').slice(0, 24);
}

/** Keeps the socket's sign-in in step with Supabase: on start, on every auth change (incl. token refresh) and reconnect. */
export function bindAccount(socket: LobbySocket): () => void {
  if (!supabase) return () => {};
  const send = async (session: Session | null) => {
    accountStore.setState({ session, linked: false });
    if (!socket.connected) return;
    const reply = await socket.emitWithAck('auth', { protocolVersion: PROTOCOL_VERSION, accessToken: session?.access_token ?? null }) as RoomReply<{ signedIn: boolean }>;
    if (accountStore.getState().session === session) accountStore.setState({ linked: reply.ok && reply.value.signedIn });
  };
  void supabase.auth.getSession().then(({ data }) => send(data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => { void send(session); });
  const onConnect = () => { void send(accountStore.getState().session); };
  socket.on('connect', onConnect);
  return () => { data.subscription.unsubscribe(); socket.off('connect', onConnect); };
}

export const sendEmailCode = (email: string) => supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
export const verifyEmailCode = (email: string, token: string) => supabase!.auth.verifyOtp({ email, token, type: 'email' });
/** Google returns to the lobby, where Supabase reads the result from the URL. */
export const signInWithGoogle = () => supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}${location.pathname}?lobby=1` } });
export const signOut = () => supabase!.auth.signOut();
