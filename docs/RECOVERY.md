# Recovery, Backups and Version Guards — PR-059

These procedures apply when the server runs with PostgreSQL (`DATABASE_URL` set; see PR-058). They are drilled automatically by `apps/server/test/versionGuard.test.ts` (`pnpm --filter @vibe-rico/server test:db`).

## Save versions

- Every stored game snapshot carries `schemaVersion` and `engineVersion`, inside the JSON and as the `rooms.snapshot_schema_version` / `snapshot_engine_version` columns.
- On load, `storage/versionGuard.ts`:
  1. applies **known** upgrades from `SNAPSHOT_UPGRADES`, keyed by the version they upgrade from. There are none yet, because 1.0.0 is the first schema. Upgrades happen in memory.
  2. validates the result strictly (`deserializeGame`): version fields, ruleset and every field.
- **An unsupported version is isolated.** Commands for that room get `VERSION_MISMATCH`, and nothing is written, so the original row stays exactly as stored. Other rooms are unaffected.
- **A supported upgrade is persisted on the room's next successful commit**, which stores the upgraded snapshot and version columns.
- **To add a migration:**
  1. bump `SNAPSHOT_SCHEMA_VERSION` in the engine;
  2. add `SNAPSHOT_UPGRADES['<old>'] = raw => …` producing the new shape;
  3. add a test that loads an old save.

  Never edit stored rows by hand to "fix" a version.

## Backup

The server keeps rooms, seats (token **hashes** only), command results and events in PostgreSQL. Back up the whole database in custom format:

```sh
pg_dump --format=custom --file=vibe-rico-$(date +%Y%m%d-%H%M).dump "$DATABASE_URL"
```

Take backups while the server runs; each command commits in one transaction, so a dump is consistent. Keep backups private: although tokens are hashed, the snapshots contain every player's full game state.

## Restore

1. Stop the server: `kill <pid>` or stop the container. Players see the disconnect notice; their tokens remain valid.
2. Restore into an empty database:

   ```sh
   createdb vibe_rico_restored
   pg_restore --dbname=vibe_rico_restored vibe-rico-YYYYMMDD-HHMM.dump
   ```
3. Point `DATABASE_URL` at the restored database and start the server. Migrations already applied are skipped.
4. Players reload the page; their saved seat tokens resume against the restored hashes.

The drill test verifies that a restored copy is identical to the original room and that its replay and every seat's view are reproduced exactly.

## History export (diagnostics)

```sh
pnpm --filter @vibe-rico/server build
DATABASE_URL=postgres://… node apps/server/scripts/export-history.mjs <roomId>
```

This prints `{ replay, snapshot }` as JSON: the initial state, the accepted commands and the current state. Load the replay with the engine CLI (`load <replay-json>`) or the local dev tools import. It contains **no reconnect tokens or token hashes**; the test asserts this. It does contain every player's private game state, so share it only with the developer investigating.
