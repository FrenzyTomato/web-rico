# Dependency-ordered Engineering Backlog

PR-001's original source audit is complete. The user subsequently designated the local 44-page Special Edition rulebook (S3) as canonical; see [reference policy](../references/README.md). PR-002 is DONE against S3 with user-supplied building stock recorded as PROJECT-003; PR-003 is DONE. PR-004 and PR-005 are DONE; PR-006–047, PR-027A, PR-030A and PR-033A/B are DONE; PR-048 is WAIVED by the user (no playtest performed); PR-049–054 are DONE; PR-055 and PR-056 are READY. V1 remains the 3–5-player base game; deterministic setup, role selection, round rotation, base role mechanics and the building catalog are implemented; all23 building abilities and final scoring are implemented; headless controls and replay are implemented; 3/4/5-player full-game fixtures are implemented; application packages remain pending.

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
- **User ruling 2026-10-01:** removed the unrequested extras. The CLI no longer fills in `actorId`, so commands must include it; a missing actorId is `UNKNOWN_COMMAND`. Replay no longer rejects unknown record keys, no longer validates `seed`, and no longer treats non-string version fields as invalid-record (any mismatch is `incompatible-version`). `invalid-snapshot` has no `detail` field. Tests updated; all checks pass (engine 564, protocol 3, server 57).

## PR-035 [MEDIUM] — Define player-view and privacy contracts

- **Milestone:** M5
- **Status:** DONE
- **Dependencies:** PR-003, PR-033
- **Files / Areas:** `packages/protocol/src/views.ts`, `packages/protocol/src/messages.ts`, `docs/PROTOCOL.md`
- **Scope / Acceptance:** Define PlayerView/PlayerEvent/LegalAction DTOs field by field from VISIBILITY rules. Specify developer-tool versus player permissions.
- **Required verification:** Audit scores, RNG, future sequences, legal actions, errors, and logs. Each private-field category has a test specification forbidding disclosure.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 — Added `@vibe-rico/protocol` with type-only DTOs reusing engine types: `views.ts` (PublicPlayerView, PlayerView, PlayerEvent, PlayerLegalActions) and `messages.ts` (PlayerBroadcast, CommandAccepted, CommandRejected with the nine PROTOCOL.md codes). PROTOCOL.md now maps every GameState field to public / viewer-only / not projected, citing VISIBILITY-001–003 and GAME_STATE.md. `earnedVp` goes to the owner only (`viewer`). rng and estateBag are server-only. estateDiscard, endTriggers and snapshot metadata are not projected because they are absent from the public list. `vp-earned` events go to the owner only and `end-triggered` is withheld. Legal actions go to the decision-maker only. Errors carry no engine message text. Developer-tool full state is local-dev only. Disclosure test specifications PRIV-01–07 cover scores, future estate order, RNG, legal actions, errors, logs/credentials and developer state; runtime assertions belong to PR-042. Three compile-time tests in `packages/protocol/test/views.test.ts` pin the exact DTO key sets. A mutation check that added `rng` to PlayerView failed typecheck as intended and was reverted. Checks via npm with Node 24.21.0 (pnpm unavailable on PATH): engine typecheck/test/build pass with 549 tests; protocol typecheck/test/build pass with 3 tests; 552 total. The workspace link was added by hand as the `link:` importer in `pnpm-lock.yaml` plus a `node_modules` symlink, so `pnpm install --frozen-lockfile` has not been run to confirm it. Review fix, same day: review reproduced TS2307 on a clean checkout, because the engine typecheck emits no declarations. Protocol `typecheck`/`test`/`build` now run `tsc -p ../game-engine` first. With both `dist/` directories deleted, each protocol script passes on its own. Rulebook PDF not re-read: no PDF renderer on this machine, and the cited reconciled rules already resolve RULE-TODO-009. No dependencies added and no commit made.
- **User ruling 2026-10-01:** the estate discard pile and recorded end triggers were added to VISIBILITY-001. PlayerView gains `estateDiscard` and `endTriggers`; `end-triggered` events are no longer withheld (only `vp-earned` stays owner-only). The views.test key sets and the PROTOCOL.md table were updated; checks pass.

## PR-036 [LOW] — Add full-game fixtures and property checks

- **Milestone:** M5
- **Status:** DONE (accepted by the user 2026-10-01; Codex's final verification after cleanup was not completed)
- **Dependencies:** PR-034
- **Files / Areas:** `packages/game-engine/test/scenarios/full-games.test.ts`, `packages/game-engine/test/scenarios/invariants.property.test.ts`, `docs/TEST_SCENARIOS.md`
- **Scope / Acceptance:** Provide fixed histories that legally finish for 3/4/5 players. Random legal actions are only for bounded invariant checks.
- **Required verification:** TS-REPLAY: every command accepted, independently verified scoring, invariants at every step, and identical replay/recovery results.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-09-30 implementation (Claude; Codex review pending). Three frozen histories in `test/scenarios/fixtures/full-game-{3,4,5}p.ts` start from `createGame` (seeds 1897/2024/36) and finish legally with no resource edits: 259/340/400 commands, 22/19/15 rounds, each ending by Captain VP exhaustion (revisions 256/335/390, overflow 2/5/14). They were generated once by a temporary authored strategy that chose from legal descriptors, then saved as literal command lists; tests only replay them. `full-games.test.ts` (6 tests) checks, for every command: only the decision-maker has legal actions, the command is accepted, the input is unchanged, revision +1, contiguous event indexes, `assertGameState`, test-local conservation ledgers (goods, estates, Quarries, buildings, workers, VP; literals from SET-01/03, not the engine catalog), and an identical transition from a restored snapshot. At game-over, engine scores must equal a test-local scorer (literal building VP and bonus rules, competition ranks) and frozen per-seat literals; earned VP and overflow must equal the `vp-earned` event tally; every base role (plus Adventurer at 4/5) was chosen at least once; no seat has legal actions. Replay: the serialized record reproduces the final state and all per-revision events. Recovery: a replay from a restored snapshot at every round start (22/19/15 checkpoints) reproduces the same final state and remaining events. `invariants.property.test.ts` (9 tests): random legal play for 3/4/5 players × 3 seeds with a test-local PRNG, capped at 400 steps. Each generated command must be accepted, keep invariants and ledgers, and be deterministic after snapshot recovery. The same command from another seat must fail with WRONG_ACTOR. The step cap is diagnostic, not a completed game. Coverage limitation: all three fixtures end by VP exhaustion, and the only nonzero final bonus is Fire Station (6); City/worker triggers and the other bonuses remain covered by the existing boundary tests. One test-side error was fixed during development: the event tally first added `overflow` to `quantity`, but `quantity` already includes overflow. No engine bug or rule change was found. Checks via npm with Node 24.21.0: engine typecheck/test/build pass (564 tests); protocol typecheck/test/build pass (3). The temporary generator was deleted after the fixtures were saved. No dependencies added and no commit made.

## PR-037 [LOW] — Create server and protocol entry points

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-035, PR-036
- **Files / Areas:** `apps/server/package.json`, `apps/server/src/app.ts`, `packages/protocol/package.json`, `packages/protocol/src/schemas.ts`, `apps/server/test/protocol.test.ts`
- **Scope / Acceptance:** Introduce Fastify/Socket.IO/Zod, gameplay and room envelope schemas, and a health check. Reject oversized input.
- **Required verification:** Health check succeeds; reject wrong types, unknown versions, oversized payloads, and forged resource fields.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01 — Started after the user accepted PR-036 and paused the Codex pilot automation. Installed the pinned pnpm 11.25.0 through corepack with user approval. The existing lockfile passed `pnpm install --frozen-lockfile`, which confirms PR-035's hand-written protocol link.
  - **Pinned dependencies:** zod 4.6.5 (protocol); fastify 5.12.5 and socket.io 4.8.4 (server); dev dependencies @types/node 24.19.0 (matching the Node 24 runtime), socket.io-client 4.8.4 and a test-only engine type dependency.
  - **`packages/protocol/src/schemas.ts`:** strict Zod schemas for the PROTOCOL.md gameplay envelope and the four ARCHITECTURE RoomCommands, plus `PROTOCOL_VERSION` `"1"` and parse functions returning `VERSION_MISMATCH` / `BAD_SCHEMA`. Actions are engine commands without actorId; `satisfies z.ZodType<PlayerAction>` and an exhaustive kind test keep them aligned with the engine. The protocol package now has a zod runtime dependency; `skipLibCheck` was needed for zod's DOM `URL` declarations.
  - **`CommandRejected.commandId`:** now `string | null`, so a BAD_SCHEMA reply can be sent when the request has no commandId.
  - **`apps/server/src/app.ts`:** Fastify with `GET /health`, Socket.IO `command` events answered on the acknowledgement, and a 16 KiB `maxHttpBufferSize`. Valid requests get `UNAUTHORIZED`, because PROTOCOL step 1 needs sessions (PR-041); nothing reaches the engine.
  - **`apps/server/src/main.ts`** plus a `start` script for a local listener.
  - **Tests:** 39 in `apps/server/test/protocol.test.ts`:
    - the health check;
    - all 14 command kinds accepted, and the goods/building runtime lists checked exhaustive by type;
    - seven wrong-type cases, including a numeric version;
    - explicit VERSION_MISMATCH, including a different-shape v2 and a room request;
    - seven forged-field cases (actorId, envelope playerId, Trader price, Builder price, Captain quantity, cargo VP, Craftsman output);
    - room envelopes;
    - real Socket.IO acknowledgements;
    - an oversized payload closing the connection, while one just under the limit is still answered.

  **Checks** (real `pnpm`, via a corepack shim on PATH): `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 39; 606 total) and `pnpm build` pass with all `dist/` removed. Server and protocol typecheck also pass on their own from clean outputs. `node apps/server/dist/main.js` answered `/health` with `{"status":"ok"}`. Room field names (displayName, roomCode, roomId) are minimal choices for PR-038 to confirm. No commit made.

## PR-038 [LOW] — Implement room storage, creation, and joining

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-037
- **Files / Areas:** `apps/server/src/rooms/store.ts`, `apps/server/src/rooms/inMemoryStore.ts`, `apps/server/src/rooms/lobby.ts`, `apps/server/test/lobby.test.ts`
- **Scope / Acceptance:** Implement InMemoryRoomStore, invitation-code generation, create/join, and startup with fixed seats. Writes follow the expectedRevision contract.
- **Required verification:** Test room-code collision retries, player limits, duplicate names distinct from identity, unauthorized starts, and new-seat rejection after start.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`rooms/store.ts`:** the Room shape (roomId, roomCode, hostPlayerId, seats in join order, game `{seed, state}` or null) and an async RoomStore interface: `create` fails on a taken roomId/roomCode; `update` writes only at the expected revision and increments it.
  - **`rooms/inMemoryStore.ts`:** `InMemoryRoomStore`.
  - **`rooms/lobby.ts`:**
    - `createRoom`: the creator is host and seat 1; code collisions retry with a fresh code.
    - `joinRoom`: at most 5 seats; rejected after start; display names may repeat because identity is a server-generated playerId.
    - `startGame`: host only (`UNAUTHORIZED` otherwise). It fixes seats in join order, makes the first seat Governor, draws a seed and records it with the `createGame` state. The 3–5 player count is enforced by `createGame`, not duplicated.
    - Errors use existing ProtocolErrorCode values (`ILLEGAL_COMMAND`, `UNAUTHORIZED`, `STALE_REVISION`); no new codes.
    - Randomness uses node:crypto `randomUUID`/`randomInt` and is injectable for tests. Room codes are 6 characters from A–Z0–9.
    - The PR-037 room schema fields (`create-room {displayName}`, `join-room {roomCode, displayName}`, `start-game {roomId}`) match this API unchanged.
  - **Tests:** eight in `apps/server/test/lobby.test.ts` cover code-collision retries, code format, the 5-seat cap, start with 2 (rejected) vs 3 and 5, duplicate names with distinct IDs, non-host and stranger starts with no write, and the started state equal to `createGame(seats in join order, Governor seat 1, recorded seed)`. They also cover joins and a second start rejected after start, unknown codes, and concurrent joins where the second write is `STALE_REVISION` with explicit stale/ok store updates. One test-side expectation was corrected: a one-seat room starts at revision 0.
  - **Checks:** real pnpm with all `dist/` removed; frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 47; 614 total) and `pnpm build` pass. The server now depends on the engine at runtime (previously test-only).
  - **Rulings to confirm:** seat order = join order, Governor = first seat (the host), and the room-code format; no doc specifies them. The lobby is not yet wired to Socket.IO: the caller must hold a seat credential, which is PR-041. Pregame leaving and host closure are PR-040. No commit made.
- **User ruling 2026-10-01:** the initial Governor is a uniformly random seat, drawn via injectable `LobbyRandom.pick` (crypto `randomInt`). Seats stay clockwise in join order. Lobby tests assert the picked seat and in-range picks; all checks pass.

## PR-039 [MEDIUM] — Implement room command queues and deduplication

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-038
- **Files / Areas:** `apps/server/src/commands/queue.ts`, `apps/server/src/commands/submit.ts`, `apps/server/test/commands.test.ts`
- **Scope / Acceptance:** Follow PROTOCOL.md processing order. Same-ID/same-payload retries return the original result; different payloads fail; stale revisions do not execute.
- **Required verification:** TS-NET: concurrent different actions, retries after lost acknowledgment, old revisions, and same-ID/different-payload requests; only one valid transition.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`commands/queue.ts`:** `RoomQueues`, one promise chain per room. Tasks run in arrival order, and a failed task does not block later ones.
  - **`commands/submit.ts`:** `submitCommand` follows PROTOCOL.md steps 2–7 in the room queue:
    - **Step 2:** a missing room gets `ROOM_CLOSED`; a room still in the lobby gets `ILLEGAL_COMMAND`.
    - **Step 3:** saved success looked up by (playerId, commandId) within the room's single game. The same `{expectedRevision, action}` returns the saved `CommandAccepted` without reapplying; a different payload gets `COMMAND_ID_REUSE`.
    - **Step 4:** a stale `expectedRevision` gets `STALE_REVISION` with `currentRevision`.
    - **Step 5:** the engine runs with the server-attached actorId; a rejection becomes `ILLEGAL_COMMAND` + ruleId.
    - **Step 6:** one store write against the read revision holds the new snapshot plus an `AcceptedCommand` record (request, acceptedRevision, events). A throwing store gets `STORE_UNAVAILABLE`, nothing is saved, and a retry can succeed. A store-level stale write gets `STALE_REVISION` without `currentRevision`, because it is unknown.
    - **Step 7:** returns the acknowledgement; broadcasts are PR-042.
  - Only successes are saved, per step 6. Step 1 (schema and session) belongs to the caller; roomId and playerId are trusted parameters until PR-041. The history lives in the store's `Room.game.commands`, not in GameState. `store.ts`/`lobby.ts` gained `commands: []`, and one lobby expectation was updated.
  - **Tests:** ten in `apps/server/test/commands.test.ts`:
    - a single accepted command with recorded events;
    - a retry after a lost acknowledgement, after later revisions, returns the original result with no write;
    - same ID with a different action or revision gets `COMMAND_ID_REUSE` with no write, while another seat's same ID is a new command;
    - old revisions;
    - three concurrent different actions give exactly one transition, the others STALE;
    - concurrent duplicates give one transition;
    - engine rejection;
    - storage failure;
    - unknown and lobby rooms;
    - queue order and continuation after a failure.
  - Mutation check: bypassing the queue failed the three concurrency tests, and they passed once it was restored. Two test-side store-revision expectations were corrected.
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 57; 624 total) and `pnpm build` pass. Not yet wired to Socket.IO: submit needs the session-resolved player (PR-041). No commit made.

## PR-040 [LOW] — Implement room lifecycle and resource limits

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-038
- **Files / Areas:** `apps/server/src/rooms/lifecycle.ts`, `apps/server/src/rooms/limits.ts`, `apps/server/test/lifecycle.test.ts`
- **Scope / Acceptance:** Implement pregame leaving, host transfer/closure, and preserved seats after in-game disconnection. Configure empty-room cleanup and rate limits with documented defaults.
- **Required verification:** Disconnection preserves players; start/close races behave predictably; idle cleanup never removes active rooms.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`rooms/lifecycle.ts`:** `RoomLifecycle`. `leave` is pregame and seated-only; it transfers host to the next seat and removes the room with the last seat. `close` is host-only and removes the room. `connected`/`disconnected` change presence only. `sweep` removes rooms empty for the TTL and rechecks inside the queue in case of a reconnect. Store changes run in `RoomQueues`.
  - **`rooms/limits.ts`:** documented defaults (empty-room TTL 24 h, sweep 60 s, 20 events/s per connection) and a fixed-window `RateLimiter`, wired into `app.ts` with `socket.use`; exceeding the limit closes the connection.
  - **Store:** `RoomStore.delete(roomId, expectedRevision)` added. A lobby start on a removed room now returns `ROOM_CLOSED`, as commands do. Defaults are documented in PROTOCOL.md "Room lifecycle and limits".
  - **Tests:** ten in `apps/server/test/lifecycle.test.ts`:
    - leave, host transfer and last-leaver removal (code freed);
    - fixed seats after start, and unseated leavers;
    - host-only close, then join/start/command/close seeing it closed;
    - start→close and close→start;
    - concurrent start+close matching a serial-order outcome;
    - a disconnected player's seat and game preserved past the TTL while others are connected, with their command accepted after reconnecting;
    - a room with a connected player never swept after 500 TTLs;
    - removal only at the full empty TTL, with a reconnect resetting the timer;
    - the limiter window;
    - a real socket closed after exceeding the limit.
  - The concurrent start/close test first wrongly assumed only one could succeed; start-then-close is a valid serial outcome, and the test now asserts serializability. Mutation check: making the sweep ignore presence failed three cleanup tests, and they passed once restored.
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 67; 634 total) and `pnpm build` pass. Presence events and the sweep timer are wired with sessions in PR-041. No commit made.

## PR-041 [MEDIUM] — Implement credentials and basic reconnect

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-039, PR-040
- **Files / Areas:** `apps/server/src/sessions/tokens.ts`, `apps/server/src/sessions/reconnect.ts`, `apps/server/test/reconnect.test.ts`
- **Scope / Acceptance:** Bind random tokens to seats, store hashes, allow one active controller, and recover snapshots/subscriptions without a gap.
- **Required verification:** TS-NET: refresh, network loss, invalid/cross-room tokens, two tabs, commands during recovery, and invalidation of old connections.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`sessions/tokens.ts`:** 32-byte base64url tokens; seats store only a SHA-256 `tokenHash`. Lobby create/join issue the token and return it once.
  - **`sessions/reconnect.ts`:** `Sessions` authenticates a token against one room's seats. `take` bumps the per-seat sessionGeneration and returns the replaced connection; `isCurrent` checks the generation; `release` reports whether a disconnecting socket was still the controller.
  - **`submitCommand`:** takes an `isCurrentSession` check, run inside the room queue (step 2), giving `STALE_SESSION`.
  - **`app.ts`:** now owns the store, queues, lobby, lifecycle, sessions and the cleanup sweep timer. Socket events:
    - `room` does create/join (grants a seat and attaches the session) and start/leave (need the current session).
    - `resume` authenticates, takes control, notifies the replaced socket with `session-replaced`, joins the room channel and reads the revision, all in one queued task.
    - `command` resolves room and player from the session, rejecting a missing session or mismatched envelope roomId with `UNAUTHORIZED`.
    - Controller disconnects feed lifecycle presence.
  - **Protocol:** `resumeRequest` schema, plus `RoomReply` / `SeatGranted` / `Resumed` reply types.
  - **Tests:** six in `apps/server/test/reconnect.test.ts`, over real sockets:
    - hash-only token storage;
    - refresh (resume on a new connection, then act);
    - network loss (retry after a lost acknowledgement returns the original result at revision 1, confirmed by another seat's resume);
    - invalid, cross-room, unknown-room and malformed tokens, plus unauthenticated and cross-room commands;
    - two tabs (old tab notified, its command and leave give `STALE_SESSION`, the new tab acts);
    - commands during recovery (a concurrent accepted Planter command and resume: either the resumed revision includes it, or the resumed socket is already in the room channel).
  - Mutation check: removing the in-queue session check failed the two-tabs test, and it passed once restored. During review I removed a leftover probing loop in a test helper, and fixed the recovery test to use the Planter chooser, so its command is actually accepted concurrently. Existing tests were updated for the new submit parameter and seat hashes.
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 73; 640 total) and `pnpm build` pass. Views and broadcasts on the room channel are PR-042. No commit made.
- **User rulings 2026-10-01:** (1) added the host-only `close-room {roomId}` room request, handled by `RoomLifecycle.close`; tested over sockets (non-host `UNAUTHORIZED`, then `ROOM_CLOSED` for commands). (2) Kept refusing commands whose envelope roomId differs from the session's room; recorded in PROTOCOL.md.

## PR-042 [LOW] — Implement player projections and broadcasts

- **Milestone:** M6
- **Status:** DONE
- **Dependencies:** PR-035, PR-041
- **Files / Areas:** `apps/server/src/projection/playerView.ts`, `apps/server/src/projection/playerEvents.ts`, `apps/server/src/rooms/broadcast.ts`, `apps/server/test/projection.test.ts`
- **Scope / Acceptance:** Implement projectForPlayer and player-filtered event/action/error broadcasts. Never send full GameState.
- **Required verification:** TS-PRIVACY: compare all messages across independent connections. RNG, other players’ private data, tokens, and developer state remain invisible.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`projection/playerView.ts`:** `projectForPlayer`, copying fields one by one. **`projection/playerEvents.ts`:** `eventsForPlayer`; other players' `vp-earned` are dropped.
  - **`rooms/broadcast.ts`:** `broadcastFor` (one seat's `PlayerBroadcast` with `getLegalCommands`) and `broadcast` (every current controller in the room channel).
  - **Wiring:** `submitCommand` takes an `onCommitted` callback, run inside the queue after the write and before the acknowledgement. `start-game` now runs in the room queue and broadcasts revision 0. `resume` sends the seat its current `state` before replying. A takeover removes the replaced socket from the channel.
  - **Tests:** four in `apps/server/test/projection.test.ts`:
    - Replaying the frozen PR-036 3/4/5-player histories, at every revision for every seat: viewer VP only, no player `earnedVp`, no other seat's `vp-earned` (PRIV-01; opponent VP events were confirmed to occur); no current bag tile ID (PRIV-02); no `rng` key or RNG state words (PRIV-03); legal actions equal to the engine's, and empty for non-actors (PRIV-04); full breakdowns at game over.
    - Three real connections plus a takeover tab:
      - each receives only its own addressed `state` at start and after a command;
      - a rejected command reaches only the submitter (PRIV-05);
      - a replaced tab stops receiving, and resume delivers the current view;
      - no inbox contains a token, token hash, `rng` or `estateBag` (PRIV-03/06);
      - `/state`, `/snapshot`, `/debug` and `/dev/state` are 404 (PRIV-07).
  - Mutation checks: spreading player state into the view, and removing the event filter, each failed three full-game privacy tests; they passed once restored. The test imports the engine's PR-036 fixtures by relative path.
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 78; 645 total) and `pnpm build` pass. No commit made.

## PR-043 [LOW] — Create the web entry point and lobby

- **Milestone:** M7
- **Status:** DONE
- **Dependencies:** PR-042
- **Files / Areas:** `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/lobby/Lobby.tsx`, `apps/web/src/network/socket.ts`, `apps/web/src/lobby/Lobby.test.tsx`
- **Scope / Acceptance:** Create a React/Vite page for room creation, invitation-code entry, joining, seat display, and starting; use same-origin connections.
- **Required verification:** Test successful/failed room flows, invite links, full-room and disconnection messages; install and pin compatible versions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`apps/web`:** React 19.3.0 + Vite 8.3.1 (matching Vitest's), @vitejs/plugin-react 6.1.1 and socket.io-client 4.8.4, all exact-pinned. Tests use jsdom 30.1.1, @testing-library/react 16.3.3 and @testing-library/dom 10.4.2 (with @types/react 19.3.0). No Tailwind or Zustand yet; Zustand arrives with PR-044's store.
  - **`network/socket.ts`:** a same-origin `io()`, typed room/resume helpers and saved-seat storage. **`lobby/Lobby.tsx`:** Chinese display text, per ARCHITECTURE. It covers create; join with an invite-code field prefilled from `?room=`; the invite link; the seat list with host/you markers; host-only start; the started state; disconnected and seat-replaced messages; and resume on load/reconnect. `main.tsx`, `index.html` and `vite.config.ts` (dev proxy for `/socket.io`, jsdom test environment).
  - **Server addition, needed for seat display:** the `room-state` broadcast (`RoomState` in protocol; `roomState()` copies seats without token hashes). The PR-042 privacy test now also asserts room-state contents and that no inbox contains `tokenHash`.
  - **Tests:** seven in `apps/web/src/lobby/Lobby.test.tsx`, with a fake socket:
    - create (request, code, invite link, duplicate-name seats, saved seat);
    - invite-link prefill and join;
    - failed join (combined unknown/full/started message, no saved seat);
    - host start (too-few-players message, then the started state);
    - disconnection (message, disabled start, resume on reconnect);
    - seat opened elsewhere;
    - a rejected resume clearing the seat.
  - **Manual check** in the browser pane against the real server and Vite dev proxy: create; join via invite link from another tab; seats rendered. A second tab in the same browser appeared to "miss" updates. Root cause: shared localStorage made it resume, and so take over, the saved seat, correctly moving the older tab out of the channel. In-page and Node probes confirmed the transport delivers every broadcast. The fix was to surface `session-replaced` in the UI, which was then verified in the browser. A temporary debug hook in main.tsx was removed.
  - **Added `.claude/launch.json`** (server + web dev configs, pointing at the local nvm Node 24.21.0).
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 78, web 7; 652 total) and `pnpm build` (including `vite build`) pass. Production static serving is not in this ticket. No commit made.

## PR-044 [LOW] — Implement the authoritative client-state store

- **Milestone:** M7
- **Status:** DONE
- **Dependencies:** PR-043
- **Files / Areas:** `apps/web/src/state/gameStore.ts`, `apps/web/src/state/gameStore.test.ts`, `apps/web/src/network/commands.ts`
- **Scope / Acceptance:** Use Zustand for PlayerView, revision, and pending commands. Old snapshots cannot overwrite newer ones; disable sends while disconnected.
- **Required verification:** Test broadcasts before acknowledgments and vice versa, duplicate/old messages, STALE_REVISION, and reconnect retries with the original commandId.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`state/gameStore.ts`:** `createGameStore(transport)`, a Zustand 5.0.15 (exact-pinned) vanilla store with `latest` PlayerBroadcast (view, revision, legal actions), `connected`, verbatim `pending` requests by commandId, and the last `rejection`. Actions:
    - `receive` accepts only a newer revision;
    - `submit` is null without a live session or a snapshot, and otherwise sends with `latest.revision`;
    - `sessionReady` enables sends and resends every pending request unchanged;
    - `disconnected`.
  - **`network/commands.ts`:** `socketTransport` and `bindStore` (the socket's `state` and `disconnect` feed the store).
  - **Lobby:** an `onSession` callback after create/join/resume, held in a ref so the socket effect doesn't re-run. `main.tsx` creates and binds the store.
  - **Tests:** eight in `state/gameStore.test.ts`:
    - request shape and pending;
    - broadcast before acknowledgement;
    - acknowledgement before broadcast;
    - duplicate and old snapshots ignored (same object kept);
    - `STALE_REVISION` dropping the request without a resend;
    - sends disabled while disconnected, then a resume resending the identical request (same commandId) and settling;
    - no send before the first snapshot;
    - `bindStore` wiring.

    Two lobby assertions check `onSession` after create and after each resume.
  - An initial run failed two lobby tests: a default `onSession` arrow in the effect dependencies re-ran the effect on every render. Fixed with a ref. Mutation check: dropping the revision guard failed the old/duplicate test, and it passed once restored.
  - **Checks:** real pnpm from clean `dist/`: frozen install, `pnpm typecheck`, `pnpm test` (engine 564, protocol 3, server 78, web 15; 660 total) and `pnpm build` pass. The store is not rendered yet; the game view and forms are PR-045. No commit made.

## PR-045 [LOW] — Build complete debug views and action forms

- **Milestone:** M7
- **Status:** DONE
- **Dependencies:** PR-044
- **Files / Areas:** `apps/web/src/debug/GameView.tsx`, `apps/web/src/actions/ActionForm.tsx`, `apps/web/src/actions/ActionForm.test.tsx`, `apps/web/src/debug/ScoreView.tsx`
- **Scope / Acceptance:** Display every shared area and the player’s resources. Provide forms for every LegalAction member, including worker allocation/goods retention, and readable itemized scoring.
- **Required verification:** Every action descriptor can construct a request; server rejection is clearly shown; UI does not reimplement rules.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`actions/ActionForm.tsx`:** `describeOptions` maps each discrete LegalAction one-to-one to labelled requests, for all 12 discrete phases. There are constrained forms for worker allocation (per-slot counts; idle shown as total minus placed) and retention (kept counts plus Warehouse checkboxes). The server validates every submission, and the UI adds no rules.
  - **`debug/GameView.tsx`:** every PlayerView field (round/Governor/phase/decision-maker, own VP, end triggers, role cards, supplies, building market, estate market/discard, ships, Trading House, every seat's public resources). `Game` reads the store, shows the last rejection in Chinese (code + ruleId), and disables actions while disconnected. **`debug/ScoreView.tsx`:** the itemized final table in rank order.
  - The Lobby renders `game` once started; `main.tsx` wires it up. Labels use engine IDs for roles, goods and buildings; terminology help is PR-054.
  - **Tests:** eight in `ActionForm.test.tsx`:
    - Over all three frozen PR-036 games: at every discrete decision, every offered option is accepted by `applyCommand`, and the move actually played is among them (>100 decisions each).
    - Every allocation and retention decision is filled into the rendered form and submits exactly the played command.
    - Rejection text (code + rule); the initial 6 role options; the decision-maker's name.
    - The 3p final table (Chen 46 / Alice 41 / Bruno 34, 11 columns).
  - **Manual browser check** against the real server, with two scripted bot seats: start, role choice, Planter options including the chooser Quarry, bot turns advancing the view, and the allocation form on my turn. An illegal all-idle allocation showed "操作被拒绝：ILLEGAL_COMMAND（规则 RECRUITER-002）"; the legal one was accepted and play continued.
  - **Checks:** real pnpm from clean `dist/`: frozen install, typecheck, test (engine 564, protocol 3, server 78, web 23; 668 total) and build pass. No commit made.

## PR-046 [LOW] — Build developer scenarios and state diagnostics

- **Milestone:** M7
- **Status:** DONE
- **Dependencies:** PR-045, PR-034
- **Files / Areas:** `apps/web/src/debug/ScenarioTools.tsx`, `apps/server/src/debug/scenarios.ts`, `apps/server/test/debug-access.test.ts`
- **Scope / Acceptance:** Local development supports fixture import/export, history inspection, and state copying. Production disables endpoints and hides entry points.
- **Required verification:** Unauthorized/production access fails; damaged snapshots cannot enter games; developer replay identifies command positions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`apps/server/src/debug/scenarios.ts`:**
    - `exportRoom` returns a replay record built from the stored `initialState`, seed and accepted commands, plus a serialized snapshot copy.
    - `importRoom` validates via `replay()`, requires the imported seats to be exactly the room's seats, then writes the replayed game, with command history keyed `import-i`, under the expectedRevision contract.
  - **`app.ts`:** `createApp({ devTools })`, off by default. `main.ts` enables it only with `VIBE_RICO_DEV_TOOLS=1`. Only then are the `debug-export`/`debug-import` handlers registered, and the socket message cap becomes 1 MiB, since full-game replays exceed the 16 KiB player cap. Access requires the caller's current session in that room. A successful import broadcasts the imported state; the importing page reloads, because clients keep only newer revisions.
  - The started-game record gained `initialState`, needed for replay export.
  - **`apps/web/src/debug/ScenarioTools.tsx`:** export (command history list, replay JSON, snapshot copy) and import (failure index or snapshot path shown). It is rendered only under `import.meta.env.DEV`; the production build contains no dev-tools strings (checked).
  - **Tests:** five in `apps/server/test/debug-access.test.ts`:
    - handlers absent without dev tools (acknowledgement timeouts);
    - unauthenticated, other-room and lobby-room access refused;
    - the export replay reproduces the snapshot;
    - a damaged snapshot gives invalid-snapshot, a duplicated command gives rejected-command at index 1, and a non-replay object is refused, with the export unchanged afterwards;
    - foreign seats refused, and a valid import broadcasts revision 0 to all seats.
  - One test-side error was fixed (a second role move after Planter). A real limit issue was found: fixture imports exceeded 16 KiB and closed the socket, hence the dev-only cap.
  - **Manual browser check** (dev server with dev tools, two bot seats): export listed 6 commands; a tampered import showed "第 1 条命令被拒绝：WRONG_PHASE（ROLE-001）".
  - **Checks:** real pnpm from clean `dist/`: frozen install, typecheck, test (engine 564, protocol 3, server 83, web 23; 673 total) and build pass. `.claude/launch.json` enables dev tools for the local server config. No commit made.

## PR-047 [LOW] — Test complete multiplayer games in browsers

- **Milestone:** M8
- **Status:** DONE
- **Dependencies:** PR-045, PR-046
- **Files / Areas:** `apps/web/e2e/full-game.spec.ts`, `apps/web/e2e/reconnect.spec.ts`, `apps/web/playwright.config.ts`
- **Scope / Acceptance:** Use independent Playwright contexts for 3/4/5 players to execute fixed legal histories, refreshing one player during play.
- **Required verification:** TS-UI: everyone reaches game over with matching public state/final scores; refresh preserves identity without duplicate actions.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **Setup:** Playwright 1.63.0 (exact-pinned) with the system Chrome channel, so no browser download, one worker, and two web servers started by the config:
    - `e2e/server.mjs`: the real `createApp` with injected deterministic lobby randomness and a test-only `/e2e/next-game` seed/Governor hook, so fixed histories replay;
    - the Vite dev server.
  - **Support changes:** `createApp` gained a `random` option (lobby injection). The Game root carries `data-revision` so tests can wait for exact revisions. Pure option descriptors moved to `actions/options.ts` so e2e can reuse them. `pnpm --filter @vibe-rico/web test:e2e` builds prerequisites and runs.
  - **`e2e/full-game.spec.ts`:** the three frozen PR-036 histories (3p 259, 4p 340, 5p 400 commands), each seat in its own browser context. Every command is performed by clicking the matching option button or filling the allocation/retention form, after waiting for that revision. One actor refreshes mid-game and resumes their seat. Every seat reaches the same final revision and shows identical rank/name/total rows equal to the engine's scores.
  - **`e2e/reconnect.spec.ts`:**
    - offline right after an action: the disconnect notice shows and clears; all seats are at revision 1 (applied once), and the next command works;
    - a second tab in the same context takes over: the old tab shows the seat-opened-elsewhere message and stays at the old revision.
  - **Defects found and fixed:**
    1. With 4–5 players, the two Adventurer cards had identical labels. Duplicate React keys made them indistinguishable; the 5p run failed with a strict-mode violation. Role labels now include the card ID, keys use the action, and the fixture unit test asserts unique labels.
    2. A dropped connection rejected the pending acknowledgement promise, giving an unhandled rejection. The store now keeps the command pending for the resume retry, with a unit test.
  - **Checks:** real pnpm from clean `dist/`: frozen install, typecheck, test (engine 564, protocol 3, server 83, web 24; 674 total), build, and e2e (5 passed, ~56 s). `test-results/` and `playwright-report/` were added to .gitignore. No commit made.

## PR-048 [LOW] — Run friend playtests and record defects

- **Milestone:** M8
- **Status:** WAIVED (user ruling 2026-10-01). **No playtest has been performed; this is not a pass.** Dependants proceed; the kit in docs/PLAYTEST.md stays ready.
- **Dependencies:** PR-047
- **Files / Areas:** `docs/PLAYTEST.md`, `docs/TEST_SCENARIOS.md`, `docs/BACKLOG.md`
- **Scope / Acceptance:** Organize complete manual playtests. Record every decision needing explanation or lacking usable controls; prepare consistent feedback and reproduction data.
- **Required verification:** Actual playtest records include player count, duration, version, ending, and issues. Never mark unperformed playtests as passed.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01, preparation only; **no playtest has been performed, so this ticket is not DONE.**
  - Added `docs/PLAYTEST.md`: the host procedure (server without dev tools; production web build via `vite preview --host` on the LAN, because `vite dev` would show the developer panel's full private state to players), in-play guidance, a per-session record template (player count, duration, version, ending, refresh/disconnect trials, issues with revision/severity, unclear decisions or controls), and an empty sessions list.
  - Supporting changes: `vite.config.ts` preview proxy for `/socket.io`, checked to reach a running server (HTTP 200); the game screen shows `版本 N` for reproduction.
  - Remaining for DONE: real sessions recorded by the user and friends. Remote (non-LAN) play needs PR-061's deployment.
  - Checks: typecheck, test (674), build and e2e (5) pass.

## PR-049 [LOW] — Create the tabletop scene and fallback

- **Milestone:** M9
- **Status:** DONE
- **Dependencies:** PR-048
- **Files / Areas:** `apps/web/src/scene/TableScene.tsx`, `apps/web/src/scene/Camera.tsx`, `apps/web/src/scene/SceneBoundary.tsx`, `apps/web/src/scene/TableScene.test.tsx`
- **Scope / Acceptance:** Introduce Three.js/R3F/drei, a semi-top-down camera, lighting, and table. Retain the DOM client when WebGL is unavailable.
- **Required verification:** Readable 3/4/5-player layouts; controls work after resize, scene failure, and lack of WebGL.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **Packages** (exact-pinned): three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, @types/three 0.186.0.
  - **`scene/TableScene.tsx`:** a table plus one seat marker per player. `seatPositions` is pure: the viewer is at the front edge and seats run clockwise from above, on an oval inside the table. Names are canvas-texture sprites; the viewer's marker is green and the Governor is labelled.
  - **`scene/Camera.tsx`:** a semi-top-down perspective camera aimed at the table centre.
  - **`scene/SceneBoundary.tsx`:** renders the scene only with WebGL, and shows a notice if it throws. The DOM client sits outside the boundary.
  - **Tests:** six in `TableScene.test.tsx`: 3/4/5-player layouts for every viewer (on the table, viewer in front, clockwise, centres ≥3 apart); no WebGL gives the notice with the scene never rendered and DOM controls still clickable; a throwing scene gives the notice with controls still clickable; jsdom's missing WebGL takes the default fallback.
  - **Manual browser check** with real WebGL, 5 seats (me plus 4 bots): readable clockwise layout. After a tablet resize the canvas re-fits (752 px) and an action still worked.
  - **Defect found and fixed:** drei `<Html>` labels remounted endlessly under React 19 (7,000+ "synchronously unmount a root" errors) and the viewer's label never rendered. They were replaced by canvas-texture sprites; 0 errors over 4 s afterwards.
  - **Checks:** typecheck, test (engine 564, protocol 3, server 83, web 33; 683 total), build and e2e (5 passed, with the scene mounted in Chrome). The build warns about a >500 kB chunk (Three.js); code-splitting belongs to PR-055.

## PR-050 [LOW] — Build shared-area models

- **Milestone:** M9
- **Status:** DONE
- **Dependencies:** PR-049
- **Files / Areas:** `apps/web/src/scene/CommonBoard.tsx`, `apps/web/src/scene/RoleTiles.tsx`, `apps/web/src/scene/Ships.tsx`, `apps/web/src/scene/Markets.tsx`
- **Scope / Acceptance:** Use original geometry for roles, building market, tiles, trading area, ships, and supplies. Models read only PlayerView.
- **Required verification:** Visually check counts and slots for empty/full/exhausted fixtures; overlapping objects must not obscure important data.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01. The user supplied a visual reference (a Three.js Catan client); `docs/DESIGN.md` adapts its structure, palette and typography to Puerto Rico, with original art only.
  - **Shared-area models** (original low-poly geometry, reading only PlayerView): `Ships.tsx` (cargo ships with one slot per capacity crate, and the Trading House's 4 slots); `RoleTiles.tsx` (cards with stacked coins; chosen cards darkened and naming their chooser); `Markets.tsx` (estate market and Quarry stack with discard count; supply barrels with counts, workers, Register and VP; building market in catalog order, sold-out types greyed but listed); `CommonBoard.tsx` arranges them on a larger island table in a teal sea.
  - **Labels:** `Label.tsx` canvas-texture sprites sized to their text. Pure `pieces.ts` helpers: `shipSlots`, `tradingSlots`, `buildingMarket`.
  - **Screen shell (per the user's style direction):** `layout/GameShell.tsx` + `styles.css` tokens and a self-hosted Cormorant Garamond font (@fontsource 5.3.0; no font CDN):
    - top bar;
    - players panel (initials medallions in seat colours, Governor badge, own VP only);
    - 3D stage;
    - turn panel (decision-maker, rejection, final scores, a Chinese chronicle of the last 20 filtered events; the store keeps 50);
    - bottom hand of goods/coin cards plus the action controls;
    - a collapsible full text view, open automatically without WebGL.
    A started game renders full-screen.
  - **Dev-only `scene-preview.html`**, excluded from the production build: renders any revision of the frozen fixtures for visual checks.
  - **Tests:** 38 web tests (new: ship/Trading House/building-market slot counts including empty/full/sold-out, camera-fit bounds, chronicle retention).
  - **Visual checks** (browser, real WebGL): 5p revision 0 (all empty) and 396 (all three ships full 6/6, 7/7, 8/8; chosen roles naming choosers; sold-out buildings greyed; empty supplies greyed). Labels were initially unreadable, so they were made text-sized and the market respaced. In the live 3p shell, side seats were cropped on a narrow stage, so the camera now backs off by stage aspect (`cameraDistanceScale`).
  - **Defect found:** the e2e 3p game timed out after the richer scene because R3F rendered every tab at 60 fps continuously. Now `frameloop="demand"`; the 3p e2e takes 19.5 s.
  - **Regression caught by e2e and fixed:** the full-screen started game had dropped the lobby's disconnect and seat-replaced notices; they now stay above the game.
  - **Checks:** see PR-051 (shared final run). Labels are small on very narrow stages; readability refinement is PR-054.

## PR-051 [LOW] — Build player boards and reusable pieces

- **Milestone:** M9
- **Status:** DONE
- **Dependencies:** PR-049
- **Files / Areas:** `apps/web/src/scene/PlayerBoard.tsx`, `apps/web/src/scene/Buildings.tsx`, `apps/web/src/scene/Fields.tsx`, `apps/web/src/scene/Workers.tsx`
- **Scope / Acceptance:** Display buildings, fields, workers, and goods by seat, mapped by stable instance IDs. Show no unauthorized information.
- **Required verification:** Screenshot checks for empty/full boards and multiplayer layouts; updates leave no stale objects; supplement color with text/shapes.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01, in the DESIGN.md style.
  - **`PlayerBoard.tsx`:** one seat's public board: a seat-colour band, title with Governor/you markers, Countryside and City grids, goods barrels with counts, and a line with coins, idle workers and any Personal Ship. Earned VP is never drawn.
  - **`Fields.tsx`:** 12 spaces; plantations are flat goods-colour tiles and Quarries taller grey blocks, each with a one-character mark so colour is never the only cue; workers are drawn on occupied tiles.
  - **`Buildings.tsx`:** 12 City spaces in build order, using the catalog footprint (two-space buildings never wrap rows); each shows its name and workers against its catalog worker slots (`Workers.tsx`: filled discs vs empty rings).
  - **Layout:** all objects are keyed by stable instance IDs. The engine now exports its `BUILDINGS` catalog, so the UI reads footprints and slots instead of copying rule data. The table grew to 36×24 and the camera scales with it.
  - **Tests:** 40 web tests. The layout test now checks, for 3/4/5 players and every viewer, that boards stay on the table and never overlap. New: 12 Countryside slots empty/full keyed by tile ID; a full City with two-space buildings not wrapping; catalog worker slots.
  - **Visual checks** on the scene preview: 5p revision 396 (full boards, no overlap with the shared area) and 3p revision 0 (starting plantations, empty grids).
  - **Checks:** real pnpm from clean `dist/`: typecheck, test (engine 564, protocol 3, server 83, web 40; 690 total), build, and e2e (3 full games plus 2 reconnect specs, all passing after the notice fix). No PR-051 regressions.

## PR-052 [LOW] — Connect object selection to legal actions

- **Milestone:** M9
- **Status:** DONE
- **Dependencies:** PR-050, PR-051, PR-045
- **Files / Areas:** `apps/web/src/scene/Selection.tsx`, `apps/web/src/actions/ActionPanel.tsx`, `apps/web/e2e/scene-actions.spec.ts`
- **Scope / Acceptance:** Hover/click associates objects with legal-action forms, submitted through the same command channel. DOM controls remain available.
- **Required verification:** Clicks do not mutate authoritative resources; illegal objects offer no executable action; server rejection preserves consistent views.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`scene/Selection.tsx`:** `SceneTarget` (role card, estate tile, Quarry stack, market building, cargo ship, own goods barrel, own Countryside tile) and `optionsForTarget`, which filters the engine-derived options by object and computes nothing itself. A `Selectable` wrapper (click selects, gold outline plus pointer cursor when actionable) is applied to all those objects. A dev-only `TargetProbe` (`window.__sceneTargets`, absent from the production bundle, checked) gives browser tests real canvas positions.
  - **`actions/ActionPanel.tsx`:** the selected object's actions, submitted through the same `store.submit` channel. An object with no legal action says so and offers only "取消选择". Selecting never changes state. The DOM ActionForm stays.
  - **Tests:** six unit tests in `Selection.test.tsx`:
    - over all three frozen games, every object-related move played is reachable by clicking its object (>50 per game), and every option an object offers is one of the engine's options;
    - a sold-out building and an empty option list offer nothing;
    - the panel submits then clears, and shows the no-action message.

    `e2e/scene-actions.spec.ts` clicks the real canvas:
    - another seat's role-card click offers nothing and changes nothing;
    - the Governor's click offers exactly that card's action, and choosing it advances all seats to revision 1;
    - a replaced tab's panel submission is rejected (STALE_SESSION shown) and every view stays at revision 0.
  - **Defects found while stabilising e2e:**
    1. Seat browser contexts were never closed, so WebGL tabs accumulated and the suite slowed to a timeout. `closeTables` now runs after each test.
    2. A real client race: the socket could connect before the lobby subscribed to `connect`, leaving the lobby "disconnected" with disabled buttons; it was intermittent. The lobby now re-reads `socket.connected` after subscribing, with a regression test (mutation-checked).
  - **Checks:** real pnpm from clean `dist/`: typecheck, test (engine 564, protocol 3, server 83, web 47; 697 total) and build pass; e2e 7/7 passed in two consecutive runs (1.7 min each).

## PR-053 [LOW] — Implement event animation and interruption recovery

- **Milestone:** M10
- **Status:** DONE
- **Dependencies:** PR-052
- **Files / Areas:** `apps/web/src/animation/eventQueue.ts`, `apps/web/src/animation/transitions.ts`, `apps/web/src/animation/eventQueue.test.ts`
- **Scope / Acceptance:** Use short event-driven animations, deduplicated by revision and event index. Skipping, reconnecting, or lagging aligns directly to the snapshot.
- **Required verification:** TS-MOTION: duplicate/missing events, new state during animation, skip, and reconnect; the final view always matches the latest snapshot.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **`animation/eventQueue.ts`:** a pure queue of short (600 ms) highlights.
    - Broadcasts are accepted once each in revision order, so every (revision, index) is seen at most once; duplicate and old broadcasts are ignored.
    - A revision gap (missed events, or a reconnect snapshot) drops pending effects and aligns to the snapshot.
    - A lagging backlog of more than 6 keeps only the newest; `skip` clears everything; a zero duration (for reduced motion, PR-054) shows nothing.
    - The queue never holds game state, so the scene always renders the latest snapshot.
  - **`animation/transitions.ts`:** `effectFor` maps an event to an on-table object (role card, market building, own tile, cargo ship).
  - **Wiring:** a pulsing gold ring on the matching `Selectable` that requests frames only while active; a 「跳过动画」 skip button while effects play.
  - **Tests:** seven in `eventQueue.test.ts` (TS-MOTION): order and duration, duplicate/old, gap or reconnect alignment, new state during an animation, lag cap, skip, zero duration, event mapping.
  - **Manual browser check:** choosing a role and building showed the pulse and skip button, and the chronicle updated.
  - **Defect found and fixed:** with on-demand rendering, the canvas image could be discarded (white or empty stage after a state change) and nothing redrew it. A `Redraw` helper now invalidates on every view change and on visibility, with a 1 fps safety net; verified during and after a pulse.
  - **Checks:** real pnpm from clean `dist/`: typecheck, test (engine 564, protocol 3, server 83, web 54; 704 total), build, e2e 7/7 (2.3 min).

## PR-054 [LOW] — Improve readability and accessibility

- **Milestone:** M10
- **Status:** DONE
- **Dependencies:** PR-052
- **Files / Areas:** `apps/web/src/actions/ActionPanel.tsx`, `apps/web/src/settings/Settings.tsx`, `apps/web/src/styles.css`, `apps/web/e2e/accessibility.spec.ts`
- **Scope / Acceptance:** Clearly identify the decision-maker, errors, and reasons for waiting. Provide complete keyboard controls, focus indicators, reduced motion, and terminology help.
- **Required verification:** Complete representative roles by keyboard; distinguish cues without color; reduced-motion settings prevent mandatory long animations.
- **Out of scope:** Other tickets’ deliverables; consume dependencies only through defined interfaces.
- **Evidence:** 2026-10-01
  - **Decision-maker and waiting, stated in text:** the turn panel says 「轮到你：<phase>」 or 「等待 <name>：<phase>」, and the acting seat is marked 「（行动中）」, so colour or outline is never the only cue. Errors keep `role="alert"` with code and rule.
  - **`settings/Settings.tsx`:** a 「设置与帮助」 panel with a 「减少动画」 toggle (default from `prefers-reduced-motion`, saved per browser) and a glossary of the seven roles plus 总督 and 运货分. Reduced motion makes the event queue zero-length, so no pulses play, and disables CSS transitions/animations.
  - **Keyboard:** every action is a native button or form control. A strong `:focus-visible` ring was added. In `ActionPanel.tsx`, the first option takes focus and Escape closes.
  - **Tests:** two settings unit tests (system default plus document class; saving plus glossary). `e2e/accessibility.spec.ts`:
    - the first 9 commands of the frozen 3p game (Recruiter choice, recruit decision, three allocation forms, the next role and Planter turns) are played by Tab/Enter/typing only, with a non-`none` outline asserted on each focused control and all seats reaching revision 9;
    - turn/waiting/acting texts on actor and waiting seats;
    - with `reducedMotion: 'reduce'` the setting is on and no skip button (pulse) ever appears after a role choice.
  - **Checks:** real pnpm from clean `dist/`: typecheck, test (engine 564, protocol 3, server 83, web 56; 706 total), build, e2e 10/10 (2.4 min).

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
- **Status:** READY
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
