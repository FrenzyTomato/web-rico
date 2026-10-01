import { defineConfig } from 'drizzle-kit';

// Migrations are generated from src/storage/schema.ts into ./drizzle and applied by the server/tests.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/storage/schema.ts',
  out: './drizzle',
});
