/**
 * Bot strategy catalog (docs/BOT_STRATEGY.md has sources). Classic names are mapped to this engine:
 * settler=planter, mayor=recruiter, prospector=adventurer, colonists=workers, indigo=fruit.
 * `signals` describe a strategy as seen in public history; they are the options of the inference question.
 */
export const STRATEGY_IDS = ['shipper', 'trader', 'builder', 'balanced'] as const;
export type StrategyId = typeof STRATEGY_IDS[number];

export interface Strategy {
  readonly id: StrategyId;
  readonly name: string;
  /** Short plan for the bot's own prompt. */
  readonly plan: string;
  readonly signals: string;
  readonly painPoints: string;
  /** Buildings this strategy values, used by the code pre-score. */
  readonly keyBuildings: readonly string[];
  /** Roles it leans on, used by the code pre-score. */
  readonly keyRoles: readonly string[];
}

export const STRATEGIES: Readonly<Record<StrategyId, Strategy>> = {
  shipper: {
    id: 'shipper', name: 'Corn/fruit shipper',
    plan: 'Many cheap plantations (corn needs no building), ship often for steady VP, protect goods with a warehouse, get Harbor or Wharf, keep a small coin source.',
    signals: 'Mostly corn and fruit plantations, picks Captain often, ships rather than sells, few coins, early warehouse, Harbor or Wharf.',
    painPoints: 'Ships full of other goods, no Captain when it holds goods, short of coins, losing goods without a warehouse.',
    keyBuildings: ['small-warehouse', 'harbor', 'wharf', 'hacienda', 'small-fruit-depot', 'large-warehouse', 'customs-house'],
    keyRoles: ['planter', 'captain', 'craftsman'],
  },
  trader: {
    id: 'trader', name: 'Coffee/tobacco trader',
    plan: 'Grow tobacco or coffee with its building, sell through the trading house, use markets and Factory for coins, then turn coins into buildings before the end.',
    signals: 'Coffee or tobacco plantations with their buildings, picks Trader and Craftsman often, sells rather than ships, high coins, markets or Factory.',
    painPoints: 'Trading house full or already holding its good, the player before it selling the same good, coins left unspent at the end.',
    keyBuildings: ['large-coffee-roaster', 'large-tobacco-storage', 'small-market', 'large-market', 'factory', 'office', 'harbor'],
    keyRoles: ['trader', 'craftsman', 'builder'],
  },
  builder: {
    id: 'builder', name: 'Quarry builder',
    plan: 'Take quarries early to cut costs, buy cheap income buildings and Factory, then large buildings and staff them with Recruiter.',
    signals: 'Several quarries, picks Builder often, many buildings bought, few goods shipped, aims for large buildings.',
    painPoints: 'Slow start, a game that ends before its large buildings are bought and staffed, no quarries left.',
    keyBuildings: ['builders-yard', 'small-market', 'factory', 'school', 'harbor', 'city-hall', 'residence', 'fortress', 'customs-house', 'fire-station'],
    keyRoles: ['planter', 'builder', 'recruiter'],
  },
  balanced: {
    id: 'balanced', name: 'Balanced / role denial',
    plan: 'Varied goods, take the role that helps you more than the players after you, adapt and hold back the leader.',
    signals: 'Varied plantations, mixes shipping and selling, rarely repeats a role, takes roles others want.',
    painPoints: 'No single engine; a committed specialist can outscore it.',
    keyBuildings: ['small-market', 'factory', 'harbor', 'small-warehouse', 'wharf'],
    keyRoles: ['trader', 'captain', 'builder'],
  },
};

/** Choice criteria for "which plan is this player following" (inference) and the bot's own pick. */
export const signalCriteria = (): Record<string, string> => ({
  ...Object.fromEntries(STRATEGY_IDS.map(id => [id, `${STRATEGIES[id].name}: ${STRATEGIES[id].signals}`])),
  unclear: 'Too early or mixed signals; no clear plan yet.',
});
export const planCriteria = (): Record<string, string> =>
  Object.fromEntries(STRATEGY_IDS.map(id => [id, `${STRATEGIES[id].name}: ${STRATEGIES[id].plan}`]));

export const POSTURES = ['build', 'race', 'block', 'stall'] as const;
export type Posture = typeof POSTURES[number];
export const postureCriteria = (): Record<Posture, string> => ({
  build: 'Keep developing my own plan and engine; the payoff is still ahead.',
  race: 'Bring the game end closer while my position holds up.',
  block: 'Hold back the most dangerous opponent before they pull away.',
  stall: 'Delay the end; I need more turns to catch up.',
});
