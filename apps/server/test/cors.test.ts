import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';

it('allows only configured frontend origins for polling and preflight', async () => {
  const { app } = createApp({ allowedOrigins: ['https://webri.co'] });
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  try {
    for (const method of ['GET', 'OPTIONS']) {
      for (const origin of ['https://webri.co', 'https://untrusted.example']) {
        const response = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
          method, headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
        });
        expect(response.headers.get('access-control-allow-origin')).toBe(origin === 'https://webri.co' ? origin : null);
        if (method === 'GET') expect(await response.text()).toContain('"sid"');
        else expect(response.status).toBe(204);
      }
    }
  } finally { await app.close(); }
});
