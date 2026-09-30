# Rule Decisions and Remaining Questions

The active [rules specification](RULES.md) and [state contract](GAME_STATE.md) have been reconciled to [S3](../references/puerto-rico-1897-special-edition-rulebook-en.pdf). All page numbers below refer to S3. V1 remains the 3–5-player base game. No decisions remain open; per-type stock is documented user input, not a newly verified PDF claim.

| Question ID | Status and resolution | Rule references / S3 source |
| --- | --- | --- |
| RULE-TODO-001 | RESOLVED — User-selected Special Edition PDF, exact hash recorded; S1/S2 superseded | Source register; pp.3–8 |
| RULE-TODO-002 | RESOLVED — S3 authoritative; verify and record any later publisher correction; no silent fallback to classic or S1 rules | Reference policy |
| RULE-TODO-003 | RESOLVED — Correct total workers then Register allocation; market drawn before starting estates assigned | SETUP-001–006; pp.3–8 |
| RULE-TODO-004 | RESOLVED — All role actions, advantages, shortages and transition boundaries specified; explicit interpretations recorded | ROLE and role-specific rules; pp.9–17 |
| RULE-TODO-005 | RESOLVED — Distribution, placement, clockwise online order; insufficient refill ends after Recruiter phase | RECRUITER-001–004; pp.10–11,17 |
| RULE-TODO-006 | RESOLVED — Mandatory loading, optional Wharf, storage, Cargo/Personal Ship cleanup | CAPTAIN-001–007; pp.14–16,20–21 |
| RULE-TODO-007 | RESOLVED — 23 base building types; S3 names/costs/slots/abilities; no cost-swap alternatives | BUILDING-001–023; pp.18–22 |
| RULE-TODO-008 | RESOLVED — End after triggering phase, overflow VP, itemized scoring, coins+goods tiebreak, explicitly shared victory | ENDGAME/SCORE; pp.11,15,17,21–22 |
| RULE-TODO-009 | RESOLVED — Public board/money/goods; earned VP concealed from opponents until scoring; hidden bag/RNG and filtered logs | VISIBILITY-001–003; pp.6–8,14 |
| RULE-TODO-010 | RESOLVED — User-approved unlimited coin accounting retained; S3 imposes component limits on goods/buildings/Countryside, not a money cap | PROJECT-001; pp.4,9 |
| RULE-TODO-011 | RESOLVED BY EXPLICIT INTERPRETATION — Accept full currently available production or decline the entire action. No per-good quantity slider added without an explicit rule | CRAFTSMAN-001; pp.9,12 |
| RULE-TODO-012 | RESOLVED BY USER INPUT — Production stock 4/4/3/3/3/3 adopted from the user-supplied building-quantity conversation; PROJECT-003 preserves provenance because the PDF does not enumerate per-type quantities | SETUP-005, BUILDING-001–006; pp.3,6,18 |
| RULE-TODO-013 | RESOLVED — Market first, then retrieve required starting types from the remaining bag. Even the maximum market draw cannot exhaust needed Fruit/Corn | SETUP-002–003; pp.6–8 |

## Reconciliation outcomes

- S1's end-of-round rule was replaced by S3's end-of-phase rule, not retained as an alternative.
- Wharf crates are held on the Personal Ship until the Captain phase ends; conservation includes that location.
- Shared victory is directly stated in S3, so the earlier PROJECT-002 convention is no longer needed as a rules gap workaround.
- Harbor's full p.21 text/example controls over the contradictory different-goods summary in reference-card artwork on p.3.
- Optional-action/Recruiter wording, estate-exhaustion shorthand, and Customs House overflow are explicit interpretations in RULES.md. They are not fabricated publisher clarifications.
- The previously proposed partial-production convention was not approved and has not been adopted. Production now follows the stronger literal reading above.

PR-003 will create individual scenario mappings and exhaustive fixtures; no production code exists.
