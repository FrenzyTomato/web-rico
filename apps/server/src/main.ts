import { resolve } from 'node:path';
import { createApp } from './app.js';
import { InMemoryRoomStore } from './rooms/inMemoryStore.js';
import { connect } from './storage/postgresStore.js';
import { JevClient } from './bots/jev.js';
import { supabaseAccounts } from './accounts/supabase.js';

// DATABASE_URL selects PostgreSQL (rooms survive restarts, PR-058); without it the store is in memory.
// HOST/PORT default to a local listener; the container sets HOST=0.0.0.0 and WEB_ROOT (docs/DEPLOYMENT.md).
const url = process.env.DATABASE_URL;
const store = url ? (await connect(url)).store : new InMemoryRoomStore();
// WEB_ROOT may be relative to the working directory; the static plugin needs an absolute path.
const webRoot = process.env.WEB_ROOT ? resolve(process.env.WEB_ROOT) : undefined;
const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean);
// JEV_API_KEY lets bot seats ask TypeSafe Jev; without it they play on the code value alone (docs/BOT_STRATEGY.md).
const jevKey = process.env.JEV_API_KEY?.trim();
const bots = { client: jevKey ? new JevClient(jevKey, process.env.JEV_MODEL?.trim() || undefined) : null,
  log: (entry: Record<string, unknown>) => console.log(JSON.stringify(entry)) };
// SUPABASE_URL enables optional sign-in (docs/ACCOUNTS_PLAN.md). SUPABASE_JWT_SECRET is only for projects still on
// the legacy shared-secret tokens; SUPABASE_SERVICE_ROLE_KEY lets players delete their accounts.
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const accounts = supabaseUrl ? supabaseAccounts({ url: supabaseUrl, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  jwtSecret: process.env.SUPABASE_JWT_SECRET?.trim() || undefined }) : undefined;
const { app, ready } = createApp({ store, allowedOrigins, bots, accounts, devTools: process.env.VIBE_RICO_DEV_TOOLS === '1', ...(webRoot ? { webRoot } : {}) });
await ready;
const host = process.env.HOST ?? '127.0.0.1', port = Number(process.env.PORT ?? 3000);
await app.listen({ host, port });
// Graceful shutdown (docker stop sends SIGTERM): stop accepting work, let in-flight commits finish.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
console.log(`listening on http://${host}:${port} (${url ? 'postgres' : 'memory'} store${webRoot ? ', serving web client' : ''})`);
