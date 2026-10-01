import { resolve } from 'node:path';
import { createApp } from './app.js';
import { InMemoryRoomStore } from './rooms/inMemoryStore.js';
import { connect } from './storage/postgresStore.js';

// DATABASE_URL selects PostgreSQL (rooms survive restarts, PR-058); without it the store is in memory.
// HOST/PORT default to a local listener; the container sets HOST=0.0.0.0 and WEB_ROOT (docs/DEPLOYMENT.md).
const url = process.env.DATABASE_URL;
const store = url ? (await connect(url)).store : new InMemoryRoomStore();
// WEB_ROOT may be relative to the working directory; the static plugin needs an absolute path.
const webRoot = process.env.WEB_ROOT ? resolve(process.env.WEB_ROOT) : undefined;
const { app, ready } = createApp({ store, devTools: process.env.VIBE_RICO_DEV_TOOLS === '1', ...(webRoot ? { webRoot } : {}) });
await ready;
const host = process.env.HOST ?? '127.0.0.1', port = Number(process.env.PORT ?? 3000);
await app.listen({ host, port });
// Graceful shutdown (docker stop sends SIGTERM): stop accepting work, let in-flight commits finish.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
console.log(`listening on http://${host}:${port} (${url ? 'postgres' : 'memory'} store${webRoot ? ', serving web client' : ''})`);
