# Rules Specification

**Edition: Puerto Rico 1897 Special Edition**; **Ruleset status: S3-RECONCILED / READY**.

## Canonical source and scope

The user designated [S3, the local 44-page English rulebook](../references/puerto-rico-1897-special-edition-rulebook-en.pdf), as canonical. SHA-256: `9240acbb1121a1e43019d9ae228603748c4447e36caf2be0c65c2ca2d8373c91`. See [reference policy](../references/README.md). All active page citations below refer to **S3**, not the previous 24-page book.

Target `rulesetId`: `puerto-rico-1897-special-edition-base-en`; source revision: `source-9240acbb1121`. PR-005 will assign the implementation rulesetVersion using this specification and its documented project conventions. V1 is the **3–5-player base game**, excluding expansions I–VI, alternative rules (including Factory/School cost swap), two-player play, and Puertoma.

Sources: components pp.3–4; setup pp.6–8; concepts p.9; roles pp.10–17; buildings pp.18–22 **above the two-player heading**. Page 44 is a mixed summary, not an independent authority over full descriptions. Reference-card art on p.3 also includes variants and a conflicting Harbor summary: use p.21's full rule and example.

PR-001 originally verified S1/S2: SHA-256 `6d32f4a0746ba92e49c703d63b3e071691a8e13cf95b7287038c341de3f7401c`. Those standard-edition sources are superseded and supply no active fallback rules. Their earlier end-of-round rule must not leak into this specification. Corrections to S3 require verified, edition-specific evidence and a documented source update, not a silent website refresh.

## Engineering rules — PR-002

`CONFIRMED` means supported by S3; `INTERPRETATION` marks a digital representation or an explicit wording resolution. Unresolved source gaps remain blocked as listed in RULE_QUESTIONS.md. User-approved conventions are labeled separately. This document paraphrases rule mechanics; it does not reproduce rulebook prose or artwork.

### Reading and transition conventions

Every rule row supplies its ID, source, precondition/decision and effect. Unless overridden: choices belong to the current actor, process clockwise from the role chooser, consume only available components, and finish at the next actor, then the next role chooser. Role chooser and actor are distinct. Invalid requests change nothing. Building effects require an occupied building and are optional; accepting an effect applies all its stated costs/constraints. Public effects follow VISIBILITY-001; earned VP follow VISIBILITY-002. Test families are named under each section; PR-003 supplies individual fixture mappings and exhaustive boundary tests.

Terminology is frozen to **Planter, Recruiter, Builder, Craftsman, Trader, Captain, Adventurer**. Existing SETTLER/MAYOR/PROSPECTOR task paths are compatibility labels only; PR-005 should use `planter`, `recruiter`, `adventurer` domain tags. IDs below use those 1897 names. Two Adventurer cards share a role kind but have distinct card instance IDs.

### Setup and component accounting

Test family: TS-SETUP. Sources: S3 pp.3–4,6–8; building tile/slot illustrations pp.6,18–22. Setup follows the printed step order: random market first, prescribed starting estates second.

| ID | Rule |
| --- | --- |
| SETUP-001 | Accept exactly 3, 4, or 5 distinct seated players. Fix clockwise order and select the initial Governor before setup; the server records that selection and the seed. No player has a building, worker, goods, or earned VP initially. Each board has 12 Countryside and 12 City spaces. |
| SETUP-002 | Apply the player-count table below. Starting coins come from supply; required starting estates come from the listed estate set, face up and unoccupied. Worker totals include the initial Register: take N from 58/79/100, leaving 55/75/95 in supply. Draw the market first, then retrieve prescribed starting types from the remaining bag (INTERPRETATION of steps 7–8 then 13). Do not silently keep S1’s reserve-first order. |
| SETUP-003 | Estates: Fruit 12, Sugar 11, Corn 10, Tobacco 9, Coffee 8; Quarries: 8. Maintain a random estate bag, public market of N+1 estates, and separate discard pool. S3 steps 7–8 place all estates in the bag and draw the market before step 13 assigns starting estates. Remove the prescribed starting types from the remaining bag without disturbing the revealed market. This is always possible: even six revealed tiles cannot exhaust the 12 Fruit or 10 Corn needed for at most three Fruit/two Corn starting tiles. |
| SETUP-004 | Goods crates: Corn 10, Fruit 11, Sugar 11, Tobacco 9, Coffee 9. All begin in supply. Ships and the four-slot Trading House begin empty. Goods do not substitute for missing crates of another type. |
| SETUP-005 | The market contains 49 tiles from BUILDING-001–023: 20 production, 24 small commercial, 5 large commercial. All are available from setup; each player's limit is one of each type. Unused player-count components stay out of play. |
| SETUP-006 | Physical money represents 83 coin units (43 ones and 8 fives). Track value, not denomination changes. PROJECT-001 uses unlimited coin accounting; do not impose a cap from the physical token count. VP supply is counted in point value, not number of chips. |

| Players | Coins each | Starting estates clockwise from Governor | Worker supply | Initial Work Register | Active worker total | VP supply | Cargo capacities | Role cards |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 2 | Fruit, Fruit, Corn | 55 | 3 | 58 | 75 | 4, 5, 6 | Six non-Adventurer cards |
| 4 | 3 | Fruit, Fruit, Corn, Corn | 75 | 4 | 79 | 100 | 5, 6, 7 | Six plus one Adventurer |
| 5 | 4 | Fruit, Fruit, Fruit, Corn, Corn | 95 | 5 | 100 | 126 | 6, 7, 8 | Six plus two Adventurers |

### Rounds, roles, and activation

Test family: TS-ROUND. Sources: S3 pp.9–11,17–18.

| ID | Rule |
| --- | --- |
| ROUND-001 | The Governor chooses first; each seated player chooses one role per round, clockwise. Choosing a role is mandatory. Chosen cards stay unavailable until round end. Transfer all accumulated coins on the selected card to its chooser immediately, including when they later decline its action. |
| ROLE-001 | Resolve the selected role starting with its chooser, then clockwise. Only the chooser receives its advantage. Ordinary actions and chooser advantages are independently optional except Captain loading and its advantage; phase-specific allocation and timing rules below override general summaries. No arbitrary pass may bypass compulsory consequences. |
| ROUND-002 | After N selected roles finish without an end trigger, add one coin to each of the three unchosen cards, return chosen cards, rotate Governor one seat clockwise, and start the next round. Coins remain on unchosen cards until collected. Check ENDGAME-002 at every completed role phase, not just at round completion. |
| ROLE-002 | A Countryside tile or building is occupied when it holds at least one worker. Each worker slot holds at most one worker. Quarries, production and commercial functions require occupation; production quantity additionally depends on the number of occupied production slots. Base building VP never requires occupation. |
| ROLE-003 | Ordinary tiles cannot be removed or replaced. They may be rearranged within their area; layout has no strategic effect. Represent City use by total footprint, allowing rearrangement to fit a two-space building whenever two spaces remain. Countryside tiles each use one space. |

### Planter

Test family: TS-SETTLER (legacy test label). Sources: S3 pp.10,19–20.

| ID | Rule |
| --- | --- |
| PLANTER-001 | With room in Countryside, the actor may choose one face-up estate or decline. The chooser, or an actor with occupied Builder’s Yard, may choose one available Quarry instead. Remove the chosen tile from its source and place it unoccupied unless Hospital applies. A full Countryside prevents further placement. No Quarry supply means no Quarry option. |
| PLANTER-002 | Hacienda is a separate optional decision before the normal selection. Draw and immediately keep one hidden estate; it cannot be inspected and rejected. Recalculate remaining space before the normal action. Hospital can place at most one worker across the actor's newly acquired tile(s). Resolve that destination after their tile choices. |
| PLANTER-003 | After every actor finishes, discard leftover face-up estates and draw N+1 replacements from the bag. On bag exhaustion, return the discard pool to the bag and randomize; never reclaim placed estates. Reveal only available tiles when fewer than N+1 remain. S3 p.10 says the role action cannot be performed when both bag and discard run out; the interaction with remaining face-up estates or Quarries is recorded in the interpretation table. |
| PLANTER-004 | Digital representation: a seeded hidden permutation simulates random bag draws. Reshuffle returned discards on refill. Players cannot choose hidden identities or inspect future draws; placed tiles become public. |

### Recruiter

Test family: TS-MAYOR (legacy label). Sources: S3 pp.10–11; end trigger p.17.

| ID | Rule |
| --- | --- |
| RECRUITER-001 | Before distribution, the chooser may take their one-worker advantage from supply; none is available if supply is empty. Distribute all Work Register workers one at a time, clockwise from the chooser. With R workers, each gets floor(R/N), and the first R mod N actors get one extra. This uses existing Register workers, not supply. |
| RECRUITER-002 | Each actor confirms a complete allocation of all their workers among owned estate, Quarry and building slots, plus idle workers on the Portrait. Existing placements may change. No worker can be destroyed, duplicated or assigned to another player. After this allocation, idle workers are allowed only if every available slot is filled. Keeping the existing allocation is valid only when these constraints hold. |
| RECRUITER-003 | Use clockwise confirmations for deterministic online play: S3 permits any player to request clockwise order instead of simultaneous placement. Placement is atomic per player. Outside Recruitment, workers move only through an explicit building exception, not a generic placement command. |
| RECRUITER-004 | After all confirmations, let E be empty building slots across every player, excluding estates/Quarries. Requested Register refill is max(N,E). Transfer min(requested,supply). If supply is less than requested, record the worker-shortage trigger and end the game at this Recruiter phase’s completion. Exactly enough is not a shortage trigger. |

Example: four players, six Register workers, chooser accepts the advantage: worker gains are **3,2,1,1**. If E=7 and only five workers remain in supply, refill five and record a trigger.

### Builder

Test family: TS-BUILDER. Sources: S3 pp.11,18; School p.21.

| ID | Rule |
| --- | --- |
| BUILDER-001 | An actor may buy exactly one in-stock building or decline. They must not already own its type, must have enough City space, and must afford the final cost. On success pay the Bank, remove one market tile and place it. No debt, resale, demolition, or replacement. |
| BUILDER-002 | Price = max(0, listedCost − min(occupiedQuarries, quarryCap) − chooserDiscount), where chooserDiscount is 1 only when the Builder chooser accepts the advantage, otherwise 0. quarryCap is the market tier shown in the catalog. Never pay the player for a negative computed cost. Declining the purchase gives no discount payout. |
| BUILDER-003 | Determine discounts and active School from the pre-purchase state. Apply School after placing the new building; it may supply one worker only to that new building. Buying School does not activate itself. If City use reaches 12, record a trigger immediately; finish the remaining actors in this Builder phase, then score. Do not offer another role selection. |

Source example with three occupied Quarries, before the Builder discount: Builder’s Yard costs **1**, Office **3**, Harbor **5**, City Hall **7**.

### Craftsman

Test family: TS-PRODUCTION. Sources: S3 pp.12,18–20.

| ID | Rule |
| --- | --- |
| CRAFTSMAN-001 | Process actors clockwise from chooser. Corn capacity is occupied Corn estates. For each other good, capacity is min(occupied matching estates, occupied matching production slots summed across owned buildings). Workers do not leave their tiles. An actor may decline the entire action. If accepting, produce min(capacity, remaining supply) for every good. INTERPRETATION: S3 makes the action optional, but its per-worker formula supplies the quantities; do not add an unconfirmed per-good quantity slider. |
| CRAFTSMAN-002 | Remove actually produced crates from supply and add them to the actor. Supply shortages affect later actors; do not reserve crates for everyone first. Record goods actually produced this phase, separately from old inventory and later advantage goods. Resolve optional Factory income from those actual types. |
| CRAFTSMAN-003 | After all actors finish production, the chooser may take one additional available crate of a type they actually produced this phase. No actual production or no available matching crate means no advantage. Apply no second Factory payout. This late advantage timing overrides the general chooser-first wording. |

### Trader

Test family: TS-TRADER. Sources: S3 p.13; buildings pp.19–20.

| ID | Rule |
| --- | --- |
| TRADER-001 | Clockwise, each actor may sell one owned crate or decline. Require one free Trading House slot and no existing crate of that type, unless occupied Office permits duplication. Full means no base-game sale, even with Office. Expansion trading exceptions are outside V1. |
| TRADER-002 | Base prices: Corn 0, Fruit 1, Sugar 2, Tobacco 3, Coffee 4. A successful sale transfers the crate to the House and pays base price +1 if the chooser accepts the advantage, plus optional active Small Market (+1) and Large Market (+2). Zero-value Corn sale is legal. Declining earns nothing. |
| TRADER-003 | Only after all actors finish, return all four crates to supply if the House is full. Otherwise keep its contents for the next Trade phase. Never clear mid-phase to give later actors room. |

### Captain

Test family: TS-CAPTAIN. Sources: S3 pp.14–16; Warehouse/Harbor/Wharf pp.20–21.

| ID | Rule |
| --- | --- |
| CAPTAIN-001 | Visit actors cyclically from chooser. Each load moves one good type to one ship. If any ordinary cargo load is possible, loading is mandatory. The actor chooses the good, not necessarily the one yielding most crates across all goods. Auto-skip only when no mandatory load exists and no optional Wharf choice is taken. |
| CAPTAIN-002 | Cargo ships hold only one type each; the same type cannot occupy two cargo ships. If the chosen type already has a ship, only that ship is eligible and only if not full. Otherwise consider empty ships. Load min(owned quantity,free holds). Among empty ships, choose one maximizing that load; ties remain a player choice. Never hold back part of a selected legal load. |
| CAPTAIN-003 | Award one VP per shipped crate. The chooser earns one additional VP on their first actual load of this phase only. Each active Harbor adds one optional VP per load, including Wharf loads. No empty load earns VP or consumes a Wharf use. Track points after chip supply reaches zero as overflow, without losing awards. |
| CAPTAIN-004 | Wharf is an optional alternative to a cargo load or an option when cargo shipping is impossible. It loads all owned crates of one chosen type onto the player’s Personal Ship, once per phase, without capacity or cargo-type restrictions. Keep that cargo separate until phase-end cleanup. A player may decline Wharf, but not use that refusal to skip a possible mandatory cargo load. S3 p.21 "at any time during the Captain phase" is represented as "on any of the owner's visits": any load resets the no-load count, so the owner always gets another visit (AUD-01). |
| CAPTAIN-005 | Continue cyclic visits until a full traversal produces no load and every eligible optional Wharf decision in that traversal is resolved or declined. A skip does not permanently remove an actor; re-evaluate later visits. Declining optional Wharf with no intervening load does not create an infinite new prompt. |
| CAPTAIN-006 | Then each player selects goods to retain. Base allowance: one crate total. Active Small/Large Warehouses add all crates of up to one/two chosen types, stacking to three types. The extra single crate may be outside those types. Return every unretained crate to supply; storage never excuses earlier mandatory loading. |
| CAPTAIN-007 | Finish all retention decisions, then return cargo from full cargo ships and all Personal Ships to supply. Empty cargo ships lose their type; partly filled cargo ships keep type and contents. Reset Personal Ship contents and phase-use flags. If a trigger exists, score now; otherwise advance to the next chooser or normal round completion. Never reopen loading after cleanup. |

Example: owning six Sugar with empty ships of capacity five and seven requires the seven-hold ship for Sugar. Owning three Sugar with those same empty ships permits either (both load three).

### Adventurer

Test family: TS-PROSPECTOR (legacy label). Source: S3 p.17.

| ID | Rule |
| --- | --- |
| ADVENTURER-001 | Its chooser accepts or declines the one-coin advantage, independently of accumulated role-card coins already collected. No other player acts. Finish after that decision. Different Adventurer card instances can be selected in the same round by different choosers. |

### Complete base-game building catalog

Test family: TS-BUILDING; scoring buildings additionally TS-SCORE. Sources: S3 p.3 (44 regular + 5 expanded core tiles, with 4 alternative tiles separately excluded), pp.6,18–22 (full abilities and tile faces). Cost, VP, footprint, worker-slot and Quarry-cap columns describe static data, not activation. Inventory totals must equal 49. Per-type stock is user-supplied project input (PROJECT-003), not independently verified publisher data.

| Stable rule / type ID | Building | Cost | Base VP | City spaces | Worker slots | Quarry cap | Market stock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BUILDING-001 / small-fruit-depot | Small Fruit Depot | 1 | 1 | 1 | 1 | 1 | 4 |
| BUILDING-002 / small-sugar-mill | Small Sugar Mill | 2 | 1 | 1 | 1 | 1 | 4 |
| BUILDING-003 / large-fruit-depot | Large Fruit Depot | 3 | 2 | 1 | 3 | 2 | 3 |
| BUILDING-004 / large-sugar-mill | Large Sugar Mill | 4 | 2 | 1 | 3 | 2 | 3 |
| BUILDING-005 / large-tobacco-storage | Large Tobacco Storage | 5 | 3 | 1 | 3 | 3 | 3 |
| BUILDING-006 / large-coffee-roaster | Large Coffee Roaster | 6 | 3 | 1 | 2 | 3 | 3 |
| BUILDING-007 / small-market | Small Market | 1 | 1 | 1 | 1 | 1 | 2 |
| BUILDING-008 / hacienda | Hacienda | 2 | 1 | 1 | 1 | 1 | 2 |
| BUILDING-009 / builders-yard | Builder’s Yard | 2 | 1 | 1 | 1 | 1 | 2 |
| BUILDING-010 / small-warehouse | Small Warehouse | 3 | 1 | 1 | 1 | 1 | 2 |
| BUILDING-011 / hospital | Hospital | 4 | 2 | 1 | 1 | 2 | 2 |
| BUILDING-012 / office | Office | 5 | 2 | 1 | 1 | 2 | 2 |
| BUILDING-013 / large-market | Large Market | 5 | 2 | 1 | 1 | 2 | 2 |
| BUILDING-014 / large-warehouse | Large Warehouse | 6 | 2 | 1 | 1 | 2 | 2 |
| BUILDING-015 / factory | Factory | 7 | 3 | 1 | 1 | 3 | 2 |
| BUILDING-016 / school | School | 8 | 3 | 1 | 1 | 3 | 2 |
| BUILDING-017 / harbor | Harbor | 8 | 3 | 1 | 1 | 3 | 2 |
| BUILDING-018 / wharf | Wharf | 9 | 3 | 1 | 1 | 3 | 2 |
| BUILDING-019 / fire-station | Fire Station | 10 | 4 | 2 | 1 | 4 | 1 |
| BUILDING-020 / residence | Residence | 10 | 4 | 2 | 1 | 4 | 1 |
| BUILDING-021 / fortress | Fortress | 10 | 4 | 2 | 1 | 4 | 1 |
| BUILDING-022 / customs-house | Customs House | 10 | 4 | 2 | 1 | 4 | 1 |
| BUILDING-023 / city-hall | City Hall | 10 | 4 | 2 | 1 | 4 | 1 |

Ability definitions below are part of the matching BUILDING ID:

- **001–006** (pp.18–19): production slots for Fruit, Sugar, Fruit, Sugar, Tobacco, Coffee respectively; apply CRAFTSMAN-001. Fruit Depots and Large Tobacco Storage are production buildings, not goods-retention abilities. “Large Production” classification includes 003–006 despite their one-space footprint.
- **007** (p.19): optional +1 coin on a successful trade; **013** (p.20): optional +2. Both may apply, plus the Trader advantage.
- **008** (p.19): before normal planting, optionally take one hidden estate and immediately place it; no Quarry substitution or rejection after reveal. Requires one free Countryside space. Normal planting remains optional and requires another free space.
- **009** (p.19): normal planting may select a Quarry. No extra Quarry for the Planter, and no modification of Hacienda's hidden draw.
- **010** (p.20) / **014** (p.20): optional retention of all crates of one/two types in addition to the standard single crate; stack to three types. Only goods remaining after mandatory loading qualify.
- **011** (p.20): during this player's Planting turn, optionally add one worker to one estate/Quarry they just placed. Take from supply first, then Register only if supply is empty. With Hacienda, choose either acquired tile, but gain only one worker total. If both sources are empty, gain none. No transfer to an older tile.
- **012** (p.20): permits selling a duplicate type to the Trading House, never an extra crate or an over-capacity sale.
- **015** (p.20): after own production, actual distinct types 0/1/2/3/4/5 give optional income 0/0/1/2/3/5. Count neither unavailable goods nor old stock; no second payout for the Craftsman bonus.
- **016** (p.21): after own purchase, optionally add one worker to the newly built tile, including a multi-slot production building but never more than one worker. Source priority is supply, then Register if supply empty; none if both empty. School must already be occupied before the purchase.
- **017** (p.21): optional +1 VP for each nonempty shipment, including Wharf. Multiple shipments can earn multiple Harbor bonuses.
- **018** (p.21): optional once-per-Shipment charter as CAPTAIN-004. Gain a Personal Ship token when built; the ability still requires occupied Wharf. Hold its loaded crates until the Captain cleanup, then return them to supply. It is private shipping capacity, not a fourth communal cargo ship.
- **019** (p.21): if occupied at scoring, add 1 per owned small production building (001–002) and 2 per owned large production building (003–006), occupied or not.
- **020** (p.21): if occupied at scoring, add 4/5/6/7 for 1–9/10/11/12 occupied Countryside **spaces** (tile presence, not worker occupation); Quarries count. Zero tiles is unreachable in legal play because starting estates cannot be removed.
- **021** (p.22): if occupied at scoring, add floor(total owned workers / 3), including idle workers.
- **022** (p.22, interpreted with p.17): if occupied at scoring, add floor(earned VP / 4), including post-supply overflow. Exclude all building base and bonus points.
- **023** (p.22): if occupied at scoring, add one per owned commercial building, occupied or not, including itself and other large commercial buildings. A two-space building counts once.

### Endgame and scoring

Test families: TS-END, TS-SCORE. Sources: S3 pp.11,15,17,21–22.

| ID | Rule |
| --- | --- |
| ENDGAME-001 | Latch worker-shortage at RECRUITER-004, City-full at BUILDER-003, or exhausted VP supply during Captain. Record each reason and triggering revision/phase. Triggers are irreversible. S3 also delays VP exhaustion outside Captain until the end of the next Captain phase; no such VP-producing effect exists in the selected base game, so do not introduce expansion actions to reach that case. |
| ENDGAME-002 | Finish only the triggering role phase: all remaining Builder actors; Recruiter allocations/refill; or every Captain load, retention decision and ship cleanup. Then score immediately, even if players have not yet chosen a role this round. Never grant remaining role selections or round-end role coins. Empty goods, Quarries or estate supplies are not end triggers. |
| SCORE-001 | For each player, total = earned shipping VP (including overflow) + base VP of every owned building + individual occupied large-commercial-building bonuses. Endgame bonuses do not consume VP supply. Compute once from the final snapshot, without mutating it. |
| SCORE-002 | Rank by total VP. Among equal totals, rank by coins + goods crates owned after the final phase and its cleanup. This is a tiebreak field, not added to primary VP. If still tied, share victory/rank: directly confirmed by S3 p.17 (formerly user convention PROJECT-002). |

Example: 30 earned VP and occupied Customs House give 7 bonus VP. Fire Station plus Small Fruit Depot, Large Fruit Depot, Large Coffee Roaster, and Large Sugar Mill gives 7 bonus VP. No bonus requires those counted buildings to be occupied; only the scoring building itself does.

### Visibility, random state, and invariants

Test families: TS-PRIVACY, TS-SETUP, TS-REPLAY. Sources: S3 p.8 (money visible), p.14 (goods/money versus concealed VP), pp.6–7,10 (random estate bag). Digital boundary decisions are labeled below.

| ID | Rule |
| --- | --- |
| VISIBILITY-001 | Public: money, goods, all placed tiles/workers, idle workers, market stock, the VP supply (remaining and overflow; AUD-04, so opponents' earned VP can be inferred as VISIBILITY-003 accepts), face-up estates/Quarries, the estate discard pile (every tile was face-up in the market), recorded end triggers, ships, Trading House, role-card coins, seats, Governor, phase, and decision-maker (discard pile and end triggers added by user ruling 2026-10-01). Legal-action descriptors must not reveal information beyond that view. |
| VISIBILITY-002 | Digital convention: consistently conceal individual earned VP from opponents until final scoring; owners can see their own total. At game over reveal every scoring component and tiebreak value. Physical rules permit face-down VP; V1 chooses that permitted presentation consistently. |
| VISIBILITY-003 | Keep future estate order, unrevealed identities, RNG seed/state, and session credentials server-only. Publish a hidden draw's identity only when the tile is placed face up. Player logs and events use the same visibility filter as snapshots. Public actions may allow human deduction of concealed VP; do not claim secrecy against inference. |
| INVARIANT-001 | Goods by type are conserved across supply + players + cargo ships + Personal Ships + Trading House. Estates are conserved across bag + market + discard + players; Quarries across supply + players. Building tiles are conserved across market + players. |
| INVARIANT-002 | Active workers equal supply + Register + all placed/idle workers: 58/79/100 for 3/4/5 players. No negative quantities, illegal references, duplicate owned building types, excess slots, or City/Countryside overflow. Idle-worker restrictions apply after Recruitment confirmation, not globally after every later tile purchase. |
| INVARIANT-003 | Earned VP + remaining supply = initial VP supply + overflow. Bonus scoring is separate. No game transition out of game over; a rejected command changes neither revision, RNG nor components. |

### Wording conflicts and explicit resolutions

| Issue | S3 evidence | Resolution / status |
| --- | --- | --- |
| S1 ended at round completion | S3 pp.11,15,17 | CONFIRMED: S3 ends after the triggering phase. No S1 fallback. |
| Wharf previously returned goods immediately | p.21 | CONFIRMED: hold Personal Ship cargo until Captain cleanup. |
| Harbor reference-card art says different goods | p.3 vs full rule/example p.21 | Full rule controls: each load counts, even the same good on cargo and Personal Ship; the example awards both. |
| General optional actions vs Recruiter procedure | pp.9–11 | INTERPRETATION: Register distribution and required worker placement follow the specific procedure; chooser may decline their extra worker. No skip discards allocated workers. |
| General chooser-first wording vs production bonus | pp.9,12 | CONFIRMED: Craftsman bonus is after all players produce. |
| Occupied building vs production slot count | pp.10,12,18–19 | CONFIRMED: count matched occupied slots, not maximum building capacity. |
| City adjacency vs rearrangement | pp.11,18 | INTERPRETATION: total free footprint suffices because rearrangement is permitted. |
| Estate exhaustion says no action | p.10 | INTERPRETATION: evaluate actual acquisition options. Existing face-up estates and permitted Quarries remain usable; an exhausted bag/discard prevents new random draws, not those still-available tiles. This resolves shorthand rather than importing another edition. |
| General discard vs returning spoiled goods | pp.9,14 | CONFIRMED: spoiled goods explicitly return to supply; estate market leftovers stay in discard until a permitted bag refill. |
| Customs House says tokens while overflow is on paper | pp.17,22 | INTERPRETATION: include earned overflow VP, exclude endgame building points. |
| Final tied result | p.17 | CONFIRMED: shared victory; PROJECT-002 is superseded by this explicit rule. |
| Bank exhaustion | pp.4,9 | No additional money cap adopted. User-approved unlimited accounting (PROJECT-001) remains; p.9 limits goods/buildings/Countryside, not coins. |
| Voluntary partial production | pp.9,12 | INTERPRETATION: full available production or decline the whole action. This follows the optional-action wording and per-worker formula; it is not a claim that S3 expressly prohibits partial production. |
| Per-type production stock | pp.3,6,18 | RESOLVED as PROJECT-003: user supplied the 4/4/3/3/3/3 split. S3 does not enumerate it; retain that provenance. |
| Initial market before starting estates | pp.6–8, steps 7,8,13 | CONFIRMED order; INTERPRETATION for retrieval: remove prescribed types from the remaining bag. Starting Fruit/Corn availability is guaranteed by the component counts even under the largest market draw. |

### Approved project conventions

- **PROJECT-001** — Unlimited coin accounting; payments still require sufficient player funds. Approved by the user on 2026-09-27, not claimed as publisher errata.
- **PROJECT-002** — Historical user approval of shared victory; now directly supported by S3 p.17 and implemented through SCORE-002.

- **PROJECT-003** — Building stock supplied by the user on 2026-09-27 via [the building-quantity conversation](chatgpt-conversation://6ab91b7a-1724-83ec-b538-e45cbcd2a97b): Small Fruit Depot 4, Small Sugar Mill 4, each other production type 3; each regular commercial type 2, each expanded type 1. Total 49. Adopted as project input to close RULE-TODO-012; the referenced ChatGPT answer is not publisher verification and does not supersede S3 mechanics.

### S3 reconciliation record

- Source hash and 44-page count verified locally. Read base-game components, setup, roles, buildings and scoring through p.22 before the two-player heading.
- Rendered component, setup and building pages to verify terminology and slot/cost diagrams. Text extraction contains duplicated hidden art text; full rule paragraphs and rendered pages take precedence over those artifacts.
- Preserved numeric rule IDs; renamed four building type keys to S3 terminology before any code exists. Do not reuse old standard-edition save IDs.
- PR-002 is DONE. The user supplied the remaining stock quantities; the completed PR-003 matrix is in TEST_SCENARIOS.md. PDF authority remains unchanged.
