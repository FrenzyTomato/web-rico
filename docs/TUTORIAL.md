# Interactive tutorial

Status: local implementation updated to a continuous simulated game. The old snapshot-jumping lesson has been removed.

## Experience

**Learn to play** starts a three-player local game with the learner, Bruno and Chen. It mounts the normal `GameShell` — the same board, hand, command tiles, action panel, worker controls, player list and timeline as normal play — fed by a local store instead of a socket. The only tutorial UI is a guide tooltip. There is no room, backend connection, password check or saved progress.

The learner chooses actual illustrated command tiles. The other players choose roles and take their own turns visibly. Every legal follow-up is executed in order; production, role bonuses, worker placement and shipping are not replaced by future snapshots. Recruitment is simultaneous in the rules; the tutorial presents the players' confirmations one at a time to make them understandable.

The guided sequence spans three rounds:

| Round | Role choices | What happens |
| --- | --- | --- |
| 1 | You: Planter; Bruno: Builder; Chen: Recruiter | Everyone takes estates, builds and assigns their first workers. You build Small Market and staff your corn. |
| 2 | Bruno: Recruiter; Chen: Trader; You: Craftsman | Everyone assigns more workers; you staff Small Market. Trading ends at once without goods. You choose Craftsman, everyone produces, and you choose the bonus corn. |
| 3 | Chen: Trader; You: Captain | Opponents keep their goods for shipping. You trade one corn, then choose Captain. All three players complete their shipping turns before the lesson finishes. |

Opponent choices are scripted for teaching, not a general AI. They apply real legal commands and consume the same finite resources. The tutorial ends after Captain finishes, not immediately after the learner's shipment and not at a pretend game-over screen.

## Guidance and input

`GameShell` takes an optional `guide` (`ShellGuide`). Without it, normal play is unchanged.

- **Restriction.** `allowAction` filters the options offered by the hand, `ActionForm` and the action panel. `allowTarget` restricts scene, dock and keyboard worker targets to the next substep (`allowedTargets`). Command tiles stay visible, but only the guided tile is enabled and outlined. During opponent moves the learner gets no legal actions, so the hand reads "Waiting for other players…".
- **Opening pages.** Before the first move, four guide pages walk through the whole table, the learner's island (estates in the back fields, buildings in the front town), the places to check (estates, buildings, boats, trader depot) and how a round flows, especially the follow-up: everyone acts on each chosen role. The controller stays in its `intro` stage until **Start**, so no actions are offered meanwhile.
- **Island checks.** After the learner plants or builds, a `result` stage turns the camera to their island and explains what was added. Worker placement opens on their island and points out where estates and buildings are.
- **No object hints.** `TableScene` takes `hints={false}` in the tutorial, so hovering or long-pressing other objects never opens their hint; the guide is the only tooltip.
- **Guide tooltip.** It uses the hover-hint material. On desktop it sits in the hint corner (top right); on phones it sits in the bottom hint slot. On phones it hides while the action panel is showing. It states whose turn it is and what to do with the in-game control. It also explains the previous move and its follow-up (for example "Bruno chose Builder. Starting with Bruno, everyone may build once…").
- **Opponents.** Each opponent move shows a short preview with its target highlighted. Then it is applied and the result is explained. Both auto-advance (`PREVIEW_MS`, `RESULT_MS`); the tooltip's **Next** advances immediately without skipping engine commands.
- **Camera.** Focuses the current action, including an opponent's own island for worker placement.
- Auto-produce is off in the tutorial without modifying the user's saved setting. Exit uses the shell's normal **Back to lobby** link; the finished guide offers the same link.

## Local simulation

`scenario.ts` creates the initial game through `createGame` and derives the next guided command from the current game and its legal decisions. `controller.ts` owns the live `GameState` and calls `applyCommand` for every accepted learner or opponent move. Revisions advance one command at a time; Next never installs a different game state.

`projection.ts` exposes the public learner view and events to the existing scene. A server-side integration test checks that this local projection matches the normal server projection after every move. Production multiplayer still receives its authoritative views from the server; it does not use the tutorial controller.

Controller stages: `intro` → `action` (learner, then `result` after a plant or build) or `opponent` → `opponent-result`. A learner submission applies the move and resolves the next decision at once; `previous` keeps the applied move for the guide. The lesson completes only when the final Captain phase has finished. Wrong payloads, duplicate actions, stale revisions and callbacks from an old session cannot mutate the game.

There is no saved snapshot fixture, fixture regeneration step, fake balance update or duplicated scoring rule.

## Progress lifetime

Progress is memory-only: game state, current move, worker drafts, hints and history. No tutorial progress is written to browser storage, URLs or a backend. The mode URL is `/?tutorial=1` only.

Leaving (pagehide or unmount) invalidates the session and clears its game, projection, pending decision and history. Opponent timers are cancelled, and their callbacks also check the session generation and move index. Back/Forward cache restoration creates a fresh game. Re-entry and refresh start at revision zero.

Real room recovery and global preferences are preserved. Do not clear all localStorage to discard a tutorial.

## Verification

- Execute the complete sequence through the rules engine, checking invariants and a revision increase of exactly one per command.
- Verify all eight role choices, the learner's three command-tile choices, every player's worker allocation and shipping, and the final Captain phase boundary.
- Compare local public projections/events with normal server broadcasts throughout.
- Reject unintended selections, incorrect payloads, duplicate submissions, learner attempts to act for opponents and stale opponent callbacks after exit/reset.
- Browser walkthroughs cover desktop/mobile, automatic opponent pacing, pausing, real command tiles, long-press hints, blocked buildings, backend independence and fresh starts through navigation/refresh/restoration.
- Run the existing board, demo and mobile regressions as well as repository checks before release.

This remains a frontend deployment. Server changes are tests only; no database migration or backend deployment is needed.
