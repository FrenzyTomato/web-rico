# Multiplayer Protocol Plan

## Envelope

Client gameplay request: `{ protocolVersion, roomId, commandId, expectedRevision, action }`. The action carries neither a trusted playerId nor computed resource values. commandId is unique within the session and reused when retrying the same intent.

Server success: `{ commandId, acceptedRevision }`; failure: `{ commandId, code, ruleId?, currentRevision? }`. Distinguish at least BAD_SCHEMA, UNAUTHORIZED, STALE_SESSION, STALE_REVISION, ILLEGAL_COMMAND, COMMAND_ID_REUSE, ROOM_CLOSED, STORE_UNAVAILABLE, and VERSION_MISMATCH. Errors must not reveal another player's hidden state.

Per-player broadcast: `{ protocolVersion, revision, view, legalActions, events }`. Start with complete PlayerViews rather than complex patches. Events carry revision and batch index. Clients accept newer revisions only; older data cannot overwrite current state.

## Command processing order

1. Validate size, schema, and protocol version. Resolve roomId / playerId / sessionGeneration from the authenticated session.
2. Recheck session and room lifecycle inside the room's serial queue.
3. Look up `(gameId, playerId, commandId)`. Same ID and payload returns the saved result without reapplying; different payload returns COMMAND_ID_REUSE.
4. For new commands, validate expectedRevision. Return STALE_REVISION and request a fresh snapshot for stale input; do not rewrite intent.
5. Construct a trusted GameCommand and run engine validation.
6. Atomically write the new snapshot, success result, and event history against the expected previous revision. Storage failure must not acknowledge or broadcast success.
7. Install in-memory state, acknowledge, and broadcast player views. Client correctness must not depend on acknowledgment/broadcast arrival order.

## Rooms and recovery

A room code locates an invited room; it is not a player's credential. The server generates unpredictable reconnect tokens, stores hashes only, and excludes them from logs. Use TLS in transit; localhost is acceptable for development.

Default to one active controlling connection per seat. A valid-token takeover increments sessionGeneration, notifies the old connection, and prevents further actions from it. Refresh recovery uses the latest view while the process survives; M11 adds persistent restart recovery.

Coordinate subscription and snapshot reading through the room queue, or use a revision barrier with catch-up, so actions between them are not lost. A disconnected client stops sending new actions but retains unacknowledged commandIds. After recovery, query/retry the same command; the server deduplicates it.

Seats are fixed at game start. By default, wait for a disconnected player rather than autoplaying, silently removing a seat, or changing order. The host may close the room: this is an explicit lifecycle action, not a fabricated legal game ending. PR-040 defines and documents empty-room retention.

## Data boundaries

Filter PlayerView, events, legal choices, and logs according to VISIBILITY rules. Sending full GameState and hiding it in the browser is not confidentiality. Do not send seeds, future random sequences, or tokens to other players. Developer state import must not be a production network endpoint.

Reference: [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/). Transport reconnection is not application-level exactly-once execution. This protocol ensures retries of commands with saved results do not repeat their effects.

## Player-view and privacy contract — PR-035

Types live in `@vibe-rico/protocol` ([views.ts](../packages/protocol/src/views.ts), [messages.ts](../packages/protocol/src/messages.ts)) and reuse engine types type-only. The server's `projectForPlayer` (PR-042) implements them. Sources: RULES.md VISIBILITY-001–003; GAME_STATE.md "Visibility and replay".

| GameState field | PlayerView | Source |
| --- | --- | --- |
| seatOrder, governorPlayerId | Public | VISIBILITY-001 seats, Governor |
| players[].coins, goods, countryside, buildings, idleWorkerCount, personalShip | Public (`players`) | VISIBILITY-001 money, goods, placed tiles/workers, idle workers, ships |
| players[].earnedVp | Viewer's own only (`viewer.earnedVp`) | VISIBILITY-002 |
| roleCards (coins, selectedBy) | Public | VISIBILITY-001 role-card coins |
| phase, roundNumber, roleSelectionIndex | Public | VISIBILITY-001 phase, decision-maker; GAME_STATE turn data |
| phase `game-over` scores | Public: every breakdown and tiebreak | VISIBILITY-002 |
| supply (goods, workers, Register, Quarries, building stock, VP remaining/overflow) | Public | VISIBILITY-001 market stock; GAME_STATE "supplies" |
| estateMarket | Public | VISIBILITY-001 face-up estates |
| ships, tradingHouse | Public | VISIBILITY-001 |
| estateBag | Server-only | VISIBILITY-003 future order, unrevealed identities |
| rng | Server-only | VISIBILITY-003 |
| estateDiscard, endTriggers | Not projected | Absent from the VISIBILITY-001 public list |
| schemaVersion, engineVersion, rulesetId, rulesetVersion, sourceHash, gameId | Not projected | Snapshot metadata. `revision` travels in the broadcast envelope |

Events: `PlayerEvent` is a canonical event after the same filter. `vp-earned` goes only to its owner. `end-triggered` is never sent, matching `endTriggers`. Kept events keep their canonical `revision`/`index`, so filtered batches may have index gaps. `game-scored` and `tile-placed` are public; a Hacienda draw's identity first appears at placement. Player logs are these filtered events; there is no separate log channel.

Legal actions: only the current decision-maker receives `getLegalCommands` output; every other viewer receives `[]`. Descriptors reference only face-up market tiles, the actor's own components and public prices, so they add nothing beyond PlayerView.

Errors: `CommandRejected` goes only to the submitter and carries `code`, optional `ruleId` and `currentRevision`. It never carries engine message text or state.

Permissions: a player connection receives only its own `PlayerBroadcast`, `CommandAccepted` and `CommandRejected`. Full GameState (serialized snapshot, RNG, bag) is a developer-tool permission. It is available only in a controlled local development environment, is disabled by default, and is never a production network endpoint or player message (ARCHITECTURE "Presentation boundaries").

### Disclosure test specifications (implemented by PR-042)

Each case projects the same state for every seat and inspects every message sent to each connection. None of the listed data may appear anywhere in serialized output, including nested fields, events and errors.

| ID | Private category | Setup | Forbidden disclosure |
| --- | --- | --- | --- |
| PRIV-01 | Other players' earned VP | VIS-01: A earned 9, B earned 11; Captain loads by both | B's view/events never contain 11 or B's `vp-earned`; A's likewise for 9. Only at game-over do both see both breakdowns |
| PRIV-02 | Future estate order and identities | Bag with known order; Hacienda draw of Coffee | No bag tile ID or kind in any message before placement; the Coffee tile appears only in the `tile-placed` event and view after placement |
| PRIV-03 | RNG seed/state | Any seeded game, including after a discard reshuffle | No `rng` object, seed or state words in any view, event, legal action or error |
| PRIV-04 | Legal actions | Non-actor and actor views in every decision phase | Non-actors receive `[]`; actor descriptors reference no bag/discard tile |
| PRIV-05 | Errors | Rejected commands from each seat | Only the submitter receives `CommandRejected`; no engine message or state fields |
| PRIV-06 | Logs and credentials | Full command history, reconnect | Player logs equal the filtered events; reconnect tokens/hashes never appear in any message |
| PRIV-07 | Developer state | Production configuration | No endpoint or message returns a full snapshot; developer access exists only when local development mode is enabled |

PR-035 compile-time checks in [views.test.ts](../packages/protocol/test/views.test.ts) pin the exact DTO key sets. Adding any GameState field to a view or envelope fails the typecheck until this table is revisited.
