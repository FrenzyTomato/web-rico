# Architecture and Engineering Constraints

## Goals and current decisions

Friends join private rooms through a link, play a complete 3–5-player game, recover their seat after refreshing, and see a final scoring breakdown. The current UI assumptions are desktop browsers first with per-browser Chinese/English display language; these remain adjustable and are not game rules.

Use one authoritative server instance, a pure engine, and deterministic random state. Build headless play and a DOM debug client before a semi-top-down 2.5D tabletop. Role, building, ship, resource, and worker values and behavior must come from the frozen RULES.md.

## Build dependencies and runtime flow

Build dependencies: `server → game-engine`; `server → protocol`; `web → protocol`; `web → ui`. If protocol reuses IDs, use type-only engine exports without reverse dependencies or engine runtime imports. Automated checks prohibit framework and IO imports in the engine.

Runtime flow: player intent → protocol validation → session-bound identity → room queue → engine validation and transition → successful storage → player-specific views and events → acknowledgment/broadcast → client rendering.

## Planned API

```ts
createGame(input: CreateGameInput): CreateGameResult
applyCommand(state: GameState, command: GameCommand): GameResult
getLegalCommands(state: GameState, playerId: PlayerId): LegalAction[]
calculateFinalScore(state: GameState): FinalScoreBreakdown[]
assertGameState(state: GameState): void
projectForPlayer(state: GameState, playerId: PlayerId): PlayerView
```

The first five functions belong to the engine; projection belongs to the server. A successful GameResult returns new state and ordered events; failure returns a RuleError with ruleId. Inputs remain unchanged. CreateGameInput contains the frozen rulesetId, gameId, clockwise seatOrder, an explicitly seated governorPlayerId, and seed. Create/join/leave/start are RoomCommands; the engine receives only the player list fixed at startup and gameplay commands.

`LegalAction` is a discriminated union describing discrete choices and constrained forms, avoiding enumeration of every worker allocation. The client provides form-format feedback only; applyCommand revalidates submissions. Legal-action descriptions and execution validation share rule functions, with consistency tests.

Automatic actions advance to the next player decision or game over. Each iteration must make verifiable progress and have a loop limit. Arbitrary EndTurn/PassRole commands must not bypass mandatory actions. Do not add temporary gameplay shortcuts to hide missing rules.

## Engineering standards

- Enable TypeScript strict, noImplicitAny, and noUncheckedIndexedAccess; no any in domain models.
- State contains only JSON-serializable data; no Map, Set, Date, or class instances in snapshots.
- Version the RNG algorithm and state. Replays record initialState, seed, rulesetVersion, engineVersion, and successful command history.
- Rule tests reference ruleId and independently calculated expected results, not just internal consistency.
- Define conservation separately for each finite component. Score is not physical chip count: if rules allow scoring after supply exhaustion, use a separate ledger rather than an incorrect constant-total-VP assertion.
- Separate building data from abilities. Prefer explicit ability functions over a premature rules DSL. Shared rule entry points determine occupancy, privileges, and timing.
- Keep unbounded logs out of canonical state; the room store owns history. Stable event sequence numbers deduplicate client animations.

## Presentation boundaries

Three.js handles the table, tiles, buildings, resources, ships, selection highlights, camera, and short animations. React DOM handles rooms, explanations, legal-action forms, logs, settings, and scoring. Provide keyboard access and a DOM-only fallback.

Accept authoritative state as soon as it arrives; animation is visual interpolation only. After reconnect, skipped animation, or WebGL loss, rebuild the current view without replaying all history. Developer tools are disabled by default; full private state is available only in a controlled local development environment.

## Storage and release

Start with InMemoryRoomStore. Later use PostgreSQL / Drizzle for rooms, session token hashes, snapshots, command results, and event batches. Atomically commit the new revision, snapshot, deduplication result, and events before acknowledging success.

One Node instance serves same-origin static pages and Socket.IO, running in Docker. Rehearse production database backup and restore. The user will choose the deployment target; do not create an external project now.
