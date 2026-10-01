// Test harness only (PR-058): the real server, except it exits right after a successful commit and before
// the acknowledgement — a crash between steps 6 and 7 of PROTOCOL.md.
import { createApp } from '../../dist/app.js';
import { connect } from '../../dist/storage/postgresStore.js';

const { store } = await connect(process.env.DATABASE_URL);
const crashing = Object.create(store);
crashing.update = async (room, expected) => {
  const result = await store.update(room, expected);
  if (result === 'ok' && room.game && room.game.commands.length > 0) process.exit(70);
  return result;
};
const { app, ready } = createApp({ store: crashing });
await ready;
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT) });
