# Player mats and piece interactions

Each mat has twelve subtle estate positions above twelve building spaces (two rows of six each). Large buildings occupy two adjacent spaces. Personal workers, goods, coins and earned VP appear in the bottom dock; other players' public resources remain available in the player drawer. The old green resource trays are removed from all mats. Opponents' earned VP stays hidden until final scoring.

Owned models have a separate row of small brass-and-teal worker medallions below their footprint, with the name beneath that row. Assigned worker miniatures replace the empty medallion and fill its footprint; empty medallions can be clicked to place a held worker. Owned model rows are compact (2.1 units) with smaller name captions. Public market models have no worker markers. The original medallion design has a bevelled rim, four rivets and an engraved crew icon; all markers share one 128×128 texture.

Worker socket capacities come from the engine building catalog and the one-worker countryside rule. `docs/reference/worker-slots.json` is a human-readable reference; a test checks it against the runtime catalog. Edit canonical rules/catalog first, then regenerate the reference when a ruleset changes.

During the player's Recruiter placement turn:

1. The server has already distributed the Work Register (and any accepted Recruiter bonus) into player pools.
2. Click a pool worker, then an owned estate or building. The draft immediately shows the worker in a socket.
3. Click an assigned worker to move it. Click the pool while holding a worker to return it there.
4. Confirm the allocation. Confirmation is disabled until all workers are accounted for and no idle workers remain while usable sockets are empty.

This is a local draft until confirmation; the server validates the full allocation atomically. Keyboard controls use the same draft. Revision changes, disconnects, and pending submissions clear stale selections. Opponents' pieces are read-only.

During Captain/Trader, click an individual crate, then a cargo/personal boat or the trading depot. A single legal choice submits immediately. If building privileges offer multiple legal choices, the action panel asks which to use. Shipping quantity, capacity, mandatory loads, good-type restrictions, Office/markets, Harbor and Wharf are taken from server legal descriptors; clicking one crate selects its type, not permission to ship an arbitrary quantity. Trading sells exactly one crate. Text action controls remain available.

Development-only local sandboxes (no room or multiplayer server needed):

- `scene-preview.html?game=3p&at=2&interact=1`: initial worker distribution and placement.
- `scene-preview.html?game=3p&at=8&interact=1`: corn crate to cargo boat.
- `scene-preview.html?game=3p&at=30&interact=1`: corn crate to trading depot.
- `scene-preview.html?game=3p&at=241`: populated mat, static view.

Validation: 69 web tests, including engine acceptance of every worker allocation reconstructed from a saved three-player history and selected-crate destination tests; 35 engine recruitment tests; build and boundary lint. Browser clicks verified worker → estate, crate → boat, and crate → depot in the local sandbox. No live five-player game or performance benchmark was run. The existing gzip asset test needed a 30-second timeout on this machine; the test source was not changed.

## Dock and harbour layout

The player list and chronicle are drawers, both closed initially. Turn status and command errors remain visible with drawers closed. The bottom dock shows money, private VP, every idle worker and every crate as 50px selectable piece portraits; available role cards appear there only for the player's role-selection decision. Those portraits are 17 small WebP derivatives of the existing source art (about 220 KB total), avoiding another WebGL context. Original models remain intact. No duplicate 3D resource trays are rendered.

Public goods supply is a left column; large boats/depot occupy the upper centre; remaining worker/VP counts and actual Work Register workers sit to the right. Estate choices are below the goods and the 23-building market uses price groups from 1 to 10, left to right, with up to three buildings per column (catalog order within each group). Each group has one borderless coin-and-price label below it; the five 10-coin buildings share two columns and one label. Recruitable workers are three times the size of workers occupying buildings. No role tile is rendered in the public centre.

Model captions are transparent, borderless labels below the footprint. Estate and building hover summaries are in `apps/web/src/scene/effects.ts`, paraphrased from the pinned rules. Cost, base VP, spaces and worker capacities read the engine catalog.

Bay centres and deck heights in `apps/web/src/scene/harbourSlots.ts` are measured from the fitted runtime meshes (including asymmetric bow bays and the four depot bays in front of its roof). Empty bays have invisible click targets; only legal destinations show a thin square outline. Loaded crates use those same centres. No extra circular sockets are drawn.

Each empty cargo/depot socket is selectable only after selecting a crate. It submits the same legal action as its parent vessel/depot; the socket does not override forced load quantity or allow unloading. The selected good filters options, including optional privileges.

Full-layout development sandbox: add `&shell=1` to a scene-preview URL (`at=0` for role cards, `at=2` for worker allocation, `at=8` for cargo, `at=241` for a populated mat). These runs use a local engine-backed transport and do not connect to real rooms.

Validation (2026-10-02): web typecheck and production build pass; 71 web tests
verified (the asset gzip check was rerun with a 30-second timeout after a loaded
browser caused its default five-second timeout). Lint and diff whitespace checks
pass. In the local engine-backed shell preview, a dock worker was assigned to an
estate (pool 2 → 1, confirmation enabled), and a selected corn crate was shipped
through an empty boat socket (revision advanced, crate removed, VP updated).
Public and populated personal views, below-model labels, rule tooltips, and the
collapsed-by-default drawers were inspected in the browser. No live five-player
session was run.

Follow-up validation: all 71 web tests pass with their normal timeout, including increasing-price order and cargo/depot legality. A browser click on a modeled boat bay successfully shipped cargo after selecting its crate.

The shared reserve counters (remaining workers and VP) are fixed DOM HUD chips
in the stage's upper right, so camera motion does not affect their readability.
Only the recruitable worker group remains beside the harbour. UI surfaces use
midnight teal, warm ivory text, sea-glass selection/focus, and restrained brass
accents; the illustrated board and model assets retain their existing colours.
The same palette applies to drawers, settings, cards, the dock, and tooltips.

Chinese UI text, canvas captions, and player-mat headings use self-hosted Source Han Sans CN (思源黑体) from Adobe (SIL OFL 1.1). A small variable-font subset covers current UI text; the original full font loads on demand for other characters. Canvas captions redraw when their font segments finish loading. The production build includes the font license at `/Source-Han-Sans-OFL.txt`.

Dock worker portraits use five transparent WebP renders of the existing worker GLBs, without card backgrounds (about 41 KB total). The original portraits remain available. `assets/runtime/render-worker-icons.py` regenerates the source RGBA PNGs; convert to WebP preserving alpha. Crates and role cards retain their own treatments.

## Language selection

The lobby and game header share a Chinese/English toggle, saved per browser as `vibe-rico.language` (Chinese by default). The button is labelled in the current language. Switching changes text immediately without recreating the game store, camera, worker draft, or retention form. User-entered names, room codes, links, and raw developer replay data remain verbatim.

`src/i18n/en.ts` maps Chinese source messages to English with numbered placeholders; `language.tsx` provides a typed translator and reactive subscription shared by the DOM and Three.js trees. Building/estate effects, terms, chronicles, accessibility labels, errors, scores, and settings all use the selected language. Player-island headings use localized text sprites over a shared terrain texture; English model captions fit their available width. Role portraits are cropped above printed English captions by `assets/runtime/crop-role-illustrations.py`, preserving the original images and models.

Regression coverage switches representative game phases in both directions, verifies there is no other-language UI text, checks all legal choices from a recorded game, and preserves an in-progress worker selection.

## Island environment

The supplied `import/player-island.png`, `main-island.png`, and `ocean.png` replace the rectangular table and mats. Original PNGs remain untouched; `assets/runtime/prepare-islands.py` creates alpha-preserving WebP copies under `public/art/environment`, also copied into production builds. Three loader-cached textures are shared across every seat; there is no continuous water animation or extra rendering canvas.

The main island is 64 × 32 world units, with cargo boats positioned in the painted harbour channels, the building market on the paved clearing, and estates on the western countryside. Player islands are 15 × 16.875 including coastlines; their existing 12 estate and 12 building placements retain their model scale and interaction targets. `archipelago.ts` spaces 3–5 seats around the harbour with at least two units of ocean between island footprints. Camera presets follow the new arrangement, including the market’s off-centre position.

The sea uses mirrored repetition to avoid hard joins in the supplied image. Artwork is rendered with unlit materials to preserve its painted palette, while game models retain their existing lighting. The backgrounds are two-dimensional terrain surfaces underneath the interactive three-dimensional pieces.
