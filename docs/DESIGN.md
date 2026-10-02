# Visual Design Direction

User direction (2026-10-01): follow the look of a reference Three.js Catan client (dark wood frame, parchment panels, gold trim, classical serif type, a 3D island in a teal sea), adapted to Puerto Rico. Take only its **structure, palette and typography**. All art is original (no commercial images, scans, textures or icons): simple lit geometry, flat drawn icons, and initials medallions instead of portraits.

## Screen layout

| Region | Reference | Puerto Rico content (PlayerView only) |
| --- | --- | --- |
| Top bar | Title, board name, rules/settings | 波多黎各 · room code · round N · Governor · revision |
| Left panel | Settlers with house colour and VP | Each seat in clockwise order: initials medallion in seat colour, name, coins, goods total, chosen role; own earned VP only (VISIBILITY-002); Governor badge |
| Centre | 3D island in a teal sea | San Juan harbour on an island: cargo ships at the dock, Trading House, role cards, building market, estate market, supplies; player plantations and cities around it |
| Right panel | Whose turn, "Chronicle" log | Decision-maker and what they are choosing ("等待 X：种植"); the last rejection; a chronicle of this seat's filtered events (PlayerEvent) |
| Bottom bar | Resource cards and build buttons | The viewer's five goods and coins as cards; the current legal actions as action cards and forms |

The DOM client stays complete on its own (SceneBoundary fallback). The 3D centre replaces nothing essential.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--wood` | `#2b1d14` | Frame and bars |
| `--wood-light` | `#4a3222` | Panel borders, inactive cards |
| `--parchment` | `#efe4cc` | Panels and cards |
| `--ink` | `#2a2118` | Text on parchment |
| `--gold` | `#c9a45c` | Trim, headings, the active seat |
| `--sea` | `#2f7f86` | Scene background water |
| Seat colours | `#b5483a` `#d6a94a` `#3f6fa8` `#e8e2d4` `#5b8a4f` | Seats 1–5, always paired with the name (never colour alone) |

Goods colours in the scene: corn `#e6c34a`, fruit `#c9553f`, sugar `#f4f1ea`, tobacco `#8a5a36`, coffee `#3b2a20`.

Type: Cormorant Garamond for Latin headings and self-hosted Source Han Sans CN (思源黑体) for Chinese and dense UI text. The lobby and top bar offer a persistent Chinese/English toggle. Each language uses its own UI text, canvas captions, mat headings, and rule descriptions. Role cards use illustration-only crops with localized labels.

## Scene style

- A teal sea plane under a parchment-and-wood island board; soft warm directional light plus ambient; no textures from external sources.
- Pieces are low-poly primitives: barrels for goods, flat tiles for plantations (goods colour) and quarries (grey), blocks with coloured roofs for buildings, discs for workers, hulls for ships.
- Names and counts are canvas-texture labels (the PR-049 technique), readable at 3/4/5-player layouts.
- Motion is short and interruptible (PR-053) and respects reduced motion (PR-054).
