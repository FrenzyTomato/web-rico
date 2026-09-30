# Single-Task Execution Guide

## Workflow

Always consult [the canonical local rulebook](../references/puerto-rico-1897-special-edition-rulebook-en.pdf) when uncertain. Follow [its reference policy](../references/README.md); S3 supersedes S1; the reconciled specification labels interpretations and remaining source gaps explicitly.

1. Select a BACKLOG.md ticket whose dependencies are complete and rules established. Check status; do not bypass blockers by following numbers alone.
2. Choose the run's effort from `[LOW]` / `[MEDIUM]`. These labels are recommendations, not records of automatic switching.
3. Implement only that ticket and its necessary tests. Record out-of-scope findings as new tickets.
4. For rule or behavior changes, write a failing test, implement, then verify. Validate documentation and simple configuration according to risk; avoid tests that merely mirror implementation.
5. Record actual changes, check commands and results, rule sources, and remaining issues. Explicitly identify checks not run.
6. Mark DONE only after acceptance. Failed dependencies cannot pass a milestone on a promise to fix them later.

## Reusable task prompt

```text
Execute PR-XXX in docs/BACKLOG.md. Complete only this ticket.
Read README.md, docs/ARCHITECTURE.md, the relevant rules, and dependencies first.
Verify dependencies are complete. Do not guess rules still marked RULE-TODO.
Follow the file scope, acceptance criteria, and required tests. Split oversized work.
For behavior changes, write a failing test first, then implement and verify.
Do not automatically continue to another ticket, deploy, or change unrelated features.
Report changes, actual check results, and unresolved issues; update ticket status.
```

## Effort selection

LOW: types, components, schemas, simple rules, and known scenario tests under an established design.
MEDIUM: state machines, Captain/Mayor logic, complex building combinations, endgame/scoring, visibility boundaries, concurrent recovery, and transactional failure semantics.

Choose effort for complexity, not a target ratio. Split large tasks first. If a LOW task reveals unresolved cross-module design, record the issue and split that design into a MEDIUM ticket.

## Current status

PR-001 source verification is complete. PR-002 is complete against S3 with user-supplied building stock documented in PROJECT-003. PR-003 coverage, PR-004 workspace setup, and PR-005 domain interfaces are complete. PR-006 IDs/snapshot serialization and PR-007 reproducible RNG are complete; PR-008 invariants and PR-009 command/error entry points are complete; PR-010 deterministic setup is complete; PR-011 role selection, PR-012 internal round rotation, PR-013 bounded automatic progression, PR-014 ordinary Planter choice, PR-015 market refill/completion and PR-016 basic Builder purchases and PR-017 Recruiter advantage/distribution and PR-018 worker placement/refill and PR-019 Craftsman production/bonus and PR-020 base trading/clearing and PR-021 Adventurer income and PR-022 cargo-ship eligibility and PR-023 cargo loading/turn traversal and PR-024 shipping points and PR-025 retention/cleanup and PR-026 shared building catalog, PR-027 economic abilities and PR-027A Office and PR-028 settlement abilities and PR-029 School, PR-030 Warehouses and PR-030A Harbor/Wharf and PR-031 building coverage audit are complete; PR-032 and PR-033A/B/033 and PR-034 headless controls/replay and PR-035 player-view/privacy contracts are complete; PR-036 is ready. Typecheck/build pass; 549 engine + 3 protocol tests pass; full-game fixtures and application packages remain unimplemented.


PR-032 ruling: use `game-over` with explicit `scores:null` until PR-033 integrates aggregate scoring, rather than inventing score totals or implementing later tickets. Play is terminal immediately after role cleanup; PR-033 owns filling scores at this boundary. Cost if this staging representation persists: consumers must handle pending scores until scoring integration is complete. Work continues in the existing checkout because the repository has no baseline commit and its files remain untracked; no commit or worktree migration was attempted.


PR-033A/B/033 completion: five pure activated bonus calculators, aggregate base/earned/bonus scoring and shared competition ranks are implemented. Final completion populates mandatory scores and emits exactly one ordered `game-scored` event; PR-032's temporary null scores are removed. Reused existing activation and catalog facts; no dependency additions. Initial calculator assertions failed14 bonus cases and8 aggregate/integration cases before implementation; final typecheck/test/build pass (537 tests). Tests include literal rule examples, overflow, post-cleanup inventory, frozen-input determinism and 3/4/5-player terminal integration. No commit made because the repository still has no baseline commit.

PR-033A/B/033 final review: fresh reviewer found no material issues; acceptance satisfied. Focused38 scoring/endgame tests and full537-test suite pass.
