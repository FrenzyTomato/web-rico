import type { PlayerEvent, PlayerView } from '@vibe-rico/protocol';
import type { Role } from '@vibe-rico/game-engine';
import type { BoardView } from '../scene/Camera.js';
import { t } from '../i18n/language.js';
import { BUILDING, GOOD, ROLE, TILE } from '../i18n/terms.js';
import type { TutorialMove, TutorialStep } from './controller.js';
import { learner } from './scenario.js';

type Text = (en: string, zh: string) => string;
export const playerName = (id: string, text: Text) => id === learner ? text('You', '你') : id === 'bruno' ? 'Bruno' : 'Chen';
const roleOf = (step: TutorialStep, view: PlayerView): Role | null => step.action.kind === 'choose-role'
  ? view.roleCards.find(c => step.action.kind === 'choose-role' && c.instanceId === step.action.roleCardId)?.kind ?? null : null;
const tileName = (id: string, view: PlayerView) => {
  const tile = [...view.estateMarket, ...view.players.flatMap(p => p.countryside)].find(t => t.instanceId === id);
  return tile ? TILE[tile.kind] : '';
};

/** What each command tile sets in motion, as told right after someone picks it. */
function roleFollowUp(role: Role, name: string, text: Text) {
  const actor = name === 'You' ? 'you' : name;
  switch (role) {
    case 'planter': return text(`Starting with ${actor}, everyone takes one estate from the market. The chooser may take a quarry instead.`, `从${actor}开始，每人从市场领取一块田园。选择者也可以改取采石场。`);
    case 'builder': return text(`Starting with ${actor}, everyone may build once. The chooser pays 1 coin less.`, `从${actor}开始，每人可以建造一次。选择者少付 1 金币。`);
    case 'recruiter': return text(`The chooser takes 1 extra worker, the workers on the ship are shared out, then everyone places workers on their own island.`, `${actor}多领 1 名工人，船上的工人分给所有人，然后每人在自己的岛上分配工人。`);
    case 'craftsman': return text(`Everyone produces from staffed estates (goods other than corn also need a staffed processing building). Then the chooser takes 1 extra good.`, `所有人用有工人的田园生产（玉米以外的货物还需要有工人的加工建筑）。之后${actor}额外领取 1 个货物。`);
    case 'trader': return text(`Starting with ${actor}, each player may sell one good to the trading house. The chooser earns 1 extra coin.`, `从${actor}开始，每人可以向交易所出售一个货物。选择者多得 1 金币。`);
    case 'captain': return text(`Starting with ${actor}, players must load goods onto ships; every crate is worth 1 point. The chooser earns 1 bonus point.`, `从${actor}开始，玩家必须把货物装上货船，每箱 1 分。选择者额外得 1 分。`);
    default: return '';
  }
}

export function tutorialCopy(step: TutorialStep, view: PlayerView, language: 'en' | 'zh') {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const a = step.action, actor = playerName(step.command.actorId, text);
  let camera: BoardView = 'mine', title = '', todo = '', preview = '';
  switch (a.kind) {
    case 'choose-role': {
      const role = roleOf(step, view)!;
      camera = 'shared'; title = text(`Choose ${ROLE[role]}`, `选择${ROLE[role]}`);
      todo = text(`Pick the outlined ${ROLE[role]} card in your hand. Whoever picks a role gets its privilege, then everyone takes the action in turn.`, `在手牌中点选带描边的${ROLE[role]}。选择者获得特权，然后所有人依次执行该行动。`);
      preview = text(`${actor} is choosing a role: ${ROLE[role]}.`, `${actor}正在选择角色：${ROLE[role]}。`); break;
    }
    case 'plant': {
      const name = a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : '';
      camera = 'estates'; title = text(`Take ${name}`, `领取${name}`);
      todo = text(`Click the outlined ${name} estate on the board, then press “Plant ${name}” in the action panel.`, `点击棋盘上带描边的${name}田园，再在行动面板中点击“种植”。`);
      preview = text(`${actor} is taking a ${name} estate.`, `${actor}正在领取${name}田园。`); break;
    }
    case 'build': {
      const name = a.purchase ? BUILDING[a.purchase.buildingTypeId] : '';
      camera = 'buildings-1'; title = text(`Build ${name}`, `建造${name}`);
      todo = text(`Click the outlined ${name} in the building market, then press Build in the action panel. A staffed Small Market adds 1 coin to every sale.`, `点击建筑市场中带描边的${name}，再在行动面板中点击“建造”。有工人的小市场每次出售多得 1 金币。`);
      preview = text(`${actor} is building ${name}.`, `${actor}正在建造${name}。`); break;
    }
    case 'recruit-worker':
      title = text('Recruiter privilege', '招募者特权');
      preview = text(`${actor} takes the extra worker for choosing Recruiter.`, `${actor}领取选择招募者的额外工人。`); break;
    case 'allocate-workers': {
      // Name the one spot that gains a worker in this guided placement.
      const owned = view.players.find(p => p.playerId === step.command.actorId)!.buildings;
      const staffed = a.allocation.buildings.find(b => b.occupiedSlots > (owned.find(x => x.instanceId === b.buildingId)?.occupiedSlots ?? 0));
      const building = owned.find(x => x.instanceId === staffed?.buildingId);
      const where = building ? BUILDING[building.buildingTypeId] : TILE.corn;
      title = step.command.actorId === learner ? text('Place your workers', '分配工人') : text('Place workers', '分配工人');
      todo = text(`Pick up a worker from your worker pool, click the outlined ${where} on your island, then press “${t('确认分配')}”. Only occupied estates and buildings work.`, `从工人池拿起一名工人，点击你岛上带描边的${where}，再点击“${t('确认分配')}”。只有有工人的田园和建筑才会工作。`);
      preview = text(`${actor} is placing workers on their island.`, `${actor}正在自己的岛上分配工人。`); break;
    }
    case 'produce':
      title = text('Produce goods', '生产货物');
      todo = text('Press Produce in your hand. Your staffed corn estate makes 1 corn; no building is needed for corn.', '点击手牌区的“生产”。有工人的玉米田产出 1 个玉米，玉米不需要加工建筑。');
      preview = text(`${actor} is producing goods.`, `${actor}正在生产货物。`); break;
    case 'take-production-bonus':
      title = text('Craftsman privilege', '工匠特权');
      todo = text(`As Craftsman you take 1 extra good. Press “${t('额外货物 {0}', [a.good ? GOOD[a.good] : ''])}” in your hand.`, `作为工匠，你可以额外领取 1 个货物。点击手牌区的“${t('额外货物 {0}', [a.good ? GOOD[a.good] : ''])}”。`); break;
    case 'trade':
      camera = 'depot'; title = text('Sell a good', '出售货物');
      todo = text('Select your corn crate in the dock, then click the outlined trading house. Corn sells for 0, but your staffed Small Market adds 1 coin.', '在货物区选择你的玉米货箱，再点击带描边的交易所。玉米售价为 0，但有工人的小市场多给 1 金币。');
      preview = a.sale ? text(`${actor} is selling ${GOOD[a.sale.good]}.`, `${actor}正在出售${GOOD[a.sale.good]}。`) : text(`${actor} is deciding whether to sell.`, `${actor}正在决定是否出售。`); break;
    case 'load':
      camera = 'boats'; title = text('Ship goods', '运货');
      todo = text(`Select your ${GOOD[a.shipment.good]} crate in the dock, then click the outlined ship. Every crate is worth 1 point, and the Captain earns 1 bonus point.`, `在货物区选择你的${GOOD[a.shipment.good]}货箱，再点击带描边的货船。每箱 1 分，船长额外得 1 分。`);
      preview = text(`${actor} must load ${GOOD[a.shipment.good]} onto a ship.`, `${actor}必须把${GOOD[a.shipment.good]}装上货船。`); break;
    case 'retain':
      title = text('Keep leftover goods', '保留剩余货物');
      preview = text(`${actor} is choosing which leftover goods to keep.`, `${actor}正在选择保留哪些剩余货物。`); break;
    default: title = text('Your move', '你的行动'); todo = text('Follow the outlined target.', '按照描边提示操作。');
  }
  return { title, todo, preview, camera, actor };
}

/** What a move just did, and what it sets up next. `view` is the board after the move. */
export function describeMove(move: TutorialMove, view: PlayerView, language: 'en' | 'zh') {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const a = move.step.action, actorId = move.step.command.actorId, actor = playerName(actorId, text);
  const coins = move.events.reduce((sum, e) => sum + (e.kind === 'coins-changed' && e.playerId === actorId ? e.delta : 0), 0);
  const moved = (from: 'supply' | 'player') => move.events.flatMap(e => e.kind === 'goods-moved' && e.from.kind === from ? [`${GOOD[e.good]}×${e.quantity}`] : []).join(' ');
  const points = move.events.reduce((sum, e) => sum + (e.kind === 'vp-earned' ? e.quantity : 0), 0);
  switch (a.kind) {
    case 'choose-role': {
      const role = move.events.find((e): e is Extract<PlayerEvent, { kind: 'role-selected' }> => e.kind === 'role-selected')!.role;
      const bonus = coins > 0 ? text(` ${actor} also collected ${coins} coin${coins > 1 ? 's' : ''} left on the tile.`, `${actor}还拿到了牌上积累的 ${coins} 金币。`) : '';
      const skipped = view.phase.kind === 'role-selection' ? text(' Nobody had anything to do, so the phase ended at once.', '没有人能执行该行动，阶段立即结束。') : '';
      return text(`${actor} chose ${ROLE[role]}.${bonus} `, `${actor}选择了${ROLE[role]}。${bonus}`) + roleFollowUp(role, actor, text) + skipped;
    }
    case 'plant': return text(`${actor} took a ${a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : ''} estate. It produces only once a worker is placed on it.`, `${actor}领取了${a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : ''}田园。放上工人后才会生产。`);
    case 'build': {
      const name = a.purchase ? BUILDING[a.purchase.buildingTypeId] : '';
      return coins < 0 ? text(`${actor} built ${name} for ${-coins} coin${coins < -1 ? 's' : ''}.`, `${actor}花费 ${-coins} 金币建造了${name}。`)
        : text(`${actor} built ${name} for free thanks to the Builder discount.`, `${actor}凭建筑师折扣免费建造了${name}。`);
    }
    case 'recruit-worker': return text('Everyone received a worker from the ship. Each player now places their workers; the phase ends when all have confirmed.', '每人都从船上得到了工人。现在每人分配自己的工人，全部确认后阶段结束。');
    case 'allocate-workers': return text(`${actor} confirmed worker placement. Occupied estates and buildings will work in later phases.`, `${actor}确认了工人分配。有工人的田园和建筑将在之后的阶段发挥作用。`);
    case 'produce': {
      const made = moved('supply');
      return made ? text(`${actor} produced ${made}.`, `${actor}生产了${made}。`) : text(`${actor} had nothing staffed to produce.`, `${actor}没有可生产的货物。`);
    }
    case 'take-production-bonus': return text(`${actor} took 1 extra ${a.good ? GOOD[a.good] : ''}. Goods are sold with Trader or shipped with Captain.`, `${actor}额外领取了 1 个${a.good ? GOOD[a.good] : ''}。货物可以通过商人出售，或通过船长运走。`);
    case 'trade': return a.sale ? text(`${actor} sold ${GOOD[a.sale.good]} for ${coins} coin${coins === 1 ? '' : 's'}.`, `${actor}出售${GOOD[a.sale.good]}获得 ${coins} 金币。`)
      : text(`${actor} passed, keeping goods to ship for points.`, `${actor}放弃出售，留着货物运货得分。`);
    case 'load': {
      const shipped = moved('player');
      return actorId === learner ? text(`You shipped ${shipped} and earned ${points} points.`, `你运送了${shipped}，获得 ${points} 分。`)
        : text(`${actor} shipped ${shipped}, 1 point per crate. Shipping continues until nobody can load.`, `${actor}运送了${shipped}，每箱 1 分。持续运货，直到没有人能装货。`);
    }
    default: return text(`${actor} finished their move.`, `${actor}完成了行动。`);
  }
}
