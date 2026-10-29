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
    case 'recruiter': return text(`The chooser takes 1 extra worker, the workers in the hiring pool are shared out, then everyone places workers on their own island.`, `${actor}多领 1 名工人，招募池里的工人分给所有人，然后每人在自己的岛上分配工人。`);
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
      camera = 'estates';
      if (a.choice.kind === 'quarry') {
        title = text('Take a quarry', '领取采石场');
        todo = text(`As Planter you may take a quarry instead of an estate. Click the outlined quarry stack on the board, then press "${t('取采石场')}" in the action panel.`,
          `作为种植者，你可以改取采石场。点击棋盘上带描边的采石场，再在行动面板中点击“${t('取采石场')}”。`);
        preview = text(`${actor} is taking a quarry.`, `${actor}正在领取采石场。`); break;
      }
      const name = a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : '';
      title = text(`Take ${name}`, `领取${name}`);
      todo = text(`Click the outlined ${name} estate on the board, then press "Plant ${name}" in the action panel.`, `点击棋盘上带描边的${name}田园，再在行动面板中点击“种植”。`);
      preview = text(`${actor} is taking a ${name} estate.`, `${actor}正在领取${name}田园。`); break;
    }
    case 'build': {
      const name = a.purchase ? BUILDING[a.purchase.buildingTypeId] : '';
      camera = 'buildings-1';
      if (!a.purchase) {
        title = text('Builder', '建筑师');
        todo = text('Pass this time.', '这次放弃建造。');
        preview = text(`${actor} can't afford anything useful and passes.`, `${actor}买不起需要的建筑，放弃建造。`); break;
      }
      title = text(`Build ${name}`, `建造${name}`);
      const why = a.purchase?.buildingTypeId === 'small-fruit-depot'
        ? text(`Your fruit estate needs it: fruit only becomes a good once ${name} is staffed too.`, `你的${GOOD.fruit}田需要它：只有${name}也有工人时，${GOOD.fruit}才能变成货物。`)
        : a.purchase?.buildingTypeId === 'small-warehouse'
        ? text(`Staffed, ${name} lets you keep every crate of one kind of good after shipping.`, `有工人时，${name}让你在运货后保留一种货物的全部货箱。`) : '';
      todo = text(`Click the outlined ${name} in the building market, then press Build in the action panel. ${why}`, `点击建筑市场中带描边的${name}，再在行动面板中点击“建造”。${why}`);
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
      todo = text(`Check your island, now in view: estates are in the fields at the back, buildings in the town at the front. Pick up a worker from your worker pool, click the outlined ${where}, then press "${t('确认分配')}". Only occupied estates and buildings work.`, `查看你的岛屿（已切换到此视角）：田园在后方田地，建筑在前方城镇。从工人池拿起一名工人，点击带描边的${where}，再点击“${t('确认分配')}”。只有有工人的田园和建筑才会工作。`);
      preview = text(`${actor} is placing workers on their island.`, `${actor}正在自己的岛上分配工人。`); break;
    }
    case 'produce':
      title = text('Produce goods', '生产货物');
      todo = text(`Press Produce in your hand. Your staffed ${GOOD.fruit} estate and staffed ${BUILDING['small-fruit-depot']} make 1 ${GOOD.fruit}.`,
        `点击手牌区的“生产”。有工人的${GOOD.fruit}田和有工人的${BUILDING['small-fruit-depot']}产出 1 个${GOOD.fruit}。`);
      preview = text(`${actor} is producing goods.`, `${actor}正在生产货物。`); break;
    case 'take-production-bonus':
      title = text('Craftsman privilege', '工匠特权');
      preview = text(`${actor} chose Craftsman, so takes 1 extra ${a.good ? GOOD[a.good] : ''}.`, `${actor}选择了工匠，额外领取 1 个${a.good ? GOOD[a.good] : ''}。`);
      todo = text(`As Craftsman you take 1 extra good. Press "${t('额外货物 {0}', [a.good ? GOOD[a.good] : ''])}" in your hand.`, `作为工匠，你可以额外领取 1 个货物。点击手牌区的“${t('额外货物 {0}', [a.good ? GOOD[a.good] : ''])}”。`); break;
    case 'trade':
      camera = 'depot'; title = text('Sell a good', '出售货物');
      todo = text(`Select your ${GOOD.fruit} crate in the dock, then click the outlined trading house. ${GOOD.fruit} sells for 1 coin, plus 1 for your Trader privilege.`,
        `在货物区选择你的${GOOD.fruit}货箱，再点击带描边的交易所。${GOOD.fruit}售价 1 金币，商人特权再多得 1 金币。`);
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
    case 'plant': return a.choice.kind === 'quarry'
      ? text(`${actor} took a quarry. With a worker on it, it makes buildings 1 coin cheaper.`, `${actor}领取了采石场。放上工人后，建筑便宜 1 金币。`)
      : text(`${actor} took a ${a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : ''} estate. It produces only once a worker is placed on it.`, `${actor}领取了${a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : ''}田园。放上工人后才会生产。`);
    case 'build': {
      const name = a.purchase ? BUILDING[a.purchase.buildingTypeId] : '';
      if (!a.purchase) return text(`${actor} passed and kept the coins.`, `${actor}放弃建造，留下了金币。`);
      return coins < 0 ? text(`${actor} built ${name} for ${-coins} coin${coins < -1 ? 's' : ''}.`, `${actor}花费 ${-coins} 金币建造了${name}。`)
        : text(`${actor} built ${name} for free thanks to the Builder discount.`, `${actor}凭建筑师折扣免费建造了${name}。`);
    }
    case 'recruit-worker': return text('Everyone received a worker from the hiring pool. Each player now places their workers; the phase ends when all have confirmed.', '每人都从招募池得到了工人。现在每人分配自己的工人，全部确认后阶段结束。');
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

/** Opening pages: the table, the learner's island, where to look, and how a round flows. */
export function introPages(language: 'en' | 'zh'): { camera: BoardView; mine?: true; title: string; body: string[]; diagram?: true }[] {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const views = [t('可选田园'), t('建筑市场'), t('货船'), t('交易所')].map(v => text(`"${v}"`, `“${v}”`)).join(text(', ', '、'));
  return [
    { camera: 'overview', title: text('Welcome to the table', '欢迎来到牌桌'),
      body: [text('The harbour island in the middle is shared by everyone. Each player has their own island around it: yours, Bruno\'s and Chen\'s. Drag to move, scroll or pinch to zoom, and use the view buttons (the "Viewing" menu on a phone) to jump between places.', `中间的港口岛由所有人共用，周围是每位玩家自己的岛屿：你的、Bruno 的和 Chen 的。拖动可移动视角，滚轮或双指可缩放，也可以用视角按钮（手机上为“查看区域”菜单）快速切换。`)] },
    { camera: 'mine', mine: true, title: text('Your island', '你的岛屿'),
      body: [text(`Estates you take go into the fields at the back; buildings you buy go into the town at the front. They only work once a worker is placed on them. Your coins, unplaced workers and goods are in your hand at the bottom. "${t('我的岛屿')}" brings you back here any time.`, `你领取的田园放在后方田地，购买的建筑放在前方城镇，放上工人后才会工作。金币、未分配的工人和货物在下方手牌区。随时可以用“${t('我的岛屿')}”回到这里。`)] },
    { camera: 'shared', title: text('Places to check', '常看的地方'),
      body: [text(`On the harbour: ${views}. Estates and buildings are bought there, ships take goods for points, and the depot buys goods for coins. Other players' islands show what they own.`, `港口岛上有：${views}。在那里领取田园、购买建筑，货船用货物换分数，交易所用货物换金币。其他玩家的岛屿显示他们拥有的东西。`)] },
    { camera: 'shared', title: text('How a round flows', '一轮如何进行'), diagram: true, body: [
      text('Players take turns picking a role card. The chooser gets its privilege, a small bonus, then everyone carries out that role, chooser first. So you act on other players\' roles too.', '玩家轮流选择一张角色牌。选择者获得它的特权（一个小奖励），然后从选择者开始，所有人依次执行这个角色。所以别人选的角色你也会行动。'),
      text('When everyone has a role, the round ends: unpicked roles gain 1 coin and the Governor moves on. Ship goods and own buildings to score points.', '每人都选过后本轮结束：没人选的角色各加 1 金币，总督传给下一位。通过运货和拥有建筑得分。'),
    ] },
  ];
}

/** After the learner plants or builds: what is now on their island. */
export function islandCheck(move: TutorialMove, view: PlayerView, language: 'en' | 'zh') {
  const text: Text = (en, zh) => language === 'zh' ? zh : en;
  const a = move.step.action;
  if (a.kind === 'plant' && a.choice.kind === 'quarry') return text('Check your island: your quarry is in the fields at the back. It needs a worker before it saves you anything.', '查看你的岛屿：采石场在后方田地中。放上工人后才能帮你省钱。');
  if (a.kind === 'plant') {
    const name = a.choice.kind === 'estate' ? tileName(a.choice.tileId, view) : '';
    return text(`Check your island: your new ${name} estate is in the fields at the back. It stays empty until you place a worker on it.`, `查看你的岛屿：新的${name}田园在后方田地中。放上工人之前它不会生产。`);
  }
  if (a.kind === 'build' && a.purchase) return text(`Check your island: ${BUILDING[a.purchase.buildingTypeId]} now stands in the town at the front. Its worker slot is empty, so it does nothing yet.`, `查看你的岛屿：${BUILDING[a.purchase.buildingTypeId]}已建在前方城镇中。它的工人位还空着，暂时不会起作用。`);
  return '';
}
