import { createApp } from './app.js';
import { InMemoryRoomStore } from './rooms/inMemoryStore.js';
import { connect } from './storage/postgresStore.js';

// DATABASE_URL selects PostgreSQL (rooms survive restarts, PR-058); without it the store is in memory.
const url = process.env.DATABASE_URL;
const store = url ? (await connect(url)).store : new InMemoryRoomStore();
const { app, ready } = createApp({ store, devTools: process.env.VIBE_RICO_DEV_TOOLS === '1' });
await ready;
const port = Number(process.env.PORT ?? 3000);
await app.listen({ host: '127.0.0.1', port });
console.log(`listening on http://127.0.0.1:${port} (${url ? 'postgres' : 'memory'} store)`);
