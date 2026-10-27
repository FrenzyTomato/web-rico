// Prompt eval for bot seats (docs/BOT_STRATEGY.md "Prompt findings"): asks live Jev the bot's real questions on
// fixed positions and prints the probability each expected answer gets, so prompt changes can be compared.
// Usage: JEV_API_KEY=... pnpm --filter @vibe-rico/server build && node scripts/bot-eval.mjs
import { applyCommand, createGame } from '@vibe-rico/game-engine';
import { commands, input } from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.ts';
import { decide, freshMemory } from '../dist/bots/decide.js';
import { JevClient } from '../dist/bots/jev.js';
import { postureCriteria, signalCriteria } from '../dist/bots/strategies.js';

if (!process.env.JEV_API_KEY) { console.error('usage: JEV_API_KEY=... node scripts/bot-eval.mjs'); process.exit(2); }
const jev = new JevClient(process.env.JEV_API_KEY, process.env.JEV_MODEL || undefined);
const names = { alice: 'alice', bruno: 'bruno', chen: 'chen' };

/** The fixed 3-player game at its 31st role choice: round 11, bruno to choose. */
function position() {
  let state = createGame(input).state;
  const history = [];
  let choices = 0;
  for (const [i, c] of commands.entries()) {
    if (state.phase.kind === 'role-selection' && choices++ === 30) break;
    const r = applyCommand(state, c);
    history.push({ playerId: c.actorId, commandId: `c${i}`, expectedRevision: state.revision, action: c, acceptedRevision: r.state.revision, events: r.events });
    state = r.state;
  }
  return { state, history };
}
function edit(state, f) { const s = structuredClone(state); f(s); return s; }
function give(s, id, goods = {}, vp = 0) {
  const p = s.players.find(x => x.playerId === id);
  for (const [g, n] of Object.entries(goods)) { p.goods[g] += n; s.supply.goods[g] -= n; }
  p.earnedVp += vp; s.supply.vpRemaining -= vp;
}
const { state: base, history } = position();
const rows = [];
const check = (name, probability, pass) => rows.push({ name, probability: Number(probability.toFixed(2)), pass });

// Move choices go through the real bot (memory marks the table as read, so only the move question is asked).
async function move(name, state, expect) {
  const d = await decide({ state, history, me: 'bruno', names, memory: { ...freshMemory(), readAt: history.length }, client: jev });
  const p = Object.fromEntries(Object.entries(d.trace.scores).map(([k, v]) => [k, v.jev]));
  if (expect.best) check(`${name}: bot picks ${expect.best} (Jev's top: ${Object.entries(p).sort((a, b) => b[1] - a[1])[0][0]})`, p[expect.best] ?? 0, d.trace.key === expect.best);
  if (expect.top2) check(`${name}: ${expect.top2.join('/')} in Jev's top 2`, expect.top2.reduce((a, k) => a + (p[k] ?? 0), 0),
    Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, 2).some(([k]) => expect.top2.includes(k)));
  if (expect.not) check(`${name}: bot avoids ${expect.not}`, p[expect.not] ?? 0, d.trace.key !== expect.not);
}
await move('Coffee to sell', edit(base, s => { give(s, 'bruno', { coffee: 2 }); for (const g of s.tradingHouse) s.supply.goods[g]++; s.tradingHouse = []; }), { best: 'trader' });
await move('Rich, coffee unprocessed', edit(base, s => { s.players.find(p => p.playerId === 'bruno').coins = 9; }), { best: 'builder' });
await move('Leader holds corn', edit(base, s => give(s, 'chen', { corn: 6 }, 15)), { not: 'captain' });
const builderTurn = edit(base, s => { s.players.find(p => p.playerId === 'bruno').coins = 9; });
await move('Which building', applyCommand(builderTurn, { kind: 'choose-role', actorId: 'bruno', roleCardId: builderTurn.roleCards.find(c => c.kind === 'builder').instanceId }).state,
  { top2: ['large-coffee-roaster', 'large-tobacco-storage'] });

// Inference and posture use the same question text as the bot's table read.
const profiles = {
  shipper: { player: 'chen', rolesChosen: ['planter', 'captain', 'captain', 'recruiter', 'captain', 'craftsman', 'captain', 'captain'], plantations: ['corn', 'corn', 'corn', 'fruit', 'fruit', 'sugar'], quarries: 0, buildingsBought: ['small-fruit-depot', 'small-warehouse', 'harbor'], shippedBarrels: 19, soldGoods: 1, coins: 2 },
  trader: { player: 'chen', rolesChosen: ['planter', 'trader', 'craftsman', 'builder', 'trader', 'trader', 'craftsman', 'builder'], plantations: ['coffee', 'tobacco', 'tobacco', 'corn'], quarries: 1, buildingsBought: ['large-coffee-roaster', 'large-tobacco-storage', 'small-market', 'factory'], shippedBarrels: 4, soldGoods: 7, coins: 9 },
  builder: { player: 'chen', rolesChosen: ['planter', 'builder', 'planter', 'builder', 'recruiter', 'builder', 'builder', 'planter'], plantations: ['corn', 'fruit'], quarries: 4, buildingsBought: ['builders-yard', 'small-market', 'hospital', 'office', 'school'], shippedBarrels: 3, soldGoods: 2, coins: 4 },
};
for (const [plan, profile] of Object.entries(profiles)) {
  const a = (await jev.ask({ round: 8, playerHistories: [profile] }, { q: { type: 'choice', instructions: 'Which plan is chen following, judging by their history?', criteria: signalCriteria() } })).q;
  check(`Inference: ${plan}`, a.probabilities[plan] ?? 0, a.choice === plan);
}
const postures = [
  ['build', 'Behind, City Hall in reach', { you: 'bruno', round: 14, estimatedRoundsLeft: 2, vpChipsLeft: 6, publicVp: { bruno: 24, chen: 28, alice: 20 }, yourNotes: ['9 coins and 2 quarries: City Hall affordable next Builder', 'Factory pays 3 coins per production'] }],
  ['race', 'Leading late', { you: 'bruno', round: 13, estimatedRoundsLeft: 2, vpChipsLeft: 8, publicVp: { bruno: 34, chen: 26, alice: 22 }, yourNotes: ['5 corn ready to ship', 'no affordable large building'] }],
  ['block', 'Leader running away', { you: 'bruno', round: 9, estimatedRoundsLeft: 5, vpChipsLeft: 30, publicVp: { bruno: 12, chen: 25, alice: 14 }, yourNotes: ['one staffed corn', '3 coins'], opponentPlans: { chen: 'shipper with harbor and 7 corn' } }],
  ['build', 'Early game', { you: 'bruno', round: 3, estimatedRoundsLeft: 12, vpChipsLeft: 75, publicVp: { bruno: 1, chen: 2, alice: 0 }, yourNotes: ['coffee plantation, roaster affordable soon'] }],
];
for (const [expected, name, state] of postures) {
  const a = (await jev.ask(state, { q: { type: 'choice', instructions: 'Given the whole game situation, which posture should bruno take this turn?', criteria: postureCriteria() } })).q;
  check(`Posture: ${name} → ${expected}`, a.probabilities[expected] ?? 0, a.choice === expected);
}
console.table(rows);
console.log(`${rows.filter(r => r.pass).length}/${rows.length} passed`);
