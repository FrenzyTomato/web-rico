import type { PlayerEvent, PlayerView } from '@vibe-rico/protocol';
import { BUILDINGS } from '@vibe-rico/game-engine';
import type { BuildingType, Good, Role } from '@vibe-rico/game-engine';
import type { Action } from '../actions/options.js';
import { t } from '../i18n/language.js';
import { BUILDING, GOOD, ROLE } from '../i18n/terms.js';
import type { BoardView } from '../scene/Camera.js';
import { learnerFollowUp } from './controller.js';
import type { TutorialMove, TutorialState } from './controller.js';
import { islandCheck, playerName } from './copy.js';
import { learner } from './scenario.js';

type Text = (en: string, zh: string) => string;
type Language = 'en' | 'zh';

/** Pictures drawn under a guide page (RoleDiagrams.tsx). */
export type RoleDiagram =
  /** The hiring pool's workers dealt one at a time from the chooser, plus the chooser's privilege worker. */
  | { kind: 'recruit'; register: number; deal: readonly { name: string; count: number; chooser: boolean }[] }
  /** How many workers refill the hiring pool: the larger of empty building slots and players. */
  | { kind: 'refill'; islands: readonly { name: string; filled: number; empty: number }[]; players: number; refill: number }
  /** Those workers moving from the supply into the hiring pool, and the game ending when it runs short. */
  | { kind: 'supply'; refill: number; supply: number }
  /** A building's price: cost − staffed quarries − Builder privilege, never below 0. */
  | { kind: 'price'; cost: number; quarries: number; privilege: boolean; price: number }
  /** The production rule: an estate and its processing building both need a worker; corn needs no building. */
  | { kind: 'chain'; good: Good; building: BuildingType }
  /** What each player is about to produce: staffed estates, staffed processing slots, and the goods that come out. */
  | { kind: 'produce'; rows: readonly ProductionRow[] }
  /** The trading house's 4 slots, the price of each good, and a player shut out because their good is already there. */
  | { kind: 'house'; slots: readonly (Good | null)[]; blocked?: { name: string; good: Good } }
  /** The cargo ships with their loads. */
  | { kind: 'ships'; ships: readonly { capacity: number; good: Good | null; loaded: number }[] };
export interface ProductionRow {
  name: string;
  estates: readonly { good: Good; staffed: boolean }[];
  buildings: readonly { good: Good; slots: number; staffed: number }[];
  output: Partial<Record<Good, number>>;
}
/** A paragraph; the chooser's privilege and the learner's next step stand out. */
export type GuideParagraph = string | { text: string; tone: 'privilege' | 'next' };
/** `camera` turns the board to what the page describes, like the view shortcuts do. */
export interface GuidePage { title: string; paragraphs: GuideParagraph[]; diagram?: RoleDiagram; camera?: BoardView }

/** Which good each processing building turns out (corn needs none). */
export const PROCESSES: Partial<Record<BuildingType, Good>> = {
  'small-fruit-depot': 'fruit', 'large-fruit-depot': 'fruit', 'small-sugar-mill': 'sugar', 'large-sugar-mill': 'sugar',
  'large-tobacco-storage': 'tobacco', 'large-coffee-roaster': 'coffee',
};
const GOODS: readonly Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];

const FOLLOW_UP: Partial<Record<Action['kind'], (text: Text, action: Action) => string>> = {
  plant: (text, a) => a.kind === 'plant' && a.choice.kind === 'quarry' ? text('take your quarry', '领取采石场') : text('take an estate', '领取田园'),
  build: text => text('build', '建造'),
  'allocate-workers': text => text('place your workers', '分配工人'), produce: text => text('produce goods', '生产货物'),
  trade: text => text('sell a good', '出售货物'), load: text => text('ship goods', '运货'), retain: text => text('keep leftover goods', '保留剩余货物'),
};

/** The chooser's bonus, as a noun phrase after "X's privilege:". */
function privilegeOf(role: Role, text: Text) {
  switch (role) {
    case 'planter': return text(`the option to take a quarry instead of an estate.`, '可以改取采石场，而不是田园。');
    case 'builder': return text('1 coin off the building.', '建筑便宜 1 金币。');
    case 'recruiter': return text('1 extra worker from the supply.', '从供应区多领 1 名工人。');
    case 'craftsman': return text('1 extra good of a kind just produced.', '额外领取 1 个刚生产的货物。');
    case 'trader': return text('1 extra coin for the sale.', '出售时多得 1 金币。');
    case 'captain': return text('1 bonus point.', '额外 1 分。');
    case 'adventurer': return text('1 coin.', '1 金币。');
  }
}

/**
 * The pause after anyone picks a role, split into short pages: what the role does (with a picture where it helps),
 * the chooser's privilege, the rules around it, and finally whether the learner follows up.
 * `view` is the board right after the pick; `followUp` is the learner's first move in that phase, if any. A role picked
 * before (`repeat`) gets one short page: the deal or what gets made, and the privilege.
 */
export function rolePages(move: TutorialMove, view: PlayerView, followUp: Action | null, language: Language, repeat = false): GuidePage[] {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const actorId = move.step.command.actorId, actor = playerName(actorId, text), mine = actorId === learner;
  const role = move.events.find((e): e is Extract<PlayerEvent, { kind: 'role-selected' }> => e.kind === 'role-selected')!.role;
  const coins = move.events.reduce((sum, e) => sum + (e.kind === 'coins-changed' && e.playerId === actorId ? e.delta : 0), 0);
  const title = text(mine ? `You chose ${ROLE[role]}` : `${actor} chose ${ROLE[role]}`, `${actor}选择了${ROLE[role]}`);
  const privilegeText = text(mine ? 'Your privilege: ' : `${actor}'s privilege: `, mine ? '你的特权：' : `${actor}的特权：`) + privilegeOf(role, text)
    + (coins > 0 ? text(` Plus the ${coins} coin${coins > 1 ? 's' : ''} that piled up on the card.`, `另外还拿到牌上积累的 ${coins} 金币。`) : '');
  const privilege: GuideParagraph = { text: privilegeText, tone: 'privilege' };
  const phrase = followUp ? FOLLOW_UP[followUp.kind]?.(text, followUp) : undefined;
  const nextText = !phrase ? text('You have nothing to do for this role, so play moves on.', '这个角色你没有要做的，游戏继续。')
    : mine ? text(`You go first, so it's your turn to ${phrase}.`, `你先行动，现在轮到你${phrase}。`)
    : text(`${actor} goes first. Then it's your turn to ${phrase}.`, `${actor}先行动，然后轮到你${phrase}。`);
  const next: GuideParagraph = { text: nextText, tone: 'next' };
  const sugarMill = BUILDING['large-sugar-mill'];
  let pages: GuidePage[];
  switch (role) {
    case 'recruiter': {
      const register = view.supply.workRegisterCount, n = view.seatOrder.length, start = view.seatOrder.indexOf(actorId);
      const deal = view.seatOrder.map((_, offset) => {
        const id = view.seatOrder[(start + offset) % n]!;
        return { name: playerName(id, text), count: Math.floor(register / n) + (offset < register % n ? 1 : 0), chooser: offset === 0 };
      });
      pages = [
        { title, diagram: { kind: 'recruit', register, deal }, paragraphs: [
          text(`New workers are hired. The ${register} workers in the hiring pool are dealt out one at a time, starting with ${mine ? 'you' : actor}, so everyone gets about the same.`,
            `招募新工人。招募池里的 ${register} 名工人从${actor}开始，一次一名轮流分发，所以每人得到的差不多。`),
          privilege] },
        { title: text('Recruiter: placing workers', '招募者：分配工人'), paragraphs: [
          text('Then everyone places all their workers on their own island, starting with the chooser. A worker on an estate lets it produce; a worker on a building switches its ability on.',
            '然后从选择者开始，每人把所有工人分配到自己的岛上。田园上有工人才会生产，建筑上有工人才会发挥作用。'),
          text('Workers you can\'t or don\'t place aren\'t lost. They wait in your worker pool, and you can rearrange all of your workers at every Recruiter.',
            '放不下或不想放的工人不会消失。他们留在你的工人池里，每次招募时你都可以重新安排所有工人。')] },
      ];
      break;
    }
    case 'planter':
      pages = [
        { title, paragraphs: [
          text('Starting with the chooser, everyone takes one estate from the market. A new estate only produces once a worker is placed on it.', '从选择者开始，每人从市场领取一块田园。新田园放上工人后才会生产。'),
          { ...privilege, text: privilegeText + text(` Anyone with a staffed ${BUILDING['builders-yard']} may take one too.`, `拥有有工人的${BUILDING['builders-yard']}的玩家也可以领取。`) }] },
        { title: text('Planter: quarries', '种植者：采石场'), camera: 'estates', diagram: { kind: 'price', cost: 4, quarries: 2, privilege: false, price: 2 }, paragraphs: [
          text('A quarry produces no goods. Instead, with a worker on it, it makes every building you buy 1 coin cheaper.', '采石场不生产货物。放上工人后，你购买的每座建筑都便宜 1 金币。'),
          text(`Pricier buildings can use more quarries: 1 for the cheapest, up to 4 for the 10-coin buildings. For example, ${sugarMill} costs 4; with 2 staffed quarries you pay 2.`,
            `越贵的建筑能用的采石场越多：最便宜的只能用 1 个，10 金币的建筑最多 4 个。例如${sugarMill}售价 4，有 2 个有工人的采石场时只需付 2。`)] },
      ];
      break;
    case 'builder':
      pages = [{ title, camera: 'buildings-1', diagram: { kind: 'price', cost: 4, quarries: 2, privilege: true, price: 1 }, paragraphs: [
        text('Starting with the chooser, everyone may buy one building.', '从选择者开始，每人可以购买一座建筑。'),
        privilege,
        text(`Each staffed quarry takes off 1 more coin, up to the building's limit, and the price never goes below 0. For example, ${sugarMill} costs 4; with 2 quarries and the privilege it costs 1.`,
          `每个有工人的采石场再便宜 1 金币（不超过该建筑的上限），价格最低为 0。例如${sugarMill}售价 4，有 2 个采石场再加特权只需 1 金币。`)] }];
      break;
    case 'craftsman': {
      const rows = productionRows(view, text);
      pages = [
        { title, diagram: { kind: 'chain', good: 'fruit', building: 'small-fruit-depot' }, paragraphs: [
          text('Everyone produces goods. A staffed corn estate makes corn by itself; any other estate also needs a worker in its processing building.',
            '所有人生产货物。有工人的玉米田可以直接产出玉米；其他田园还需要对应的加工建筑里也有工人。'),
          privilege] },
        { title: text('Craftsman: what gets made', '工匠：生产什么'), diagram: { kind: 'produce', rows }, paragraphs: [productionSummary(rows, text)] },
      ];
      break;
    }
    case 'trader':
      pages = [
        { title, camera: 'depot', diagram: { kind: 'house', slots: houseSlots(view) }, paragraphs: [
          text('Starting with the chooser, each player may sell one good to the trading house. The price is under each good: the rarer the good, the more it pays.',
            '从选择者开始，每人可以向交易所出售一个货物。价格标在每种货物下方：越稀有的货物越值钱。'),
          privilege] },
        { title: text('Trader: one of each kind', '商人：每种只能一个'), camera: 'depot', paragraphs: [
          text('The house has 4 places, and each kind of good can be there only once. Whoever sells a kind first shuts everyone else out of it until the house is full and emptied.',
            '交易所有 4 个位置，每种货物只能放一个。谁先卖出某种货物，其他人就不能再卖这种，直到交易所放满并清空。'),
          text('A staffed Small Market adds 1 coin to a sale, a Large Market 2.', '有工人的小市场每次出售多得 1 金币，大市场多得 2 金币。')] },
      ];
      break;
    case 'captain':
      pages = [
        { title, camera: 'boats', diagram: { kind: 'ships', ships: shipLoads(view) }, paragraphs: [
          text('Starting with the chooser, players take turns loading goods onto the ships, every crate worth 1 point, until nobody can load any more. Loading is not optional.',
            '从选择者开始，玩家轮流把货物装上货船，每箱 1 分，直到没有人能再装。能装就必须装。'),
          privilege] },
        { title: text('Captain: which ship', '船长：装哪艘船'), camera: 'boats', paragraphs: [
          text('A ship carries one kind of good, and a kind already on one ship can only go on that ship. An empty ship takes any kind nobody else is shipping.',
            '每艘船只装一种货物；已经装在某艘船上的货物只能继续装那艘船。空船可以装还没有人在运的任何货物。'),
          text('On your turn you load as many crates of one kind as fit.', '轮到你时，选一种货物，能装多少就装多少。')] },
        { title: text('Captain: after shipping', '船长：运货之后'), camera: 'boats', paragraphs: [
          text(`Each player keeps only 1 leftover good, and a staffed ${BUILDING['small-warehouse']} keeps all of one kind; the rest go back to the supply. Full ships are emptied for the next Captain.`,
            `每人只能保留 1 个剩余货物，有工人的${BUILDING['small-warehouse']}可以保留一种货物的全部；其余退回供应区。装满的货船会清空，等待下一次船长。`)] },
      ];
      break;
    case 'adventurer':
      pages = [{ title, paragraphs: [text('Only the chooser acts; nobody else follows.', '只有选择者行动，其他人不跟随。'), privilege] }];
      break;
  }
  if (repeat) pages = role === 'craftsman' ? [{ ...pages[1]!, title, paragraphs: [...pages[1]!.paragraphs, privilege] }] : [pages[0]!];
  const last = pages[pages.length - 1]!;
  pages[pages.length - 1] = { ...last, paragraphs: [...last.paragraphs, next] };
  return pages;
}

/**
 * Once the last player has placed workers, the Recruiter turn is over and the hiring pool has been refilled: how many
 * workers it got (empty building slots on every island against the number of players), and the game ending when the
 * supply can't fill it. Null for any other move. `view` is the board after the move.
 */
export function recruiterRefillPages(move: TutorialMove, view: PlayerView, language: Language): GuidePage[] | null {
  if (move.step.action.kind !== 'allocate-workers' || view.phase.kind === 'recruiter-placement') return null;
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const islands = view.seatOrder.map(id => {
    const buildings = view.players.find(p => p.playerId === id)!.buildings;
    const slots = buildings.reduce((n, b) => n + BUILDINGS[b.buildingTypeId].workerSlots, 0), filled = buildings.reduce((n, b) => n + b.occupiedSlots, 0);
    return { name: playerName(id, text), filled, empty: slots - filled };
  });
  const players = view.seatOrder.length, empty = islands.reduce((n, i) => n + i.empty, 0), refill = view.supply.workRegisterCount;
  const reason = empty >= players
    ? text(`There are ${empty} empty building slots and ${players} players, so it gets one worker per empty slot: ${refill}.`, `现在有 ${empty} 个空建筑工人位、${players} 位玩家，所以按空位补充：${refill} 名。`)
    : text(`${empty === 0 ? 'There are no empty building slots' : `There ${empty === 1 ? 'is' : 'are'} only ${empty} empty building slot${empty === 1 ? '' : 's'}`}, fewer than the ${players} players, so it gets one worker per player: ${refill}.`,
      `${empty === 0 ? '没有空的建筑工人位' : `只有 ${empty} 个空建筑工人位`}，少于 ${players} 位玩家，所以按人数补充：${refill} 名。`);
  return [
    { title: text('Refilling the hiring pool', '补充招募池'), diagram: { kind: 'refill', islands, players, refill }, paragraphs: [
      text('Everyone has placed their workers, so the Recruiter turn is over and the hiring pool is refilled for the next one.', '所有人都分配完工人，本次招募结束，招募池为下一次招募补充工人。'),
      reason] },
    { title: text('When workers run out', '工人用完时'), diagram: { kind: 'supply', refill, supply: view.supply.workerCount }, paragraphs: [
      text(`Those workers came from the supply, shown as "${t('剩余工人')}" at the top (now ${view.supply.workerCount}).`,
        `这些工人来自供应区，也就是顶部的“${t('剩余工人')}”（现在是 ${view.supply.workerCount}）。`),
      text('If the supply ever can\'t fill the hiring pool, the game ends once that Recruiter turn is over.', '如果哪次供应区补不满招募池，那次招募结束后游戏就会结束。')] },
  ];
}

/**
 * After a building is bought at a discount: the price worked out from the cost, staffed quarries and the Builder
 * privilege. Null when nothing was bought or nothing came off. `view` is the board after the build.
 */
export function buildPricePage(move: TutorialMove, view: PlayerView, language: Language): GuidePage | null {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const a = move.step.action;
  if (a.kind !== 'build' || !a.purchase) return null;
  const actorId = move.step.command.actorId, actor = playerName(actorId, text), mine = actorId === learner;
  const { cost, quarryCap } = BUILDINGS[a.purchase.buildingTypeId];
  const player = view.players.find(p => p.playerId === actorId)!;
  const quarries = Math.min(quarryCap, player.countryside.filter(t => t.kind === 'quarry' && t.occupied).length);
  const privilege = a.purchase.useAdvantage;
  if (quarries === 0 && !privilege) return null;
  const price = Math.max(0, cost - quarries - Number(privilege));
  const name = BUILDING[a.purchase.buildingTypeId];
  const sum = `${cost} − ${quarries}${privilege ? ' − 1' : ''} = ${price}`;
  return { title: text(`${actor} built ${name}`, `${actor}建造了${name}`), diagram: { kind: 'price', cost, quarries, privilege, price }, paragraphs: [
    text(`${name} costs ${cost}.`, `${name}售价 ${cost}。`)
      + (privilege ? text(` ${actor} chose Builder, so the privilege takes 1 off.`, `${actor}选择了建筑师，特权便宜 1。`) : '')
      + (quarries > 0 ? text(` ${quarries} staffed quarr${quarries > 1 ? 'ies take' : 'y takes'} ${quarries} off.`, `${quarries} 个有工人的采石场便宜 ${quarries}。`)
        : text(mine ? ' You have no staffed quarries.' : ` ${actor} has no staffed quarries.`, `${actor}没有有工人的采石场。`))
      + text(` ${sum}, so ${mine ? 'you' : actor} paid ${price === 0 ? 'nothing' : `${price} coin${price === 1 ? '' : 's'}`}.`, `${sum}，所以${actor}支付了 ${price} 金币。`),
    mine ? islandCheck(move, view, language) : text('Everyone else builds at full price, less their own staffed quarries.', '其他人按原价建造，只能用自己有工人的采石场减价。'),
  ] };
}

/**
 * After the learner builds: a processing building explains how production works (estate and building both staffed);
 * a discounted building shows its price sum. Either way it ends by pointing at the new building on their island.
 */
export function learnerBuildPages(move: TutorialMove, view: PlayerView, language: Language): GuidePage[] | null {
  const a = move.step.action;
  if (a.kind !== 'build' || !a.purchase || move.step.command.actorId !== learner) return null;
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const type = a.purchase.buildingTypeId, good = PROCESSES[type], name = BUILDING[type];
  if (!good) { const price = buildPricePage(move, view, language); return price && [price]; }
  const me = view.players.find(p => p.playerId === learner)!;
  const idleQuarry = me.countryside.some(t => t.kind === 'quarry' && !t.occupied);
  return [{ title: text(`You built ${name}`, `你建造了${name}`), diagram: { kind: 'chain', good, building: type }, paragraphs: [
    text(`Production needs both halves: a worker on the ${GOOD[good]} estate grows the crop, and a worker in ${name} turns it into a crate of ${GOOD[good]}. With either one empty, nothing comes out. Corn is the exception: its estate alone is enough.`,
      `生产需要两半都有工人：${GOOD[good]}田上的工人种出作物，${name}里的工人把它加工成一箱${GOOD[good]}。任何一边空着都不会产出。玉米例外：只要玉米田有工人就行。`),
    islandCheck(move, view, language) + (idleQuarry ? text(' Your quarry has no worker yet, so it didn\'t lower the price.', '你的采石场还没有工人，所以没有减价。') : ''),
  ] }];
}

/** Each player's staffed estates and processing slots, and what they will produce. */
function productionRows(view: PlayerView, text: Text): ProductionRow[] {
  return view.seatOrder.map(id => {
    const p = view.players.find(x => x.playerId === id)!;
    const estates = p.countryside.filter(t => t.kind !== 'quarry').map(t => ({ good: t.kind as Good, staffed: t.occupied }));
    const buildings = p.buildings.flatMap(b => { const good = PROCESSES[b.buildingTypeId]; return good ? [{ good, slots: BUILDINGS[b.buildingTypeId].workerSlots, staffed: b.occupiedSlots }] : []; });
    const output: Partial<Record<Good, number>> = {};
    for (const good of GOODS) {
      const grown = estates.filter(e => e.good === good && e.staffed).length;
      const made = good === 'corn' ? grown : Math.min(grown, buildings.filter(b => b.good === good).reduce((n, b) => n + b.staffed, 0));
      if (made > 0) output[good] = made;
    }
    return { name: playerName(id, text), estates, buildings, output };
  });
}

/** "You make 1 fruit; Bruno makes …", plus any staffed estate that makes nothing for lack of a staffed building. */
function productionSummary(rows: readonly ProductionRow[], text: Text) {
  const goods = (row: ProductionRow) => (Object.entries(row.output) as [Good, number][]).map(([g, n]) => `${n} ${GOOD[g]}`).join(text(' and ', '和')) || text('nothing', '什么也没有');
  const made = rows.map(r => r.name === text('You', '你') ? text(`you make ${goods(r)}`, `你产出${goods(r)}`) : text(`${r.name} makes ${goods(r)}`, `${r.name}产出${goods(r)}`)).join(text('; ', '；'));
  const idle = rows.flatMap(r => GOODS.filter(g => g !== 'corn' && r.estates.some(e => e.good === g && e.staffed) && !r.output[g])
    .map(g => text(`${r.name === 'You' ? 'Your' : `${r.name}'s`} ${GOOD[g]} estate has a worker, but no staffed building to process it, so it makes nothing.`,
      `${r.name}的${GOOD[g]}田虽然有工人，但没有有工人的加工建筑，所以不会产出。`)));
  return [text(`This time ${made}.`, `这次${made}。`), ...idle].join(' ');
}

const houseSlots = (view: PlayerView): (Good | null)[] => [0, 1, 2, 3].map(i => view.tradingHouse[i] ?? null);
const shipLoads = (view: PlayerView) => view.ships.map(s => ({ capacity: s.capacity, good: s.goodType, loaded: s.loadedCount }));

/** After a bot passes in the Trader turn because its good is already in the trading house. */
export function tradeBlockedPage(move: TutorialMove, view: PlayerView, language: Language): GuidePage | null {
  const a = move.step.action, actorId = move.step.command.actorId;
  if (a.kind !== 'trade' || a.sale || actorId === learner) return null;
  const p = view.players.find(x => x.playerId === actorId)!;
  const good = view.tradingHouse.find(g => p.goods[g] > 0);
  if (!good) return null;
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const actor = playerName(actorId, text);
  return { title: text(`${actor} can't sell ${GOOD[good]}`, `${actor}不能出售${GOOD[good]}`), camera: 'depot', diagram: { kind: 'house', slots: houseSlots(view), blocked: { name: actor, good } }, paragraphs: [
    text(`${actor} has ${GOOD[good]}, but the trading house already holds ${GOOD[good]} and each kind can be there only once. Selling first shut ${actor} out.`,
      `${actor}有${GOOD[good]}，但交易所里已经有${GOOD[good]}，每种只能放一个。你先卖出，就把${actor}挡在了外面。`),
    text(`So ${actor} passes and keeps the goods to ship for points later.`, `所以${actor}放弃出售，留着货物以后运货得分。`),
  ] };
}

/** Once nobody can load any more: where every crate went, before full ships are emptied. */
export function shipsLoadedPage(move: TutorialMove, view: PlayerView, language: Language): GuidePage | null {
  if (move.step.action.kind !== 'load' || view.phase.kind === 'captain-loading') return null;
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const ships = shipLoads(view);
  const lines = ships.map(s => s.good ? text(`${GOOD[s.good]} ${s.loaded}/${s.capacity}${s.loaded === s.capacity ? ' (full)' : ''}`, `${GOOD[s.good]} ${s.loaded}/${s.capacity}${s.loaded === s.capacity ? '（满）' : ''}`)
    : text(`empty ${s.capacity}-crate ship`, `空的 ${s.capacity} 箱货船`)).join(text(', ', '，'));
  return { title: text('Loading is done', '装货结束'), camera: 'boats', diagram: { kind: 'ships', ships }, paragraphs: [
    text(`Nobody can load any more: ${lines}. Each kind stayed on its own ship.`, `没有人能再装货了：${lines}。每种货物都只装在自己那艘船上。`),
    text('Full ships are emptied after the Captain turn; a ship that isn\'t full keeps its cargo, so its kind stays locked to it.', '船长阶段结束后，装满的船会清空；没装满的船保留货物，这种货物仍只能装这艘船。'),
  ] };
}

/**
 * Pages the guide waits on until the learner has read them: what a role just picked does (anyone's pick), how the
 * hiring pool was refilled once everyone has placed workers, how production works or a discount was worked out after a
 * build, why a bot couldn't sell its good, and where every crate went once loading is done. Null when the move needs
 * no explanation.
 */
export function explainPages({ stage, previous, snapshot, game, history }: Pick<TutorialState, 'stage' | 'previous' | 'snapshot' | 'game' | 'history'>, language: Language): GuidePage[] | null {
  if (!previous || !snapshot || !game) return null;
  const mine = previous.step.command.actorId === learner;
  if (stage !== (mine ? 'result' : 'opponent-result')) return null;
  const picks = (role: Role) => history.filter(e => e.kind === 'role-selected' && e.role === role).length;
  if (previous.step.action.kind === 'choose-role') {
    const role = previous.events.find((e): e is Extract<PlayerEvent, { kind: 'role-selected' }> => e.kind === 'role-selected')!.role;
    return rolePages(previous, snapshot.view, learnerFollowUp(game), language, picks(role) > 1);
  }
  // The refill is explained once, after the first Recruiter.
  const refill = picks('recruiter') === 1 ? recruiterRefillPages(previous, snapshot.view, language) : null;
  if (refill) return refill;
  if (mine) { const page = shipsLoadedPage(previous, snapshot.view, language); return learnerBuildPages(previous, snapshot.view, language) ?? (page && [page]); }
  const page = buildPricePage(previous, snapshot.view, language) ?? tradeBlockedPage(previous, snapshot.view, language) ?? shipsLoadedPage(previous, snapshot.view, language);
  return page && [page];
}
