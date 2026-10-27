import { BUILDINGS, getLegalCommands } from '@vibe-rico/game-engine';
import type { BuildingType, GameCommand, GameState, Good, Goods, LegalAction, PlayerId, PlayerState, WorkerAllocation } from '@vibe-rico/game-engine';
import type { PlayerAction } from '@vibe-rico/protocol';
import { buildingFacts, describeDelta, emptySlots, PRICE, PROCESSES, production, roundsLeft, simulate, unlockCount, usedSpaces } from './facts.js';
import type { Deltas } from './facts.js';
import { STRATEGIES } from './strategies.js';
import type { StrategyId } from './strategies.js';

/** One legal move with the facts Jev sees and the numbers the code scores. */
export interface Candidate {
  readonly key: string;
  readonly action: PlayerAction;
  /** Choice option description: code-computed facts, "You: … Others: …". */
  readonly facts: string;
  /** Simulated change for every player to the end of the current role, when it can be simulated. */
  readonly deltas: Deltas | null;
  /** The mover's value not captured by `deltas`, in VP terms (a building's VP, a plantation, workers placed well). */
  readonly own: number;
  /** How much the move brings the game end closer (VP chips taken, town spaces filled). */
  readonly pace: number;
  /** Nested decisions: the first level picks a group, the second a candidate inside it. */
  readonly group?: string;
}
export interface OptionContext {
  readonly state: GameState;
  readonly me: PlayerId;
  readonly names: Readonly<Record<string, string>>;
  readonly strategy: StrategyId | undefined;
  /** VP worth of one coin now (facts.coinValue). */
  readonly coin: number;
}

const strip = (c: GameCommand): PlayerAction => { const { actorId: _, ...action } = c; return action as PlayerAction; };
const LARGE: readonly BuildingType[] = ['fire-station', 'residence', 'fortress', 'customs-house', 'city-hall'];

/** Every reasonable move for `me` now. Dominated flags (factory, harbor, markets, school) are always taken. */
export function candidates(ctx: OptionContext): Candidate[] {
  const { state, me } = ctx;
  const legal = getLegalCommands(state, me)[0];
  if (!legal) return [];
  const p = state.players.find(x => x.playerId === me)!;
  const make = (key: string, command: GameCommand, facts: string, extra: Partial<Pick<Candidate, 'own' | 'pace' | 'group'>> & { quiet?: boolean } = {}): Candidate => {
    const deltas = simulate(state, command);
    // Planting and building are not simulated, so their roles show only the facts (the simulated line read as "+1 coin").
    return { key, action: strip(command), deltas, own: extra.own ?? 0, pace: extra.pace ?? 0, ...(extra.group ? { group: extra.group } : {}),
      facts: deltas && !extra.quiet ? `${facts} Coins, goods, workers and VP by the end of this role: ${describeDelta(deltas, me, ctx.names)}.` : facts };
  };
  const only = (command: GameCommand) => [make('only', command, 'Only sensible option.')];
  switch (legal.phase) {
    case 'role-selection': return legal.roleCardIds.map(id => {
      const card = state.roleCards.find(c => c.instanceId === id)!;
      return make(card.kind, { kind: 'choose-role', actorId: me, roleCardId: id }, roleFacts(ctx, card.kind),
        { own: roleOwn(ctx, card.kind), quiet: card.kind === 'planter' || card.kind === 'builder' });
    });
    case 'planter-before': return only({ kind: 'use-hacienda', actorId: me, accept: legal.accept.includes(true) });
    case 'planter-worker': return only({ kind: 'use-hospital', actorId: me, tileId: legal.tileIds.find(t => t !== null) ?? null });
    case 'recruiter-advantage': return only({ kind: 'recruit-worker', actorId: me, accept: legal.accept.includes(true) });
    case 'adventurer': return only({ kind: 'take-adventurer-coin', actorId: me, accept: legal.accept.includes(true) });
    case 'craftsman-production': return only({ kind: 'produce', actorId: me, production: { accept: true, useFactory: legal.factoryChoices.includes(true) } });
    case 'planter-choice': {
      const seen = new Set<string>();
      return legal.choices.flatMap(choice => {
        const key = choice.kind === 'estate' ? state.estateMarket.find(t => t.instanceId === choice.tileId)?.kind ?? choice.tileId : choice.kind;
        if (seen.has(key)) return [];
        seen.add(key);
        return [make(key, { kind: 'plant', actorId: me, choice }, plantFacts(p, key), { own: plantOwn(ctx, p, key) })];
      });
    }
    case 'builder-choice': {
      const best = new Map<BuildingType, LegalOptions<'builder-choice'>['purchases'][number]>();
      for (const x of legal.purchases) if ((best.get(x.buildingTypeId)?.price ?? Infinity) > x.price) best.set(x.buildingTypeId, x);
      return [...[...best.values()].map(x => {
        const def = BUILDINGS[x.buildingTypeId];
        return make(x.buildingTypeId, { kind: 'build', actorId: me, purchase: { buildingTypeId: x.buildingTypeId, useAdvantage: x.useAdvantage, useSchool: x.schoolChoices.includes(true) } },
          `${x.buildingTypeId}: ${buildingFacts(p, x.buildingTypeId)} Costs you ${x.price} of your ${p.coins} coins; worth ${def.baseVp} VP; uses ${def.footprint} of your ${12 - usedSpaces(p)} free town spaces.`,
          { own: buildOwn(ctx, p, x.buildingTypeId), pace: def.footprint, group: buildingGroup(x.buildingTypeId) });
      }), make('pass', { kind: 'build', actorId: me, purchase: null }, 'Buy nothing and keep your coins.', { group: 'pass' })];
    }
    case 'craftsman-bonus': return legal.goods.map(good => make(good ?? 'none', { kind: 'take-production-bonus', actorId: me, good },
      good ? `Take 1 extra ${good} (sells for ${PRICE[good]}).` : 'Take nothing.', { own: good ? PRICE[good] * 0.1 : 0 }));
    case 'trader-choice': {
      const best = new Map<Good, LegalOptions<'trader-choice'>['sales'][number]>();
      for (const x of legal.sales) if ((best.get(x.good)?.price ?? -1) < x.price) best.set(x.good, x);
      return [...[...best.values()].map(x => make(`sell_${x.good}`, { kind: 'trade', actorId: me, sale: { good: x.good, useAdvantage: x.useAdvantage, useSmallMarket: x.useSmallMarket, useLargeMarket: x.useLargeMarket } },
        `Sell 1 ${x.good} for ${x.price} coins; the trading house then holds ${[...state.tradingHouse, x.good].join(', ')}.`)),
      make('pass', { kind: 'trade', actorId: me, sale: null }, 'Sell nothing.')];
    }
    case 'captain-loading': {
      const harbor = legal.harborChoices.includes(true);
      const loads = legal.loads.map(x => {
        const ship = x.shipment.kind === 'cargo' ? state.ships.find(s => s.instanceId === (x.shipment as { shipId: string }).shipId)! : null;
        const where = ship ? `the ${ship.capacity}-hold ship (${ship.goodType ? `${ship.loadedCount} ${ship.goodType}` : 'empty'})` : 'your own ship';
        return make(`${x.shipment.good}_${ship ? ship.capacity : 'own'}`, { kind: 'load', actorId: me, shipment: x.shipment, useHarbor: harbor },
          `Load ${x.quantity} ${x.shipment.good} onto ${where}.`, { pace: x.quantity });
      });
      return legal.canDeclineWharf ? [...loads, make('decline_wharf', { kind: 'decline-wharf', actorId: me }, 'Do not use your own ship.')] : loads;
    }
    case 'captain-retention': return retentionOptions(legal).map((r, i) =>
      make(`keep_${i}`, { kind: 'retain', actorId: me, retained: r.retained, warehouseTypes: r.warehouseTypes },
        `Keep ${Object.entries(r.retained).filter(([, n]) => n).map(([g, n]) => `${n} ${g}`).join(', ') || 'nothing'}.`,
        { own: Object.entries(r.retained).reduce((a, [g, n]) => a + n * (0.3 + PRICE[g as Good] * 0.1), 0) }));
    case 'recruiter-placement': return allocations(state, p, legal).map(a =>
      ({ key: a.key, action: { kind: 'allocate-workers', allocation: a.allocation }, facts: a.facts, deltas: null, own: a.own, pace: 0 }));
  }
}

type LegalOptions<K extends LegalAction['phase']> = Extract<LegalAction, { phase: K }>;

function roleFacts(ctx: OptionContext, role: string): string {
  const { state, me } = ctx;
  const name = (id: string) => id === me ? 'you' : ctx.names[id] ?? id;
  const card = state.roleCards.find(c => c.kind === role && c.selectedBy === null);
  const coins = card?.accumulatedCoins ? `Carries ${card.accumulatedCoins} bonus coins for you. ` : '';
  const others = state.players.filter(q => q.playerId !== me);
  const p = state.players.find(q => q.playerId === me)!;
  if (role === 'planter') {
    const usable = state.estateMarket.filter(t => t.kind === 'corn' || production({ ...p, countryside: [...p.countryside, { instanceId: t.instanceId, kind: t.kind, occupied: true }] })[t.kind]! > (production(p)[t.kind] ?? 0));
    return `${coins}You: pick first from ${state.estateMarket.map(t => t.kind).join(', ') || 'nothing'}${state.supply.quarryCount ? ' or a quarry' : ''}; `
      + `${usable.length ? `${[...new Set(usable.map(t => t.kind))].join('/')} would produce for you once staffed` : 'none of these has a building of yours to produce with'}. Others: each takes one too.`;
  }
  if (role === 'builder') {
    const mine = bestBuilds(ctx, p).slice(0, 2);
    return `${coins}You: with ${p.coins} coins can buy ${mine.map(({ type }) => `${type}${unlockCount(p, type) ? ` (lets your staffed ${PROCESSES[type]} produce)` : ''}`).join(' or ') || 'nothing useful'}. `
      + `Others: ${others.map(q => `${name(q.playerId)} ${affordable(state, q, false).join('/') || 'nothing useful'}`).join('; ')}.`;
  }
  if (role === 'recruiter') return `${coins}Workers waiting: ${state.supply.workRegisterCount}. Empty slots: ${state.players.map(q => `${name(q.playerId)} ${Math.max(0, emptySlots(q))}`).join(', ')}.`;
  if (role === 'craftsman') return `${coins}Production now: ${state.players.map(q => `${name(q.playerId)} ${Object.entries(production(q)).map(([g, n]) => `${n} ${g}`).join(', ') || 'nothing'}`).join('; ')}.`;
  return coins;
}
/** Large buildings and the most useful purchases a player could make with a Builder now (rough: quarries and privilege). */
function affordable(state: GameState, p: PlayerState, chooser: boolean): BuildingType[] {
  const quarries = p.countryside.filter(t => t.kind === 'quarry' && t.occupied).length;
  return (Object.keys(BUILDINGS) as BuildingType[]).filter(t => state.supply.buildingStock[t] > 0 && !p.buildings.some(b => b.buildingTypeId === t)
    && BUILDINGS[t].cost - Math.min(quarries, BUILDINGS[t].quarryCap) - Number(chooser) <= p.coins
    && (LARGE.includes(t) || unlockCount(p, t) > 0 || ['factory', 'harbor', 'wharf'].includes(t))).slice(0, 4);
}
/** Affordable buildings for `p` as Builder, best first by the code value net of their price. */
function bestBuilds(ctx: OptionContext, p: PlayerState) {
  const quarries = p.countryside.filter(t => t.kind === 'quarry' && t.occupied).length;
  return (Object.keys(BUILDINGS) as BuildingType[]).flatMap(type => {
    const price = Math.max(0, BUILDINGS[type].cost - Math.min(quarries, BUILDINGS[type].quarryCap) - 1);
    if (ctx.state.supply.buildingStock[type] <= 0 || p.buildings.some(b => b.buildingTypeId === type) || price > p.coins
      || BUILDINGS[type].footprint > 12 - usedSpaces(p)) return [];
    return [{ type, value: buildOwn(ctx, p, type) - price * ctx.coin }];
  }).sort((a, b) => b.value - a.value);
}
function roleOwn(ctx: OptionContext, role: string): number {
  const p = ctx.state.players.find(x => x.playerId === ctx.me)!;
  // A role's own value is most of the best plantation or building it lets the chooser take.
  if (role === 'planter') return 0.8 * Math.max(0, ...ctx.state.estateMarket.map(t => plantOwn(ctx, p, t.kind)), ctx.state.supply.quarryCount ? plantOwn(ctx, p, 'quarry') : 0);
  if (role === 'builder') return 0.8 * Math.max(0, bestBuilds(ctx, p)[0]?.value ?? 0);
  if (role === 'recruiter') return Math.min(2, Math.max(0, emptySlots(p))) * 0.3;
  return ctx.strategy && STRATEGIES[ctx.strategy].keyRoles.includes(role) ? 0.2 : 0;
}
function plantFacts(p: PlayerState, kind: string): string {
  if (kind === 'quarry') return 'Take a quarry: each staffed quarry cuts building costs by 1.';
  if (kind === 'decline') return 'Take nothing.';
  const good = kind as Good;
  const has = p.countryside.filter(t => t.kind === good).length;
  const slots = p.buildings.filter(b => PROCESSES[b.buildingTypeId] === good).reduce((a, b) => a + BUILDINGS[b.buildingTypeId].workerSlots, 0);
  return `Take a ${good} plantation (sells for ${PRICE[good]}); you have ${has}${good === 'corn' ? ' and corn needs no building' : ` and ${slots} ${good} building slot(s)`}.`;
}
function plantOwn(ctx: OptionContext, p: PlayerState, kind: string): number {
  if (kind === 'decline') return 0;
  if (kind === 'quarry') return ctx.strategy === 'builder' ? 1.2 : 0.7;
  const good = kind as Good;
  const slots = p.buildings.filter(b => PROCESSES[b.buildingTypeId] === good).reduce((a, b) => a + BUILDINGS[b.buildingTypeId].workerSlots, 0);
  const usable = good === 'corn' || slots > p.countryside.filter(t => t.kind === good).length;
  return 0.5 + (usable ? 0.5 : 0) + (ctx.strategy === 'shipper' && (good === 'corn' || good === 'fruit') ? 0.3 : 0)
    + (ctx.strategy === 'trader' && (good === 'coffee' || good === 'tobacco') ? 0.3 : 0);
}
function buildOwn(ctx: OptionContext, p: PlayerState, type: BuildingType): number {
  const left = Math.max(1, ctx.state.supply.vpRemaining / Math.max(1, ctx.state.players.length * 1.5));
  const key = ctx.strategy && STRATEGIES[ctx.strategy].keyBuildings.includes(type) ? 0.8 : 0;
  // A processing building pays per production; the rough count of productions left caps it.
  const production = unlockCount(p, type) * Math.min(3, left / 3) * 0.6;
  const large = LARGE.includes(type) ? 2.5 : 0;
  // Effect buildings pay over the rounds left, so they fade late in the game.
  const effect = (EFFECT_VALUE[type] ?? 0) * Math.min(1, roundsLeft(ctx.state) / 6);
  return BUILDINGS[type].baseVp + production + large + effect + key;
}
const EFFECT_VALUE: Partial<Record<BuildingType, number>> = {
  harbor: 2, factory: 2, wharf: 1.8, 'large-market': 1.2, 'small-market': 0.8, 'small-warehouse': 0.8, 'large-warehouse': 1,
  hacienda: 0.6, 'builders-yard': 0.6, hospital: 0.6, office: 0.6, school: 0.6,
};
const buildingGroup = (type: BuildingType) => PROCESSES[type] ? 'production' : LARGE.includes(type) ? 'large'
  : ['harbor', 'wharf', 'small-warehouse', 'large-warehouse'].includes(type) ? 'shipping' : 'economy';
export const GROUP_FACTS: Readonly<Record<string, string>> = {
  production: 'A building that processes a crop into goods.',
  economy: 'A building that gives coins, plantations, quarries or workers.',
  shipping: 'A building that helps ship or keep goods.',
  large: 'A large building worth bonus VP at the end.',
  pass: 'Buy nothing this time.',
};

function retentionOptions(l: LegalOptions<'captain-retention'>): { retained: Goods; warehouseTypes: Good[] }[] {
  const held = (Object.keys(l.available) as Good[]).filter(g => l.available[g] > 0);
  const variants = [
    [...held].sort((a, b) => l.available[b] - l.available[a] || PRICE[b] - PRICE[a]),
    [...held].sort((a, b) => PRICE[b] - PRICE[a] || l.available[b] - l.available[a]),
  ];
  const seen = new Set<string>();
  return variants.flatMap(order => {
    const warehouseTypes = order.slice(0, l.maxWarehouseTypes);
    const single = order.find(g => !warehouseTypes.includes(g));
    const retained = { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
    for (const g of warehouseTypes) retained[g] = l.available[g];
    if (single) retained[single] = 1;
    const key = JSON.stringify(retained);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ retained, warehouseTypes }];
  });
}

/** A handful of sensible placements: production chains first, then buildings, then the rest — in a few orders. */
function allocations(state: GameState, p: PlayerState, l: LegalOptions<'recruiter-placement'>) {
  const slots = l.slots;
  const tileGood = new Map(p.countryside.map(t => [t.instanceId as string, t.kind]));
  const building = new Map(p.buildings.map(b => [b.instanceId as string, b.buildingTypeId]));
  const chainFirst = (good: Good | 'quarry') => good === 'corn' || good === 'quarry' || p.buildings.some(b => PROCESSES[b.buildingTypeId] === good);
  const orders: [string, string, (s: typeof slots[number]) => number][] = [
    ['chains', 'Staff production chains first (plantation plus its building), then other buildings, then other plantations.',
      s => s.kind === 'building' ? (PROCESSES[building.get(s.instanceId)!] ? 3 : 2) : chainFirst(tileGood.get(s.instanceId)!) ? 3 : 1],
    ['buildings', 'Staff buildings first, most expensive first, then plantations.',
      s => s.kind === 'building' ? 4 + BUILDINGS[building.get(s.instanceId)!].cost / 10 : chainFirst(tileGood.get(s.instanceId)!) ? 2 : 1],
    ['plantations', 'Staff plantations first, then buildings.',
      s => s.kind === 'countryside' ? (chainFirst(tileGood.get(s.instanceId)!) ? 4 : 3) : PROCESSES[building.get(s.instanceId)!] ? 2 : 1],
  ];
  const seen = new Set<string>();
  return orders.flatMap(([key, facts, rank]) => {
    let left = l.totalWorkers;
    const filled = new Map<string, number>();
    for (const s of [...slots].sort((a, b) => rank(b) - rank(a))) {
      const n = Math.min(left, s.capacity);
      filled.set(s.instanceId, n);
      left -= n;
    }
    const allocation: WorkerAllocation = {
      countryside: p.countryside.map(t => ({ tileId: t.instanceId, occupied: (filled.get(t.instanceId) ?? 0) > 0 })),
      buildings: p.buildings.map(b => ({ buildingId: b.instanceId, occupiedSlots: filled.get(b.instanceId) ?? 0 })),
      idleCount: left,
    };
    const id = JSON.stringify(allocation);
    if (seen.has(id)) return [];
    seen.add(id);
    const after = { ...p, countryside: p.countryside.map((t, i) => ({ ...t, occupied: allocation.countryside[i]!.occupied })),
      buildings: p.buildings.map((b, i) => ({ ...b, occupiedSlots: allocation.buildings[i]!.occupiedSlots })) };
    const made = production(after);
    const activeBuildings = after.buildings.filter(b => b.occupiedSlots > 0 && !PROCESSES[b.buildingTypeId]).map(b => b.buildingTypeId);
    const own = Object.entries(made).reduce((a, [g, n]) => a + n * (0.6 + PRICE[g as Good] * 0.15), 0) + activeBuildings.length * 0.8;
    return [{ key, allocation, own, facts: `${facts} Produces ${Object.entries(made).map(([g, n]) => `${n} ${g}`).join(', ') || 'nothing'}; active buildings: ${activeBuildings.join(', ') || 'none'}.` }];
  });
}
