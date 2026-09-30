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
| estateDiscard, endTriggers | Public | VISIBILITY-001 (user ruling 2026-10-01): discarded tiles were face-up; end triggers restate public facts |
| schemaVersion, engineVersion, rulesetId, rulesetVersion, sourceHash, gameId | Not projected | Snapshot metadata. `revision` travels in the broadcast envelope |

Events: `PlayerEvent` is a canonical event after the same filter. `vp-earned` goes only to its owner. `end-triggered` is public, matching `endTriggers`. Kept events keep their canonical `revision`/`index`, so filtered batches may have index gaps. `game-scored` and `tile-placed` are public; a Hacienda draw's identity first appears at placement. Player logs are these filtered events; there is no separate log channel.

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
| PRIV-04 | Legal actions | Non-actor and actor views in every decision phase | Non-actors receive `[]`; actor descriptors reference no bag tile |
| PRIV-05 | Errors | Rejected commands from each seat | Only the submitter receives `CommandRejected`; no engine message or state fields |
| PRIV-06 | Logs and credentials | Full command history, reconnect | Player logs equal the filtered events; reconnect tokens/hashes never appear in any message |
| PRIV-07 | Developer state | Production configuration | No endpoint or message returns a full snapshot; developer access exists only when local development mode is enabled |

PR-035 compile-time checks in [views.test.ts](../packages/protocol/test/views.test.ts) pin the exact DTO key sets. Adding any GameState field to a view or envelope fails the typecheck until this table is revisited.

## Server and schema entry points — PR-037

`@vibe-rico/protocol` [schemas.ts](../packages/protocol/src/schemas.ts) holds Zod schemas. `PROTOCOL_VERSION` is `"1"`.
- **Gameplay request:** the envelope above. `action` is an engine `GameCommand` without `actorId`. Every object is strict, so any extra key is `BAD_SCHEMA`. That covers identity (`actorId`, `playerId`) and computed values (price, quantity, VP, output). The schema checks JSON types only; the engine still validates every ID and quantity.
- **Room request:** `{ protocolVersion, action }`, where `action` is one of the four ARCHITECTURE RoomCommands:
  - `create-room {displayName}`
  - `join-room {roomCode, displayName}`
  - `leave-room {roomId}`
  - `start-game {roomId}`

  The field names come from the room-code and display-name requirements in PR-038, which implements handling. PR-038 may revise them.
- **Version check:** a string `protocolVersion` other than `"1"` is `VERSION_MISMATCH`, whatever the rest of the shape. Anything else malformed is `BAD_SCHEMA`.

`apps/server` [app.ts](../apps/server/src/app.ts) is one Fastify instance with Socket.IO attached:
- `GET /health` returns `{ status: "ok" }`.
- Clients send gameplay requests as the `command` event with an acknowledgement. The reply is a `CommandRejected` or, later, a `CommandAccepted`. A request without an acknowledgement is ignored, because there is nowhere to reply.
- Size limit: `MAX_MESSAGE_BYTES` = 16 KiB (Socket.IO `maxHttpBufferSize`). A larger message closes the connection. The largest legal action, a full-board worker allocation, is about 2 KiB.
- `CommandRejected.commandId` is `null` only when a rejected request has no string `commandId`.
- Until sessions exist (PR-041), processing step 1 cannot resolve a player, so every valid request is answered `UNAUTHORIZED`. Nothing reaches the engine.
- `pnpm --filter @vibe-rico/server build && pnpm --filter @vibe-rico/server start` listens on `127.0.0.1:${PORT:-3000}` for local development.

## Room lifecycle and limits — PR-040

[lifecycle.ts](../apps/server/src/rooms/lifecycle.ts) and [limits.ts](../apps/server/src/rooms/limits.ts). Store changes run in the room's serial queue, under the expectedRevision contract.

- **Leaving:** only before start, and only by a seated player. The seat is removed. A departing host passes host to the next seat in join order. When the last seat leaves, the room is removed and its code freed. After start, seats are fixed and leaving is `ILLEGAL_COMMAND`.
- **Closing:** host only (`UNAUTHORIZED` otherwise), before or during a game. It removes the room. Later joins, starts and commands see it as closed (`ROOM_CLOSED`; an unknown code on join stays `ILLEGAL_COMMAND`).
- **Start/close races:** a concurrent start and close always end in the state of some serial order. Either both succeed and the room is gone, or the start sees `ROOM_CLOSED`, or the overlapping write returns `STALE_REVISION`.
- **Disconnection:** changes in-memory presence only. Seats, order and game state are untouched, and the game waits (see "Rooms and recovery" above).
- **Empty-room cleanup:** a room with no connected player for `emptyRoomTtlMs` (default 24 h) is removed. The sweep runs every `sweepIntervalMs` (default 60 s). A room with any connected player is never removed, and a reconnect resets the timer. Presence is fed by the socket layer once sessions exist (PR-041), which also starts the sweep timer.
- **Rate limit:** at most `eventsPerWindow` incoming Socket.IO events (default 20) per connection per `windowMs` (default 1 s). Exceeding it closes the connection, as an oversized message does, so there is no separate error code.

## Credentials and reconnect — PR-041

[tokens.ts](../apps/server/src/sessions/tokens.ts), [reconnect.ts](../apps/server/src/sessions/reconnect.ts), wired in [app.ts](../apps/server/src/app.ts). All Socket.IO events reply on the acknowledgement.

- **`room`** (room request):
  - `create-room` / `join-room` reply `{ ok: true, value: { roomId, roomCode, playerId, token } }`. The token (32 random bytes, base64url) is sent only in this reply. Each seat stores only its SHA-256 `tokenHash`, and the server logs nothing.
  - `start-game` / `leave-room` need the connection's current session for that `roomId`. Otherwise the reply is `UNAUTHORIZED`, or `STALE_SESSION` for a replaced connection.
  - `close-room {roomId}` (host only, user ruling 2026-10-01) removes the room; later commands see `ROOM_CLOSED`.
- **`resume`** `{ protocolVersion, roomId, token }` reclaims a seat. The token must match a seat of that room; anything else is `UNAUTHORIZED`. The reply is `{ ok: true, value: { playerId, revision } }`, with `revision` null before start.
  - **Takeover:** every resume increments the seat's sessionGeneration and makes this connection the only controller. The previous connection receives `session-replaced`, and its later commands and room actions get `STALE_SESSION`. For commands, this is checked inside the room queue (processing step 2).
  - **No gap:** the resume runs as one task in the room queue. It checks the token, takes control, joins the room channel `roomId` (the subscription PR-042 broadcasts on) and reads the revision. So any commit either lands before that read or happens after the connection has joined.
- **`command`:** roomId and playerId come from the session. A missing session, or an envelope `roomId` other than the session's room, is `UNAUTHORIZED`; a mismatched command is never run in the session's room (user ruling 2026-10-01).
- **Presence:** only the current controller's disconnect marks the seat disconnected for empty-room cleanup, so closing a replaced tab doesn't count. The server starts the cleanup sweep every `sweepIntervalMs`. A client that loses its connection resumes, then retries its unacknowledged commandIds; deduplication (PR-039) returns the saved result.

## Player projections and broadcasts — PR-042

[playerView.ts](../apps/server/src/projection/playerView.ts), [playerEvents.ts](../apps/server/src/projection/playerEvents.ts), [broadcast.ts](../apps/server/src/rooms/broadcast.ts).

- **`projectForPlayer(state, viewerId)`** copies each PlayerView field by name; it never spreads GameState. `eventsForPlayer` keeps every event except other players' `vp-earned`.
- **Server → client event `state`:** a `PlayerBroadcast` `{ protocolVersion, revision, view, legalActions, events }` for one seat. `legalActions` is `getLegalCommands` for that seat, so it is empty unless that seat decides.
- **When sent:**
  - After every accepted command, inside the room queue after the store write and before the acknowledgement (step 7), so broadcasts follow commit order.
  - After `start-game` (revision 0, no events), also in the queue.
  - On `resume`, only to the resuming connection, with no events. This is the snapshot for recovery.
- **Who receives it:** a replaced connection leaves the room channel, so each seat's messages go only to its current controller. Rejections stay acknowledgement-only, so other connections never see them.

## Lobby seat list and web lobby — PR-043

- **Server → room channel `room-state`:** `RoomState` `{ roomCode, hostPlayerId, seats: [{ playerId, displayName }], started }`. It is sent after create, join, resume, start and a successful leave. Seats are copied field by field, so `tokenHash` never leaves the server. Display names are public within the room, and PlayerView carries only player IDs, so this is how clients learn names.
- **Web lobby** ([Lobby.tsx](../apps/web/src/lobby/Lobby.tsx)):
  - Connects with `io()`, same origin; in development Vite proxies `/socket.io` to the server on port 3000.
  - `?room=CODE` invite links prefill the code.
  - The seat credential from create/join is kept in localStorage (`vibe-rico.seat`) and resumed on load and on every reconnect. A rejected resume clears it.
  - Browser tabs share localStorage, so a second tab in the same browser resumes, and so takes over, the same seat. By design one controller per seat, so the older tab shows "此座位已在其他窗口中打开" on `session-replaced` and disables its actions.
  - Join errors are distinguished (user ruling 2026-10-01): `ROOM_NOT_FOUND`, `ROOM_FULL` (5 seats) and `GAME_STARTED`, each with its own lobby message. Display names are required: an empty or whitespace-only `displayName` is `BAD_SCHEMA`, and the lobby disables create/join until a name is typed.

## Client state store — PR-044

[gameStore.ts](../apps/web/src/state/gameStore.ts) (Zustand vanilla store) and [commands.ts](../apps/web/src/network/commands.ts).

- **Authoritative state:** `latest` is the last `PlayerBroadcast`. A snapshot replaces it only when its revision is newer, so old or duplicate messages (including the resume snapshot at the same revision) are ignored.
- **Acknowledgements:** they only remove the request from `pending` and record a rejection. State changes arrive only by broadcast, so broadcast-then-ack and ack-then-broadcast give the same result.
- **`STALE_REVISION`:** drops the request without resending or rewriting it (processing step 4). Because the connection is subscribed, the newer snapshot arrives by broadcast.
- **Sends:** `submit` uses `latest.revision` as `expectedRevision`. It is disabled (returns null) while there is no live session or no snapshot yet. The session is live after create, join or resume; the lobby's `onSession` calls `sessionReady()`. A socket disconnect ends it.
- **Retries:** on `sessionReady()` every pending request is resent verbatim, with the original commandId and expectedRevision, so a command whose acknowledgement was lost is deduplicated by the server (PR-039).
