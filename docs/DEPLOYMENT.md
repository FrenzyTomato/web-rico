# Private Deployment — PR-061

One machine runs two containers: the game service (web client + Socket.IO + API on one origin) and PostgreSQL. No hosting is provisioned automatically; choose a host you control, such as a home server or small VPS.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build on `node:24-bookworm-slim`. The runtime stage holds only the server's production dependencies plus built output (engine, protocol, server, migrations, web client) and runs as the unprivileged `node` user. |
| `compose.yaml` | `app` + `db` (`postgres:16-alpine`) with a named volume, health checks and `restart: unless-stopped`. |
| `.env.example` | Settings to copy into `.env`. `.env` is excluded from git and from the image (`.dockerignore`). |

## Environment variables

| Variable | Where | Meaning |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `.env` | Database password; required. Use a long random value, for example `openssl rand -hex 24`. |
| `APP_PORT` | `.env` | Host port for the game service; default 3000. It is bound to `127.0.0.1`, so expose it only through TLS. |
| `DATABASE_URL` | set by compose | Selects the PostgreSQL store; without it the server keeps rooms in memory. |
| `HOST`, `PORT`, `WEB_ROOT` | baked into the image | Listener `0.0.0.0:3000` inside the container, and the static client root. |
| `VIBE_RICO_DEV_TOOLS` | **never in production** | Enables full-state developer tools (local development only). |

## First start

```sh
cp .env.example .env        # then set POSTGRES_PASSWORD
docker compose up -d --build
curl http://127.0.0.1:3000/health        # {"status":"ok"}
```

Migrations run automatically at startup (`drizzle/0000_initial.sql`; already-applied ones are skipped).

## TLS

Friends must connect over HTTPS, because seat tokens travel over the connection (PROTOCOL.md). Run a reverse proxy on the host that terminates TLS and forwards to `127.0.0.1:${APP_PORT}`, including WebSocket upgrades. A minimal Caddy example, which also obtains certificates automatically:

```
game.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Share `https://game.example.com/` invite links. localhost without TLS is fine for development only.

## Operations

- **Shutdown:** `docker compose stop` sends SIGTERM. The server closes gracefully and exits 0; in-flight commits finish or roll back atomically. Players see the disconnect notice and resume when it is back.
- **Restart / upgrade:**

  ```sh
  git pull && docker compose up -d --build
  ```

  Rooms, seats and history live in the `db-data` volume and survive; players' saved tokens resume.
- **Backups and restore:** see `docs/RECOVERY.md`, for example:

  ```sh
  docker compose exec db pg_dump -U postgres -Fc vibe_rico > backup.dump
  ```
- **Logs:** `docker compose logs app`. The server logs no tokens, hashes or game state.

## Verified (2026-10-01, from a clean build cache)

- `docker compose build --no-cache` gives a 415 MB image.
- `up -d`: the db is healthy and `/health` returns ok. `/` serves the built client. The log reports the PostgreSQL store.
- Three socket clients create, join and start a room; a command is accepted at revision 1.
- `docker compose restart app`: the same seat token resumes at revision 1, and retrying the command returns the saved result (no duplicate).
- No password, token or `.env` in the image config, layer history, filesystem or logs.
- `stop` completes immediately with exit code 0.
- The test stack and its volume were removed afterwards (`down -v`).

## Vercel frontend with a separate backend

Compose defaults `CORS_ORIGINS` to `https://webri.co`. Override it with a comma-separated list in `.env` if needed; origins must match exactly (no trailing slash). Direct server launches default to no cross-origin browser access.

Set Vercel’s public build variable `VITE_SERVER_URL=https://api.webri.co` and redeploy. Configure Caddy on the Droplet to reverse proxy `api.webri.co` to `127.0.0.1:3000`. After pulling backend changes, run `docker compose up -d --build`. Keep the existing database password and volume.

### Room creation password

The password gate is disabled by default. To enable it, set `VITE_ROOM_CREATION_PASSWORD_ENABLED=true` and configure `VITE_ROOM_CREATION_PASSWORD` in `apps/web/.env` for local development and in the Vercel project environment variables for Production (and Preview if used). Restart Vite locally and rebuild/redeploy on Vercel after changing it. The lobby requires an exact password match to create a room; joining and resuming are unaffected. While enabled, missing password configuration blocks creation. Set `VITE_ROOM_CREATION_PASSWORD_ENABLED=false` (or omit it) to hide the field and allow creation without a password; the stored password can remain unchanged. This is a frontend-only gate: the value is public in the JavaScript bundle and does not protect the backend room API.
