// Browser-test server: the real app with deterministic lobby randomness, so fixed PR-036 histories replay.
// Test harness only; production uses apps/server/src/main.ts.
import { createApp } from '../../server/dist/app.js';

let n = 0;
let next = { seed: 1, governor: 0 };
const random = { id: () => `e2e-${++n}`, roomCode: () => `E2E${++n}`, seed: () => next.seed, pick: () => next.governor };
const { app } = createApp({ random });
// Sets the seed and Governor seat index used by the next start-game.
app.post('/e2e/next-game', async request => { next = request.body; return { ok: true }; });
await app.listen({ host: '127.0.0.1', port: 3000 });
