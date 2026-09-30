# Puerto Rico Online Implementation Plan

> **For agentic workers:** During implementation, use `superpowers:executing-plans` task by task. Use `superpowers:subagent-driven-development` only if the user explicitly chooses delegation. This planning run delivers documents only.

**Goal:** Let 3–5 friends complete a rules-correct online Puerto Rico game in a private room, reconnect after refreshing, and see clear final scoring.

**Architecture:** A pure TypeScript engine performs deterministic state transitions. One server instance authenticates players, serializes execution, and stores results. Clients receive player views and legal choices; React DOM and Three.js render them without adjudicating rules.

**Tech Stack:** pnpm / TypeScript; React / Vite / Three.js / React Three Fiber / drei / Zustand / Tailwind; Node.js / Fastify / Socket.IO / Zod; Vitest / fast-check / Playwright; later PostgreSQL / Drizzle / Docker.

**Spec:** [Architecture and requirements](ARCHITECTURE.md), [rules specification](RULES.md), [protocol](PROTOCOL.md). The stack follows the original discussion. Verify and pin compatible versions during PR-004, PR-037, PR-043, and PR-049 rather than guessing future versions here.

## Global Constraints

- V1: 3–5 players, Puerto Rico 1897, private rooms. No AI, matchmaking, accounts, rankings, spectators, expansion framework, physics simulation, voice, native mobile apps, or horizontal scaling.
- Rule correctness comes first. Record unresolved rules as `RULE-TODO`; do not fill gaps from memory.
- The engine has no UI, network, or database dependencies. Neither `Math.random()` nor system time may drive rules.
- Clients cannot mutate canonical state. Server sessions bind identity. Hidden information must not enter other players' state, events, legal actions, or logs.
- Use original or placeholder assets; do not reproduce commercial images, scans, textures, or icons.
- Execute one READY ticket per run by default. Most tasks should touch 2–6 core files; split before exceeding roughly 8 files.
- This planning run installs no dependencies, implements no production code, and deploys nothing. Git and workspace initialization belong to PR-004.

## Review Focus

| High-risk input or condition | Expected behavior | Owner |
| --- | --- | --- |
| Retry after execution but lost acknowledgment | Return the original result without charging or granting resources twice | PR-039, PR-058 |
| Two tabs controlling one seat; old connection submits | One active controller; the old connection cannot act | PR-041 |
| Hidden scores or future tile order in logs/events | Consistent player filtering and a field-level visibility audit | PR-035, PR-042 |
| No available shipping or worker-allocation action | Bounded automatic progress; no invalid pass to evade mandatory actions | PR-013, PR-023, PR-025 |
| End trigger occurs before the required phase/round finishes | Record the reason and finish at the correct scoring boundary | PR-032 |

## Why this sequence

Use pure engine → complete headless game → multiplayer debug UI → 3D. Rule bugs can then be reproduced with a seed, snapshot, and command history.

A visual-first prototype helps explore art but delays discovery of role-phase and mandatory-action problems. Full event sourcing or distributed room services add unnecessary operational complexity. Use snapshots plus command history, a single-instance room queue, and an explicit storage interface.

## Milestones

| Milestone | Deliverables | Exit criteria | Tickets |
| --- | --- | --- | --- |
| M0 Rules freeze | Edition, sources, rule IDs, scenarios | All core RULE-TODOs resolved; every rule has a source location | PR-001–003 |
| M1 Tooling and engine foundation | Workspace, types, RNG, invariants, snapshots | Compilation, determinism, and serialization checks pass | PR-004–009 |
| M2 Setup and rounds | Setup, role selection, rotation, automatic progress | Multi-round fixtures pass for 3/4/5 players | PR-010–013 |
| M3 Base roles | Legality, actions, privileges, phase completion | Full role scenarios and invalid-input tests pass | PR-014–025 |
| M4 Building abilities | Every selected-edition building and interaction | Complete catalog coverage, including active/inactive tests | PR-026–031 |
| M5 Endgame and complete headless play | Endgame, scoring, replay | Legal complete games for 3/4/5 players with identical replay | PR-032–036 |
| M6 Multiplayer service | Rooms, identity, command queue, basic reconnect | Consistent authoritative state; retries have no duplicate effects | PR-037–042 |
| M7 Debug web client | Lobby, state, action forms, developer tools | Every action is usable; complete play without Three.js | PR-043–046 |
| M8 Playable acceptance | Browser games and friend playtesting | End-to-end flows pass for all three player counts | PR-047–048 |
| M9 Three.js tabletop | Scene, shared area, player boards, selection | 3D matches authoritative state; all actions retain DOM access | PR-049–052 |
| M10 Interaction and animation | Event animation, accessible controls, performance | Play survives interrupted animation; agreed-device targets met | PR-053–055 |
| M11 Persistence and recovery | Transactional snapshots, deduplication, restart recovery | Fault injection loses no acknowledged action and duplicates no execution | PR-056–059 |
| M12 Private release | Rule audit, containers, recovery guide, trial run | No blocking defects; friends complete a game through a URL | PR-060–063 |

M1 tooling ticket PR-004 can proceed independently of rule clarification. M3 can verify individual roles with controlled fixtures; that does not establish complete playability. M6 reconnect covers refresh/disconnect while the process survives; M11 adds durable recovery after server restart. M9 waits for M8. M11 can follow M8 before visual polish; release requires both.

## Scope and file map

```text
apps/server/src/{rooms,sessions,commands,projection,storage}
apps/server/test/
apps/web/src/{lobby,state,debug,actions,scene,animation}
apps/web/e2e/
packages/game-engine/src/{model,rng,invariants,setup,round,roles,buildings,scoring,replay}
packages/game-engine/test/{roles,buildings,scenarios}
packages/protocol/src/{commands,views,messages,schemas}
packages/ui/src/              # Create when components first need cross-page reuse
apps/web/public/assets/      # Original assets; no premature standalone asset package
docs/
```

This is a planned structure; ticket paths refer to future files. The engine owns internal domain types. Protocol owns transport DTOs, runtime schemas, and player views. The server maps between them. The web runtime depends only on protocol and UI, not engine adjudication logic.

## Execution and estimates

[BACKLOG.md](BACKLOG.md) is the execution entry point. Each ticket includes scope, dependencies, files, acceptance, tests, and effort. Although 1897 is selected, M0 must supply source-verified numbers and the building catalog; do not invent them now. After M0, reassess whether M3/M4 tasks still fit one run each.

This initial 63-ticket backlog does not promise completion in exactly 63 runs. Complete PR-001–004 first, record implementation, verification, and revision time, then use median task duration to estimate remaining work. Budget separately for rule audits, full-game playtests, and fixes. Model effort is not a guarantee of duration or correctness.

## References

- Original requirements: [Generate implementation plan](chatgpt-conversation://6ab8855c-fcb0-83ec-b69a-0d8e26e4bd3c). The readable final message was truncated at roughly 20,000 characters; this plan does not claim to cover the unseen tail.
- [React Three Fiber introduction](https://r3f.docs.pmnd.rs/getting-started/introduction): a React renderer for Three.js, compatible with keeping DOM controls.
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/): default delivery does not replace application persistence, acknowledgments, or deduplication; see PR-039 and PR-057–058.
