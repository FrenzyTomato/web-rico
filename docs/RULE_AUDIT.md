# Final Rule and Boundary Audit — PR-060

**Date:** 2026-10-01.

**Method:** two independent read-only reviewers compared the canonical rulebook (S3; text extracted locally with macOS PDFKit, all 44 pages) with `docs/RULES.md` and the engine/server code, and ran the relevant existing tests.
- **Reviewer A:** Captain, workers and Recruiter (rulebook pp.9–11, 14–17, 19–21).
- **Reviewer B:** building catalog and abilities, Builder, Craftsman, Trader, scoring, endgame timing and the visibility boundary (pp.3–4, 9–22).

A mechanical check then mapped every rule ID to scenario cases and test files (table below).

**Result:** no BLOCKER or MAJOR finding. All in-scope tests pass: 144 for A; 385 engine and 4 projection for B. Seven MINOR findings are recorded below. Per EXECUTION.md, regression tests were ticketed (PR-060A) before any fix. No rule was changed.

## Findings

| ID | Severity | Area / rule | Rulebook | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | MINOR (doc) | CAPTAIN-004 Wharf | p.21 "at any time during the Captain phase", once per phase | The engine offers Wharf on the owner's visits, in place of that visit's cargo load. The outcome is identical: any load resets the no-load count, so the owner always gets another visit, and a Wharf owner with goods is never auto-skipped. RULES.md did not say how "at any time" is represented. | Doc sentence in CAPTAIN-004; regression test (PR-060A) |
| AUD-02 | MINOR (test gap) | CAPTAIN-003 Harbor, ENDGAME-001 | p.21 Harbor +1 VP each shipment; p.19 building functions are not mandatory | Declining the optional Harbor point can avoid exhausting the VP supply, and so avoid the end trigger. The code is correct but untested. | Regression test (PR-060A) |
| AUD-03 | MINOR (test gap) | RECRUITER-001/004 | p.10 extra worker from supply; p.11 not enough workers ends the game | Accepting the Recruiter's extra worker can turn the refill into a worker shortage. The code is correct but untested. | Regression test (PR-060A) |
| AUD-04 | MINOR (doc) | VISIBILITY-001 | p.14 VP tokens may be kept face down; the supply is not hidden | `supply.vpRemaining` / `vpOverflow` are public (as in the physical game), so successive views let a client infer opponents' earned VP. VISIBILITY-003 already accepts inference; VISIBILITY-001 did not list the VP supply. | Doc fix in VISIBILITY-001; pinning test (PR-060A) |
| AUD-05 | MINOR (defensive) | VISIBILITY-003 projection | — | `projectForPlayer` copies top-level fields by name but passes nested objects (supply, phase, ships, tiles, buildings) by reference. They hold only public data today, but a future hidden field would pass silently. | Key-allowlist test (PR-060A) |
| AUD-06 | MINOR (UX, needs decision) | BUILDER-003, ENDGAME-002 | p.11 the game ends after this Builder phase | After a City-full trigger, automatic skipping is off, so remaining Builder actors with no affordable building must decline by hand. The outcome and scoring timing are correct; it is only extra clicks. | **User decision**; unchanged |
| AUD-07 | MINOR (test gap) | BUILDER-002 Quarry cap | p.11 expanded buildings by 4 Quarries (−4 coins) | The cap of 4 is never isolated: the only cap test uses 3 Quarries, where both caps give the same price. | Regression test (PR-060A) |

**Not verifiable from the rulebook text:**
- Per-building stock (PROJECT-003, user-supplied).
- Production worker slots 3/3/3/2: the rulebook shows them only in images, and p.12 confirms at least 2 for Large Tobacco Storage. They remain as reconciled in RULES.md.

## Verified correct

**Captain:**
- CAPTAIN-001: mandatory loading.
- CAPTAIN-002: one good per ship; largest ship forced; ties stay the player's choice.
- CAPTAIN-003: Captain +1 once; Harbor per load including Wharf; overflow.
- CAPTAIN-004: Wharf once per phase; cannot be used to skip a load.
- CAPTAIN-005: visits cycle until n visits in a row load nothing.
- CAPTAIN-006: retention with stacked Warehouses.
- CAPTAIN-007: cleanup order.

**Recruiter:**
- RECRUITER-001: optional extra worker; clockwise floor/remainder distribution.
- RECRUITER-002/003: full allocation; idle only when all slots are full.
- RECRUITER-004: refill is max(N, empty building slots); exactly enough is not a shortage.

**Building catalog and abilities:**
- Catalog cost/VP/spaces and Quarry caps match p.3 and pp.11–22.
- BUILDING-001–023 abilities and combinations:
  - Markets stacking with Office and the Trader privilege;
  - Factory 0/0/1/2/3/5;
  - Hacienda before Planter, with Hospital;
  - Builder's Yard;
  - School pre-occupation;
  - Warehouses;
  - Harbor/Wharf;
  - all five large-building bonuses.

**Production, trade and scoring:**
- CRAFTSMAN-001–003: matched production; supply limits; late chooser bonus.
- TRADER-001–003: House capacity; duplicates via Office; clearing only when full at phase end.
- SCORE-001/002: earned (with overflow) + base + bonuses; coins + goods tiebreak; shared rank.

**Endgame and visibility:**
- ENDGAME-001/002: each trigger finishes its phase, then scores.
- VISIBILITY-001–003: no earned VP, bag order or RNG in views, events or legal actions; Hacienda draw revealed only on placement; full scores at game over.

## Rule-to-test map

Every rule ID in RULES.md has at least one scenario case or citing test file. Each test file asserts the rule's literal expectation (see TEST_SCENARIOS.md for the cases).

| Rule ID | Scenario cases (TEST_SCENARIOS.md) | Test files citing the rule |
| --- | --- | --- |
| ADVENTURER-001 | ADV-01 | — |
| BUILDER-001 | BLD-01, BLD-02 | `invariants.test.ts`, `roles/builder.test.ts` |
| BUILDER-002 | BLD-01 | `roles/builder.test.ts` |
| BUILDER-003 | BLD-02, B-16 | `roles/builder.test.ts` |
| BUILDING-001 | B-01 | — |
| BUILDING-002 | B-02 | — |
| BUILDING-003 | B-03 | — |
| BUILDING-004 | B-04 | — |
| BUILDING-005 | B-05 | — |
| BUILDING-006 | B-06 | — |
| BUILDING-007 | B-07 | — |
| BUILDING-008 | B-08 | — |
| BUILDING-009 | B-09 | — |
| BUILDING-010 | B-10 | — |
| BUILDING-011 | B-11 | — |
| BUILDING-012 | B-12 | — |
| BUILDING-013 | B-13 | — |
| BUILDING-014 | B-14 | — |
| BUILDING-015 | B-15 | — |
| BUILDING-016 | B-16 | — |
| BUILDING-017 | B-17 | — |
| BUILDING-018 | B-18 | — |
| BUILDING-019 | B-19 | — |
| BUILDING-020 | B-20 | — |
| BUILDING-021 | B-21 | — |
| BUILDING-022 | B-22 | — |
| BUILDING-023 | B-23 | — |
| CAPTAIN-001 | CAP-01 | `roles/captain-load.test.ts` |
| CAPTAIN-002 | CAP-01, CAP-02 | `invariants.test.ts`, `roles/captain-load.test.ts` |
| CAPTAIN-003 | CAP-03 | — |
| CAPTAIN-004 | CAP-04 | `invariants.test.ts`, `roles/captain-load.test.ts` |
| CAPTAIN-005 | CAP-04, CAP-05 | `invariants.test.ts`, `roles/captain-load.test.ts` |
| CAPTAIN-006 | CAP-06 | — |
| CAPTAIN-007 | CAP-07 | `invariants.test.ts` |
| CRAFTSMAN-001 | PRO-01 | — |
| CRAFTSMAN-002 | PRO-02 | `invariants.test.ts` |
| CRAFTSMAN-003 | PRO-02 | `automatic.test.ts` |
| ENDGAME-001 | END-01 | `invariants.test.ts` |
| ENDGAME-002 | END-02 | `automatic.test.ts`, `invariants.test.ts`, `round.test.ts` |
| INVARIANT-001 | INV-01 | `dispatch.test.ts`, `helpers/verify.ts` |
| INVARIANT-002 | INV-02 | `automatic.test.ts`, `invariants.test.ts` |
| INVARIANT-003 | INV-03 | `invariants.test.ts` |
| PLANTER-001 | PLN-01 | `roles/settler-choice.test.ts` |
| PLANTER-002 | B-08 | `automatic.test.ts`, `invariants.test.ts`, `roles/settler-choice.test.ts` |
| PLANTER-003 | PLN-02 | `invariants.test.ts`, `roles/settler-choice.test.ts`, `roles/settler-complete.test.ts` |
| PLANTER-004 | SET-02, PLN-02 | — |
| RECRUITER-001 | REC-01 | `invariants.test.ts` |
| RECRUITER-002 | REC-02 | — |
| RECRUITER-003 | REC-02 | — |
| RECRUITER-004 | REC-03 | — |
| ROLE-001 | RND-01 | `commands.test.ts`, `projection.test.ts`, `apps/web/src/actions/ActionForm.test.tsx`, `automatic.test.ts`, `invariants.test.ts`, `replay.test.ts` |
| ROLE-002 | RND-03 | `invariants.test.ts` |
| ROLE-003 | RND-03 | — |
| ROUND-001 | RND-01 | `chooseRole.test.ts` |
| ROUND-002 | RND-02 | `automatic.test.ts`, `roles/builder.test.ts`, `roles/settler-complete.test.ts` |
| SCORE-001 | SCR-01 | `helpers/verify.ts`, `invariants.test.ts` |
| SCORE-002 | SCR-02 | `scoring.test.ts` |
| SETUP-001 | SET-01 | `replay.test.ts` |
| SETUP-002 | SET-01 | — |
| SETUP-003 | SET-02 | — |
| SETUP-004 | SET-03 | — |
| SETUP-005 | SET-03 | — |
| SETUP-006 | SET-04 | — |
| TRADER-001 | TRD-01 | `invariants.test.ts` |
| TRADER-002 | TRD-01 | — |
| TRADER-003 | TRD-02 | — |
| VISIBILITY-001 | VIS-01 | — |
| VISIBILITY-002 | VIS-01 | `projection.test.ts` |
| VISIBILITY-003 | VIS-01 | — |
