# Vibe Rico

A private online Puerto Rico game for 3–5 friends. Faithfully implement Puerto Rico 1897, render the tabletop with Three.js, and let the server adjudicate every action.

Current status: **deterministic setup and base Planter/Builder actions implemented; no playable application yet**. Git, the engine package, and development commands are available.

## Reading order

1. [Implementation plan and milestones](docs/IMPLEMENTATION_PLAN.md)
2. [Dependency-ordered Low / Medium backlog](docs/BACKLOG.md)
3. [Architecture and engineering constraints](docs/ARCHITECTURE.md)
4. [Open rule questions](docs/RULE_QUESTIONS.md) and [rules specification](docs/RULES.md)
5. [Single-task execution guide](docs/EXECUTION.md)

**Puerto Rico 1897 Special Edition** sources, scope, and scenario specifications are recorded in the rules documents. Domain interfaces are defined; gameplay implementation follows the backlog.

## Canonical rulebook

Use [the local Special Edition rulebook](references/puerto-rico-1897-special-edition-rulebook-en.pdf) whenever a rule is uncertain. The user designated it canonical; [reference policy](references/README.md) supersedes the earlier standard-edition source. PR-001–035, PR-027A, PR-030A and PR-033A/B are complete; PR-036 is ready; V1 remains the 3–5-player base game.

## Development

Use Node **24.21.0** (`nvm use`, pinned in `.nvmrc`) and pnpm **11.25.0** (`packageManager`). The supported runtime range is Node24.19–24.x, which also supports the app’s bundled pnpm launcher. TypeScript **7.0.2** and Vitest **5.0.2** are exact development dependencies; transitive dependencies are locked in `pnpm-lock.yaml`. Compatibility references: [Vitest requirements](https://vitest.dev/guide/) and [pnpm installation](https://pnpm.io/installation).

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Headless play in a terminal (seed, then 3–5 player IDs clockwise; the first is Governor). Type JSON commands or `help`:

```sh
pnpm --filter @vibe-rico/game-engine cli 42 a b c
```

Packages: `@vibe-rico/game-engine` and the type-only `@vibe-rico/protocol` player-view/message DTOs (PR-035). Build emits ESM and declarations into its ignored `dist/` directory. Its entry point exports the domain types and ruleset identity. Tests compile positive and negative type fixtures, then run contract, snapshot, deterministic RNG, state-invariant, and command-rejection checks; an empty suite now fails. Setup tests verify initial game rules; all base roles and23 building abilities, bounded automatic progression, endgame and itemized final scoring are implemented. Headless controls (pure `startCli`/`runCliLine`) and versioned replay with failure-position diagnostics are implemented; full-game fixtures and application packages remain unimplemented. Browser tests and application packages belong to later tickets.
