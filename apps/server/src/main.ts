import { createApp } from './app.js';

// Local development listener; deployment configuration belongs to later tickets.
const { app } = createApp({ devTools: process.env.VIBE_RICO_DEV_TOOLS === '1' });
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
console.log(`listening on http://127.0.0.1:${Number(process.env.PORT ?? 3000)}`);
