import { applyCommand, BUILDINGS, getLegalCommands } from '@vibe-rico/game-engine';
import type { BuildingType, GameCommand, GameState, Good, LegalAction, PlayerId, PlayerState } from '@vibe-rico/game-engine';

/** Code does the arithmetic; Jev only judges (docs/BOT_STRATEGY.md "Prompt findings"). */
export const PRICE: Readonly<Record<Good, number>> = { corn: 0, fruit: 1, sugar: 2, tobacco: 3, coffee: 4 };
export const PROCESSES: Partial<Record<BuildingType, Good>> = {
  'small-fruit-depot': 'fruit', 'large-fruit-depot': 'fruit', 'small-sugar-mill': 'sugar',
  'large-sugar-mill': 'sugar', 'large-tobacco-storage': 'tobacco', 'large-coffee-roaster': 'coffee',
};
export const EFFECT: Partial<Record<BuildingType, string>> = {
  'small-market': '+1 coin whenever you sell', 'large-market': '+2 coins whenever you sell',
  hacienda: 'extra plantation when planting', 'builders-yard': 'may take a quarry instead of a plantation',
  'small-warehouse': 'keep one extra kind of good after shipping', 'large-warehouse': 'keep two extra kinds of goods after shipping',
  hospital: 'new plantation comes with a worker', office: 'may sell a good already in the trading house',
  factory: 'coins when you produce several kinds of goods', school: 'new building comes with a worker',
  harbor: '+1 VP every time you ship', wharf: 'ship on your own ship once per Captain',
  'fire-station': 'end-game VP bonus', residence: 'end-game VP for filled plantation spaces', fortress: 'end-game VP for workers',
  'customs-house': 'end-game VP for shipped VP', 'city-hall': 'end-game VP for buildings',
};
const BUILDING_SPACES = 12;

export interface Delta { readonly coins: number; readonly vp: number; readonly goods: number; readonly workers: number }
export type Deltas = Readonly<Record<PlayerId, Delta>>;

const actorOf = (s: GameState) => s.seatOrder.find(id => getLegalCommands(s, id).length > 0);
/** Plain follow-up play used only to estimate what a move yields: take the obvious best option, never build or plant. */
function defaultCommand(l: LegalAction): GameCommand | null {
  const a = l.actorId;
  switch (l.phase) {
    case 'craftsman-production': return { kind: 'produce', actorId: a, production: { accept: true, useFactory: l.factoryChoices.includes(true) } };
    case 'craftsman-bonus': return { kind: 'take-production-bonus', actorId: a, good: [...l.goods].sort((x, y) => (y ? PRICE[y] : -1) - (x ? PRICE[x] : -1))[0] ?? null };
    case 'trader-choice': {
      const best = [...l.sales].sort((x, y) => y.price - x.price)[0];
      return { kind: 'trade', actorId: a, sale: best ? { good: best.good, useAdvantage: best.useAdvantage, useSmallMarket: best.useSmallMarket, useLargeMarket: best.useLargeMarket } : null };
    }
    case 'captain-loading': {
      const best = [...l.loads].sort((x, y) => y.quantity - x.quantity)[0];
      return best ? { kind: 'load', actorId: a, shipment: best.shipment, useHarbor: l.harborChoices.includes(true) } : { kind: 'decline-wharf', actorId: a };
    }
    case 'captain-retention': {
      const keep = (Object.keys(l.available) as Good[]).filter(g => l.available[g] > 0).sort((x, y) => PRICE[y] - PRICE[x])[0];
      return { kind: 'retain', actorId: a, retained: { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0, ...(keep ? { [keep]: 1 } : {}) }, warehouseTypes: [] };
    }
    case 'planter-before': return { kind: 'use-hacienda', actorId: a, accept: false };
    case 'planter-choice': return { kind: 'plant', actorId: a, choice: { kind: 'decline' } };
    case 'planter-worker': return { kind: 'use-hospital', actorId: a, tileId: null };
    case 'builder-choice': return { kind: 'build', actorId: a, purchase: null };
    case 'recruiter-advantage': return { kind: 'recruit-worker', actorId: a, accept: l.accept.includes(true) };
    case 'adventurer': return { kind: 'take-adventurer-coin', actorId: a, accept: l.accept.includes(true) };
    default: return null; // Worker placement: workers received are counted, placement is not simulated.
  }
}

/** Applies `command`, plays the rest of the role with default choices and returns each player's change. */
export function simulate(state: GameState, command: GameCommand): Deltas | null {
  const first = applyCommand(state, command);
  if (!first.ok) return null;
  let s = first.state;
  for (let i = 0; i < 60 && s.phase.kind !== 'role-selection' && s.phase.kind !== 'game-over'; i++) {
    const id = actorOf(s);
    const legal = id && getLegalCommands(s, id)[0];
    const next = legal && defaultCommand(legal);
    if (!next) break;
    const r = applyCommand(s, next);
    if (!r.ok) break;
    s = r.state;
  }
  const goods = (p: PlayerState) => Object.values(p.goods).reduce((a, b) => a + b, 0);
  return Object.fromEntries(state.players.map(p => {
    const q = s.players.find(x => x.playerId === p.playerId)!;
    return [p.playerId, { coins: q.coins - p.coins, vp: q.earnedVp - p.earnedVp, goods: goods(q) - goods(p), workers: workers(q) - workers(p) }];
  }));
}

export const workers = (p: PlayerState) => p.idleWorkerCount + p.countryside.filter(t => t.occupied).length + p.buildings.reduce((a, b) => a + b.occupiedSlots, 0);
export const emptySlots = (p: PlayerState) => p.countryside.filter(t => !t.occupied).length
  + p.buildings.reduce((a, b) => a + BUILDINGS[b.buildingTypeId].workerSlots - b.occupiedSlots, 0) - p.idleWorkerCount;
export const buildingVp = (p: PlayerState) => p.buildings.reduce((a, b) => a + BUILDINGS[b.buildingTypeId].baseVp, 0);
export const usedSpaces = (p: PlayerState) => p.buildings.reduce((a, b) => a + BUILDINGS[b.buildingTypeId].footprint, 0);
/** Goods one production would make right now (corn needs no building). */
export function production(p: PlayerState): Partial<Record<Good, number>> {
  const out: Partial<Record<Good, number>> = {};
  for (const good of Object.keys(PRICE) as Good[]) {
    const staffed = p.countryside.filter(t => t.kind === good && t.occupied).length;
    const capacity = good === 'corn' ? staffed : p.buildings.filter(b => PROCESSES[b.buildingTypeId] === good).reduce((a, b) => a + b.occupiedSlots, 0);
    const n = Math.min(staffed, capacity);
    if (n) out[good] = n;
  }
  return out;
}

/** Rough rounds left before an end trigger (VP chips, workers or a full town); shown to Jev and used for coin value. */
export function roundsLeft(state: GameState): number {
  const n = state.players.length;
  const byVp = state.supply.vpRemaining / Math.max(1, n * 1.5);
  const byWorkers = state.supply.workerCount / Math.max(1, n);
  const byTown = Math.min(...state.players.map(p => (BUILDING_SPACES - usedSpaces(p)) * 1.5));
  return Math.max(0, Math.round(Math.min(byVp, byWorkers, byTown)));
}
/** VP worth of one coin: high early, near zero once nothing more can be bought. */
export const coinValue = (state: GameState) => Math.min(0.6, 0.1 + roundsLeft(state) * 0.04);
export const GOOD_VALUE = 0.6;
export const WORKER_VALUE = 0.5;
/** A move's change in VP terms; workers count only up to the player's empty slots. */
export const deltaValue = (d: Delta, coin: number, openSlots = Infinity) =>
  d.vp + d.coins * coin + d.goods * GOOD_VALUE + Math.min(d.workers, Math.max(0, openSlots)) * WORKER_VALUE;

/** Public VP estimate: building VP plus barrels shipped (others' VP chips are hidden; barrels are visible). */
export function publicVp(state: GameState, shippedBarrels: Readonly<Record<string, number>>, viewer: PlayerId): Record<PlayerId, number> {
  return Object.fromEntries(state.players.map(p => [p.playerId,
    buildingVp(p) + (p.playerId === viewer ? p.earnedVp : shippedBarrels[p.playerId] ?? 0)]));
}

export function describeDelta(d: Deltas, me: PlayerId, names: Readonly<Record<string, string>>): string {
  return Object.entries(d).map(([id, x]) => {
    const parts = [x.vp && `${x.vp > 0 ? '+' : ''}${x.vp} VP`, x.coins && `${x.coins > 0 ? '+' : ''}${x.coins} coins`,
      x.goods && `${x.goods > 0 ? '+' : ''}${x.goods} goods`, x.workers && `+${x.workers} workers`].filter(Boolean);
    return `${id === me ? 'you' : names[id] ?? id}: ${parts.join(', ') || 'nothing'}`;
  }).join('; ');
}

/** What buying `type` would do for `p`, in the words Jev answered best to. */
export function buildingFacts(p: PlayerState, type: BuildingType): string {
  const good = PROCESSES[type];
  if (!good) return EFFECT[type] ?? 'building';
  const staffed = p.countryside.filter(t => t.kind === good && t.occupied).length;
  const all = p.countryside.filter(t => t.kind === good).length;
  const capacity = p.buildings.filter(b => PROCESSES[b.buildingTypeId] === good).reduce((a, b) => a + BUILDINGS[b.buildingTypeId].workerSlots, 0);
  const unlock = Math.max(0, Math.min(all, capacity + BUILDINGS[type].workerSlots) - Math.max(capacity, 0));
  return `processes ${good} (sells for ${PRICE[good]}); you have ${all} ${good} plantation(s), ${staffed} staffed, ${capacity} ${good} building slot(s). `
    + (unlock ? `Unlocks up to ${unlock} more ${good} per production.` : 'Adds no production now.');
}
/** Extra goods per production once staffed, for the code value. */
export function unlockCount(p: PlayerState, type: BuildingType): number {
  const good = PROCESSES[type];
  if (!good) return 0;
  const all = p.countryside.filter(t => t.kind === good).length;
  const capacity = p.buildings.filter(b => PROCESSES[b.buildingTypeId] === good).reduce((a, b) => a + BUILDINGS[b.buildingTypeId].workerSlots, 0);
  return Math.max(0, Math.min(all, capacity + BUILDINGS[type].workerSlots) - capacity);
}
