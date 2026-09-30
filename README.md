# Vibe Rico

A private online Puerto Rico (1897 Special Edition) game for 3–5 friends. A pure TypeScript engine enforces the rules, a single server adjudicates every action, and browsers render each player's filtered view.

**Status:** playable prototype. A complete multiplayer game runs in the browser (DOM debug client, Chinese UI) with reconnect, and is covered by unit and browser tests. The 3D tabletop, persistent storage and deployment are not built yet. Ticket-level status lives in [the backlog](docs/BACKLOG.md).

## Layout

| Package | Purpose |
| --- | --- |
| `packages/game-engine` | Rules engine: setup, roles, buildings, scoring, replay, headless CLI. No I/O. |
| `packages/protocol` | Wire schemas (Zod) and player-view/message types. |
| `apps/server` | Fastify + Socket.IO: rooms, sessions, command queue, per-player broadcasts. |
| `apps/web` | React + Vite client: lobby, game view, action forms. |

## Development

Requires Node **24.21.0** (`.nvmrc`) and pnpm **11.25.0** (`packageManager`; `corepack enable` provides it).

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Run a local game: start the server (port 3000), then the web dev server (port 5173, proxying `/socket.io` to the server), and open http://localhost:5173.

```sh
pnpm --filter @vibe-rico/server build && pnpm --filter @vibe-rico/server start
```

```sh
pnpm --filter @vibe-rico/web dev
```

Set `VIBE_RICO_DEV_TOOLS=1` on the server to enable the local-only scenario tools (history export/import). Never enable them for real players.

Browser tests (uses the installed Google Chrome):

```sh
pnpm --filter @vibe-rico/web test:e2e
```

Headless engine play in a terminal (seed, then 3–5 player IDs clockwise; the first is Governor):

```sh
pnpm --filter @vibe-rico/game-engine cli 42 a b c
```

Playtests on a local network: see [docs/PLAYTEST.md](docs/PLAYTEST.md).

## Documentation

1. [Implementation plan and milestones](docs/IMPLEMENTATION_PLAN.md)
2. [Backlog and ticket status](docs/BACKLOG.md)
3. [Architecture and engineering constraints](docs/ARCHITECTURE.md)
4. [Rules specification](docs/RULES.md) and [open rule questions](docs/RULE_QUESTIONS.md)
5. [Protocol](docs/PROTOCOL.md) and [game state](docs/GAME_STATE.md)
6. [Single-task execution guide](docs/EXECUTION.md)

The [local Special Edition rulebook](references/puerto-rico-1897-special-edition-rulebook-en.pdf) is canonical whenever a rule is uncertain ([reference policy](references/README.md)).
