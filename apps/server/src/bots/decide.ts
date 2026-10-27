import type { GameState, PlayerId } from '@vibe-rico/game-engine';
import type { PlayerAction } from '@vibe-rico/protocol';
import type { AcceptedCommand } from '../rooms/store.js';
import { buildingVp, coinValue, deltaValue, emptySlots, production, publicVp, roundsLeft, usedSpaces } from './facts.js';
import { profiles } from './history.js';
import type { ChoiceQuestion, DecisionClient } from './jev.js';
import { candidates, GROUP_FACTS } from './options.js';
import type { Candidate } from './options.js';
import { planCriteria, postureCriteria, signalCriteria, STRATEGIES, STRATEGY_IDS } from './strategies.js';
import type { Posture, StrategyId } from './strategies.js';

/** At most this many Jev calls per bot turn (user requirement). */
export const MAX_CALLS = 3;
/** Above this many candidates the choice is split (groups) or pre-scored down; flat probabilities otherwise. */
const MAX_CHOICE = 12;
/** A new own plan must beat the current one by this much, so plans don't flip-flop. */
const SWITCH_MARGIN = 0.25;

/** What a bot remembers between turns; rebuilt by the next table read after a restart. */
export interface BotMemory {
  readonly strategy?: StrategyId;
  readonly strategyRound?: number;
  /** Opponent → probability of each plan (plus "unclear"). */
  readonly beliefs: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly posture: Readonly<Record<Posture, number>>;
  /** History length at the last table read. */
  readonly readAt?: number;
}
export const freshMemory = (): BotMemory => ({ beliefs: {}, posture: { build: 0.55, race: 0.15, block: 0.15, stall: 0.15 } });

export interface DecideInput {
  readonly state: GameState;
  readonly history: readonly AcceptedCommand[];
  readonly me: PlayerId;
  readonly names: Readonly<Record<string, string>>;
  readonly memory: BotMemory;
  /** Null: no key or Jev disabled; the code value alone decides. */
  readonly client: DecisionClient | null;
}
export interface Decision {
  readonly action: PlayerAction;
  readonly memory: BotMemory;
  readonly calls: number;
  /** For logs and tuning. */
  readonly trace: { readonly key: string; readonly scores: Readonly<Record<string, { jev: number; value: number }>>; readonly fallback?: string };
}

export async function decide(input: DecideInput): Promise<Decision | null> {
  const { state, history, me, names, client } = input;
  let calls = 0, fallback: string | undefined;
  const ask = async (s: unknown, qs: Record<string, ChoiceQuestion>) => {
    if (!client) throw new Error('no client');
    if (calls >= MAX_CALLS) throw new Error('call budget spent');
    calls++;
    return client.ask(s, qs);
  };
  const myName = names[me] ?? me;
  const coin = coinValue(state);
  let memory = input.memory;
  const first = candidates({ state, me, names, strategy: memory.strategy, coin });
  if (first.length === 0) return null;
  if (first.length === 1) return { action: first[0]!.action, memory, calls, trace: { key: first[0]!.key, scores: {} } };

  const people = profiles(state, history, me, names);
  const barrels = Object.fromEntries(Object.entries(people).map(([id, p]) => [id, p.shippedBarrels]));
  const vp = publicVp(state, barrels, me);
  const opponents = state.seatOrder.filter(id => id !== me);

  // Call 1: read the table when others have moved since the last read.
  const othersMoved = memory.readAt === undefined || history.slice(memory.readAt).some(c => c.playerId !== me);
  if (client && othersMoved) {
    const newRound = memory.strategy === undefined || (memory.strategyRound ?? 0) < state.roundNumber;
    const questions: Record<string, ChoiceQuestion> = {
      posture: { type: 'choice', instructions: `Given the whole game situation, which posture should ${myName} take this turn?`, criteria: postureCriteria() },
    };
    if (state.roundNumber > 1) for (const id of opponents) questions[`plan:${id}`] = { type: 'choice',
      instructions: `Which plan is ${names[id] ?? id} following, judging by their history?`, criteria: signalCriteria() };
    if (newRound) questions.own = { type: 'choice', instructions: `Which plan fits ${myName}'s position best for the rest of the game?`, criteria: planFit(state, me, memory) };
    try {
      const answers = await ask({ ...tableState(state, me, names, vp, memory), playerHistories: Object.values(people) }, questions);
      const beliefs = { ...memory.beliefs };
      for (const id of opponents) {
        const a = answers[`plan:${id}`];
        if (a) beliefs[id] = blend(beliefs[id], a.probabilities, 0.5);
      }
      const posture = blend(memory.posture, answers.posture?.probabilities, 0.7) as Record<Posture, number>;
      let strategy = memory.strategy, strategyRound = memory.strategyRound;
      const own = answers.own?.probabilities;
      if (own) {
        const best = STRATEGY_IDS.reduce((a, b) => (own[b] ?? 0) > (own[a] ?? 0) ? b : a);
        if (!strategy || (own[best] ?? 0) > (own[strategy] ?? 0) + SWITCH_MARGIN) strategy = best;
        strategyRound = state.roundNumber;
      }
      memory = { ...(strategy ? { strategy } : {}), ...(strategyRound !== undefined ? { strategyRound } : {}), beliefs, posture, readAt: history.length };
    } catch (e) { fallback = `read: ${(e as Error).message}`; }
  }

  const all = memory.strategy === input.memory.strategy ? first : candidates({ state, me, names, strategy: memory.strategy, coin });
  const threat = threats(state, me, vp);
  const code = (c: Candidate) => codeValue(state, me, c, coin, threat, memory.posture);
  // Calls 2–3: one Choice, or a group then a member when there are too many options.
  let jev = new Map<string, number>(all.map(c => [c.key, 1 / all.length]));
  if (client) {
    try { jev = await judge(all, code, ask, mainState(state, me, names, vp, memory), question(state, myName)); }
    catch (e) { fallback = `${fallback ? `${fallback}; ` : ''}choice: ${(e as Error).message}`; }
  }
  const scores = Object.fromEntries(all.map(c => {
    const j = jev.get(c.key) ?? 0;
    return [c.key, { jev: j, value: code(c) + (2 + 3 * memory.posture.build) * j }];
  }));
  const best = all.reduce((a, b) => scores[b.key]!.value > scores[a.key]!.value ? b : a);
  return { action: best.action, memory, calls, trace: { key: best.key, scores, ...(fallback ? { fallback } : {}) } };
}

async function judge(all: readonly Candidate[], code: (c: Candidate) => number,
  ask: (s: unknown, q: Record<string, ChoiceQuestion>) => Promise<Record<string, { probabilities: Readonly<Record<string, number>> }>>,
  state: unknown, instructions: string): Promise<Map<string, number>> {
  const ranked = [...all].sort((a, b) => code(b) - code(a));
  const groups = [...new Set(all.map(c => c.group).filter((g): g is string => !!g))];
  let pool = ranked.slice(0, MAX_CHOICE), weight = (_: Candidate) => 1;
  if (all.length > MAX_CHOICE && groups.length > 1) {
    // Nested: which kind of option first, then which one within the likeliest kinds.
    const g = (await ask(state, { group: { type: 'choice', instructions, criteria: Object.fromEntries(groups.map(id =>
      [id, `${GROUP_FACTS[id] ?? id} Options: ${all.filter(c => c.group === id).map(c => c.key).join(', ')}.`])) } })).group?.probabilities ?? {};
    const top = groups.sort((a, b) => (g[b] ?? 0) - (g[a] ?? 0)).slice(0, 2);
    pool = ranked.filter(c => top.includes(c.group!)).slice(0, MAX_CHOICE);
    weight = c => g[c.group!] ?? 0;
  }
  const answer = (await ask(state, { move: { type: 'choice', instructions, criteria: Object.fromEntries(pool.map(c => [c.key, c.facts])) } })).move;
  const p = answer?.probabilities ?? {};
  const raw = pool.map(c => [c.key, (p[c.key] ?? 0) * weight(c)] as const);
  const total = raw.reduce((a, [, v]) => a + v, 0) || 1;
  return new Map(raw.map(([k, v]) => [k, v / total]));
}

/** Own gain minus weighted gains of threatening opponents, plus own extras and pace by posture. */
function codeValue(state: GameState, me: PlayerId, c: Candidate, coin: number, threat: Readonly<Record<string, number>>, posture: Readonly<Record<Posture, number>>): number {
  const open = (id: string) => emptySlots(state.players.find(p => p.playerId === id)!);
  const mine = c.deltas?.[me] ? deltaValue(c.deltas[me]!, coin, open(me)) : 0;
  const wBlock = 0.4 + 0.8 * posture.block;
  const theirs = c.deltas ? Object.entries(c.deltas).filter(([id]) => id !== me)
    .reduce((a, [id, d]) => a + (threat[id] ?? 0.3) * deltaValue(d, coin, open(id)), 0) : 0;
  return mine + c.own - wBlock * theirs + 0.3 * (posture.race - posture.stall) * c.pace;
}
/** How dangerous each opponent is: public VP lead over the bot, weighted up as the end nears. */
function threats(state: GameState, me: PlayerId, vp: Readonly<Record<string, number>>): Record<string, number> {
  const late = 1 + Math.max(0, 6 - roundsLeft(state)) * 0.1;
  return Object.fromEntries(state.seatOrder.filter(id => id !== me).map(id =>
    [id, Math.min(1.5, Math.max(0.15, ((vp[id] ?? 0) - (vp[me] ?? 0) + 8) / 16)) * late]));
}

/** The plan options plus code-computed fit: own crops and how many opponents already lean the same way (shared ships, trading house). */
function planFit(state: GameState, me: PlayerId, memory: BotMemory): Record<string, string> {
  const p = state.players.find(x => x.playerId === me)!;
  const count = (goods: readonly string[]) => p.countryside.filter(t => goods.includes(t.kind)).length;
  const rivals = (id: StrategyId) => Object.values(memory.beliefs).filter(b => likeliest(b) === id).length;
  const fit: Record<StrategyId, string> = {
    shipper: `You have ${count(['corn', 'fruit'])} corn/fruit plantation(s).`,
    trader: `You have ${count(['coffee', 'tobacco'])} coffee/tobacco plantation(s) and ${p.coins} coins.`,
    builder: `You have ${count(['quarry'])} quarr(ies) and ${p.coins} coins; ${state.supply.quarryCount} quarries left.`,
    balanced: `You have ${new Set(p.countryside.map(t => t.kind)).size} different plantation kinds.`,
  };
  const base = planCriteria();
  return Object.fromEntries(STRATEGY_IDS.map(id => [id, `${base[id]} ${fit[id]}${id === 'balanced' ? '' : ` Opponents already following it: ${rivals(id)}.`}`]));
}

function blend(old: Readonly<Record<string, number>> | undefined, next: Readonly<Record<string, number>> | undefined, w: number): Record<string, number> {
  if (!next) return { ...old };
  if (!old) return { ...next };
  return Object.fromEntries([...new Set([...Object.keys(old), ...Object.keys(next)])].map(k => [k, (1 - w) * (old[k] ?? 0) + w * (next[k] ?? 0)]));
}
const likeliest = (b: Readonly<Record<string, number>> | undefined) => b && Object.keys(b).length
  ? Object.entries(b).sort((x, y) => y[1] - x[1])[0]![0] : 'unclear';

/** Public game facts in the shape Jev answered best to; the bot's own VP chips are included, others' are estimated. */
function gameState(state: GameState, me: PlayerId, names: Readonly<Record<string, string>>, vp: Readonly<Record<string, number>>) {
  const name = (id: string) => names[id] ?? id;
  return {
    round: state.roundNumber, you: name(me), governor: name(state.governorPlayerId), turnOrder: state.seatOrder.map(name),
    estimatedRoundsLeft: roundsLeft(state),
    supply: { vpChipsLeft: state.supply.vpRemaining, workersLeft: state.supply.workerCount, workersWaiting: state.supply.workRegisterCount, quarries: state.supply.quarryCount },
    cargoShips: state.ships.map(s => `${s.capacity}-hold ship: ${s.goodType ? `${s.loadedCount} ${s.goodType}` : 'empty'}`),
    tradingHouse: state.tradingHouse, plantationsOnOffer: state.estateMarket.map(t => t.kind),
    roles: state.roleCards.map(c => `${c.kind}${c.selectedBy ? ` (taken by ${name(c.selectedBy)})` : c.accumulatedCoins ? ` (+${c.accumulatedCoins} coins on it)` : ''}`),
    players: state.players.map(p => ({ name: name(p.playerId), coins: p.coins, publicVp: vp[p.playerId] ?? buildingVp(p),
      plantations: p.countryside.map(t => `${t.kind}${t.occupied ? '' : ' (unstaffed)'}`),
      buildings: p.buildings.map(b => `${b.buildingTypeId} ${b.occupiedSlots} staffed`), freeTownSpaces: 12 - usedSpaces(p),
      goods: Object.fromEntries(Object.entries(p.goods).filter(([, n]) => n)), idleWorkers: p.idleWorkerCount })),
  };
}
function tableState(state: GameState, me: PlayerId, names: Readonly<Record<string, string>>, vp: Readonly<Record<string, number>>, memory: BotMemory) {
  const p = state.players.find(x => x.playerId === me)!;
  const made = production(p);
  return { ...gameState(state, me, names, vp),
    yourNotes: [`${p.coins} coins`, `production per Craftsman: ${Object.entries(made).map(([g, n]) => `${n} ${g}`).join(', ') || 'nothing'}`,
      ...(memory.strategy ? [`current plan: ${STRATEGIES[memory.strategy].name}`] : [])] };
}
function mainState(state: GameState, me: PlayerId, names: Readonly<Record<string, string>>, vp: Readonly<Record<string, number>>, memory: BotMemory) {
  const leader = state.seatOrder.filter(id => id !== me).sort((a, b) => (vp[b] ?? 0) - (vp[a] ?? 0))[0];
  return { ...gameState(state, me, names, vp),
    opponentPlans: Object.fromEntries(state.seatOrder.filter(id => id !== me).map(id => {
      const plan = likeliest(memory.beliefs[id]);
      return [names[id] ?? id, plan in STRATEGIES ? STRATEGIES[plan as StrategyId].name : 'unclear'];
    })),
    ...(leader ? { leader: `${names[leader] ?? leader} (public VP ${vp[leader] ?? 0} vs your ${vp[me] ?? 0})` } : {}),
    ...(memory.strategy ? { yourPlan: STRATEGIES[memory.strategy].plan } : {}) };
}
function question(state: GameState, name: string): string {
  switch (state.phase.kind) {
    case 'role-selection': return `Which role should ${name} choose now?`;
    case 'planter-choice': return `Which plantation should ${name} take now?`;
    case 'builder-choice': return `Which building should ${name} buy now?`;
    case 'trader-choice': return `What should ${name} sell now?`;
    case 'captain-loading': return `Which load should ${name} make?`;
    case 'captain-retention': return `Which goods should ${name} keep?`;
    case 'craftsman-bonus': return `Which extra good should ${name} take?`;
    case 'recruiter-placement': return `How should ${name} place workers?`;
    default: return `What should ${name} do now?`;
  }
}
