// Runs the storage tests against a real, throwaway PostgreSQL (PR-056: mocks cannot establish acceptance).
// Files run one at a time: each resets the shared database schema.
// Usage: pnpm --filter @vibe-rico/server test:db
import { execFileSync, spawnSync } from 'node:child_process';

const name = 'vibe-rico-test-db', port = 54329, password = 'vibe-rico-test';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' }); // clear a leftover container, if any
docker('run', '-d', '--rm', '--name', name, '-e', `POSTGRES_PASSWORD=${password}`, '-p', `${port}:5432`, 'postgres:16-alpine');
try {
  for (let i = 0; ; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) break;
    if (i > 60) throw Error('postgres did not become ready');
    execFileSync('sleep', ['0.5']);
  }
  const env = { ...process.env, PG_CONTAINER: name, DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/postgres` };
  const run = spawnSync('npx', ['vitest', 'run', 'test/storage', 'test/restart', 'test/versionGuard', '--no-file-parallelism', ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exitCode = run.status ?? 1;
} finally {
  docker('rm', '-f', name);
}
