# Interactive tutorial — lean implementation plan

Status: implemented locally. The fixed lesson has eight checkpoints, including a separate Craftsman bonus step.

## Scope

Add **Learn to play** beside the lobby's demo button. It opens a short, solo, interactive lesson without creating a room, opening a socket, requiring a password, or waiting for other players. Support English and Chinese, desktop and mobile.

Two requirements are non-negotiable:

1. Users cannot select or act on unintended objects during a tutorial step.
2. Returning to the lobby immediately deletes all tutorial progress. Entering again always starts from the beginning.

The first version is one fixed lesson, roughly five minutes. No branching lessons, free play, real bots, saved progress, completion badges, or tutorial editor. The existing view-only demo stays available separately.

## Lesson and presentation

Use three preset seats: the learner and two scripted opponents. Follow one prepared sequence with short, explicitly labelled jumps between teaching moments; do not imply that roles always occur in this order. The fixture determines exact quantities, prices and points from the engine.

| Chapter | Learner interaction | Teaching point |
| --- | --- | --- |
| 1. Choose a role | Select and confirm the highlighted Planter role. | A role starts a phase; its chooser receives a privilege. |
| 2. Take an estate | Select and confirm one highlighted corn estate. | Estates grow goods when staffed. |
| 3. Build | After a labelled jump to building, select and buy Small Market. | Buildings cost coins; their abilities need workers. |
| 4. Assign workers | Move the worker from the fruit estate to corn, place a pool worker in Small Market, then confirm. | Only staffed estates/buildings are active. Each pick/place is its own restricted substep. |
| 5. Produce | Explicitly confirm production; if the fixture offers a production bonus, choose the highlighted good. | Corn needs no processing building. Briefly explain that other goods may need one. |
| 6. Trade | Select one specified corn crate, then the trading depot, and confirm if required by the existing UI. | Trading earns coins; show the staffed Small Market's effect from the actual result. |
| 7. Ship | Select a remaining corn crate, then one highlighted compatible ship. | Shipping earns points rather than coins. Explain the role privilege if it applies in this fixture. |
| Finish | Return to lobby. | A short recap of estates, workers, coins and points. No completion record is retained. |

Prepare enough workers, goods and coins for the complete sequence. Verify that trading leaves corn for shipping, that Small Market is staffed, and that the chosen ship has capacity. Scripted opponent actions and skipped decisions must be legal, deterministic and visible as a brief summary; they are not an AI opponent feature.

Reuse the global matte-glass material, existing outlines, camera shortcuts and tooltip component. Add one compact instruction card with chapter progress, one instruction and a permanently accessible **Exit tutorial** button. No new glass style, full-screen spotlight mask or arrows framework.

- Desktop: position the card without covering the current target or action buttons.
- Mobile: reuse the lower tooltip area beside the view controls; avoid stacking two cards there. Inspection temporarily replaces the instruction in that area, with an explicit return to the instruction.
- Move the camera on chapter entry, then allow pan, rotate and zoom. A small **Focus target** action restores the prescribed view. Respect reduced motion.
- Use **Continue** only for explanations and labelled chapter jumps. Gameplay steps advance after the intended result, not after a timer or camera animation.
- Exit immediately without a confirmation dialog. Label it clearly: “Exit tutorial — progress will be cleared.”

## Implementation approach

Use an in-memory tutorial controller with a small, ordered step list and engine-validated replay fixtures. This is narrower than implementing a second live game client or duplicating game rules in the browser.

At development/test time, prepare the script using `createGame`, `applyCommand`, `getLegalCommands` and the server's existing projection/broadcast helpers. Export only the learner's snapshots, allowed commands and required events as a lazy-loaded frontend fixture. Keep the source script reproducible and validate it in tests. Server projection code runs in fixture generation/tests, never in the browser bundle. Do not hand-edit balances or manufacture production/scoring results.

At runtime, an accepted expected command installs its validated next snapshot. Local worker-draft interactions still use the existing board controls. Scripted opponent commands between learner decisions are already represented in the fixture. This deliberately supports only the prepared path; no general bot engine or alternate outcomes.

Each step needs only:

- Stable ID and localized instruction.
- Snapshot reference and camera destination.
- Allowed target keys, allowed action payloads and allowed draft operations.
- Completion condition: accepted expected action, expected local draft state, or explicit Continue.
- Next step reference, with an optional explanation of skipped turns.

Keep the controller and its store owned by a mounted `Tutorial` component, not a module singleton. Use a small dedicated tutorial shell that reuses TableScene, ResourceDock, shared board actions and the global HUD material. This avoids exposing live-game settings and alternate action forms. The optional target policy in the board-action layer leaves normal games unchanged. The local controller has no Socket.IO, room tokens or reconnect logic.

## Interaction restrictions

Apply restrictions at both selection and submission boundaries; hiding a button or removing an outline alone is insufficient.

1. A target is actionable only when it is both normally legal and explicitly allowed for the current tutorial substep. Apply this check before changing selection, held goods or worker drafts. Disallowed hits still consume the click so it cannot fall through to an allowed object behind them.
2. Only allowed targets receive action highlights. Hover and long-press hints are limited to the current allowed/inspection targets; unrelated objects do not open panels or show tooltips.
3. Filter and guard all equivalent DOM controls: role hand, action forms, action panels, resource dock, worker placement, confirm, reset and cancel. Keyboard activation must obey the same policy as canvas clicks. Do not render unrelated gameplay controls in the tab order.
4. Recheck the step ID, current revision and complete normalized action payload in the tutorial store's submit handler. Matching only the command kind is insufficient. Reject unexpected or stale submissions without altering state or advancing the lesson.
5. Worker drafts need their own allowed operations and expected draft checks: selecting a worker does not submit a command. A step change clears obsolete selections and hints, while preserving the intended draft between worker substeps.
6. Process each accepted action once. Lock inputs while applying its transition; ignore double taps and delayed callbacks from an earlier step. On explanations, scripted transitions and completion, no gameplay targets are allowed.

Disable auto-produce for the tutorial session without changing the user's saved preference. Omit unrelated settings, player navigation and text-view action paths from the tutorial shell. Keep language, view controls, reduced-motion behavior, the relevant keyboard action equivalents and Exit available. Focus the next instruction or enabled control after a step completes; announce progress through a polite live region.

## Progress lifetime and exit

Progress includes the current step, fixture cursor, snapshots, pending actions, selections, worker drafts, hints and any scheduled opponent/animation work.

- Never write tutorial progress to localStorage, sessionStorage, cookies, IndexedDB, the URL or a backend. The URL may identify tutorial mode only, e.g. `?tutorial=1`.
- All tutorial lobby links call one exit function. First invalidate the session token, cancel callbacks/listeners and clear the controller/store; only then navigate to `/?lobby=1`. Cleanup must finish synchronously before the lobby renders.
- Unmount cleanup is a second safeguard. Every delayed callback checks the session token before doing anything.
- Refresh, navigation away and opening a new tutorial tab start fresh. A `pagehide` handler invalidates the current session; a page restored from the browser back/forward cache must create a fresh session rather than resurrect the old step. Do not rely on `beforeunload` or ordinary unmount alone for this.
- Browser Back from the lobby into tutorial mode starts at chapter 1. No “resume tutorial” link or saved completion flag.
- Leave real room sessions and global preferences untouched; do not use `localStorage.clear()` as tutorial cleanup.

## Delivery sequence

1. **Fixtures and controller:** build the legal scripted sequence, validate it through the engine, export learner snapshots, and implement the memory-only step/exit lifecycle.
2. **Guarded interaction:** introduce the optional policy in `useBoardActions` and the tutorial’s DOM equivalents; enforce it again at submission. Verify restrictions before adding presentation.
3. **Entry and guidance:** add a lazy tutorial route before `liveApp()` so it cannot open a socket; add the lobby button, instruction card, target focus, existing highlights and translations.
4. **Verification:** run fixture/controller tests and focused desktop/mobile browser tests, then the normal repository checks. No deployment or backend migration is required to develop this feature; releasing it is a frontend deployment.

Shared touchpoints: `main.tsx`, `lobby/Lobby.tsx`, `actions/useBoardActions.ts`, the action/worker controls, `scene/Selection.tsx`, `Selectable.tsx`, `ModelHint.tsx`, `TableScene.tsx`, translations and shared styles. New tutorial code and generated data live under `apps/web/src/tutorial/`; fixture generation/validation belongs with test tooling, not production server endpoints.

## Acceptance checks

- Start from the lobby with room-password protection enabled and the backend unavailable: the tutorial still loads; no socket or room request is made.
- Complete the fixed lesson on desktop and a touch viewport. Every shown price, goods change, privilege and score agrees with an engine replay of the fixture.
- During every interactive substep, attempt a normally legal but unintended object, an unrelated hint, an alternative DOM/keyboard action and a direct unexpected submit. None changes selection, draft, snapshot or progress.
- A long press on the intended object shows its hint without text selection, an accidental command or premature step completion. Pan and pinch still work.
- Test duplicate taps, stale commands and saved auto-produce enabled. Only the intended accepted action advances the step, once.
- Exit midway through a worker draft and during a scheduled transition. The lobby appears immediately, the old controller is empty, and delayed work cannot restore it.
- Re-enter, refresh and navigate Back/Forward, including a restored page: every new tutorial visit starts at chapter 1. No tutorial progress is stored anywhere; unrelated preferences and real-room recovery still work.
- Keyboard-only users can finish and exit; mobile instruction/tooltip cards do not overlap the bottom panel or view controls. Live games and the view-only demo retain their current interactions.

## Maintenance

- Entry: `/?tutorial=1`; no room or backend connection.
- Runtime: `apps/web/src/tutorial/{Tutorial,controller,copy}` and `fixture.json`.
- Authoritative fixture source: `apps/server/test/tutorialFixture.ts`. Regenerate deliberately with `UPDATE_TUTORIAL=1 pnpm --filter @vibe-rico/server exec vitest run test/tutorialFixture.test.ts`; ordinary tests compare without writing.
- Coverage: engine replay and displayed reward assertions, controller/selection restrictions, and desktop/mobile browser walkthroughs.
- Building market stock counts use the existing canvas label’s smaller suffix, independently of tutorial mode.
