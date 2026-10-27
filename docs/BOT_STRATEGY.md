# Bot Seats

The host can fill empty seats with bots in the lobby. A bot is an ordinary seat that the server plays. It is not scripted. Each turn, the code works out the numbers from the engine, and TypeSafe **Jev** makes the judgment calls.

Code: [apps/server/src/bots](../apps/server/src/bots).

## How a bot decides

**At most 3 Jev calls per bot turn.** A role choice and the action that follows it are separate turns. Calls that aren't needed are skipped. A move with only one sensible option (accept Hacienda, produce, take a worker) makes no call.

1. **Read the table** ([decide.ts](../apps/server/src/bots/decide.ts)). This call is skipped when no one else has moved since the bot's last read. It asks:
   - **Each opponent's plan:** a Choice over the four strategies below plus "unclear", using that player's public history ([history.ts](../apps/server/src/bots/history.ts)): roles chosen, buildings bought, plantations, quarries, barrels shipped, goods sold, coins.
   - **The bot's own plan:** asked on its first turn and re-checked once per round. The options carry code-computed fit facts (its crops, and how many opponents already follow each plan). It switches only when another plan beats the current one by 0.25, so its plan doesn't flip-flop. **No plan is tied to a seat.**
   - **Posture:** build / race / block / stall, judged from the whole game: rounds left, the public VP gap, the bot's engine, and opponents' plans. There is no "lead → race" rule in code. A bot behind on points with City Hall in reach still builds.
2. **Main choice.** One Choice over the legal moves ([options.ts](../apps/server/src/bots/options.ts)).
   - The prompt is a short, neutral question, e.g. "Which role should Bea choose now?"
   - Each option is described by facts from the engine, e.g. "You: with 9 coins can buy large-coffee-roaster (lets your staffed coffee produce). Others: chen small-fruit-depot. Coins, goods, workers and VP by the end of this role: …".
   - The simulation ([facts.ts](../apps/server/src/bots/facts.ts)) applies the move and plays the rest of the role with plain default choices.
3. **Nested choice.** Used only when there are more than 12 options, i.e. a rich builder. Call 2 asks which kind of building (production / economy / shipping / large / pass). Call 3 asks which building within the two likeliest kinds.

**Final pick (code).** The code makes the final pick:

`value = simulated own gain + own extras − Σ threat × opponent gain + pace × (race − stall) + (2 + 3·build) × Jev probability`

- **Threat:** comes from each opponent's public VP lead, and grows as the end nears.
- **Blocking weight:** rises with the "block" posture.
- **Coin value:** falls as the game ends.

So a move that hands the leader VP loses value even if Jev likes it.

**Fallback.** If Jev times out or fails (one retry, honouring `retry-after`), or there is no `JEV_API_KEY`, the code value alone decides. A move the engine rejects is retried once on the code value alone. A game never stalls.

**Privacy.** Bots use only what their seat can see:
- They get their own event view, so other players' `vp-earned` events are filtered out.
- Opponents' VP is estimated as building VP plus barrels shipped.
- The simulation only reports changes to the end of the current role, which the table would show.

## Prompt findings (live, jev-1.14.0)

| Level | Works | Doesn't |
| --- | --- | --- |
| Opponent plan | A Choice whose options are described by their signals, with history profiles as the state. Clear cases get 0.93–1.00; round 2 gets "unclear". | — |
| Posture | A Choice with fact-only state. | Adding the posture to a move question: "hold back chen" made Jev take Captain, which gave chen +6 VP. |
| Role / move | Options carrying code-computed facts in the "You: … Others: …" shape. | Bare option names; "You are bruno…" framing; a generic strategy text. |
| Building | One Choice whose options carry facts: the Coffee Roaster and Tobacco Storage come out as the top two. | A yes/no question per building, which scored 0.44–0.47 everywhere. |
| Arithmetic | Done in code. | Jev's "how much does this hold back the leader" scores, which ranked options backwards at 0.00 confidence; a coin-vs-VP score, which was flat. |

A call costs about 1.2–1.9k input tokens, roughly $0.00008. In a live 3-bot game:
- 224 moves, of which 128–141 asked Jev.
- 237–249 calls in total, never more than 3 per turn.
- About 0.4 s per Jev decision.
- No fallbacks.

To measure a prompt change, run `JEV_API_KEY=... pnpm --filter @vibe-rico/server build && node apps/server/scripts/bot-eval.mjs`. It prints the probability each fixed position gets. All 11 checks pass as of this change.

## Strategies

These are drawn from the sources below. Classic names are mapped to this engine: settler=planter, mayor=recruiter, prospector=adventurer, colonists=workers, indigo=fruit.

- **Corn/fruit shipper.**
  - Plan: many cheap plantations; ship often; Warehouse; Harbor or Wharf.
  - Signals: picks Captain often, ships rather than sells, few coins.
  - Pain points and blocks: fill the empty ship with another good; take Captain when they hold goods and you don't; buy the Wharf or Harbor first.
- **Coffee/tobacco trader.**
  - Plan: a cash crop with its building; sell through the trading house; markets and Factory; convert coins into buildings before the end.
  - Signals: picks Trader and Craftsman, sells rather than ships, high coins.
  - Pain points and blocks: fill the trading house with their good; take Trader first; take the quarry.
- **Quarry builder.**
  - Plan: early quarries; cheap income buildings; Factory; large buildings staffed by Recruiter.
  - Signals: several quarries, picks Builder often.
  - Pain points and blocks: take the quarry; buy the key large building first; end the game before its large buildings pay off.
- **Balanced / role denial.**
  - Plan: varied goods; take the role that helps you more than the players after you.
  - Signals: varied plantations, rarely repeats a role.

**General principles.** These are applied in the code value and in the option facts:
- Pick roles that help you more than the next players.
- Bonus coins pile up on roles nobody picks.
- Coins are worth most early and almost nothing at the end.
- Staff production chains and paying buildings first.
- Games usually last 13–16 rounds.

**Sources.**
- [BGA Puerto Rico tips](https://en.doc.boardgamearena.com/Tips_puertorico)
- [Puerto Rico strategy guide for newbies](http://boardgamestrategy.blogspot.com/2010/08/puerto-rico-strategy-guide-for-newbies.html)
- [Puerto Rico strategy guide](https://boardgamestrategy.blogspot.com/2009/01/puerto-rico-strategy-guide.html)
- [UltraBoardGames: getting better](https://www.ultraboardgames.com/puerto-rico/getting-better.php)
- [The Gamer's Guides](https://www.thegamersguides.com/board-game-puerto-rico-strategy/)
- [Wikipedia](https://en.wikipedia.org/wiki/Puerto_Rico_(board_game))
- [Game archive session notes](https://gamearchive.barefield.ua.edu/?p=916)

## Seats and runner

- **Room requests** (host only, before start):
  - `add-bot {roomId}`
  - `fill-bots {roomId, seats}` (3–5)
  - `remove-bot {roomId, playerId}`
- **Seat list:** `RoomState.seats[].bot` marks bot seats. Strategies never leave the server.
- **Seat tokens:** a bot seat gets a token hash for a token that is never issued, so it can't be resumed.
- **Leaving:** bots can't host, so the room closes when its last human leaves.
- **Runner** ([runner.ts](../apps/server/src/bots/runner.ts)):
  - **When it runs:** after every commit, after start and import, and after a restart.
  - **What it does:** waits about 1.2 s, then submits through `submitCommand` like any seat. Validation, deduplication and broadcast are unchanged.
  - **Memory:** a bot's memory (plan, opponent beliefs, posture) is kept in server memory. After a restart, it is rebuilt by the next table read.
- **Config:** `JEV_API_KEY` enables Jev. `JEV_MODEL` overrides the pinned `jev-1.14.0`. Each bot move is logged as one JSON line, with the move, calls, plan and any fallback.
