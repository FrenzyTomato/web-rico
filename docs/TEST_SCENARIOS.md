# Test and Acceptance Matrix

## Independently calculated expectations required from M0

Cover independent acceptance/decline of non-Captain role advantages, including Builder, Trader, and Adventurer. Captain loading and its advantage follow their mandatory rules.

Every rule scenario includes edition, ruleId, source page, input snapshot, command sequence, exact resource changes, and next decision-maker. The concrete cases below freeze the verified values and explicitly documented conventions.

| Scenario ID | Scope | Minimum coverage | Ticket |
| --- | --- | --- | --- |
| TS-SETUP | Setup | Resources and initial order for 3/4/5 players; draw market before starting estates | PR-010 |
| TS-ROUND | Rounds | Role choosers, role availability, bonus accumulation, governor rotation | PR-011–013 |
| TS-SETTLER | Fields | Optional/mandatory choices, exhausted supplies, privilege, replenishment | PR-014–015 |
| TS-BUILDER | Construction | Costs, discounts, footprint, insufficient money, empty stock | PR-016 |
| TS-MAYOR | Workers | Exact division, remainders, shortages, reallocation, duplicate placement | PR-017–018 |
| TS-PRODUCTION | Production | Inactive buildings, bottlenecks, exhausted supplies, full available production or decline, late privilege | PR-019 |
| TS-TRADER | Trading | Full house, same-type restrictions, prices, privilege, clearing | PR-020 |
| TS-PROSPECTOR | Other roles | Applicable player counts, income, completion in the selected edition | PR-021 |
| TS-CAPTAIN | Shipping | Mandatory loading, compatibility, capacity, rotation, retention, unloading; Personal Ship cargo held until cleanup | PR-022–025 |
| TS-BUILDING | Buildings | Every building active/inactive, usage limits, interaction timing | PR-026–031, PR-027A/PR-030A, PR-033A/PR-033B |
| TS-END | Endgame | Every trigger, simultaneous triggers, finish triggering phase and cleanup; no further role selection or round-end bonus; reject after game over | PR-032 |
| TS-SCORE | Scoring | Independent bonuses, inactive cases, ties | PR-033A/PR-033B/PR-033 |
| TS-REPLAY | Complete games | Fixed-seed 3/4/5-player games to completion; replay after snapshot recovery | PR-034, PR-036 |
| TS-NET | Network | Duplicate/stale/unauthorized input, two tabs, actions during recovery | PR-039–042 |
| TS-PRIVACY | Visibility | No cross-player leaks through messages, events, logs, or developer tools | PR-035, PR-042 |
| TS-UI | Browser | Complete games at all three counts, forms for every action, refresh recovery | PR-047 |
| TS-MOTION | Animation | Lost/duplicate events, skipping, reconnect, WebGL loss | PR-053–055 |
| TS-DURABLE | Persistence | Failure before commit, crash after commit before acknowledgment, retry, recovery, incompatible versions | PR-057–059 |

## Verification layers

Unit tests target rule boundaries. Scenario tests cover complete phases. Property tests cover invariants and consistency between legal-action generation and validation. Fixed-history replay verifies reproducibility. Browser tests use genuinely independent sessions.

Random legal-action simulations may never trigger an ending. Use them only for bounded invariant checks; reaching the step limit is diagnostic, not a successful complete game. Full-game acceptance uses independently designed legal histories and must not alter resources to force an ending.

PR-004 provides `pnpm typecheck`, `pnpm test`, and `pnpm build`. PR-005 adds compiled type fixtures and three contract tests; the test entry point no longer permits an empty suite. PR-010 now tests player-count setup resources, stock totals, market-before-starting-estates order, seeded reproducibility and initial state invariants. Later role, building-ability and complete-game scenarios remain pending. Browser tickets will add `pnpm test:e2e`. Use package name `@vibe-rico/game-engine`, with analogous protocol, server, and web names.

## Concrete rule coverage — PR-003

All cases use **Puerto Rico 1897 Special Edition, 3–5-player base game**, S3 `source-9240acbb1121`, and the conventions in [RULES.md](RULES.md). Page numbers are PDF pages. PROJECT-003 supplies stock; PROJECT-001 supplies unlimited money; production is the recorded full-output-or-decline interpretation. These are fixture specifications, **not executed engine tests**.

Fixture conventions: A/B/C/D/E are clockwise seats; A is Governor and role chooser unless stated. Use three players unless N is specified. Each case starts independently in the named phase, with no pending end trigger or active ability except those stated. Unmentioned players decline optional actions and have no loadable goods. Complete omitted state with legal tiles/workers and balance finite components against supply; never create crates/workers to satisfy a fixture. All supplied values are test literals, not expected values calculated by the engine under test. Later test authors select the concrete seeded shuffle algorithm and record its known output; listed draw sequences are controlled bag-order fixtures, not invented seed outputs.

For role actions, **next actor** means the following seat in that role; after the last actor and cleanup, **next chooser** means the player after the role chooser, or normal round completion after the Nth role. Captain loads always advance cyclically, then enter retention after a complete no-load traversal. Recruiter advances only on valid whole-allocation confirmation. Building rows inherit their host role's next actor/chooser; scoring rows have no next actor. These defaults are part of every case unless overridden.

For every rejected command below, assert an error, zero resource changes, identical revision/RNG/state, and no emitted events. For every ability fixture, repeat with its building unoccupied and with the effect explicitly declined: only the named bonus/exception disappears; ordinary action and printed building VP remain. For all six production buildings, unoccupied means zero processing capacity, not optional building-income behavior.

### Setup, roles, and component boundaries

| Case | Rule IDs | S3 / owner | Input and action | Independently expected result / next decision |
| --- | --- | --- | --- | --- |
| SET-01 | SETUP-001, SETUP-002 | pp.6–8; PR-010 | Create games with N=3/4/5 distinct seats | Coins each 2/3/4; estates F,F,C / F,F,C,C / F,F,F,C,C (F Fruit, C Corn). Supply workers 55/75/95, Register 3/4/5, totals 58/79/100; VP 75/100/126; ships 4,5,6 / 5,6,7 / 6,7,8; role cards 6/7/8. No player goods/workers/buildings/VP; A selects role. N=2/6 or duplicate seats rejects creation. |
| SET-02 | SETUP-003, PLANTER-004 | pp.6–8,10; PR-010, PR-015 | N=3, bag's first four tiles F,S,C,T; create game then remove starting F,F,C from bag | Market remains F,S,C,T; bag counts F9,S10,C8,T8,Coffee8 =43; placed3 + market4 + bag43 =50; Quarry supply8. Repeating identical seed/commands yields identical market and RNG; no player chooses hidden order. |
| SET-03 | SETUP-004, SETUP-005 | pp.3–8 + PROJECT-003; PR-010, PR-026 | Create each supported N | Goods C10,F11,S11,T9,Coffee9; ships/House empty. Building stock totals20+24+5=49, identical at every N; numeric per-type literals in catalog below. |
| SET-04 | SETUP-006 | pp.4,9 + PROJECT-001; PR-021, PR-008 | N=4; A has83 coins, accepts Adventurer; separately attempts a cost2 purchase with1 coin/no discounts | Coins84 without bank-exhaustion failure; next chooser. Purchase rejected; balance1. VP75 means75 points, not75 physical tokens. |
| RND-01 | ROUND-001, ROLE-001 | pp.9,17; PR-011 | A has2 coins; Trader card holds3; A selects Trader, declines sale | A coins5, card coins0 and unavailable; B's Trader decision next. A cannot choose another role now; B cannot take chooser advantage. |
| RND-02 | ROUND-002 | pp.9,17; PR-012 | N=3/4/5, final selected role completes without trigger; three unchosen cards hold0,2,4 | Unchosen coins1,3,5; all6/7/8 cards available; Governor B, round+1, B chooses. Repeat a round: Governor C. Triggered counterpart END-02 grants no round coins. |
| RND-03 | ROLE-002, ROLE-003 | pp.9,18; PR-008, PR-016, PR-027 | A owns unoccupied Small Market; trades Fruit as nonchooser. City footprint10 then11; try Fire Station with10 coins and no discount | Trade pays1, no market bonus. At10 spaces build succeeds, occupies12; at11 rejects. Rearranging tiles changes no capacity; removal/replacement rejects. Base Small Market VP remains1 even unoccupied. |
| PLN-01 | PLANTER-001 | p.10; PR-014 | A has11 Countryside tiles, Quarry supply1; A selects Quarry. B has no Builder's Yard and tries Quarry; independently full-board actor tries estate | A reaches12 tiles, Quarry supply0, new tile unoccupied; B acts next. B Quarry and full-board placement reject; declining ordinary planting is legal and changes no resources. Separate N=5 variant: empty bag/discard still allows available face-up estate or Quarry per recorded interpretation. |
| PLN-02 | PLANTER-003, PLANTER-004 | p.10; PR-015 | N=5 after last actor: market leftovers F,S, bag only C, discard T,Coffee,F; controlled reshuffle order F,S,T,Coffee,F | Refresh yields C,F,S,T,Coffee,F; bag/discard empty; next chooser. N=5 variant only two total unplaced estates yields market2 with no fabrication; zero yields market0. Placed estates never recycled. |
| REC-01 | RECRUITER-001 | pp.10–11; PR-017 | Register8/6/7 for N3/4/5; A accepts supply advantage before distribution | Gains including advantage: 4,3,2 / 3,2,1,1 / 3,2,1,1,1; Register0, supply−1; A allocation first. Decline or supply0 gives 3,3,2 / 2,2,1,1 / 2,2,1,1,1. |
| REC-02 | RECRUITER-002, RECRUITER-003 | pp.10–11; PR-018 | A owns3 workers, one estate slot and one Small Market slot; confirm one each plus idle1 | Valid; B allocation next. Idle2 with empty Market slot rejects; duplicate slot, foreign tile, total4 or total2 rejects. With no free slots all surplus stays idle. Outside Recruiter generic reassignment rejects. |
| REC-03 | RECRUITER-004 | pp.11,17; PR-018, PR-032 | N=4 after allocations, E=7 empty building slots; supply5, then independent supply7; also E=2/supply9 | Transfer5, supply0, shortage trigger then score; exact7 transfers7 with no trigger; E2 requests4, transfers4 leaving5 then next chooser. Empty estates/Quarries do not increase E. |
| BLD-01 | BUILDER-001, BUILDER-002 | pp.11,18; PR-016 | A coins5, three occupied Quarries, buy Office cost5/cap2 | Accept privilege: pay2, coins3, stock−1, City+1; decline privilege: pay3, coins2. Three Quarries without privilege: Builder's Yard1, Harbor5, City Hall7. Small Fruit Depot with Quarry+privilege costs0, never pays a coin. Next actor. |
| BLD-02 | BUILDER-001, BUILDER-003 | pp.11,21; PR-016, PR-029, PR-032 | Buy duplicate Office / stock0 / cost5 with4 coins and no discounts / building exceeding12 spaces | Each rejects unchanged. At footprint11, legal one-space buy latches full City; B and C still act before score. Newly purchased School cannot give itself a worker; see B-16. |
| PRO-01 | CRAFTSMAN-001 | pp.9,12,18–19; PR-019 | A occupied estates C2,F3,S2; occupied processing F2,S0; supply C1,F5,S11; accept production | Gains C1,F2,S0; supply C0,F3,S11; no worker moves; B production next. Decline gains nothing. Requesting F1 instead of full F2 rejects under the documented interpretation. |
| PRO-02 | CRAFTSMAN-002, CRAFTSMAN-003 | p.12; PR-019 | A and B each have Fruit capacity2; supply3; C none; A produces then B then C | A gets2, B1, supply0; A has no available Fruit advantage. If initial supply4, A2/B2 likewise no bonus. If initial5, A2/B2 then A may take1 only after C finishes; otherwise decline leaves1. Old Coffee inventory alone never permits Coffee bonus. Next chooser after bonus. |
| TRD-01 | TRADER-001, TRADER-002 | p.13; PR-020 | A chooser sells Coffee to empty House, no markets; repeat with advantage declined; B sells Corn to empty House | A gains5 or4; B gains0; one crate moves to House; next actor. Prices in separate nonchooser cases C/F/S/T/Coffee are0/1/2/3/4. Same-type sale without Office and selling two crates reject. |
| TRD-02 | TRADER-003 | p.13; PR-020 | House C,F,S; A sells Coffee; B has Tobacco and Office | House remains four through B/C; B sale rejects even with Office; phase end returns C,F,S,Coffee one each to supply, House0, next chooser. House with only three at end stays unchanged. |
| ADV-01 | ADVENTURER-001 | pp.7,9,17; PR-021 | N=5; A coins2 selects Adventurer card with3 coins, accepts/declines advantage | A finishes with6/5; no B/C/D/E action; B chooses role. Second Adventurer card remains independently selectable. N3 has0, N4 has1, N5 has2 such cards. |

### Captain and phase-end boundaries

| Case | Rule IDs | S3 / owner | Input and action | Independently expected result / next decision |
| --- | --- | --- | --- | --- |
| CAP-01 | CAPTAIN-001, CAPTAIN-002 | pp.14–15; PR-022, PR-023 | N=4, empty ships5,6,7; A owns Sugar6 and Corn1 | Sugar choice requires ship6 or7, load6; ship5 rejects. Corn may instead load1 on any empty ship despite smaller total. Pass or partial Sugar5 rejects. B loading next. |
| CAP-02 | CAPTAIN-002 | pp.14–15; PR-022 | N=4, Sugar ship5 loaded4; other ships empty; A Sugar3 | Must load1 onto Sugar ship5, retains2; cannot use empty ship. Full Sugar ship blocks all further ordinary Sugar loads. With no Sugar ship, Sugar3 can choose any5/6/7 ship (ties). Mixing goods rejects. |
| CAP-03 | CAPTAIN-003 | pp.14–15; PR-024 | A chooser ships3 Corn then2 Fruit on later visit, no Harbor | Earns4 then2 =6, chooser bonus exactly1; B loading after each. If VP remaining2 before first award, remaining0 and overflow2; subsequent award raises overflow4. Exhaustion latches; continue phase. Empty load rejects and consumes no bonus. |
| CAP-04 | CAPTAIN-004, CAPTAIN-005 | pp.14–16,21; PR-023, PR-030A | All cargo ships full; A has Sugar3 with active unused Wharf; B/C no goods; A declines charter | One full no-load traversal enters retention, no repeated endless A prompt. If A accepts, personal cargo3 and one use consumed; later attempt rejects; next B then C then no-load traversal. If ordinary Sugar load is possible, declining Wharf does not permit passing it. |
| CAP-05 | CAPTAIN-005 | pp.14–16; PR-023 | Empty3-player ships4,5,6; A C1,F1; B/C no goods | A loads C1, B/C auto-skip, A loads F1; total A VP3 including chooser bonus. Only the next complete no-load traversal enters retention. Skipped players are still revisited, not removed. |
| CAP-06 | CAPTAIN-006 | p.16; PR-025 | After loading, A has C2,F3, no Warehouse; retain one F | A ends F1, supply gains C2,F2; retaining two rejects. Empty inventory requires no choice. Next retention actor; loading never resumes. |
| CAP-07 | CAPTAIN-007 | pp.16,21; PR-025, PR-030A | At cleanup: ship4 Corn4, ship5 Fruit2, ship6 empty; Personal Ship Sugar3; no unretained player goods | Supply gains C4,S3; ship4 empty/type null, ship5 remains F2, personal cargo0/use reset. Next chooser, or game-over if VP trigger already latched; no post-cleanup loading. |
| END-01 | ENDGAME-001 | pp.11,15,17; PR-032 | Separate histories: REC-03 shortage; BLD-02 full City; CAP-03 VP exhaustion | Exactly corresponding reason/revision/phase latched and retained. Empty goods/Quarry/estate supplies alone give no trigger. Two players filling Cities in one Builder phase preserve triggering evidence and both completed purchases. No base-game fixture fabricates non-Captain VP awards. |
| END-02 | ENDGAME-002 | p.17; PR-032 | First role this round triggers each ending separately | Builder: finish B/C choices; Recruiter: finish refill; Captain: finish all loading, retention and cleanup. Then game-over, no B role selection, no Governor rotation, no unchosen-card coins. Any later game command rejects unchanged. |

### Building catalog and ability fixtures

Each row is a direct BUILDING rule mapping and independent catalog assertion for PR-026. Tuple order is **cost / base VP / City spaces / worker slots / Quarry cap / stock**. Ability owner is separate; production capacities belong to PR-019, not six custom ability handlers. Sources are S3 pp.18–22; stock in every row is PROJECT-003. All building types are limited to one per player, tested by BLD-02. Bonuses below require the named building occupied unless the row explicitly contrasts inactive behavior.

| Case | Rule ID / building | Catalog tuple | Source / ability owner | Concrete action and expected ability result |
| --- | --- | --- | --- | --- |
| B-01 | BUILDING-001 Small Fruit Depot | 1/1/1/1/1/4 | p.18; PR-019 | Two occupied Fruit estates, one occupied slot, supply11: accept → Fruit+1, supply10; B next. |
| B-02 | BUILDING-002 Small Sugar Mill | 2/1/1/1/1/4 | p.18; PR-019 | Two occupied Sugar estates, one occupied slot, supply11: accept → Sugar+1, supply10. |
| B-03 | BUILDING-003 Large Fruit Depot | 3/2/1/3/2/3 | p.18; PR-019 | Four occupied Fruit estates, three occupied slots, supply11: +3, supply8. Also own occupied Small Depot: +4, supply7, not two separate estate pools. |
| B-04 | BUILDING-004 Large Sugar Mill | 4/2/1/3/2/3 | p.18; PR-019 | Three occupied Sugar estates, two occupied slots, supply11: +2, supply9; third unoccupied slot produces nothing. |
| B-05 | BUILDING-005 Large Tobacco Storage | 5/3/1/3/3/3 | p.18; PR-019 | Three occupied Tobacco estates and slots, supply9: +3, supply6; building grants no retention privilege. |
| B-06 | BUILDING-006 Large Coffee Roaster | 6/3/1/2/3/3 | p.18; PR-019 | Three occupied Coffee estates and two slots, supply9: +2, supply7; three workers in building rejects. |
| B-07 | BUILDING-007 Small Market | 1/1/1/1/1/2 | p.19; PR-027 | Nonchooser sells Corn for0 with bonus accepted: income1; declined/inactive income0; crate still sold. |
| B-08 | BUILDING-008 Hacienda; PLANTER-002 | 2/1/1/1/1/2 | p.19; PR-028 | A has10 tiles; hidden next Coffee; accept Hacienda then normal face-up Fruit →12 tiles, both unoccupied absent Hospital. Starting11: hidden Coffee fills12, no normal placement. Cannot reject revealed Coffee or substitute Quarry; separate N=5 variant with bag/discard empty gives no extra tile. |
| B-09 | BUILDING-009 Builder's Yard | 2/1/1/1/1/2 | p.19; PR-028 | B nonchooser selects one of8 Quarries → supply7, B Countryside+1. Inactive Yard rejects Quarry; chooser with Yard still gains at most one ordinary tile, no extra Quarry. |
| B-10 | BUILDING-010 Small Warehouse | 3/1/1/1/1/2 | p.20; PR-030 | Retention inventory C2,F3,S4; protect Sugar plus one Fruit →S4,F1 kept, C2/F2 returned; six kept rejects. |
| B-11 | BUILDING-011 Hospital | 4/2/1/1/2/2 | p.20; PR-028 | Hacienda Coffee + ordinary Quarry acquired; supply1/Register3: choose Quarry worker → supply0, Register3, only Quarry occupied. Supply0/Register3 → Register2. Both0 → no worker. Old estate target and second worker reject. |
| B-12 | BUILDING-012 Office | 5/2/1/1/2/2 | p.20; PR-027A | House F; B sells F1 → House F,F, supply unchanged, B income1; inactive rejects duplicate. Full House rejects even active; no second sale. |
| B-13 | BUILDING-013 Large Market | 5/2/1/1/2/2 | p.20; PR-027 | A chooser sells Coffee with both markets and advantage accepted: 4+2+1+1=8 coins. All three optional bonuses declined →4; each market adds only its own2/1. |
| B-14 | BUILDING-014 Large Warehouse | 6/2/1/1/2/2 | p.20; PR-030 | Inventory C2,F3,S4,T2; protect F/S plus one C →8 crates kept, C1/T2 returned. With both Warehouses protect C/F/S plus T1 →10 kept, T1 returned. Protected goods cannot bypass a legal load. |
| B-15 | BUILDING-015 Factory | 7/3/1/1/3/2 | p.20; PR-027 | Actual types0/1/2/3/4/5 yield coins0/0/1/2/3/5. Produces C/F, owns old Coffee, Sugar unavailable: income1, not3. Later chooser crate grants no second payout. |
| B-16 | BUILDING-016 School; BUILDER-003 | 8/3/1/1/3/2 | p.21; PR-029 | Already active School; buy Large Fruit Depot with3 empty slots: accept one worker → occupiedSlots1, not3. Supply1 preferred over Register; supply0/Register2 → Register1; both0 →0 workers. Newly bought School stays unoccupied and cannot activate itself. |
| B-17 | BUILDING-017 Harbor | 8/3/1/1/3/2 | p.21; PR-030A | A chooser loads Corn2 then Corn3 via Wharf: first2+1+1=4 VP, second3+1=4, total8. Same good twice still earns two Harbor bonuses. Decline Harbor both times →6 total. |
| B-18 | BUILDING-018 Wharf | 9/3/1/1/3/2 | p.21; PR-030A | A nonchooser owns Coffee5; cargo Coffee ship full. Charter all5 →VP5, Personal Ship5, supply unchanged until cleanup then+5. Partial4 or second charter rejects. Building purchase allocates token but unoccupied Wharf cannot charter. |
| B-19 | BUILDING-019 Fire Station | 10/4/2/1/4/1 | p.21; PR-033A | Own Small Fruit + Large Fruit + Large Sugar + Large Coffee, all unoccupied: bonus1+2+2+2=7; Fire Station unoccupied gives0 bonus but base4. |
| B-20 | BUILDING-020 Residence | 10/4/2/1/4/1 | p.21; PR-033A | Countryside tile counts1/9/10/11/12 →bonus4/4/5/6/7. Include Quarries and tiles without workers. Inactive Residence bonus0. Zero tiles is not a reachable base-game state. |
| B-21 | BUILDING-021 Fortress | 10/4/2/1/4/1 | p.22; PR-033A | Owned workers8/9/10 including2 idle →bonus2/3/3, not just placed-worker quotient. Inactive bonus0. |
| B-22 | BUILDING-022 Customs House | 10/4/2/1/4/1 | p.22 + p.17 interpretation; PR-033B | Earned VP7/8/30 →bonus1/2/7, even if30 includes overflow2. Base/other bonus VP excluded. Inactive bonus0. |
| B-23 | BUILDING-023 City Hall | 10/4/2/1/4/1 | p.22; PR-033B | Own City Hall, Residence, Small Market and Large Fruit Depot →commercial count3, bonus3; two-space Residence counts once and production does not count. Other buildings need no workers; inactive City Hall gives0 bonus. |

### Scoring, visibility, and invariants

| Case | Rule IDs | S3 / owner | Input and action | Independently expected result / next decision |
| --- | --- | --- | --- | --- |
| SCR-01 | SCORE-001 | pp.17,21–22; PR-033 | A earned30, owns active Customs House + active City Hall + inactive Small Market + inactive Large Fruit Depot; calculate twice | Base4+4+1+2=11; Customs7; City Hall3; total51 both times. VP supply unchanged; final snapshot unchanged; game-over remains. |
| SCR-02 | SCORE-002 | p.17; PR-033 | At final scoring A/B each VP40; A coins3/goods2, B coins4/goods0; C VP39/coins99 | A wins by5 vs4; C stays below both. B goods1 gives shared A/B victory with equal tiebreak5; do not add money/goods into primary VP. Use goods after Captain discard/cleanup, never cargo. |
| VIS-01 | VISIBILITY-001, VISIBILITY-002, VISIBILITY-003 | pp.6–8,10,14 + digital view policy; PR-035, PR-042 | A coins7/Fruit2/earned9, B earned11; project A/B views, events, legal choices and logs | Both see A coins7/Fruit2/board and public supply. A sees9 but no B11; B sees11 but no A9; neither receives bag order/seed/RNG/credentials. Hidden Coffee identity appears only after placement. Game-over reveals9 and11 plus breakdowns. Public action deductions remain possible. |
| INV-01 | INVARIANT-001 | pp.3–8,14–16,21; PR-008 | Balanced Corn ledger supply1 + players2 + cargo4 + personal2 + House1; transfer personal cargo to supply | Before/after total10; supply3/personal0 afterward. Extra crate makes11 and rejects invariant. Estates50, Quarries8, buildings49 each conserve across specified locations; moving a tile changes locations, not totals. |
| INV-02 | INVARIANT-002 | pp.6–11,18; PR-008 | N3 worker ledger supply40/Register3/placed14/idle1; validate; repeat equivalent ledgers totaling79/100 for N4/5 | Total58 passes; duplicated worker makes59 and fails. Negative count, nonexistent owner, duplicate building type, 13 City/Countryside spaces or overfilled slot fails. Idle with an empty slot fails Recruiter confirmation; later new empty building alone does not invalidate state. |
| INV-03 | INVARIANT-003 | pp.15,17 + engine contract; PR-008, PR-009, PR-032 | N3 total earned77, supply0, overflow2; validate then calculate building bonuses; try command after game-over | 77+0=75+2 passes, bonus points do not change ledger. Overflow1 fails. Rejected command preserves revision, RNG, components and empty events; cannot exit game-over. |

### Implementation boundaries and remaining test work

M3 implements role mechanics; M4 integrates activated abilities. CAP-04/CAP-07 can establish hook/state contracts in M3, but their actual Wharf integration assertions belong to PR-030A. Catalog data assertions belong to PR-026; earlier roles use minimal explicit fixtures, not guessed production catalogs. PR-031 audits every B-01…B-23 mapping, requires nonscoring implementations complete, and explicitly tracks scoring cases to PR-033A/PR-033B/PR-033.

The existing TS-REPLAY/NET/UI/MOTION/DURABLE families remain downstream integration requirements. This ticket does not invent complete game histories or implement test code. Future fixtures must balance components and validate legality before asserting an outcome; disconnected boundary snapshots are permitted unit fixtures, never evidence of a legally played complete game. Every added regression needs its own literal expectation and a stable rule mapping. Full-game histories and exhaustive generated combinations belong to their implementing tickets.


### PR-031 building coverage audit — 2026-09-30

All23 catalog types have explicit ability owners. All23 abilities are now implemented, including the five bonuses completed by PR-033A/B and composed by PR-033. Printed catalog assertions alone do not count as scoring evidence. The executable ownership map in [coverage.test.ts](../packages/game-engine/test/buildings/coverage.test.ts) checks every catalog key, unique B-case, matching rule ID, and complete ability ownership.

| Cases / buildings | Implementation owner | Existing executable evidence | Status |
| --- | --- | --- | --- |
| B-01–06: Small/Large Fruit Depot, Small/Large Sugar Mill, Large Tobacco Storage, Large Coffee Roaster | PR-019 | [craftsman.test.ts](../packages/game-engine/test/roles/craftsman.test.ts): per-type capacities, matching processors, supply limits | Implemented |
| B-07/13/15: Small Market, Large Market, Factory | PR-027 | [economy.test.ts](../packages/game-engine/test/buildings/economy.test.ts): independent optional bonuses, actual production counts, no repeat payout | Implemented |
| B-08/09/11: Hacienda, Builder’s Yard, Hospital | PR-028 | [settlement.test.ts](../packages/game-engine/test/buildings/settlement.test.ts): committed draw, Quarry access, one new-tile worker and source priority | Implemented |
| B-10/14: Small/Large Warehouse | PR-030 | [shipping.test.ts](../packages/game-engine/test/buildings/shipping.test.ts): protected totals5/8/10, distinct types, excess/inactive protection | Implemented |
| B-12: Office | PR-027A | [office.test.ts](../packages/game-engine/test/buildings/office.test.ts): duplicate sale, capacity, duplicated-crate cleanup | Implemented |
| B-16: School | PR-029 | [construction.test.ts](../packages/game-engine/test/buildings/construction.test.ts): pre-purchase activation, one worker, source priority | Implemented |
| B-17/18: Harbor, Wharf | PR-030A | [shipping.test.ts](../packages/game-engine/test/buildings/shipping.test.ts): optional per-load points, charter once, held cargo and cleanup | Implemented |
| B-19–21: Fire Station, Residence, Fortress | PR-033A; assembled scoring PR-033 | [scoringAssets.test.ts](../packages/game-engine/test/buildings/scoringAssets.test.ts): occupation gates, production classifications, tile/worker counts | Implemented |
| B-22/23: Customs House, City Hall | PR-033B; assembled scoring PR-033 | [scoringPoints.test.ts](../packages/game-engine/test/buildings/scoringPoints.test.ts): earned-VP floor, commercial tile counts, occupation gates | Implemented |

[building-interactions.test.ts](../packages/game-engine/test/scenarios/building-interactions.test.ts) adds four independent command sequences: Hacienda+Hospital into next-role production; Office+both markets+Trader privilege; combined Warehouses into later trading; and Harbor+Wharf+Captain bonus+Warehouses through cleanup. Each command restores a serialized snapshot, verifies deterministic results, unchanged input, one revision, contiguous event indexes and state invariants. These are controlled legal snapshots and multi-role sequences, not claims of complete end-to-end games. Existing owning suites retain the inactive/declined and rejection cases.


PR-033 scoring evidence: [scoring.test.ts](../packages/game-engine/test/scoring.test.ts) independently asserts the literal51-point example, all five composed bonuses, primary VP ordering, coins-plus-goods tiebreaks and shared competition ranks. It also covers frozen inputs, deterministic recalculation, seat-order results, finite numeric limits, mandatory terminal score arrays, 3/4/5-player completion events, and Captain overflow/cleanup before Customs House and tiebreak calculation. These are controlled legal boundary snapshots and command sequences; complete play histories remain PR-036.
