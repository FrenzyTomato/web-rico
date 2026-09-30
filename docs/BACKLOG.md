# Dependency-ordered Engineering Backlog

PR-001's original source audit is complete. The user subsequently designated the local 44-page Special Edition rulebook (S3) as canonical; see [reference policy](../references/README.md). PR-002 is DONE against S3 with user-supplied building stock recorded as PROJECT-003; PR-003 is DONE. PR-004 and PR-005 are DONE; PR-006–035, PR-027A, PR-030A and PR-033A/B are DONE; PR-036 is READY. V1 remains the 3–5-player base game; deterministic setup, role selection, round rotation, base role mechanics and the building catalog are implemented; all23 building abilities and final scoring are implemented; headless controls and replay are implemented; full-game fixtures and application packages remain pending.

**Status:** READY means available to start; IN_PROGRESS means work has started (including awaiting a documented decision); WAITING means dependencies remain incomplete; DONE requires recorded acceptance evidence. PR-number dependencies must not be skipped. Tasks are topologically ordered; PR-004 can proceed independently.

**Scope:** Each ticket covers only its title and acceptance criteria, not adjacent roles, UI polish, or refactoring. Listed files are expected core paths; fixtures and lockfiles may change with dependencies. Split work exceeding roughly 8 files or 3 buildings.

**Interfaces:** See [ARCHITECTURE.md](ARCHITECTURE.md) for public interfaces, [GAME_STATE.md](GAME_STATE.md) for state, and [PROTOCOL.md](PROTOCOL.md) for networking. Role implementations consume GameState/GameCommand and return GameResult. Clients consume PlayerView/LegalAction and send protocol actions.

**Common verification:** Besides the targeted checks below, production tasks run affected-package Vitest and typecheck. Run build when dependencies or exports change. Browser tasks run their Playwright scenarios. Documentation tasks check links, sources, and coverage. These future checks have not yet passed.

**Common steps:**

- [ ] Read dependency outputs and specific ruleIds; carry exact M0 scenario values into this ticket.
- [ ] For behavior changes, write a targeted failing test and verify the failure reason. Validate documentation/low-risk configuration by content.
- [ ] Implement one capability within the listed file scope.
- [ ] Run targeted and common checks; record actual results.
- [ ] Update status/evidence and commit only this ticket's changes.

Rule-specific tickets lacking M0 data do not yet have ready-to-copy test inputs. This is an explicit dependency; implementers must not guess values.

## PR-001 [MEDIUM] — Lock down 1897 sources and scope

- **Milestone:** M0
- **Status:** DONE
- **Dependencies:** none
- **Files / Areas:** `docs/RULES.md`, `docs/RULE_QUESTIONS.md`
- **Scope / Acceptance:** Verify the official Puerto Rico 1897 rulebook, revisions, and expansion scope for the selected edition. Save source identifiers and hashes; do not mix editions. The user-selected S3 Special Edition now supersedes the original S1 source selection.
- **Required verification:** Check RULE-TODO-001/002 individually; every conclusion must have a source location.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-27 — independently downloaded official PDFs have identical SHA-256; parsed 24 pages and revision metadata; source scope and errata policy recorded in RULES.md; RULE-TODO-001/002 resolved in RULE_QUESTIONS.md. Documentation links and task metadata checked. No production tests apply.

## PR-002 [MEDIUM] — Convert rules into an engineering specification

- **Milestone:** M0
- **Status:** DONE
- **Dependencies:** PR-001
- **Files / Areas:** `docs/RULES.md`, `docs/GAME_STATE.md`, `docs/RULE_QUESTIONS.md`
- **Scope / Acceptance:** Assign stable ruleIds to every role, setup, building, scoring, and visibility rule. Explicitly establish shortages, mandatory actions, and phase-ending conditions.
- **Required verification:** Audit every rulebook section; resolve all core rules and record conflicting wording.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-27 — 69 rule definitions and 23 base building types reconciled against canonical S3, including phase-end termination, Personal Ship cargo retention, market-first setup, and shared victory. State contract updated. Unlimited coin accounting remains approved; full production or decline is an explicit interpretation. User supplied per-type stock via the building-quantity conversation; recorded as PROJECT-003, not publisher verification. Verified 23 types totaling 49 tiles, stable rule IDs, and document links. PR-003 is READY.

## PR-003 [LOW] — Build the rule coverage matrix

- **Milestone:** M0
- **Status:** DONE
- **Dependencies:** PR-002
- **Files / Areas:** `docs/TEST_SCENARIOS.md`, `docs/BACKLOG.md`
- **Scope / Acceptance:** Link every rule and building to at least one concrete scenario. Add edition-specific values to M3/M4 and split oversized building tasks.
- **Required verification:** No orphan ruleIds; every boundary scenario has an independently calculated expectation, not merely “follow the rules.”
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-27 — Added 57 concrete cases mapping all 69 rule IDs and 23 building types, with literal inputs/results, S3 pages, convention provenance and implementation owners. Added edition-specific M3/M4 acceptance values and four bounded subtickets. Verified coverage, catalog tuples, arithmetic, local links, 67 unique tickets and topological dependencies; independent review corrected player counts for exhaustion/Adventurer fixtures. Documentation checks only; engine tests do not exist yet.

## PR-004 [LOW] — Initialize a verifiable workspace

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** none
- **Files / Areas:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `packages/game-engine/package.json`, `packages/game-engine/tsconfig.json`, `packages/game-engine/src/index.ts`
- **Scope / Acceptance:** Initialize Git and pnpm workspaces. Pin compatible Node/TypeScript/Vitest versions, enable strict settings, expose typecheck/test/build scripts, and generate a lockfile.
- **Required verification:** After pnpm install, typecheck/build pass and the test entry point runs; explicitly record that no rule tests exist yet. Configuration and lockfiles are a justified scope exception; do not split out placeholder-only packages.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Initialized Git on main and one private ESM engine workspace. Pinned Node24.21.0 in .nvmrc (supported range >=24.19.0 <25), pnpm11.25.0, TypeScript7.0.2, Vitest5.0.2; generated lockfile. pnpm install and frozen offline reinstall, typecheck, build, and test entry point all exited0; emitted ESM import and ignore rules verified. No rule tests exist: test temporarily uses --passWithNoTests. Work stayed in this newly initialized directory because there was no existing Git checkout/commit to isolate; no placeholder app packages or game interfaces added.

## PR-005 [MEDIUM] — Finalize phase and domain interfaces

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** PR-002, PR-004
- **Files / Areas:** `packages/game-engine/src/model/state.ts`, `packages/game-engine/src/model/phase.ts`, `packages/game-engine/src/model/commands.ts`, `packages/game-engine/src/model/events.ts`, `docs/GAME_STATE.md`
- **Scope / Acceptance:** Define GameState, GamePhase, GameCommand, GameEvent, GameResult, and LegalAction. Specify every decision point and automatic step; currentPlayer cannot replace phases.
- **Required verification:** Type tests reject missing phase data and mismatched commands; the transition table covers every role and game over.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added readonly domain state, 17 phase variants, correlated commands, bounded LegalAction descriptors, canonical events and success/error results; froze ruleset 1.0.0. Documented every decision and automatic transition. Initial tests failed on missing interfaces; final typecheck/build and 3 contract tests pass. Verified all 8 negative fixtures independently fail compilation, then restored expected-error assertions. Independent review found no material gaps. Supporting test config/scripts and exports are necessary scope additions; no gameplay, branded IDs, serialization or RNG algorithm implemented.

## PR-006 [LOW] — Implement IDs and versioned serialization

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** PR-005
- **Files / Areas:** `packages/game-engine/src/model/ids.ts`, `packages/game-engine/src/model/serialization.ts`, `packages/game-engine/test/serialization.test.ts`
- **Scope / Acceptance:** Define instance and type IDs. Serialization round trips preserve data; explicitly reject invalid or unsupported versions.
- **Required verification:** Test snapshot round trips, unknown versions, damaged fields, and duplicate instance IDs.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Branded six instance-ID kinds across state/phases/commands/events; retained closed semantic type-ID unions. Added strict dependency-free snapshot reader/writer with exact schema/engine/ruleset/source compatibility, complete field validation and duplicate-ID checks. All 17 phase variants and nested data round-trip; unsupported metadata, damaged fields, inconsistent cargo and duplicate IDs reject. Initial missing-export tests failed; review exposed a slot-kind/ID mismatch, reproduced with a failing compile assertion and fixed. Final typecheck/build and 45 tests pass. Supporting model/exports/contract-test edits are required to apply brands consistently. Gameplay invariants and RNG algorithm validation remain PR-008/007.

## PR-007 [LOW] — Implement reproducible RNG

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** PR-004, PR-006
- **Files / Areas:** `packages/game-engine/src/rng/seeded.ts`, `packages/game-engine/test/rng.test.ts`
- **Scope / Acceptance:** Implement seed→state→next/shuffle with a versioned algorithm, no Math.random, and recoverable serialized state.
- **Required verification:** Use independent expected vectors for fixed seeds; verify output after recovery and preservation of shuffled elements and their multiplicities.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Implemented pure xoshiro128**1.1 with versioned uint32-seed/SplitMix64 expansion, bounded rejection sampling and copying Fisher–Yates shuffle. Independent Python reference vectors verify seeds0/1/4294967295, next outputs, final states and exact permutations; tests include repeated-element identity, immutability, rejected draws and full snapshot continuation. Integrated strict RNG version/state validation with PR-006 snapshots, hence the added dependency. Initial missing-export tests failed; final typecheck/build and 73 tests pass; independent review found no material issues. No global randomness or time input.

## PR-008 [MEDIUM] — Implement state invariants

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** PR-003, PR-005, PR-006
- **Files / Areas:** `packages/game-engine/src/invariants/assertGameState.ts`, `packages/game-engine/test/invariants.test.ts`
- **Scope / Acceptance:** assertGameState checks references, capacities, component ledgers, worker locations, and phase legality. Distinguish scoring values from finite chips.
- **Required verification:** Inject invalid states for each constraint and verify rejection; valid boundaries and permitted scoring after supply exhaustion pass.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added assertGameState with snapshot-shape reuse, per-type component/worker/VP ledgers, ownership and capacities, exact round/phase cursor rules, Recruiter confirmation boundaries and end-trigger/terminal consistency. Tests inject independent corruptions and accept balanced 3/4/5-player states, City/Countryside12, round rotation, personal cargo and VP overflow. Initial missing-export tests failed; review findings reproduced and fixed for undistributed Register workers and terminal trigger provenance. Typecheck/build and 122 tests pass. The app bundled pnpm 11.19.0; checks used pinned 11.25.0 installed only in /tmp. No setup/role execution or full scoring added.

## PR-009 [LOW] — Establish command dispatch and error contracts

- **Milestone:** M1
- **Status:** DONE
- **Dependencies:** PR-005, PR-006, PR-008
- **Files / Areas:** `packages/game-engine/src/applyCommand.ts`, `packages/game-engine/src/getLegalCommands.ts`, `packages/game-engine/test/dispatch.test.ts`
- **Scope / Acceptance:** Expose applyCommand and getLegalCommands. Unsupported phases fail explicitly; share validation entry points and preserve inputs.
- **Required verification:** Unknown actions, wrong decision-makers, and wrong phases return stable errors without changing snapshot/revision/rng.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added applyCommand/getLegalCommands with one shared invariant/actor/phase gate and a typed routing table. Explicit UNKNOWN_COMMAND/UNSUPPORTED_PHASE errors; automatic/terminal boundaries reject commands; unsupported active legal-action lookup throws DispatchError. Frozen-input tests verify unchanged state/revision/RNG and deterministic errors without replacement state/events. Initial missing-export tests failed; typecheck/build and 133 tests pass; independent review found no material issues. Extracted existing balanced test fixture for reuse. No role handlers or automatic progression added.

## PR-010 [LOW] — Implement 3/4/5-player setup

- **Milestone:** M2
- **Status:** DONE
- **Dependencies:** PR-003, PR-007, PR-009
- **Files / Areas:** `packages/game-engine/src/setup/createGame.ts`, `packages/game-engine/src/setup/config.ts`, `packages/game-engine/test/setup.test.ts`
- **Scope / Acceptance:** createGame initializes supplies, seats, shared areas, and random markets from frozen configuration. Reject duplicate players and unsupported counts.
- **Required verification:** TS-SETUP: three independent fixtures; same seed produces the same state; invalid input is rejected; assertGameState passes.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added deterministic createGame/config for 3/4/5 players with explicit Governor and fixed seats. Market draw precedes starting-estate assignment; every output passes assertGameState. Independent resource fixtures and Python seed0 market/start/RNG vector verify setup, plus snapshot round trips, nonfirst Governor, separate game data and invalid-input rejection. Initial missing-export tests failed; final typecheck/build and 155 tests pass; independent review found no material issues. No role handler added.

## PR-011 [LOW] — Implement role selection

- **Milestone:** M2
- **Status:** DONE
- **Dependencies:** PR-010
- **Files / Areas:** `packages/game-engine/src/round/chooseRole.ts`, `packages/game-engine/test/chooseRole.test.ts`
- **Scope / Acceptance:** Only the legal role chooser may select an available role. Update bonuses and privilege state according to ruleId.
- **Required verification:** Repeated, unauthorized, or unavailable choices leave state unchanged. Valid choices produce exact resources and next phase.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Implemented role selection through applyCommand/getLegalCommands with shared eligibility. Transfers card coins, marks the selected instance, initializes all seven role entry phases and emits ordered revision events without granting optional advantages. Tests cover repeated/wrong-actor/unavailable/malformed choices, second chooser, distinct Adventurer IDs, exact resources/phase/RNG preservation and numeric boundaries. Initial tests failed; review’s numeric eligibility mismatch was reproduced and fixed. Typecheck/build and 169 tests pass. No role action or automatic progression added.

## PR-012 [MEDIUM] — Implement round rotation

- **Milestone:** M2
- **Status:** DONE
- **Dependencies:** PR-011
- **Files / Areas:** `packages/game-engine/src/round/advanceRound.ts`, `packages/game-engine/test/round.test.ts`
- **Scope / Acceptance:** Distinguish role chooser from phase actor. Correctly accumulate round-end bonuses and rotate the governor. Tests may simulate role-completion signals.
- **Required verification:** Independent two-round sequences for 3/4/5 players; no repeated selections or skipped players; production exposes no test-only skip command.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added immutable internal role/round completion helpers: advance the chooser by seat order, pay only unchosen cards, reset selections and rotate Governor. Pending end triggers and unsafe numeric increments reject without mutation. Independent two-round sequences cover 3/4/5 players, exact bonuses, Governor wrap, repeat/premature calls and no player skip command. Initial tests failed before implementation; typecheck/build and 176 tests pass. Final review found no material issues. Tests simulate completed roles; role cleanup and automatic revision/event orchestration remain later tickets.

## PR-013 [MEDIUM] — Implement automatic progression boundaries

- **Milestone:** M2
- **Status:** DONE
- **Dependencies:** PR-012
- **Files / Areas:** `packages/game-engine/src/round/advanceAutomatic.ts`, `packages/game-engine/src/applyCommand.ts`, `packages/game-engine/test/automatic.test.ts`
- **Scope / Acceptance:** Advance automatic steps only to the next legal decision. One command and its automatic steps produce one revision. Correctly advance states with no action.
- **Required verification:** Test no legal choices, consecutive automatic phases, an artificial loop guard, and no progression after game over; exact state and event order.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added one internal bounded runner after command dispatch, preserving the accepted revision and appending contiguous event indexes. Implemented unavailable Hacienda/production-bonus skips and cleanup-free role/round boundaries (PLANTER-002, CRAFTSMAN-003, ROUND-002; S3 pp.9,12,17,19). No generic pass or public runner export. Remaining role-specific skips, cleanup, distribution and scoring stay with their owning tickets; unsupported automatic work fails without returning partial state/events. Three initial integration tests reproduced Planter stopping at unavailable Hacienda; all21 new tests now pass, covering3/4/5 players, exact state/events, optional decisions, frozen inputs, no-ops, a128-step artificial loop, invalid intermediates, failures and terminal boundaries. Updated the prior role-selection expectation. Node24.21.0; npm --prefix packages/game-engine run typecheck / test / build all pass,197 tests total. Used installed dependencies because pnpm is absent from this shell PATH; no dependency changes. No commit made: the repository has no baseline commit and all pre-existing project files are untracked.

## PR-014 [LOW] — Implement field-selection choices

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-013
- **Files / Areas:** `packages/game-engine/src/roles/settler/chooseTile.ts`, `packages/game-engine/test/roles/settler-choice.test.ts`
- **Scope / Acceptance:** Implement tile choices, privileges, and skip conditions using the corresponding 1897 role rules and frozen terminology, not copied classic-edition names.
- **Required verification:** PLN-01: 11→12 Countryside spaces, Quarry supply1→0; reject full-board placement and nonchooser Quarry without Builder’s Yard. Ordinary decline remains legal.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Implemented shared Planter choice eligibility/execution (PLANTER-001, S3 p.10): public market estate by instance ID, chooser or occupied Builder’s Yard Quarry, and explicit ordinary decline. Full Countryside, empty Quarry stock, foreign/stale IDs and malformed choices reject without mutation; IDs minted for Quarries remain unique even across valid restored states. `applyCommand` and `getLegalCommands` use the same choices. The PR-013 runner now automatically skips no-action ordinary selection and unavailable Hospital decisions for earlier actors, preserving the one revision/event batch; a usable Hospital remains a decision. At PR-014 completion, final actor cleanup and ability execution remained with PR-015/028; PR-015 later removed that temporary boundary. The first legal-action test failed with DispatchError; subsequent targeted tests reproduced missing forced skips and an ID collision. Final typecheck/test/build pass: 225 tests total, including 28 new choice cases for3/4/5 players, PLN-01 exact state/events, exhaustion, rejection, invariants and frozen inputs. Built ESM smoke test passes. Checks used `npm --prefix packages/game-engine run ...` with installed dependencies because pnpm is absent from PATH; no dependency changes. No commit: this repository still has no baseline commit and all pre-existing project files are untracked.

## PR-015 [LOW] — Complete field selection and refill the market

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-014
- **Files / Areas:** `packages/game-engine/src/roles/settler/complete.ts`, `packages/game-engine/test/roles/settler-complete.test.ts`
- **Scope / Acceptance:** After all participants act, perform rule-defined cleanup, replenish the market, and return to role rotation.
- **Required verification:** PLN-02 / SET-02: N5 controlled refill C,F,S,T,Coffee,F, only2 or0 tiles when exhausted; preserve50 estates and market-before-starting-estates order.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Implemented automatic Planter completion after the last actor, discarding remaining face-up estates, drawing N+1 from the existing bag before shuffling/discard recycling when more tiles are needed, and stopping at the available count. One accepted command still has one revision with ordered phase events; no fake decline or premature round bonuses. Existing seed-based setup/market-first order and finite50-estate ledger remain intact. PLN-02 N5 controlled seed111 fixture yields Corn,Fruit,Sugar,Tobacco,Coffee,Fruit and exact RNG state; independent2/0-tile exhaustion cases cover bag and leftover market, exact-bag draw does not reshuffle. Tests also cover3/4/5-player next chooser/round rotation, frozen inputs, snapshot round trip and no second cleanup. Initial3 tests failed because the market remained unchanged;12 initial completion cases failed before implementation. Updated PR-013/014 expectations now that cleanup is implemented. Node24.21.0; typecheck/test/build pass using `npm --prefix packages/game-engine run ...` with installed dependencies because pnpm is absent from PATH;237 tests total. Hacienda and Hospital execution remain PR-028. No commit: this repository has no baseline commit and its pre-existing files are untracked.

## PR-016 [LOW] — Implement basic building purchases

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-013
- **Files / Areas:** `packages/game-engine/src/roles/builder/build.ts`, `packages/game-engine/test/roles/builder.test.ts`
- **Scope / Acceptance:** Handle cost, discount limits, stock, city footprint, privileges, and skip conditions. M4 adds building-ability modifiers.
- **Required verification:** BLD-01/02: Office price2 with three Quarries + accepted chooser discount,3 if declined; zero floor, exact stock/payment, duplicate/stock0/capacity/affordability rejection. RND-03: two-space building fits at10, rejects at11.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-28 — Added basic Builder purchases through applyCommand/getLegalCommands with one shared eligibility/price function. A minimal S3 pp.11,18–22 cost/Quarry-cap table (full catalog still PR-026) prices Office at2/3 with three occupied Quarries and accepted/declined chooser privilege; tests independently cover Builder’s Yard1, Harbor5, City Hall7, zero floor, affordability, stock, duplicate ownership, one-/two-space City limits, explicit decline, nonchooser restriction and malformed requests. Purchases preserve inputs/RNG, pay exact coin value, create unique building IDs and the empty Wharf token required by invariants; School worker placement remains PR-029. Auto progression skips only actors with no affordable purchase. Reaching City12 records a revisioned trigger and permits every remaining actor to buy or decline; after their decisions, the engine stops at `phase-completion` without awarding scores or round bonuses until PR-032/033. This narrow pending-scoring boundary is intentional, not a game-over substitute. The initial advertised-price test failed with DispatchError; a later test reproduced premature rollback on a triggered City with cashless later actors. Final Node24.21.0 typecheck/test/build pass:403 tests total,35 new Builder cases; no new dependencies. Commands used `npm --prefix packages/game-engine run ...` with installed dependencies because pnpm is absent from PATH. No commit: the repository has no baseline commit and its pre-existing files are untracked.

## PR-017 [MEDIUM] — Implement worker distribution and role privilege

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-013
- **Files / Areas:** `packages/game-engine/src/roles/mayor/distribute.ts`, `packages/game-engine/test/roles/mayor-distribute.test.ts`
- **Scope / Acceptance:** Distribute Work Register clockwise after the optional supply-worker advantage, using Recruiter terminology; no worker-ship model.
- **Required verification:** REC-01: Register8/6/7 for N3/4/5 yields gains4,3,2 / 3,2,1,1 / 3,2,1,1,1 including accepted advantage; verify decline and empty supply.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-29 — Implemented shared Recruiter advantage eligibility and command validation, followed by automatic clockwise Work Register distribution into idle workers. Supply advantage precedes distribution; empty supply skips it without drawing from the Register. Existing placements, RNG and inputs remain unchanged. REC-01 tests independently verify exact 3/4/5-player gains, accept/decline, chooser wrap with reversed player storage, empty/short Register, empty supply, malformed/repeated/wrong-actor commands and numeric revision limits. Ordered worker/phase events share one accepted revision. All13 initial tests failed before implementation;14 new tests now pass. Updated the old unsupported-distribution expectation. Typecheck/test/build pass via npm with installed dependencies:403 tests total. Final review found no material issues. Placement/refill remain PR-018; no new dependencies or public skip commands.

## PR-018 [MEDIUM] — Implement worker placement and phase completion

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-017
- **Files / Areas:** `packages/game-engine/src/roles/mayor/placement.ts`, `packages/game-engine/src/roles/mayor/complete.ts`, `packages/game-engine/test/roles/mayor-placement.test.ts`
- **Scope / Acceptance:** Submit complete worker allocations, enforce slot ownership/conservation and mandatory filling, then refill Work Register by max(player count, empty building slots). Record shortage for phase-end scoring.
- **Required verification:** REC-02/03:3 workers in2 slots leave1 idle; invalid allocations unchanged. N4/E7/supply5 transfers5 and triggers; exact7 does not; E2 requests4. No generic reassignment outside Recruitment.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-29 — Added complete atomic worker allocations with strict owned-slot coverage, duplicate/malformed/capacity checks, worker conservation and mandatory filling before idle workers. Shared legal descriptors reuse existing building capacities. The final confirmation refills max(N, empty building slots), records shortage only when supply is insufficient, and stops at pending scoring; otherwise normal role/round rotation follows. REC-02/03, invalid input preservation, existing-worker moves, wrong actor/revision limits and full 3/4/5-player round completion are tested. Initial15 cases failed before implementation;21 new tests pass, with one obsolete unsupported-cleanup case removed. Typecheck/test/build pass:403 tests total via npm with installed dependencies. Review found a sparse-array validation hole; regression reproduced it and explicit array materialization fixed it. Scoring remains PR-032/033; no dependency additions.

## PR-019 [LOW] — Implement production and privilege choices

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-015, PR-016, PR-018
- **Files / Areas:** `packages/game-engine/src/roles/craftsman/produce.ts`, `packages/game-engine/test/roles/craftsman.test.ts`
- **Scope / Acceptance:** Implement full available production or decline, occupied estate/processing bottlenecks, supply consumption in actor order, and late chooser bonus. Six production types share data-driven capacity logic; Factory is PR-027.
- **Required verification:** PRO-01/02 and B-01–06: C1/F2/S0 example; capacities1/1/3/3/3/2; supply3 split2/1, no early bonus; supply5 split2/2 then optional1. Reject voluntary partial output under the recorded interpretation.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-29 — Implemented full production or whole-action decline, using occupied estate/processing bottlenecks and remaining supply in clockwise actor order. Six processing building types share a good mapping; occupied slots are already bounded by existing capacity invariants. Zero-output actors automatically advance. The chooser receives an optional available crate only from types actually produced, after all actors finish; old inventory grants no eligibility. Factory remains PR-027. Initial19 tests failed before implementation;23 new tests cover PRO-01/02, all six capacities, combined processors, decline, malformed/partial requests, exact resource events, numeric limits, input preservation and 3/4/5-player empty-production round completion. Updated role-selection/isolated-rotation fixtures for automatic completion. Typecheck/test/build pass via npm with installed dependencies:403 tests total; final review found no material issues. No dependency additions.

## PR-020 [LOW] — Implement trading and clearing

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-019
- **Files / Areas:** `packages/game-engine/src/roles/trader/trade.ts`, `packages/game-engine/test/roles/trader.test.ts`
- **Scope / Acceptance:** Validate tradable goods, trading-house restrictions, prices, privileges, skipping, and phase-end clearing.
- **Required verification:** TRD-01/02: base prices0/1/2/3/4, Coffee chooser income5 or4 when advantage declined; full House blocks until all actors finish, then four crates return. Office/markets added in M4.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-29 — Implemented single-crate base sales or decline, prices0/1/2/3/4, optional chooser +1, inventory/duplicate/House-capacity validation and shared sale eligibility. No-sale actors auto-advance. Only role completion returns a full House to supply; partial contents persist. Office/markets remain M4. Initial18 cases failed before implementation;23 new tests cover TRD-01/02, malformed/two-crate requests, invalid abilities, exact payment/resource events, zero-value Corn, numeric limits, input preservation and 3/4/5-player round completion. Removed one obsolete unsupported-Trader test and made the role-selection fixture tradable. Typecheck/test/build pass via npm with installed dependencies:403 tests total. Review identified a numeric-boundary pairing mismatch in legal descriptors; a failing regression confirmed it and exact paired sale offers fixed it. No dependency additions.

## PR-021 [LOW] — Implement income for other base roles

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-013
- **Files / Areas:** `packages/game-engine/src/roles/prospector/resolve.ts`, `packages/game-engine/test/roles/prospector.test.ts`
- **Scope / Acceptance:** Implement Adventurer: optional one-coin advantage independent of collected card coins; no other player action. Zero/one/two distinct card instances for 3/4/5 players.
- **Required verification:** ADV-01 / SET-04:2 starting coins +3 card coins + optional1 =6 or5; balance83 can increase84. Nonchoosers cannot claim it.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added shared Adventurer accept/decline eligibility and chooser-only resolution. Optional one-coin income is independent of role-card coins; existing automatic progression completes the role without other actors. ADV-01/SET-04 tests cover6/5 totals,83→84, distinct second Adventurer selection,0/1/2 card inventories, exact events, malformed/wrong-actor/repeated requests, numeric limits, input preservation and4/5-player round completion. Six initial behavior tests failed before implementation; all9 new tests now pass. Typecheck/test/build pass via npm with installed dependencies:403 tests total. Final review found no material issues. No new dependencies.

## PR-022 [LOW] — Implement cargo-ship constraints

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-019
- **Files / Areas:** `packages/game-engine/src/roles/captain/shipOptions.ts`, `packages/game-engine/test/roles/captain-ships.test.ts`
- **Scope / Acceptance:** Shared functions determine goods compatibility, capacity, and candidate ships for both legal-action generation and execution validation.
- **Required verification:** CAP-01/02: N4 ships5/6/7 with Sugar6 permits6/7 only; Sugar3 ties all empty ships; matching ship5 with4 loaded forces1, not a new ship; full and mixed-type rejection.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added pure internal cargoShipOptions and findCargoShipOption over invariant-validated goods/ships. Matching good ships take precedence even when full; otherwise only empty ships maximizing the chosen good’s load are offered, preserving ties and independent good choice. Lookup reuses those exact options and returns the mandatory quantity for future execution validation. Seven tests cover CAP-01/02,3/4/5-player capacities, zero inventory, full/mixed ships and unknown selections. Initial checks failed on the missing module; typecheck/test/build now pass via npm with installed dependencies:367 tests total. Final review found no material issues. Shipping turns, scoring and public Captain commands remain later tickets; no dependencies added.

## PR-023 [MEDIUM] — Implement mandatory shipping and repeated turns

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-022
- **Files / Areas:** `packages/game-engine/src/roles/captain/load.ts`, `packages/game-engine/src/roles/captain/advance.ts`, `packages/game-engine/test/roles/captain-load.test.ts`
- **Scope / Acceptance:** Implement mandatory choices, loading quantities, multiplayer rotation, and advancement when loading is impossible. No arbitrary pass.
- **Required verification:** CAP-01/04/05: reject pass/partial loading; cyclic skips revisit A for second good; complete no-load traversal enters retention. Define optional-Wharf integration point, exercised fully in PR-030A.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Continued the existing load/advance implementation and36 tests, adding missing legal-action descriptors and automatic no-load traversal. Baseline had17 failing cases; all now pass. Mandatory cargo choices reuse PR-022 quantities, reject pass/partial/unknown loads, transfer goods immutably and rotate by seat order. Loads reset the no-load counter; automatic skips/optional Wharf declines end only after a full no-load cycle and enter chooser-first retention. Eligible Wharf decisions stop automatic skipping; Personal Ship execution remains explicitly unsupported until PR-030A. Scoring/bonus usage remain PR-024 and retention/cleanup PR-025. Updated Captain role-selection fixture to contain goods. Frozen inputs, exact events/revisions, numeric limits, nonfirst chooser and3/4/5-player cycles verified. Typecheck/test/build pass via npm with installed dependencies:403 tests total. Final review found no material issues. No dependencies added.

## PR-024 [LOW] — Implement shipping points and privilege

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-023
- **Files / Areas:** `packages/game-engine/src/roles/captain/award.ts`, `packages/game-engine/test/roles/captain-score.test.ts`
- **Scope / Acceptance:** Record loading points and privilege usage under the frozen rules. Record shortages separately as endgame signals.
- **Required verification:** CAP-03: chooser loads3 then2 →4+2 VP; initial remaining2 yields overflow4 after both awards, no early phase stop. Hidden score fields excluded from public events.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added internal shipping awards after actual cargo transfer and before actor advancement, preserving the accepted revision. Awards one point per crate and the chooser bonus once, tracks depleted supply/overflow and latches one VP-exhausted trigger without stopping loading or retention. CAP-03 tests verify4+2, initial supply2→overflow4, exact exhaustion, nonchooser loads preserving the bonus, invalid empty loads and unchanged inputs. Four initial scoring cases failed; all5 new tests pass. Prior load tests now expect score events/bonus usage. Typecheck/test/build pass via npm with installed dependencies:408 tests total. Final review found no material issues. Events remain canonical server-only deltas, with no cumulative hidden score fields or public event API; public projection remains PR-035/042. Harbor/Personal Ship effects and retention remain their assigned tickets.

## PR-025 [MEDIUM] — Implement goods retention and shipping completion

- **Milestone:** M3
- **Status:** DONE
- **Dependencies:** PR-024
- **Files / Areas:** `packages/game-engine/src/roles/captain/retain.ts`, `packages/game-engine/src/roles/captain/complete.ts`, `packages/game-engine/test/roles/captain-retain.test.ts`
- **Scope / Acceptance:** Validate retention/discard, unloading, and phase completion. Provide concrete integration points for later storage/special-shipping abilities.
- **Required verification:** CAP-06/07: without Warehouse retain1 total; full ship4 unloads, partial ship5/Fruit2 stays; conservation and no reopening loads. Personal Ship cleanup integration completed in PR-030A.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added atomic base retention (at most one owned crate), exact discard transfers and clockwise empty-inventory skips. All retention precedes cleanup: full cargo ships unload, partial cargo stays, and a Personal Ship reset hook supports later Wharf integration. Cleanup rotates the role/round unless an end trigger is pending; then it stops after unloading for PR-032/033 scoring without repeating cleanup. Warehouse types remain unsupported until M4. Initial11 tests failed before implementation;15 new tests cover CAP-06/07, malformed/over-retention, supply conservation, next nonempty actor, no resumed loading, numeric limits and3/4/5-player round completion. Earlier Captain tests now expect automatic empty retention/cleanup. Typecheck/test/build pass via npm with installed dependencies:423 tests total. Final review found no material issues. No dependencies added.

## PR-026 [LOW] — Enter the building catalog

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-003, PR-016
- **Files / Areas:** `packages/game-engine/src/buildings/definitions.ts`, `packages/game-engine/test/buildings/definitions.test.ts`
- **Scope / Acceptance:** Record all23 S3 building types with cost/base VP/footprint/slots/Quarry cap/stock, separately from ability implementation. Preserve PROJECT-003 stock provenance.
- **Required verification:** B-01–23 literal tuples:20 production +24 regular commercial +5 expanded =49, distinct IDs, Factory7/School8. Tests must not derive expected tuples from the catalog under test.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added23 immutable S3 building definitions with stable rule IDs, cost/base VP/footprint/worker slots/Quarry cap/stock. Stock provenance explicitly remains user-supplied PROJECT-003. Builder pricing, setup stock and invariants now consume the same catalog, replacing duplicated facts without implementing abilities. Independent literal B-01–23 tests verify every tuple, unique IDs, Factory7/School8 and20+24+5=49 stock. Initial checks failed on the missing module; typecheck/test/build pass via npm with installed dependencies:447 tests total,24 new catalog tests. Existing role/setup/invariant tests remain green; final review found no material issues. No dependencies added.

## PR-027 [LOW] — Implement building activation and economic abilities

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-026, PR-019, PR-020
- **Files / Areas:** `packages/game-engine/src/buildings/activation.ts`, `packages/game-engine/src/buildings/economy.ts`, `packages/game-engine/test/buildings/economy.test.ts`
- **Scope / Acceptance:** Implement shared activation checks plus Small Market (BUILDING-007), Large Market (013), and Factory (015), exactly three abilities.
- **Required verification:** B-07/13/15: Corn income1 with Small Market; Coffee chooser with both markets8; Factory types0/1/2/3/4/5 →0/0/1/2/3/5 coins, no bonus-crate second payout; inactive and declined variants.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added shared occupied-building activation and exactly three economic abilities. Small/Large Market choices independently add1/2 to paired sale offers, preserving chooser bonus and safe coin arithmetic. Factory pays0/0/1/2/3/5 for actual produced types only; inactive/declined/unavailable output and old goods grant no bonus, and the late chooser crate cannot pay again. Nine initial behavior cases failed;10 new tests cover market combinations, nonchooser Corn, all Factory counts, shortages and numeric limits. Typecheck/test/build passed with457 tests before starting PR-027A.

## PR-027A [LOW] — Implement Office duplicate trading

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-027
- **Files / Areas:** `packages/game-engine/src/buildings/office.ts`, `packages/game-engine/test/buildings/office.test.ts`
- **Scope / Acceptance:** Implement Office (BUILDING-012) through the shared Trader validation; allow duplicate type, never a second sale or fifth House crate.
- **Required verification:** B-12 / TRD-02: Fruit duplicates yield House F,F and income1 for nonchooser; inactive/full-House cases reject without mutation.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added Office eligibility using shared activation and Trader offer validation. An occupied Office permits duplicate goods while enforcing one-crate sales and the four-crate House limit. Two initial duplicate-sale tests failed;5 new tests verify nonchooser Fruit income1, inactive/full rejection, decline, no repeated sale, and phase-end return of all duplicate crates. Final typecheck/test/build pass via npm with installed dependencies:462 tests total. Final review of both tickets found no material issues. No dependencies added.

## PR-028 [MEDIUM] — Implement field and worker building interactions

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-027, PR-015, PR-018
- **Files / Areas:** `packages/game-engine/src/buildings/settlement.ts`, `packages/game-engine/test/buildings/settlement.test.ts`
- **Scope / Acceptance:** Implement Hacienda (BUILDING-008), Builder’s Yard (009), and Hospital (011). Hidden draw commits before normal selection; Hospital supplies at most one worker across newly acquired tiles.
- **Required verification:** B-08/09/11:10→12 tiles with Hacienda+normal action; at11 no second tile; nonchooser Quarry; supply then Register worker priority, both empty, inactive/declined and invalid/duplicate destinations.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added shared Hacienda/Hospital eligibility and execution plus shared activation for Builder’s Yard. Hacienda commits one hidden estate before ordinary selection, recycling discards with seeded shuffle when needed. Hospital targets only one newly acquired estate/Quarry, prefers supply then Register, and completes the actor’s turn after accept/decline. No second worker, old destination, full-board Hacienda or hidden-supply exhaustion bypass. Five initial new cases failed;9 tests now cover10→12,11→12, both destinations, worker sources/exhaustion, inactive/declined effects, nonchooser Quarry, deterministic recycling and invalid/numeric boundaries. Updated the old unsupported-Hacienda dispatch test. Typecheck/test/build pass via npm with installed dependencies:471 tests total. Final review found no material issues. No dependencies added.

## PR-029 [LOW] — Implement construction-related building abilities

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-027, PR-016
- **Files / Areas:** `packages/game-engine/src/buildings/construction.ts`, `packages/game-engine/test/buildings/construction.test.ts`
- **Scope / Acceptance:** Implement School (BUILDING-016), requiring occupation before purchase and optionally placing exactly one worker on the new building. Base Quarry/chooser discounts remain PR-016.
- **Required verification:** B-16 / BLD-02: Large Fruit Depot receives1 worker, not3; supply first, Register fallback, both empty; newly bought School cannot activate itself; active/inactive/declined variants.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added School eligibility evaluated against the buyer before purchase. Legal offers and validation share activation/source checks. Accepted School places exactly one worker on the new building, taking supply first then Register; inactive/exhausted use rejects and decline remains legal. Newly bought School cannot self-activate. Seven new tests cover Large Fruit Depot1 rather than3 workers, sources, empty/inactive/declined cases, nonchooser use, payment/events and repeat rejection. Initial two active-use tests failed; updated prior Builder test for implemented School. Typecheck/test/build pass via npm with installed dependencies:478 tests total. Final review found no material issues. No dependencies added.

## PR-030 [MEDIUM] — Implement Small and Large Warehouse retention

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-027, PR-025
- **Files / Areas:** `packages/game-engine/src/buildings/shipping.ts`, `packages/game-engine/src/buildings/storage.ts`, `packages/game-engine/test/buildings/shipping.test.ts`
- **Scope / Acceptance:** Implement Small Warehouse (BUILDING-010) and Large Warehouse (014), stacking to three protected types plus one additional crate. Storage never overrides mandatory loading.
- **Required verification:** B-10/14: Small keeps5 of9 specified crates; Large keeps8 of11; combined keeps10 of11; inactive/declined, repeated type selections, empty inventory and excess retention.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added shared occupied-Warehouse capacity and strict distinct owned-good protection validation. Small/Large stack to1/2/3 protected types plus at most one crate outside them, retaining normal owned-quantity validation and supply conservation. Eight initial tests cover B-10/14 totals5/8/10, inactive/declined protection, repeated/sparse/unknown types and excess outside allowance; three positive cases failed before implementation. Typecheck/test/build passed with486 tests before PR-030A.

## PR-030A [MEDIUM] — Implement Harbor and Wharf shipping

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-030
- **Files / Areas:** `packages/game-engine/src/buildings/shipping.ts`, `packages/game-engine/test/buildings/shipping.test.ts`
- **Scope / Acceptance:** Implement Harbor (BUILDING-017) and Wharf (018), optional rewards/charter, once-per-phase use, Personal Ship cargo and cleanup. Integrate with mandatory shipping and retention.
- **Required verification:** B-17/18 / CAP-04/07: Corn2 then personal Corn3 gives chooser+Harbor8 VP; Coffee5 charter stays on Personal Ship until cleanup; second/partial charter rejects; decline cannot evade cargo loading; inactive and no-load traversal cases.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added shared Personal Ship options and optional Harbor choices, integrating them with the existing cargo validator, point awards, repeated visits and cleanup. Wharf charters all of one good once per phase, can replace cargo loading, holds cargo until cleanup, and cannot turn decline into a mandatory-load pass. Harbor adds one point per accepted load, including charter; chooser bonus remains once. Three positive cases failed before implementation; tests cover Corn2+personal3→8 or6, nonchooser Coffee5 held until cleanup, second/partial/inactive rejection, VP overflow and no storage bypass. Prior Wharf expectations now reflect implemented charter. Final typecheck/test/build pass via npm:493 tests total,15 new tests across both tickets. Final review found no material issues. No dependency additions.

## PR-031 [LOW] — Audit building coverage and combination fixtures

- **Milestone:** M4
- **Status:** DONE
- **Dependencies:** PR-027A, PR-028, PR-029, PR-030A
- **Files / Areas:** `packages/game-engine/test/buildings/coverage.test.ts`, `packages/game-engine/test/scenarios/building-interactions.test.ts`, `docs/TEST_SCENARIOS.md`
- **Scope / Acceptance:** Audit B-01–23 catalog/ability ownership. Production B-01–06 is PR-019; economic/planting/construction/storage/shipping owners are explicit in TEST_SCENARIOS.md. Scoring B-19–23 maps to PR-033A/B, not missing nonscoring abilities.
- **Required verification:** No unmapped catalog type; verify Hacienda+Hospital, markets+Trader, Warehouses combined, Harbor+Wharf+Captain. Scoring remains an explicit downstream requirement, not a false completed test.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Audited all23 catalog types against explicit B-case/implementation ownership and existing executable suites. Added coverage checks for every catalog key, unique scenario/rule mapping and the exact five pending scoring buildings (PR-033A/B, assembled by PR-033). Added four snapshot-restored command sequences covering Hacienda+Hospital→production, Office+markets+Trader, combined Warehouses→trading, and Harbor+Wharf+Captain+Warehouses→cleanup. Each checks deterministic continuation, input preservation, invariants, one revision and ordered events. TEST_SCENARIOS now links the owning suites and separates implemented abilities from pending scoring. No production changes. Typecheck/test/build pass via npm:499 tests total,6 new audit/interaction tests. Final review found no material issues.

## PR-032 [MEDIUM] — Implement endgame triggers and completion boundary

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-021, PR-031
- **Files / Areas:** `packages/game-engine/src/scoring/endgame.ts`, `packages/game-engine/test/endgame.test.ts`
- **Scope / Acceptance:** Record each ending reason and triggering revision separately; end after the triggering role phase and its cleanup, without further role selections or round-end bonuses. Reject actions after completion.
- **Required verification:** TS-END: every cause, simultaneous causes, required legal actions after triggering, and rejection of all post-game actions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added one internal terminal completion boundary after existing trigger-producing role handlers. Builder finishes all remaining decisions; Recruiter refills the Register; Captain completes loading, overflow awards, retention and cargo/Personal Ship cleanup before game-over. No further selections, Governor rotation or round coins. Eleven new tests cover all three causes, multiple City triggers with distinct revisions, 3/4/5 players, first/final-round Builder positions, empty nonending supplies, deterministic snapshot continuation, ordered events, input preservation and every post-game command. Seven initial cases reproduced the missing terminal transition; updated six prior pending-boundary expectations. Ruling: terminal scores are explicitly null pending PR-033 integration, with serialization and invariants supporting both pending and fully scored states; no fabricated scores. Final scoring remains out of scope. Typecheck/test/build pass via npm with installed dependencies:510 tests total. Fresh review found no material issues. No dependencies added or commit made (repository has no baseline commit).

## PR-033A [LOW] — Implement Fire Station, Residence, and Fortress bonuses

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-032
- **Files / Areas:** `packages/game-engine/src/buildings/scoringAssets.ts`, `packages/game-engine/test/buildings/scoringAssets.test.ts`
- **Scope / Acceptance:** Implement only BUILDING-019/020/021 bonus calculators with occupation gates; no ranking or earned-VP bonuses.
- **Required verification:** B-19/20/21: Fire Station7; Residence tiles1/9/10/11/12 →4/4/5/6/7; Fortress workers8/9/10 →2/3/3 including idle. Each inactive bonus0.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added pure Fire Station, Residence and Fortress bonus calculators, reusing existing worker activation and one explicit six-type production classification. Tests cover Fire Station7/all-six10, empty counted buildings, Residence1/9/10/11/12 including unoccupied Quarries, Fortress8/9/10 including idle, inactive/unowned gates and input preservation. Twelve new tests; initial bonus assertions reproduced missing calculations. Final typecheck/test/build pass via npm with installed dependencies:537 tests overall. Fresh review found no material issues. No dependencies added.

## PR-033B [LOW] — Implement Customs House and City Hall bonuses

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-032
- **Files / Areas:** `packages/game-engine/src/buildings/scoringPoints.ts`, `packages/game-engine/test/buildings/scoringPoints.test.ts`
- **Scope / Acceptance:** Implement only BUILDING-022/023 bonus calculators, counting earned overflow and commercial buildings respectively; no aggregate scoring.
- **Required verification:** B-22/23: earned7/8/30 →1/2/7, excluding building points; City Hall example counts3 including itself, not spaces or production; each inactive bonus0.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added pure Customs House and City Hall bonus calculators with existing activation gates and shared production classification. Five new tests independently cover earned7/8/30→1/2/7, exclusion of building points, commercial count3 including itself and another two-space commercial tile, exclusion of production, and inactive/unowned gates. Initial bonus assertions failed before implementation; Captain integration verifies earned overflow under PR-033. Final typecheck/test/build pass:537 tests overall. Fresh review found no material issues. No dependencies added.

## PR-033 [MEDIUM] — Implement final scoring and tiebreaks

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-033A, PR-033B
- **Files / Areas:** `packages/game-engine/src/scoring/calculateFinalScore.ts`, `packages/game-engine/src/buildings/scoring.ts`, `packages/game-engine/test/scoring.test.ts`
- **Scope / Acceptance:** Compose the five separately implemented bonus calculators with earned/base VP; return itemized totals and coins+goods tiebreaks, sharing rank when both tie. Pure calculation never mutates state.
- **Required verification:** SCR-01/02:30 earned +11 base +7 Customs +3 City Hall =51; equal40 VP resolved by5 vs4 coins+goods, equal5 shares victory,39 VP never wins on money. Repeated calculation identical.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Composed five bonus calculators with every owned building’s printed base VP and earned VP into public pure calculateFinalScore. Returns fresh itemized breakdowns in seat order, VP-first then coins+post-cleanup inventory ranking, with shared competition ranks. Integrated calculation at completeGame: mandatory terminal score arrays replace PR-032 temporary nulls; one game-scored event follows phase-changed under the final accepted command revision. Ten new tests cover literal51-point scoring, all-five bonuses, ties/primary ordering, deterministic frozen inputs, reversed player order, safe integer limits, strict terminal snapshots, 3/4/5-player events and Captain overflow/cleanup. Eight initial aggregate/integration cases failed before implementation; updated prior terminal/event and coverage expectations. Final typecheck/test/build pass:537 tests,27 new across PR-033A/B/033. Fresh review found no material issues. Full-game histories remain PR-034/036. No dependencies added or commit made (repository has no baseline commit).

## PR-034 [LOW] — Implement headless controls and replay

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-033
- **Files / Areas:** `packages/game-engine/src/replay/replay.ts`, `packages/game-engine/src/cli.ts`, `packages/game-engine/test/replay.test.ts`
- **Scope / Acceptance:** CLI creates a seeded game, prints state/legal choices, reads commands, and replays history with failure-position diagnostics.
- **Required verification:** TS-REPLAY: initial snapshot plus history reproduces output; invalid commands identify their index; incompatible versions fail explicitly.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added `replay/replay.ts`: versioned ReplayRecord (format/engine/ruleset/sourceHash, optional setup seed, detached initial snapshot, accepted commands) with `createReplay`, `serializeReplay` and pure `replay(unknown)`. Replay checks record versions before decoding, then snapshot/RNG versions and invariants, then reapplies commands through `applyCommand`; it returns the initial state, final state and per-revision events, or an explicit failure: `invalid-record`, `incompatible-version`, `invalid-snapshot` (with path) or `rejected-command` (zero-based index, command and RuleError). Added `cli.ts` as pure line-in/text-out headless controls, because the engine has no IO and no Node types. `startCli` creates a seeded game and prints a summary with legal choices. `runCliLine` accepts JSON commands (actor defaults to the current decision-maker) plus `state`, `legal`, `history` and `load <replay-json>`. It reports rejections by the index they would have taken and records only accepted commands. Replay and CLI are exported from the package entry. Twelve new tests in `test/replay.test.ts` cover an independently chosen seeded 3-player Planter/Builder history, which reproduces the final state and every revision's events after snapshot recovery. They also cover rejected-command indices (WRONG_ACTOR at 2, UNKNOWN_COMMAND at 1), five record-level and two embedded snapshot/RNG version mismatches, malformed records, invariant-violating snapshots, unchanged inputs, and CLI start/accept/reject/history/load diagnostics. The new suite failed before implementation because its modules were missing; all 12 pass now. Typecheck/test/build pass via npm with Node 24.21.0 (pnpm is not installed on this machine's PATH): 549 tests total. No rule changes, no dependencies added, no commit made (repository has no baseline commit). Full-game fixtures remain PR-036. Review fix, same day: review found no runnable CLI (the compiled file did nothing when run). Added `bin/cli.mjs`, a thin Node readline host outside the IO-free `src/`, and a `cli` script (`tsc && node bin/cli.mjs <seed> <players…>`, documented in README). Verified manually from a clean `dist/`: the prompt prints the summary and legal choices; `help`, a JSON command and a malformed line each produce the expected output; bad setup prints the error plus usage and exits 1. There is no automated test of the wrapper because the engine test build has no Node types.

## PR-035 [MEDIUM] — Define player-view and privacy contracts

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-003, PR-033
- **Files / Areas:** `packages/protocol/src/views.ts`, `packages/protocol/src/messages.ts`, `docs/PROTOCOL.md`
- **Scope / Acceptance:** Define PlayerView/PlayerEvent/LegalAction DTOs field by field from VISIBILITY rules. Specify developer-tool versus player permissions.
- **Required verification:** Audit scores, RNG, future sequences, legal actions, errors, and logs. Each private-field category has a test specification forbidding disclosure.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added `@vibe-rico/protocol` with type-only DTOs reusing engine types: `views.ts` (PublicPlayerView, PlayerView, PlayerEvent, PlayerLegalActions) and `messages.ts` (PlayerBroadcast, CommandAccepted, CommandRejected with the nine PROTOCOL.md codes). PROTOCOL.md now maps every GameState field to public / viewer-only / not projected, citing VISIBILITY-001–003 and GAME_STATE.md. `earnedVp` goes to the owner only (`viewer`). rng and estateBag are server-only. estateDiscard, endTriggers and snapshot metadata are not projected because they are absent from the public list. `vp-earned` events go to the owner only and `end-triggered` is withheld. Legal actions go to the decision-maker only. Errors carry no engine message text. Developer-tool full state is local-dev only. Disclosure test specifications PRIV-01–07 cover scores, future estate order, RNG, legal actions, errors, logs/credentials and developer state; runtime assertions belong to PR-042. Three compile-time tests in `packages/protocol/test/views.test.ts` pin the exact DTO key sets. A mutation check that added `rng` to PlayerView failed typecheck as intended and was reverted. Checks via npm with Node 24.21.0 (pnpm unavailable on PATH): engine typecheck/test/build pass with 549 tests; protocol typecheck/test/build pass with 3 tests; 552 total. The workspace link was added by hand as the `link:` importer in `pnpm-lock.yaml` plus a `node_modules` symlink, so `pnpm install --frozen-lockfile` has not been run to confirm it. Review fix, same day: review reproduced TS2307 on a clean checkout, because the engine typecheck emits no declarations. Protocol `typecheck`/`test`/`build` now run `tsc -p ../game-engine` first. With both `dist/` directories deleted, each protocol script passes on its own. Rulebook PDF not re-read: no PDF renderer on this machine, and the cited reconciled rules already resolve RULE-TODO-009. No dependencies added and no commit made.

## PR-036 [LOW] — Add full-game fixtures and property checks

- **Milestone:** M5
- **Status:** READY
- **Dependencies:** PR-034
- **Files / Areas:** `packages/game-engine/test/scenarios/full-games.test.ts`, `packages/game-engine/test/scenarios/invariants.property.test.ts`, `docs/TEST_SCENARIOS.md`
- **Scope / Acceptance:** Provide fixed histories that legally finish for 3/4/5 players. Random legal actions are only for bounded invariant checks.
- **Required verification:** TS-REPLAY: every command accepted, independently verified scoring, invariants at every step, and identical replay/recovery results.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-037 [LOW] — Create server and protocol entry points

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-035, PR-036
- **Files / Areas:** `apps/server/package.json`, `apps/server/src/app.ts`, `packages/protocol/package.json`, `packages/protocol/src/schemas.ts`, `apps/server/test/protocol.test.ts`
- **Scope / Acceptance:** Introduce Fastify/Socket.IO/Zod, gameplay and room envelope schemas, and a health check. Reject oversized input.
- **Required verification:** Health check succeeds; reject wrong types, unknown versions, oversized payloads, and forged resource fields.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-038 [LOW] — Implement room storage, creation, and joining

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-037
- **Files / Areas:** `apps/server/src/rooms/store.ts`, `apps/server/src/rooms/inMemoryStore.ts`, `apps/server/src/rooms/lobby.ts`, `apps/server/test/lobby.test.ts`
- **Scope / Acceptance:** Implement InMemoryRoomStore, invitation-code generation, create/join, and startup with fixed seats. Writes follow the expectedRevision contract.
- **Required verification:** Test room-code collision retries, player limits, duplicate names distinct from identity, unauthorized starts, and new-seat rejection after start.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-039 [MEDIUM] — Implement room command queues and deduplication

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-038
- **Files / Areas:** `apps/server/src/commands/queue.ts`, `apps/server/src/commands/submit.ts`, `apps/server/test/commands.test.ts`
- **Scope / Acceptance:** Follow PROTOCOL.md processing order. Same-ID/same-payload retries return the original result; different payloads fail; stale revisions do not execute.
- **Required verification:** TS-NET: concurrent different actions, retries after lost acknowledgment, old revisions, and same-ID/different-payload requests; only one valid transition.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-040 [LOW] — Implement room lifecycle and resource limits

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-038
- **Files / Areas:** `apps/server/src/rooms/lifecycle.ts`, `apps/server/src/rooms/limits.ts`, `apps/server/test/lifecycle.test.ts`
- **Scope / Acceptance:** Implement pregame leaving, host transfer/closure, and preserved seats after in-game disconnection. Configure empty-room cleanup and rate limits with documented defaults.
- **Required verification:** Disconnection preserves players; start/close races behave predictably; idle cleanup never removes active rooms.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-041 [MEDIUM] — Implement credentials and basic reconnect

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-039, PR-040
- **Files / Areas:** `apps/server/src/sessions/tokens.ts`, `apps/server/src/sessions/reconnect.ts`, `apps/server/test/reconnect.test.ts`
- **Scope / Acceptance:** Bind random tokens to seats, store hashes, allow one active controller, and recover snapshots/subscriptions without a gap.
- **Required verification:** TS-NET: refresh, network loss, invalid/cross-room tokens, two tabs, commands during recovery, and invalidation of old connections.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-042 [LOW] — Implement player projections and broadcasts

- **Milestone:** M6
- **Status:** WAITING
- **Dependencies:** PR-035, PR-041
- **Files / Areas:** `apps/server/src/projection/playerView.ts`, `apps/server/src/projection/playerEvents.ts`, `apps/server/src/rooms/broadcast.ts`, `apps/server/test/projection.test.ts`
- **Scope / Acceptance:** Implement projectForPlayer and player-filtered event/action/error broadcasts. Never send full GameState.
- **Required verification:** TS-PRIVACY: compare all messages across independent connections. RNG, other players’ private data, tokens, and developer state remain invisible.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-043 [LOW] — Create the web entry point and lobby

- **Milestone:** M7
- **Status:** WAITING
- **Dependencies:** PR-042
- **Files / Areas:** `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/lobby/Lobby.tsx`, `apps/web/src/network/socket.ts`, `apps/web/src/lobby/Lobby.test.tsx`
- **Scope / Acceptance:** Create a React/Vite page for room creation, invitation-code entry, joining, seat display, and starting; use same-origin connections.
- **Required verification:** Test successful/failed room flows, invite links, full-room and disconnection messages; install and pin compatible versions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-044 [LOW] — Implement the authoritative client-state store

- **Milestone:** M7
- **Status:** WAITING
- **Dependencies:** PR-043
- **Files / Areas:** `apps/web/src/state/gameStore.ts`, `apps/web/src/state/gameStore.test.ts`, `apps/web/src/network/commands.ts`
- **Scope / Acceptance:** Use Zustand for PlayerView, revision, and pending commands. Old snapshots cannot overwrite newer ones; disable sends while disconnected.
- **Required verification:** Test broadcasts before acknowledgments and vice versa, duplicate/old messages, STALE_REVISION, and reconnect retries with the original commandId.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-045 [LOW] — Build complete debug views and action forms

- **Milestone:** M7
- **Status:** WAITING
- **Dependencies:** PR-044
- **Files / Areas:** `apps/web/src/debug/GameView.tsx`, `apps/web/src/actions/ActionForm.tsx`, `apps/web/src/actions/ActionForm.test.tsx`, `apps/web/src/debug/ScoreView.tsx`
- **Scope / Acceptance:** Display every shared area and the player’s resources. Provide forms for every LegalAction member, including worker allocation/goods retention, and readable itemized scoring.
- **Required verification:** Every action descriptor can construct a request; server rejection is clearly shown; UI does not reimplement rules.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-046 [LOW] — Build developer scenarios and state diagnostics

- **Milestone:** M7
- **Status:** WAITING
- **Dependencies:** PR-045, PR-034
- **Files / Areas:** `apps/web/src/debug/ScenarioTools.tsx`, `apps/server/src/debug/scenarios.ts`, `apps/server/test/debug-access.test.ts`
- **Scope / Acceptance:** Local development supports fixture import/export, history inspection, and state copying. Production disables endpoints and hides entry points.
- **Required verification:** Unauthorized/production access fails; damaged snapshots cannot enter games; developer replay identifies command positions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-047 [LOW] — Test complete multiplayer games in browsers

- **Milestone:** M8
- **Status:** WAITING
- **Dependencies:** PR-045, PR-046
- **Files / Areas:** `apps/web/e2e/full-game.spec.ts`, `apps/web/e2e/reconnect.spec.ts`, `apps/web/playwright.config.ts`
- **Scope / Acceptance:** Use independent Playwright contexts for 3/4/5 players to execute fixed legal histories, refreshing one player during play.
- **Required verification:** TS-UI: everyone reaches game over with matching public state/final scores; refresh preserves identity without duplicate actions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-048 [LOW] — Run friend playtests and record defects

- **Milestone:** M8
- **Status:** WAITING
- **Dependencies:** PR-047
- **Files / Areas:** `docs/PLAYTEST.md`, `docs/TEST_SCENARIOS.md`, `docs/BACKLOG.md`
- **Scope / Acceptance:** Organize complete manual playtests. Record every decision needing explanation or lacking usable controls; prepare consistent feedback and reproduction data.
- **Required verification:** Actual playtest records include player count, duration, version, ending, and issues. Never mark unperformed playtests as passed.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-049 [LOW] — Create the tabletop scene and fallback

- **Milestone:** M9
- **Status:** WAITING
- **Dependencies:** PR-048
- **Files / Areas:** `apps/web/src/scene/TableScene.tsx`, `apps/web/src/scene/Camera.tsx`, `apps/web/src/scene/SceneBoundary.tsx`, `apps/web/src/scene/TableScene.test.tsx`
- **Scope / Acceptance:** Introduce Three.js/R3F/drei, a semi-top-down camera, lighting, and table. Retain the DOM client when WebGL is unavailable.
- **Required verification:** Readable 3/4/5-player layouts; controls work after resize, scene failure, and lack of WebGL.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-050 [LOW] — Build shared-area models

- **Milestone:** M9
- **Status:** WAITING
- **Dependencies:** PR-049
- **Files / Areas:** `apps/web/src/scene/CommonBoard.tsx`, `apps/web/src/scene/RoleTiles.tsx`, `apps/web/src/scene/Ships.tsx`, `apps/web/src/scene/Markets.tsx`
- **Scope / Acceptance:** Use original geometry for roles, building market, tiles, trading area, ships, and supplies. Models read only PlayerView.
- **Required verification:** Visually check counts and slots for empty/full/exhausted fixtures; overlapping objects must not obscure important data.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-051 [LOW] — Build player boards and reusable pieces

- **Milestone:** M9
- **Status:** WAITING
- **Dependencies:** PR-049
- **Files / Areas:** `apps/web/src/scene/PlayerBoard.tsx`, `apps/web/src/scene/Buildings.tsx`, `apps/web/src/scene/Fields.tsx`, `apps/web/src/scene/Workers.tsx`
- **Scope / Acceptance:** Display buildings, fields, workers, and goods by seat, mapped by stable instance IDs. Show no unauthorized information.
- **Required verification:** Screenshot checks for empty/full boards and multiplayer layouts; updates leave no stale objects; supplement color with text/shapes.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-052 [LOW] — Connect object selection to legal actions

- **Milestone:** M9
- **Status:** WAITING
- **Dependencies:** PR-050, PR-051, PR-045
- **Files / Areas:** `apps/web/src/scene/Selection.tsx`, `apps/web/src/actions/ActionPanel.tsx`, `apps/web/e2e/scene-actions.spec.ts`
- **Scope / Acceptance:** Hover/click associates objects with legal-action forms, submitted through the same command channel. DOM controls remain available.
- **Required verification:** Clicks do not mutate authoritative resources; illegal objects offer no executable action; server rejection preserves consistent views.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-053 [LOW] — Implement event animation and interruption recovery

- **Milestone:** M10
- **Status:** WAITING
- **Dependencies:** PR-052
- **Files / Areas:** `apps/web/src/animation/eventQueue.ts`, `apps/web/src/animation/transitions.ts`, `apps/web/src/animation/eventQueue.test.ts`
- **Scope / Acceptance:** Use short event-driven animations, deduplicated by revision and event index. Skipping, reconnecting, or lagging aligns directly to the snapshot.
- **Required verification:** TS-MOTION: duplicate/missing events, new state during animation, skip, and reconnect; the final view always matches the latest snapshot.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-054 [LOW] — Improve readability and accessibility

- **Milestone:** M10
- **Status:** WAITING
- **Dependencies:** PR-052
- **Files / Areas:** `apps/web/src/actions/ActionPanel.tsx`, `apps/web/src/settings/Settings.tsx`, `apps/web/src/styles.css`, `apps/web/e2e/accessibility.spec.ts`
- **Scope / Acceptance:** Clearly identify the decision-maker, errors, and reasons for waiting. Provide complete keyboard controls, focus indicators, reduced motion, and terminology help.
- **Required verification:** Complete representative roles by keyboard; distinguish cues without color; reduced-motion settings prevent mandatory long animations.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-055 [LOW] — Verify performance and resource cleanup

- **Milestone:** M10
- **Status:** WAITING
- **Dependencies:** PR-053, PR-054
- **Files / Areas:** `apps/web/src/scene/resources.ts`, `apps/web/e2e/scene-performance.spec.ts`, `docs/PERFORMANCE.md`
- **Scope / Acceptance:** Record device/resolution and define and verify frame-time targets for a full table. Reuse geometry and release resources; avoid unsupported renderer rewrites.
- **Required verification:** Suggested target: p95 frame time ≤33ms at 1080p on the agreed desktop device; no sustained resource growth across 10 scene enter/exit cycles; correct WebGL recovery.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-056 [LOW] — Implement persistence schema and database adapter

- **Milestone:** M11
- **Status:** WAITING
- **Dependencies:** PR-048, PR-039
- **Files / Areas:** `apps/server/src/storage/schema.ts`, `apps/server/src/storage/postgresStore.ts`, `apps/server/test/storage.test.ts`, `apps/server/drizzle.config.ts`
- **Scope / Acceptance:** Introduce PostgreSQL/Drizzle with versioned snapshots, events, deduplication results, room/session-hash tables, and migrations. Preserve the RoomStore interface.
- **Required verification:** Use a real test database for round trips, unique constraints, revision conflicts, and initial migrations; mocks alone cannot establish acceptance.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-057 [MEDIUM] — Implement atomic commits and failure handling

- **Milestone:** M11
- **Status:** WAITING
- **Dependencies:** PR-056
- **Files / Areas:** `apps/server/src/storage/commit.ts`, `apps/server/src/commands/submit.ts`, `apps/server/test/storage-failures.test.ts`
- **Scope / Acceptance:** Transactionally write snapshot, command result, and events. Failure changes neither authoritative memory nor success acknowledgments. Sequence numbers remain monotonic.
- **Required verification:** TS-DURABLE: errors before/during commit fully roll back; CAS conflicts fail; acknowledgment follows successful commit only.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-058 [MEDIUM] — Implement restart recovery and lost acknowledgments

- **Milestone:** M11
- **Status:** WAITING
- **Dependencies:** PR-057, PR-041
- **Files / Areas:** `apps/server/src/storage/recoverRoom.ts`, `apps/server/src/sessions/reconnect.ts`, `apps/server/test/restart.test.ts`
- **Scope / Acceptance:** Restore rooms, sessions, snapshots, and processed commands after restart. A retry after a post-commit/pre-acknowledgment crash returns the saved result.
- **Required verification:** TS-DURABLE: same-token recovery after a real process restart; retries grant no duplicate resources; no actions lost during snapshot/subscription recovery.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-059 [LOW] — Add version guards and recovery drills

- **Milestone:** M11
- **Status:** WAITING
- **Dependencies:** PR-058
- **Files / Areas:** `apps/server/src/storage/versionGuard.ts`, `apps/server/test/versionGuard.test.ts`, `docs/RECOVERY.md`
- **Scope / Acceptance:** Explicitly isolate unsupported save versions; upgrade only through known migrations. Document backup/restore and history export.
- **Required verification:** Rejected old versions retain original data; restored backups reproduce replay/final views; diagnostics exports contain no credentials.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-060 [MEDIUM] — Perform the final rule and boundary audit

- **Milestone:** M12
- **Status:** WAITING
- **Dependencies:** PR-055, PR-059, PR-003
- **Files / Areas:** `docs/RULE_AUDIT.md`, `docs/TEST_SCENARIOS.md`, `docs/BACKLOG.md`
- **Scope / Acceptance:** Independently audit against the rulebook, emphasizing Captain, workers, building combinations, scoring, and visibility. Create regression-test tickets before fixing findings.
- **Required verification:** Every ruleId maps to implementation and passing tests; close all blocking defects. Unreviewed items cannot be called passed.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-061 [LOW] — Containerize and document private deployment

- **Milestone:** M12
- **Status:** WAITING
- **Dependencies:** PR-059
- **Files / Areas:** `Dockerfile`, `compose.yaml`, `.dockerignore`, `docs/DEPLOYMENT.md`, `.env.example`
- **Scope / Acceptance:** Provide a single-instance web/realtime service and database. Document TLS, environment variables, migrations, backups, and shutdown without automatically provisioning hosting.
- **Required verification:** From a clean environment, build, start, check health/connectivity, and recover after restart. Images and logs contain no secrets.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-062 [LOW] — Automate regression checks

- **Milestone:** M12
- **Status:** WAITING
- **Dependencies:** PR-060, PR-061
- **Files / Areas:** `.github/workflows/ci.yml`, `package.json`, `docs/EXECUTION.md`
- **Scope / Acceptance:** After choosing a hosted repository, configure lint/typecheck/test/build and separate e2e checks. Local and CI entry points match.
- **Required verification:** Full checks pass in a clean environment; checks detect prohibited engine network/UI imports. Without a remote, record local results only.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## PR-063 [LOW] — Accept the release candidate

- **Milestone:** M12
- **Status:** WAITING
- **Dependencies:** PR-062
- **Files / Areas:** `docs/RELEASE_CHECKLIST.md`, `docs/PLAYTEST.md`, `docs/BACKLOG.md`
- **Scope / Acceptance:** Friends complete a real game at the target URL, including refresh/disconnection/recovery. Record release version, known limitations, and rollback procedure.
- **Required verification:** Retain complete playtest and scoring evidence; no blocking bugs. Keep pending if deployment is unauthorized or no test participants are available.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** Not executed.

## Initial effort distribution

67 tickets: 46 LOW and 21 MEDIUM. PR-003 added PR-027A, PR-030A, PR-033A, and PR-033B to keep building implementation tasks within three abilities. Do not combine complex tasks merely to preserve this ratio.
