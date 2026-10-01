// Diagnostics export (docs/RECOVERY.md): prints a room's replay record and snapshot as JSON.
// It contains game history only: no reconnect tokens or token hashes.
// Usage: DATABASE_URL=postgres://... node scripts/export-history.mjs <roomId>
import { exportRoom } from '../dist/debug/scenarios.js';
import { connect } from '../dist/storage/postgresStore.js';

const [roomId] = process.argv.slice(2);
if (!roomId || !process.env.DATABASE_URL) { console.error('usage: DATABASE_URL=... node scripts/export-history.mjs <roomId>'); process.exit(2); }
const { store, close } = await connect(process.env.DATABASE_URL);
const exported = await exportRoom(store, roomId);
await close();
if (!exported.ok) { console.error(`no started game in room ${roomId}`); process.exit(1); }
process.stdout.write(JSON.stringify(exported.value) + '\n');
