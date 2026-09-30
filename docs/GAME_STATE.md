# State Design Contract

Reconciled to [S3](../references/puerto-rico-1897-special-edition-rulebook-en.pdf) and [RULES.md](RULES.md). PR-005 implements the exported TypeScript interfaces in `packages/game-engine/src/model/`; this document records their transition and validation contract. Building stock follows documented user input PROJECT-003; The implementation rulesetVersion is `1.0.0`, exported with the source hash as `RULESET`.

Key S3 differences: end at phase completion, keep Personal Ship cargo until cleanup, use an estate bag, and preserve standard Factory cost 7 / School cost 8 (alternative cost swap excluded).

## Canonical data

| Model | Required data / purpose |
| --- | --- |
| GameState | schemaVersion, engineVersion, rulesetId, rulesetVersion, sourceHash, gameId, revision, seatOrder, players, governorPlayerId, roundNumber, roleSelectionIndex, roleCards, phase, supply, estateBag, estateDiscard, estateMarket, ships, tradingHouse, rng, endTriggers |
| PlayerState | playerId, integer coins, earnedVp, Countryside tile instances, building instances, idleWorkerCount, goods by type, personalShip (when Wharf owned) |
| CountrysideTile | instanceId, kind (`fruit`, `sugar`, `corn`, `tobacco`, `coffee`, `quarry`), occupied boolean; each uses one Countryside space |
| BuildingInstance | instanceId, buildingTypeId, occupiedSlots; cost, points, footprint, slot capacity, Quarry cap and ability are catalog data, not mutable copies |
| RoleCard | instanceId, kind, accumulatedCoins, selectedBy or null. Adventurer copies have distinct IDs |
| Supply | goods counts, workerCount, workRegisterCount, quarryCount, buildingStock, vpRemaining, vpOverflow. Money is not a finite gameplay supply under PROJECT-001 |
| CargoShip | fixed capacity, goodType or null, loadedCount; null iff empty; distinct occupied ships cannot share a type |
| TradingHouse | list of up to four good types; duplicates possible only through Office sales |
| Estate bag | Hidden seeded permutation simulating bag draws, public market, discard pool. Draw initial market before removing prescribed starting estates. Re-randomize on discard refill |
| PersonalShip | Owned with Wharf; goods type and loaded count, plus usedThisPhase. Loaded goods remain here until Captain cleanup and do not count as unshipped player inventory |
| EndTrigger | reason (`worker-shortage`, `city-full`, `vp-exhausted`), triggering revision, phase and required phase-completion boundary; allow multiple reasons, never erase them |
| FinalScoreBreakdown | playerId, earnedVp, baseBuildingVp, bonuses keyed by scoring building ID, totalVp, tieBreakCoinsAndGoods, rank; shared winners if still tied under SCORE-002 (S3 p.17) |

Store worker counts/positions, not identities: workers have no individual powers in this base game. Preserve finite totals (58/79/100 active workers), but never model Citizens. Keep `earnedVp` inclusive of overflow; `vpOverflow` tracks the global amount beyond the initial scoring supply for accounting, not additional points awarded twice. For an award A, spend min(A,vpRemaining), add the excess to vpOverflow, and add A once to earnedVp.

Coins use unbounded nonnegative integer balances. Accumulated role coins are separate from player balances until selection. Printed denominations do not affect legal choices. Source and project conventions must travel with saved games; Ruleset version 1.0.0 incorporates these resolved decisions.

## Decision and transition states

Every role decision carries actorId, roleChooserId, and actorIndex (clockwise offset from the chooser). Role selection carries only actorId because no role has been chosen yet. Phase-specific data must not leak into unrelated phases. The server supplies actorId from the trusted session. Room create/join/leave/start stays outside GamePhase.

| Phase / substate | Decisions / context | Completion |
| --- | --- | --- |
| role-selection | Current chooser and unused role-card IDs | Collect card coins; enter selected role |
| planter-before | Optional Hacienda use, if occupied and space exists | Hidden draw commits immediately, then normal selection |
| planter-choice | Choose face-up estate, permitted Quarry, or decline | Save IDs of tiles acquired this turn |
| planter-worker | Optional Hospital worker and destination among newly acquired tiles | Next actor; after last actor refresh market |
| recruiter-advantage | Chooser accepts/declines extra supply worker | Deterministically distribute Register to all players |
| recruiter-distribution | Automatic: distribute existing Register clockwise after advantage resolves | Add received workers to each player’s idle pool; empty Register; begin chooser allocation |
| recruiter-placement | Each actor submits complete slot allocation plus idle count | Validate worker conservation and mandatory filling, then next actor; refill Register after last, then score if shortage triggered |
| builder-choice | Choose legal building or decline; chooser accepts/declines discount; optional School worker choice for the purchase | Purchase and optional worker placement are one validated transition; detect full City; finish all Builder actors, then score if triggered |
| craftsman-production | Each actor accepts full available production or declines; actual types produced and optional Factory income | Consume supply in seat order; after last actor enter bonus decision |
| craftsman-bonus | Chooser selects one available actually produced type or declines | Next role chooser |
| trader-choice | Choose a legal good or decline; chooser accepts/declines extra coin; optional market effects | Next actor; clear House only if full at phase end |
| captain-loading | Current actor, Captain bonus-used flag, Wharf-used set, no-load traversal progress, optional Harbor effect | Repeated clockwise visits until all mandatory loads exhausted and optional charter decisions settled |
| captain-retention | Each player submits retained goods and selected Warehouse-protected types | Return discarded goods; after all decisions unload full cargo ships and every Personal Ship; score if triggered |
| adventurer | Chooser accepts or declines the one-coin advantage | Pay if accepted, then complete phase |
| phase-completion | No player decision | Finish role cleanup; if its end trigger exists, score immediately; otherwise next role chooser or round-completion |
| round-completion | No player decision | Only reached without an ending trigger: add role coins and rotate Governor |
| game-over | Immutable score breakdown and shared ranks | Reject all further game commands |

The online allocation order is always clockwise. No negotiation for simultaneous placement or generic `EndTurn` is needed. Automatic steps must terminate at a real decision or game over. One accepted player command plus its deterministic consequences increments revision once and emits an ordered event batch.

## Command intent and validation boundaries

The typed commands below implement these domain intents; the exact discriminants and transition targets are listed in the implementation table:

- ChooseRole: role **card instance** ID, never just a role kind.
- Planter: accept/decline Hacienda; choose tile/Quarry/decline; optional Hospital destination. A hidden draw cannot be undone after reveal.
- Recruiter: accept/decline privilege; confirm full placement. Any player-owned instance reference and worker-slot count must validate against current state.
- Builder: building type, chooser discount acceptance, and optional School usage. Price, stock, discounts, worker source, and end trigger are server-calculated.
- Craftsman: accept/decline full available production, optional Factory use; separate chooser bonus decision after all production.
- Trader: good type plus use/decline chooser advantage and available market bonuses. Client never supplies an authoritative sale price.
- Adventurer: accept/decline one coin; role-card coins were already collected.
- Captain: good and cargo-ship ID, or optional Wharf choice, plus Harbor use if offered; retain goods with optional Warehouse type choices. Load quantity and VP are computed, not trusted from the client.

When an optional effect has no actual result, auto-skip it. Optional ordinary actions still need explicit decline or a forced no-choice transition. Omitted choice fields must not silently choose an outcome with strategic consequences. LegalAction describes bounded choice sets and quantity/allocation constraints rather than enumerating all combinations. applyCommand validates the same rules independently of the UI.

## Visibility and replay

Canonical state stays server-side. PlayerView contains public board, supplies, money, goods and turn data; the owner's earned VP; and permitted legal choices. Other players' earned totals, the draw order, rng and credentials are excluded. Final scoring reveals every player's breakdown. Public shipping history can support deduction of VP; filtering is not a promise against inference.

RNG algorithm/version/state are serializable, use no system time or Math.random, and reproduce setup and discard reshuffles. A server-only replay records sourceHash, rulesetVersion, initial state and accepted commands, including declined effects. Do not store unlimited event history inside GameState. No Map, Set, Date, or class instances in persisted state.

## Invariants

- All ID references exist, ownership is unique, and all quantities are nonnegative integers.
- Countryside ≤12; City footprint ≤12; one building of each type per player; occupiedSlots ≤ catalog slot capacity.
- Goods (including cargo held on Personal Ships), estates, Quarries, buildings and workers satisfy INVARIANT-001/002; active workers exclude unused box pieces.
- After Recruitment confirmation, idle workers imply all available slots filled. Do not impose that condition globally when new unoccupied tiles are acquired later.
- VP remaining + all earned VP = initial VP + overflow; building bonuses are separate.
- Cargo Ship load ≤ capacity; no duplicate cargo type across Cargo Ships; Personal Ships have no capacity/type-exclusivity restriction and clear only at Captain cleanup; Trading House length ≤4.
- Role cards cannot be selected twice per round; actors and choosers match phase progress; all end triggers persist; no role selection or round-end bonus occurs after the triggering phase completes.
- Invalid commands leave state, revision, RNG and events unchanged; game-over cannot return to play.

## Implemented interface boundaries — PR-005

- `state.ts`: readonly component state, closed goods/role/building unions, final scores, role-specific end triggers and `RULESET`. Numeric ranges, positive loaded counts, ownership, unique IDs, capacity and resource conservation require runtime validation in PR-008/009. Readonly types prevent ordinary accidental mutation; they do not freeze runtime objects.
- `phase.ts`: `DecisionPhase`, `AutomaticPhase`, and `GamePhase`. Acquired Planter tile IDs survive until Hospital choice; chooser production types survive all production turns until the late advantage; Captain bonus and consecutive no-load count survive repeated visits. Wharf usage lives only in `PlayerState.personalShip.usedThisPhase`, avoiding duplicate flags.
- `commands.ts`: `CommandByPhase` binds each decision kind to its commands; `DecisionSubmission` preserves that correlation as a mapped discriminated union. `GameCommand` is the engine-wide input union. `LegalAction` describes bounded choices rather than enumerating worker allocations or retention combinations. Neither type replaces runtime validation, trusted identity attachment, or stale-revision handling.
- `events.ts`: canonical ordered semantic events and `GameResult`. Success contains the new state plus readonly events; failure contains only a `RuleError` (rule ID, stable code and message). Event index is zero-based within the accepted revision. Events do not constitute a full state-reconstruction log; replay uses initial state plus accepted commands. Server projection must filter canonical events before exposing them, especially earned VP.

PR-006 adds branded string IDs and strict snapshot serialization; see the storage boundary below. PR-007 fixes the RNG algorithm/version and numeric state layout below. Ruleset `1.0.0` includes PROJECT-001/003 and the documented production interpretation; changing semantics requires a new ruleset version.

All three RoleTurn fields are validated together: actorId must equal the seat at the indicated clockwise offset, and chooser-only decisions require offset0. No `currentPlayer` shortcut determines phase legality. Worker distribution may temporarily leave workers idle before confirmation; the mandatory-filling invariant applies to each completed allocation, not this intermediate state.

## Exact command and transition table

This table is the complete transition contract. PR-013 implements the bounded runner and initial automatic boundaries below; role actions and their remaining automatic steps belong to later tickets. Every `GamePhase.kind` appears exactly once. “Next actor” means the next clockwise seat in the current role, not the next role chooser. All no-effect/forced skips are automatic consequences and emit no fake player command.

| Phase kind | Allowed command kind | Required context / accepted result | Next phase kind |
| --- | --- | --- | --- |
| role-selection | choose-role | actorId; collect chosen card’s coins and mark the selected RoleCard instance with selectedBy | planter-before / recruiter-advantage / builder-choice / craftsman-production / trader-choice / captain-loading / adventurer |
| planter-before | use-hacienda | RoleTurn; accept commits hidden draw, decline takes none; initialize acquiredTileIds | planter-choice |
| planter-choice | plant | RoleTurn + acquiredTileIds; estate instance, Quarry or decline; append acquired IDs | planter-worker |
| planter-worker | use-hospital | RoleTurn + acquiredTileIds; new tile ID or null, at most one worker from supply then Register | planter-before for next actor; otherwise phase-completion |
| recruiter-advantage | recruit-worker | chooser RoleTurn; accept/decline one supply worker | recruiter-distribution |
| recruiter-distribution | none — automatic | roleChooserId; distribute all Register workers clockwise into idle pools once | recruiter-placement |
| recruiter-placement | allocate-workers | RoleTurn; complete owned tile/slot allocation and idle total; no allocation cross product | recruiter-placement for next actor; otherwise phase-completion |
| builder-choice | build | RoleTurn; null declines, purchase explicitly selects building, advantage and School | builder-choice for next actor; otherwise phase-completion |
| craftsman-production | produce | RoleTurn + chooserProducedTypes; decline or full output with explicit Factory choice; retain chooser’s actual types | craftsman-production for next actor; otherwise craftsman-bonus |
| craftsman-bonus | take-production-bonus | chooser RoleTurn + chooserProducedTypes; available produced type or null | phase-completion |
| trader-choice | trade | RoleTurn; null declines, sale explicitly selects good, advantage and both market bonuses; duplicate sale implies Office use | trader-choice for next actor; otherwise phase-completion |
| captain-loading | load / decline-wharf | RoleTurn + captainBonusUsed + consecutiveNoLoads; shipment selects cargo ship or Personal Ship, good and Harbor choice; quantity is calculated | captain-loading cyclically; captain-retention after one full no-load traversal |
| captain-retention | retain | RoleTurn; counts retained and Warehouse types; no shipping state resets until cleanup | captain-retention for next actor; otherwise phase-completion |
| adventurer | take-adventurer-coin | chooser RoleTurn; explicit accept/decline, card coins already collected | phase-completion |
| phase-completion | none — automatic | role + roleChooserId; perform role cleanup below exactly once, then inspect latched triggers | game-over if triggered; otherwise role-selection or round-completion |
| round-completion | none — automatic | reachable only without end trigger; add unchosen role coins, release selected cards, rotate Governor | role-selection |
| game-over | none — terminal | immutable score breakdowns and ranks | none; all commands fail GAME_OVER |

Phase cleanup: Planter discards/refills the market; Recruiter refills the Register and detects shortage; Trader clears only a full House; Captain unloads full Cargo Ships and all Personal Ships and resets personal-use flags. Builder’s City trigger is detected on purchase, but waits for this boundary; Captain’s VP trigger similarly waits through loading and retention. Craftsman/Adventurer have no additional cleanup. Completing the triggering phase skips all remaining role selections and round-end bonuses.

At entry to an unavailable optional ability or an actor with no legal ordinary action, automatic advancement follows the same table without offering a command. `decline-wharf` is legal only when there is no mandatory cargo load and the actor has an optional unused charter; otherwise a no-load skip is automatic. Successful loads reset consecutiveNoLoads to0; skips/eligible declines increase it, and N consecutive no-load visits end loading. A failed command changes neither state nor RNG, revision or events. One accepted command and its complete automatic chain form one revision; automatic intermediates never receive external commands.

## Verification scope

`test/model.test.ts` is compiled by `tsconfig.test.json` before Vitest runs. It has positive assignments, negative `@ts-expect-error` checks for malformed phase/command data, correlated submissions, and an exhaustive phase-kind switch. The separate test config prevents tests from entering published build output. `pnpm test` no longer permits an empty suite. These tests establish interface constraints and representative plain-data shapes only; they do not validate gameplay transitions, numeric invariants, network security, or versioned snapshot parsing.

## IDs and snapshot storage — PR-006

`createId(kind, value)` accepts a nonblank string without trimming or generating a new value. GameId, PlayerId, TileId, BuildingId, RoleCardId and ShipId are distinct compile-time brands across state, commands, phases and events. `Good`, `Role`, `BuildingType` and `ScoringBuilding` remain closed semantic type-ID unions. Brands disappear in JSON; the decoder restores their types only after validating the stored string. Callers ensure uniqueness; physical tile/building/card/ship instance IDs share a global namespace, while player IDs and seat IDs are checked for duplicates within their lists. References to an existing ID are not new instances.

`serializeGame(state): string` validates before writing. `deserializeGame(json): GameState` parses and validates every required field, rejects unknown fields rather than silently discarding them, and returns a detached plain-data state. Both throw `SnapshotError` with `INVALID_SNAPSHOT` or `UNSUPPORTED_VERSION` and a field path. There is no migration or best-effort coercion.

Accepted metadata is exact: schemaVersion `1.0.0`, engineVersion `0.0.0`, rulesetId `puerto-rico-1897-special-edition-base-en`, rulesetVersion `1.0.0`, and the pinned S3 source hash. Missing/non-string metadata is invalid; a nonblank but unsupported value is an unsupported version. The engine version matches the engine package version; future compatibility/migration changes must update the explicit policy and fixtures, not silently accept a different engine version.

All 17 phase shapes and their required progress fields are checked. Component counts are nonnegative safe integers, rounds/ranks are positive, cargo is either null/zero or a known good with positive count, and goods/building/bonus records require every known key. The decoder rejects duplicate physical IDs across bag, discard, market, owned tiles/buildings, role cards and ships, plus duplicate player/seat IDs. It validates the RNG algorithm/version and all four state words through PR-007’s shared validator.

This is a **storage-shape boundary**, not proof of legal play. PR-008 must validate references, ownership, player counts, phase/seat consistency, capacities and component conservation before a restored state is used by the engine. No room credentials or networking schema belong in these snapshots. Tests deliberately include synthetic storage fixtures rather than claiming they are complete legally played games.

## Reproducible randomness — PR-007

`seedRng(seed)` accepts an unsigned 32-bit integer, including0. It returns `{ algorithm: "xoshiro128ss", version: "1", state: [a,b,c,d] }`. The four words are unsigned32-bit integers and cannot all be zero. `validateRng(unknown)` validates and copies this shape. Snapshot read/write uses the same validation and rejects incompatible algorithm/version metadata; the earlier provisional PR-006 RNG placeholder is intentionally unsupported.

The generator follows [Blackman and Vigna’s xoshiro128**1.1](https://prng.di.unimi.it/xoshiro128starstar.c). Seeding runs [SplitMix64](https://prng.di.unimi.it/splitmix64.c) twice from the zero-extended numeric seed, taking low32/high32 words of the first result followed by low32/high32 of the second. BigInt is used only inside seed expansion; saved state contains ordinary JSON numbers. Version1 covers this complete seed expansion, output step, bounded sampling and shuffle order. Any change to those semantics requires a new RNG version and explicit snapshot compatibility decision.

`nextUint32(rng)` returns `{ value, rng }` with a value in0…4294967295 and fresh state. `randomInt(rng, upperExclusive)` accepts bounds1…4294967296 and rejects draws at or above `floor(2^32 / bound) * bound` before reducing modulo the bound, avoiding modulo bias. Rejected draws still advance the returned RNG state. Bound1 consumes a draw.

`shuffle(rng, items)` returns a new array and state, using descending Fisher–Yates with an unbiased index in0…i on each iteration. Empty and singleton arrays consume no draws. Inputs are never mutated; repeated values and object references are preserved. This generator is for deterministic gameplay, not session tokens or room credentials. It never reads the clock or global randomness.

Independent literal vectors for seeds0,1,4294967295 were calculated with a separate Python integer implementation of the published reference operations before implementing the TypeScript generator. Tests cover expanded seed words, five outputs/final state, exact shuffle order, a three-rejection bounded-draw case, unchanged frozen inputs, duplicate-element identity and continuation through the full game snapshot boundary. Statistical tests are not substituted for exact reproducibility checks.

## Snapshot invariants — PR-008

`assertGameState(state): void` first reuses PR-006's `validateSnapshot` for strict shape, versions, scalar ranges, unique IDs and RNG validation, then checks the rules below without mutating the input. Shape failures remain `SnapshotError`; gameplay consistency failures throw `InvariantError` with a rule ID and diagnostic detail. Snapshot decoding remains a storage boundary: callers must run this assertion before using a restored state for play. Later command/setup tickets will call it at their stable boundaries.

The round cursor is now explicit: `roleSelectionIndex` is the zero-based offset from the Governor of the current or next chooser, always0…N−1. In `role-selection`, exactly that many cards have selectedBy set. During a role, phase cleanup, game-over, and round completion, exactly index+1 cards are selected. Round completion uses index=N−1; it resets the cursor to0 only when entering the next round. Selected players are precisely the clockwise prefix from the Governor, each selecting once; selected cards have already paid out their accumulated coins. Active phase kind must match the current chooser's selected card.

The assertion verifies:

- Exactly3–5 distinct players matching the seat list; valid Governor, chooser/actor offset, selected-card ownership, acquired-tile ownership, unique produced types, phase cursor and bounded Captain no-load count.
- Player-count-specific role cards and cargo capacities; City/Countryside limits, unique owned building types, building worker slots, Trading House/estate-market capacities and cargo type exclusivity.
- Per-good and per-estate totals, eight Quarries, per-type building stock (PROJECT-003), and active worker totals58/79/100. Cargo on Personal Ships participates in the goods ledger. The minimal building table contains only stock, worker capacity and footprint; costs/ability catalog remain PR-026.
- Personal Ship presence exactly when Wharf is owned; loaded cargo and its used flag agree; use requires an occupied Wharf during Captain. Full communal ships are unloaded before Captain game-over, while partial cargo persists.
- Register empty throughout Recruiter placement. Earlier confirmed players must fill available slots before leaving idle workers; the current/later actors need not have confirmed yet. All players satisfy this at Recruiter cleanup and a Recruiter ending. Idle workers alongside later-acquired empty slots are permitted outside that boundary.
- Earned VP plus remaining supply equals initial supply plus overflow; overflow requires exhausted supply. Building base/bonus scores do not enter this ledger. Triggers cannot precede their condition, reference the future, or cross a role boundary; City12 and empty VP supply require their matching trigger. Recruiter shortage means supply0 and Register below the requested refill, not merely an empty bank of workers.
- Game-over requires a trigger from the final chooser's role and one score entry per player, with matching earned VP, arithmetic totals and in-range ranks. Computing building bonuses, tiebreak order and final ranks belongs to PR-033.

This checks a single snapshot, including documented automatic intermediate phases. It cannot establish historical reachability, whether a tile was actually acquired on this turn, that a trigger was never erased, or that a rejected command preserved its input. Those are transition/replay tests in PR-009 onward. No role execution, setup routine, or generic rule framework was added.

## Command entry points — PR-009

`applyCommand(state, command): GameResult` and `getLegalCommands(state, playerId): LegalAction[]` share `inspectDecision`, which runs state invariants and identifies the trusted decision-maker. Invalid engine state throws its existing snapshot/invariant error; it is not misreported as an invalid player choice. The internal `GameCommand` actor ID must be attached by the server as described in PROTOCOL.md.

Role selection is implemented in PR-011. For other known, phase-matched commands by the current actor, applyCommand returns `{ ok: false, error: { code: "UNSUPPORTED_PHASE", ruleId: "ROLE-001", ... } }`. Legal-action lookup for that same active actor throws `DispatchError` with the identical error record, rather than claiming that an unimplemented turn has no legal choices. Nonactors (including unseated IDs), automatic phases, and game-over return an empty legal-action list.

Error precedence is deterministic: corrupt state throws first; game-over returns GAME_OVER; automatic phases return WRONG_PHASE; malformed command identity or an unknown action returns UNKNOWN_COMMAND; a known action from the wrong actor returns WRONG_ACTOR; a known action incompatible with the current decision returns WRONG_PHASE; otherwise the unimplemented handler returns UNSUPPORTED_PHASE. There is no generic pass, silent role completion, RNG draw, revision bump, or success result. Rejections contain no replacement state or event batch and preserve the input command/state.

The phase/command routing table is checked against `CommandByPhase`. PR-011 onward will add actual role validation and execution behind the shared decision gate; payload/resource validation remains mandatory in those handlers, even when an action was advertised by getLegalCommands. This ticket validates the command identity, not every future action payload, and does not replace transport schema validation. PR-013 now chains implemented automatic steps after successful commands.

## Deterministic setup — PR-010

`createGame({ rulesetId, gameId, seatOrder, governorPlayerId, seed }): CreateGameResult` now constructs a complete initial state. IDs use the PR-006 brands; seats are fixed in clockwise order and the Governor must be one of them. The caller chooses the Governor explicitly. Seed is an unsigned32-bit integer, including0. No accounts, room commands, automatic seat randomization, or default Governor are introduced.

Success uses the existing GameResult shape: `{ ok: true, state, events: [] }`, at revision0, round1, cursor0, awaiting the Governor’s role selection. Invalid player counts, duplicate/blank IDs, missing Governor membership or invalid seeds return INVALID_SETUP; a different ruleset returns UNSUPPORTED_RULESET. Internal configuration/invariant faults throw rather than masquerading as user mistakes. Inputs are unchanged, and each invocation owns fresh arrays and resource records.

Setup consumes exactly one PR-007 shuffle of50 estate instances in this fixed initial order: Corn10, Fruit12, Sugar11, Tobacco9, Coffee8, with one-based IDs `estate-<good>-<ordinal>`. Draw N+1 market tiles from the front, then take the first remaining matching estate for each prescribed starting type clockwise from the Governor. Preserve the supplied seat/player order even when the Governor is not its first member. Keep the remaining bag order and advanced RNG state; assigning starts consumes no additional random draws. Physical IDs are deterministic and unique within a game, not global across games.

`setup/config.ts` contains setup quantities only: player-count resources, goods/estates, initial building stock, and base role kinds. It does not implement the later building-cost/ability catalog. S3 and PROJECT-003 remain the provenance. Every constructed state passes assertGameState before return. Exact initial resources, seed0 market/starting instances/RNG, nonfirst Governor, independent game data, invalid inputs and snapshot recovery are tested. Role selection is implemented by PR-011 below.

## Role selection — PR-011

During role-selection, getLegalCommands returns the chooser’s available role-card instance IDs. applyCommand uses the same eligibility function, rejecting occupied/nonexistent/malformed card IDs with ILLEGAL_CHOICE / ROUND-001. Cards that would exceed safe integer coin/revision storage are excluded consistently from both paths. Other players receive no choices and cannot select. A repeated selection while the role is active returns WRONG_PHASE.

Success marks only the selected card, transfers all its accumulated coins to the chooser and clears those coins, increments revision once, and initializes the exact role entry phase from the transition table. Actor and chooser are the selecting player, actorIndex0; Craftsman starts with no produced types and Captain starts with unused bonus and no-load count0. Other resources, RNG, Governor and round cursor stay unchanged. Optional advantages are not consumed or granted on selection.

Events are ordered role-selected, coins-changed when the card held a positive amount, then phase-changed, all at the new revision with contiguous zero-based indexes. The resulting state passes invariants; the old state is not mutated. PR-013 appends automatic events within that same revision: selecting Planter without a usable Hacienda now advances from planter-before to planter-choice. Role actions remain unimplemented; there is no temporary skip command.


## Round rotation — PR-012

Internal `advanceAfterRole(state)` accepts phase-completion only after the caller has finished role-specific actions and cleanup. It advances the chooser clockwise from the Governor using seatOrder and roleSelectionIndex, independently of the role’s last actor. After the final chooser it enters round-completion without paying bonuses yet.

Internal `advanceRound(state)` accepts round-completion, adds one coin to each unchosen card, clears all selections, rotates Governor one seat clockwise, increments roundNumber and resets roleSelectionIndex to0. The new Governor is the next role-selection actor. Both helpers validate input/output, preserve their inputs and RNG, and reject pending end triggers; scoring must occur instead of rotation. Unsafe round/coin increments also reject.

These helpers are not exported from the package entry point and are not player commands. They preserve revision and do not emit events: PR-013 now chains automatic steps and aggregates events under the accepted command’s single revision. Role-specific cleanup remains with the role implementations. Tests use explicit completion signals to verify two-round chooser and bonus sequences for3/4/5 players; they do not claim complete legal games.

## Automatic progression — PR-013

Internal `advanceAutomatic(result)` runs after a command handler succeeds. The handler increments revision once; automatic steps preserve that revision and append events with contiguous indexes. Failed commands bypass progression. The runner validates every intermediate state, rejects unchanged snapshots or changed state/event revisions, and limits a chain to128 iterations. It stops before invoking another step at game-over. An automatic phase cannot masquerade as a player decision; PR-016 allows one explicit pending Builder scoring boundary at `phase-completion` after a City-full trigger until PR-032/033 implement the terminal transition.

A single phase switch implements the currently available boundaries:

- Skip Hacienda when unoccupied/absent, Countryside is full, or both hidden estate pools are empty; do not draw or accept a usable ability automatically.
- Skip a Craftsman bonus with no available actually produced type, then finish the role.
- Advance completed Builder, Craftsman and Adventurer phases without end triggers; these roles require no additional cleanup.
- Chain round completion through PR-012, preserving RNG and paying only unchosen cards.

Other unimplemented roles' decisions remain at their role-handler boundary; PR-014 handles ordinary Planter no-action checks, PR-015 handles Planter cleanup, and PR-016 handles basic Builder choices. Recruiter/Trader/Captain cleanup and Register distribution return UNSUPPORTED_PHASE; pending City-full Builder scoring stops explicitly at `phase-completion` rather than returning game-over or granting another round. PR-032/033 must complete scoring. Later handlers must route their successful results through this runner and extend the same switch for their automatic steps. No generic pass or public runner API is added.

The optional internal step callback allows tests to inject no-ops, cycles, failures and synthetic terminal transitions without adding player commands or pretending full roles are implemented. Tests also exercise real setup/selection for3/4/5 players, exact event order, optional-choice preservation, frozen inputs and consecutive completion/rotation boundaries.

## Ordinary Planter choice — PR-014

`roles/settler/chooseTile.ts` uses the frozen `planter-choice` domain phase; the legacy directory name does not change rule terminology. `availablePlantingChoices` supplies the same eligible face-up estate IDs, conditional Quarry choice and explicit decline used by `chooseTile`. The chooser can always take an in-stock Quarry while other actors require an occupied Builder’s Yard. A full Countryside offers only decline; hidden-bag exhaustion does not remove already visible estates or Quarries. Reject malformed, stale, unavailable, or unauthorized choices without resource, RNG, revision or event changes.

An accepted estate moves from market to Countryside; a Quarry reduces supply and receives a deterministic unused instance ID. The tile is unoccupied; record it alongside previously acquired Hacienda tiles for the later Hospital decision. Decline acquires nothing. Emit `tile-placed` (if applicable) then `phase-changed` at one new revision; automatic steps append subsequent phase changes without incrementing it. Earlier actors with no selectable tile skip the ordinary choice automatically; without a usable Hospital they proceed clockwise to the next actor. An available Hospital remains a decision. PR-015 now advances the final actor without an available Hospital step to automatic phase completion and refills the market before leaving the role. Hacienda/Hospital effect execution belongs to PR-028.

## Planter completion and estate refill — PR-015

After the final actor finishes their tile choices and has no usable Hospital decision, automatic progression enters `phase-completion` once. `roles/settler/complete.ts` appends leftover face-up market tiles to the existing discard pool, draws up to N+1 replacements from the front of the hidden bag, and reshuffles that pool with the versioned RNG only when the bag runs out before the market is full. Recycled tiles are drawn from the shuffled order; no placed estates or Quarries are reclaimed. If fewer than N+1 unplaced estates remain, reveal only those available, including zero. An exactly sufficient bag leaves discards untouched and RNG unchanged.

Cleanup preserves revision and emits no hidden-order event. The automatic runner then advances to the next role chooser, or completes the round with PR-012 after the last chooser, appending contiguous phase-change events within the accepted command’s revision. No additional player decline or direct role-skip command is needed when the final actor has no legal tile option. An actual optional Hospital destination remains a player decision for PR-028; no worker is placed by this ticket. The N5 controlled C,F,S,T,Coffee,F refill,2/0 exhaustion,3/4/5-player round boundaries, state invariants and snapshot recovery have executed tests.

## Basic Builder purchases — PR-016

`roles/builder/build.ts` contains only the base building costs, Quarry caps, and City footprints needed for purchases. The complete catalog of printed values/base VP/abilities remains PR-026. Shared `availableBuilds` advertises affordable, in-stock types not already owned by the actor, respecting one/two-space City limits, occupied Quarries capped by type, and the optional one-coin chooser privilege. Each offer has a computed price and `schoolChoices:[false]` until PR-029 implements School. An actor may explicitly decline; no-purchase actors auto-skip unless a City-full trigger is pending.

A purchase spends max(0,listed cost−capped Quarries−accepted chooser discount), places a uniquely identified unoccupied building, reduces stock, and emits building/coin/phase events under one accepted revision. Wharf ownership initializes an empty Personal Ship as required by the state invariant; its shipping ability is not active without a worker and PR-030A. A City reaching12 immediately latches a `city-full` trigger and emits `end-triggered`. Remaining Builder actors retain their decisions, including explicit declines when no purchase is affordable. After the final actor, the game remains at the explicit `phase-completion` pending scoring boundary rather than fabricating results, rotating the Governor, or skipping the rest of this role. PR-032/033 will turn that pending boundary into game-over and scoring. Invalid purchases change nothing; rejected School use does not place a worker.


## Recruiter advantage and distribution — PR-017

`recruit-worker` accepts an explicit boolean from the Recruiter chooser. Shared eligibility advertises decline and, when supply has workers, acceptance. Accepting moves one supply worker to the chooser’s idle workers before entering recruiter-distribution; declining does not move a worker. Empty supply automatically skips the unavailable advantage on role selection. Malformed, unavailable and unsafe-revision choices reject without changing state.

Automatic distribution empties the Work Register into players’ idle workers clockwise from the chooser, using seatOrder rather than player storage order. Each receives floor(R/N), with one extra for the first R mod N players. Existing occupied and idle workers are preserved. An empty Register still advances to recruiter-placement with the chooser first; supply exhaustion alone does not trigger game end here.

Emit the advantage worker event when accepted, then the distribution phase event, positive Register gains in clockwise order, and the placement phase event. All share the accepted command’s revision and contiguous event indexes; RNG is unchanged. Placement validation, later actors and Register refill remain PR-018.


## Recruiter placement and completion — PR-018

`allocate-workers` submits every owned Countryside tile and building exactly once, including unoccupied slots, plus idleCount. Legal descriptors give total workers and each slot’s capacity. Validation rejects foreign/missing/duplicate slots, invalid counts, overcapacity, changed worker totals, and idle workers while any slot is empty. Existing workers may move. Each accepted confirmation replaces only that player’s placement, emits workers-allocated followed by phase-changed, and advances clockwise from the chooser under one new revision.

The last confirmation runs Recruiter completion once before automatic rotation: count empty building slots only, request max(player count, empty building slots), and move available supply workers to the Work Register. Exact supply is sufficient; a shortage latches worker-shortage at the accepted revision and emits end-triggered. Like Builder, a triggered phase remains at phase-completion pending PR-032/033 scoring, without role selection or round bonuses. Otherwise automatic role/round rotation continues. Allocation confirmations remain explicit even with zero workers; there is no generic reassignment outside Recruitment. Shared capacity facts come from the existing invariant table pending the complete building catalog.


## Craftsman production and bonus — PR-019

Production eligibility computes each good from occupied estates, occupied matching processing slots (summed across buildings), and current supply. Corn needs only its estates. `produce` accepts exactly whole-action decline or full production with useFactory:false; per-good quantities and Factory use are rejected until their specified implementation. Every actual crate transfers from supply to the actor, with goods-moved events in Corn/Fruit/Sugar/Tobacco/Coffee order, then phase-changed. Workers and RNG remain unchanged.

Actors proceed clockwise; each sees the supply left by earlier actors. Zero-output actors automatically advance without an invented player command. The chooser’s actual production types are recorded separately from old inventory. Only after all actors finish does craftsman-bonus offer null (decline) and still-available types from that record. No eligible type automatically completes the phase. Accepted bonus/production and all automatic consequences share one revision with contiguous event indexes, including role/round rotation. Numeric revision exhaustion rejects without changing state. Factory payouts remain PR-027.


## Base trading and clearing — PR-020

`trade` accepts null to decline or one owned good with explicit privilege choices. Shared eligibility requires a free Trading House slot, no matching House good, and safe coin arithmetic. Base prices are Corn0/Fruit1/Sugar2/Tobacco3/Coffee4; only the chooser may accept the additional coin. Small/Large Market choices must be false until their M4 implementation; Office duplication is likewise deferred. Sales transfer one crate, pay the exact price (including legal zero-price Corn), and advance clockwise. Invalid payloads, quantities and unavailable options reject without changing state.

Actors with no sale automatically advance. At Trader phase completion only, a full House returns all four crates to supply, emitting goods-moved events before the next role-selection event. Partial House contents persist. One accepted command and all automatic skips, cleanup and rotation share one revision and contiguous event indexes; RNG stays unchanged.

Trader legal descriptors expose exact `sales` combinations (good, privilege/market flags, price), replacing independent good/effect lists. This preserves eligibility when only some privilege combinations fit numeric coin limits.


## Adventurer income — PR-021

`take-adventurer-coin` accepts an explicit boolean from the chooser only. Shared eligibility offers decline and, when the coin increment fits safe integer storage, acceptance. Acceptance pays one coin; decline preserves coins already collected from the role card. The command enters phase-completion immediately, with no other player action, then uses existing automatic role/round rotation. Events are optional coins-changed followed by phase changes, all under one new revision. Invalid choices or exhausted revision storage reject without mutation; RNG and supply are untouched. Separate Adventurer card instances remain independently selectable in4/5-player games.


## Cargo-ship eligibility — PR-022

Internal `cargoShipOptions(goods, ships)` returns legal cargo shipments with their required quantities. Inputs are taken from an invariant-validated state. For each owned good, its matching ship is the sole candidate, including when full (then no load is possible). Without a matching ship, only empty ships qualify; retain those maximizing min(owned crates, free holds), preserving ties. Maximization is per good, so players may choose a different good with fewer crates.

`findCargoShipOption` reuses the same list to validate good/ship selection and supply the mandatory load quantity. Neither helper mutates inputs or handles Personal Ships. PR-023 will connect them to legal-action descriptors and shipping execution; no partial-load or skip command is introduced here.


## Captain loading and traversal — PR-023

Cargo `load` uses PR-022’s shared options and mandatory quantity. Legal descriptors advertise those loads and harborChoices:[false]; Harbor use, explicit quantities, arbitrary pass and malformed selections reject. A valid load transfers goods from the actor to the selected ship and emits goods-moved, then phase-changed. PR-024 now awards VP and the chooser bonus before advancing the actor.

Each load resets consecutiveNoLoads and advances clockwise. When no cargo load or eligible optional Wharf decision exists, the automatic runner skips the visit. A complete no-load traversal enters captain-retention with the chooser first, without unloading ships or rotating roles. PR-025 now implements retention and cleanup. All automatic transitions retain the accepted revision and contiguous event indexes, preserving RNG and inputs.

An occupied, unused Wharf with owned goods stops automatic skips. With no mandatory cargo load, the actor may decline it; declining counts as a no-load visit, and an intervening load allows re-evaluation on the next cycle. Wharf refusal cannot bypass mandatory cargo. This is the PR-030A integration point: Personal Ship execution explicitly returns UNSUPPORTED_PHASE, and Personal Ship loads are not yet advertised. Numeric revision exhaustion blocks commands without turning an otherwise mandatory load into an automatic skip.


## Shipping points — PR-024

Internal `awardShipping` runs only after a positive load, before actor rotation. It grants one VP per crate plus one for the chooser’s first actual load, setting captainBonusUsed only on that chooser award. Nonchooser loads, skips and declined Wharf decisions never consume it. Earned VP includes all points even after chips run out; vpRemaining floors at0 and vpOverflow accumulates the portion of each award exceeding the remaining supply.

Reaching0, including exact exhaustion, latches one vp-exhausted trigger at the accepted command revision. Further loads preserve that trigger and continue scoring; shipping still proceeds through all remaining visits to retention. Cleanup/scoring remain later tickets. Event order is goods-moved, vp-earned, optional end-triggered, then phase transitions, with contiguous indexes under one revision. These are existing canonical server-only events containing award deltas, not cumulative hidden score fields; public projection remains PR-035/042.


## Captain retention and cleanup — PR-025

`retain` supplies all five nonnegative integer goods counts, each within owned inventory and totaling at most one, with warehouseTypes:[] until M4. Retaining zero is permitted. Every unretained crate returns to supply with goods-moved events; the next retention actor follows clockwise from the chooser. Empty inventories automatically advance. Legal descriptors expose owned counts, base allowance1 and maxWarehouseTypes0. Invalid choices preserve state; revision exhaustion blocks submission.

After the last retention actor, cleanup unloads full communal cargo ships and clears their types. Partial cargo remains. The Personal Ship reset hook returns held cargo and clears its used flag; end-to-end Wharf integration remains PR-030A. Cleanup never reopens loading. With no trigger, normal role/round rotation follows. With a trigger, the cleaned phase-completion state remains pending PR-032/033 scoring; another automatic check does not emit duplicate cleanup events. All effects stay within the accepted command’s revision.


## Shared building catalog — PR-026

`buildings/definitions.ts` contains23 frozen definitions keyed by BuildingType, with stable BUILDING rule IDs, cost, baseVp, footprint, workerSlots, quarryCap and stock. Printed values follow the reconciled canonical S3 table; BUILDING_STOCK_SOURCE explicitly identifies PROJECT-003’s user-supplied multiplicities. The catalog does not implement or activate abilities.

Builder purchase prices/footprints, setup stock and invariant capacity/conservation checks consume this single catalog. The existing workerCapacity accessor reads it for Recruiter logic. Independent literal tests cover all23 tuples and the20 production +24 regular commercial +5 expanded stock total. No state or snapshot schema changes are required.


## Economic abilities and Office — PR-027 / PR-027A

`isBuildingActive` checks ownership and occupied worker slots. Trading now enumerates exact combinations of optional Small Market (+1), Large Market (+2) and chooser (+1) bonuses. Advertised offers and execution share eligibility and safe coin arithmetic; declining a bonus changes only its income, not the sale.

Factory choices depend on activation, actual available production and safe coin arithmetic. Accepting Factory grants0/0/1/2/3/5 coins for0/1/2/3/4/5 produced types, after goods transfers and before phase advancement. Old stock, unavailable production and whole-action decline do not contribute. The chooser’s later bonus crate never invokes Factory again. Event indexes remain contiguous under the accepted revision.

An occupied Office permits a matching good already in the Trading House. The shared check still requires a free slot; it neither creates a second action nor permits a fifth crate. Full-House cleanup returns each copy to supply at phase end. Declining the ordinary sale remains available.


## Settlement abilities — PR-028

Shared settlement eligibility drives legal choices and automatic skipping. `use-hacienda` accepts or declines before normal planting. Acceptance immediately removes and places the next hidden estate, recycling/shuffling the discard pool only when the bag is empty, preserving the face-up market. It records that new tile for Hospital, then recalculates ordinary planting space. No hidden identity choice or post-reveal rejection exists.

Builder’s Yard uses shared occupied-building activation to permit an ordinary nonchooser Quarry; it grants no extra tile or Hacienda Quarry. `use-hospital` chooses null or one unoccupied tile acquired during this actor’s current planting turn. The worker comes from supply first, then Register; with neither available there is no worker choice. Acceptance emits workers-received and a full workers-allocated snapshot, then finishes the actor’s turn, preventing a second placement. Decline also finishes the turn. Both acquired tiles remain eligible after Hacienda plus normal planting, but at most one receives a worker.

Automatic progression and explicit Hospital completion share the same next-actor transition, including final Planter refill/rotation. Every accepted decision and its automatic consequences use one revision with contiguous events. Existing tiles, other actors and input state are preserved; hidden draws consume RNG only when discard recycling requires a shuffle.


## School construction ability — PR-029

School purchase choices use the buyer’s pre-purchase board: an occupied School and an available worker permit useSchool:true. Supply is preferred; only an empty supply allows a Register worker. Accepting spends exactly one worker and creates the new building with occupiedSlots1 regardless of its capacity. Declining leaves it empty. A newly purchased School cannot grant itself a worker.

The building-built event contains the final occupied slot count, followed by any coin payment and a workers-received source event. Existing City triggers and actor advancement follow under the same revision. Base prices, Quarry caps and chooser discounts are unchanged; absent/inactive School or exhausted worker sources cannot grant workers.


## Warehouses, Harbor and Wharf — PR-030 / PR-030A

Retention now derives maxWarehouseTypes from occupied Small/Large Warehouses (1+2, stacking to3). Protected selections must be distinct, known, owned goods within that capacity; retained quantities cannot exceed inventory. At most one retained crate may lie outside the protected types. Selecting fewer or no types declines some or all storage benefits. Storage never authorizes skipping mandatory loading.

Captain legal descriptors now advertise cargo and eligible Personal Ship loads, plus optional Harbor use. A Personal Ship load moves all owned crates of the chosen type to the actor’s token and marks it used. It can replace a legal cargo load, but declining Wharf is allowed only when cargo loading is impossible. Personal cargo stays separate from supply until final Captain cleanup, which returns it and clears the used flag. Existing cyclic no-load and optional-decision handling is unchanged.

Occupied Harbor adds one optional VP to each actual cargo or Personal Ship load. It combines with the chooser’s once-per-phase bonus and participates in the same supply/overflow/end-trigger accounting. No empty or rejected load awards points. Tests cover storage totals, valid/invalid charters, combined bonuses and exact cleanup conservation.


## Endgame completion (PR-032)

PR-032 supersedes the earlier pending `phase-completion` descriptions above. Existing role handlers record irreversible City-full, worker-shortage and VP-exhaustion evidence, including each triggering revision. Remaining Builder decisions and Captain loading/retention still run; Recruiter refill and Captain unloading finish before the internal `scoring/endgame.ts` boundary enters `game-over`. No further role selection, Governor rotation or unchosen-role coin awards occur. The final accepted command owns the terminal event's revision; automatic completion adds no revision.

PR-033 now completes scoring at this boundary; it removes PR-032's temporary `scores:null` representation. Every terminal snapshot requires a complete score array. After cleanup, `completeGame` calculates scores and emits `phase-changed` followed by one `game-scored` event, under the final accepted command's revision. Terminal states expose no legal commands and reject every game command with `GAME_OVER`.

## Final scoring (PR-033A/B/033)

The five pure building calculators use the shared activation check. Only the scoring building needs a worker; counted buildings and Countryside tiles need no workers. Fire Station counts the six explicit production types at small/large weights; Residence counts tile presence including Quarries; Fortress counts all workers including idle; Customs House counts earned VP including overflow, excluding building VP; City Hall counts commercial tiles once, including itself.

Public `calculateFinalScore(state)` returns fresh breakdowns in seat order without modifying the input or consuming VP supply. It uses shared printed base VP for every owned building, including inactive ones, and itemizes all five bonuses. Rank is one plus the number of strictly better players, ordered by total VP then coins plus crates in player inventory after cleanup; ties share rank (for example 1,1,3). Cargo and building points never enter the tiebreak. Numeric totals must fit safe integer snapshot storage. Terminal score calculation and command continuation are deterministic; final scores serialize with the complete snapshot. Full-game histories/replay remain PR-034/036.
