import type { Good } from '@vibe-rico/game-engine';
import { BUILDING, GOOD } from '../i18n/terms.js';
import type { RoleDiagram } from './rolePages.js';

type Text = (en: string, zh: string) => string;
const initial = (name: string) => name.length <= 3 ? name : name.slice(0, 1);

/** The picture under a guide page. */
export function RoleDiagramView({ diagram, text }: { diagram: RoleDiagram; text: Text }) {
  switch (diagram.kind) {
    case 'recruit': return <RecruitDiagram {...diagram} text={text} />;
    case 'refill': return <RefillDiagram {...diagram} text={text} />;
    case 'supply': return <SupplyDiagram {...diagram} text={text} />;
    case 'price': return <PriceDiagram {...diagram} text={text} />;
    case 'chain': return <ChainDiagram {...diagram} text={text} />;
    case 'produce': return <ProduceDiagram {...diagram} text={text} />;
    case 'house': return <HouseDiagram {...diagram} text={text} />;
    case 'ships': return <ShipsDiagram {...diagram} text={text} />;
  }
}

/** A crate of `good`, in that good's colour. */
const Crate = ({ x, y, size, good }: { x: number; y: number; size: number; good: Good }) =>
  <rect x={x} y={y} width={size} height={size} rx="2" className={`rd-good ${good}`} />;
const PRICES: readonly Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];

/** Production: estate and processing building both staffed make a crate; either empty makes nothing; corn needs no building. */
function ChainDiagram({ good, building, text }: Extract<RoleDiagram, { kind: 'chain' }> & { text: Text }) {
  const rows = [
    { estate: good, staffed: true, building: true, out: true },
    { estate: good, staffed: true, building: false, out: false },
    { estate: 'corn' as Good, staffed: true, building: null, out: true },
  ];
  return <svg className="tutorial-diagram" viewBox="0 0 300 116" role="img"
    aria-label={text(`A staffed ${GOOD[good]} estate and a staffed ${BUILDING[building]} make 1 ${GOOD[good]}; with the building empty they make nothing; a staffed corn estate makes corn on its own.`,
      `有工人的${GOOD[good]}田加上有工人的${BUILDING[building]}产出 1 个${GOOD[good]}；建筑空着就不产出；有工人的玉米田单独就能产出玉米。`)}>
    <text x="27" y="10" textAnchor="middle" className="rd-chip-label">{text('Estate', '田园')}</text>
    <text x="96" y="10" textAnchor="middle" className="rd-chip-label">{text('Building', '加工建筑')}</text>
    <text x="214" y="10" textAnchor="middle" className="rd-chip-label">{text('Makes', '产出')}</text>
    {rows.map((r, i) => {
      const y = 18 + i * 33;
      return <g key={i}>
        <rect x="12" y={y} width="30" height="24" rx="4" className={`rd-good ${r.estate}`} />
        {r.staffed && <circle cx="27" cy={y + 12} r="4.5" className="rd-worker outlined" />}
        {r.building === null ? <text x="96" y={y + 16} textAnchor="middle" className="rd-chip-label">{text('none needed', '不需要')}</text> : <>
          <text x="54" y={y + 17} textAnchor="middle" className="rd-op small">+</text>
          <rect x="66" y={y} width="60" height="24" rx="4" className="rd-chip" />
          <rect x="88" y={y + 5} width="16" height="14" rx="2" className={r.building ? 'rd-slot filled' : 'rd-slot'} />
          {r.building && <circle cx="96" cy={y + 12} r="4" className="rd-worker" />}
        </>}
        <line x1="134" y1={y + 12} x2="168" y2={y + 12} markerEnd="url(#chain-arrow)" className="arrow" />
        {r.out ? <>
          <Crate x={176} y={y + 3} size={18} good={r.estate} />
          <text x="200" y={y + 16} className="label">{text(`1 ${GOOD[r.estate]}`, `1 个${GOOD[r.estate]}`)}</text>
        </> : <text x="176" y={y + 16} className="rd-warning">{text('nothing', '无产出')}</text>}
      </g>;
    })}
    <defs>
      <marker id="chain-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
      </marker>
    </defs>
  </svg>;
}

/**
 * Each player's estates (good-coloured squares, a dot when staffed) and processing buildings (a little house with a
 * roof in its good's colour and one circle per worker slot), then the goods they are about to make.
 */
function ProduceDiagram({ rows, text }: Extract<RoleDiagram, { kind: 'produce' }> & { text: Text }) {
  const top = 16, height = top + rows.length * 36;
  return <svg className="tutorial-diagram" viewBox={`0 0 300 ${height}`} role="img"
    aria-label={rows.map(r => `${r.name}: ${(Object.entries(r.output) as [Good, number][]).map(([g, n]) => `${n} ${GOOD[g]}`).join(', ') || text('nothing', '无')}`).join('; ')}>
    <defs>
      <marker id="produce-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
      </marker>
    </defs>
    <text x="34" y="10" className="rd-chip-label">{text('Estates', '田园')}</text>
    <text x="104" y="10" className="rd-chip-label">{text('Buildings', '加工建筑')}</text>
    <text x="216" y="10" className="rd-chip-label">{text('Makes', '产出')}</text>
    {rows.map((r, i) => {
      const y = top + i * 36, out = Object.entries(r.output) as [Good, number][];
      return <g key={r.name}>
        <circle cx="13" cy={y + 13} r="11" className="rd-player" />
        <text x="13" y={y + 17} textAnchor="middle" className="initial">{initial(r.name)}</text>
        {r.estates.map((e, j) => { const ex = 34 + j * 22; return <g key={`e${j}`}>
          <rect x={ex} y={y + 4} width="18" height="18" rx="3" className={`rd-good ${e.good}`} />
          {e.staffed && <circle cx={ex + 9} cy={y + 13} r="3.5" className="rd-worker outlined" />}
        </g>; })}
        {r.buildings.length === 0 && <text x="104" y={y + 17} className="rd-chip-label">—</text>}
        {r.buildings.map((b, j) => { const bx = 104 + j * 40, w = Math.max(24, b.slots * 10 + 8); return <g key={`b${j}`}>
          <path d={`M ${bx - 2} ${y + 10} L ${bx + w / 2} ${y} L ${bx + w + 2} ${y + 10} Z`} className={`rd-good ${b.good}`} />
          <rect x={bx} y={y + 10} width={w} height="16" rx="2" className="rd-chip" />
          {Array.from({ length: b.slots }, (_, k) => <circle key={k} cx={bx + w / 2 - (b.slots - 1) * 5 + k * 10} cy={y + 18} r="3.5" className={k < b.staffed ? 'rd-worker' : 'rd-slot'} />)}
        </g>; })}
        <line x1="186" y1={y + 13} x2="208" y2={y + 13} markerEnd="url(#produce-arrow)" className="arrow" />
        {out.length === 0 ? <text x="216" y={y + 17} className="rd-chip-label">{text('nothing', '无')}</text>
          : out.map(([g, n], k) => <g key={g}>
            <Crate x={216 + k * 40} y={y + 5} size={16} good={g} />
            <text x={236 + k * 40} y={y + 17} className="label">×{n}</text>
          </g>)}
      </g>;
    })}
  </svg>;
}

/** The trading house's 4 slots, the price list, and (optionally) a player whose good is already in the house. */
function HouseDiagram({ slots, blocked, text }: Extract<RoleDiagram, { kind: 'house' }> & { text: Text }) {
  const height = blocked ? 138 : 110;
  return <svg className="tutorial-diagram" viewBox={`0 0 300 ${height}`} role="img"
    aria-label={text(`Trading house: ${slots.map(g => g ? GOOD[g] : 'empty').join(', ')}.`, `交易所：${slots.map(g => g ? GOOD[g] : '空').join('、')}。`)}>
    <text x="150" y="11" textAnchor="middle" className="rd-chip-label">{text('Trading house: 4 places, one of each kind', '交易所：4 个位置，每种一个')}</text>
    {slots.map((g, i) => { const x = 30 + i * 62; return <g key={i}>
      <rect x={x} y="18" width="54" height="34" rx="6" className={g ? 'rd-chip' : 'rd-pool'} />
      {g && <><Crate x={x + 6} y={26} size={18} good={g} /><text x={x + 28} y="40" className="rd-chip-label">{GOOD[g]}</text></>}
    </g>; })}
    {PRICES.map((g, i) => { const cx = 34 + i * 58; return <g key={g}>
      <Crate x={cx - 7} y={62} size={14} good={g} />
      <text x={cx} y="88" textAnchor="middle" className="rd-chip-label">{GOOD[g]}</text>
      <text x={cx} y="101" textAnchor="middle" className="note">{text(`${i} coin${i === 1 ? '' : 's'}`, `${i} 金币`)}</text>
    </g>; })}
    {blocked && <g>
      <text x="96" y="128" textAnchor="end" className="label">{blocked.name}</text>
      <Crate x={104} y={115} size={16} good={blocked.good} />
      <path d="M 102 113 L 122 133 M 122 113 L 102 133" className="rd-cross" />
      <text x="130" y="128" className="rd-warning">{text(`${GOOD[blocked.good]} is already there`, `已经有${GOOD[blocked.good]}了`)}</text>
    </g>}
  </svg>;
}

/** The cargo ships, each a row of crate places: loaded ones in the good's colour. */
function ShipsDiagram({ ships, text }: Extract<RoleDiagram, { kind: 'ships' }> & { text: Text }) {
  return <svg className="tutorial-diagram" viewBox={`0 0 300 ${ships.length * 32 + 4}`} role="img"
    aria-label={ships.map(s => s.good ? `${GOOD[s.good]} ${s.loaded}/${s.capacity}` : text(`empty ${s.capacity}`, `空 ${s.capacity}`)).join(', ')}>
    {ships.map((s, i) => {
      const y = 4 + i * 32, w = s.capacity * 18 + 16;
      return <g key={i}>
        <path d={`M 8 ${y} H ${8 + w} L ${w - 2} ${y + 24} H 18 Z`} className="rd-hull" />
        {Array.from({ length: s.capacity }, (_, k) => k < s.loaded && s.good
          ? <Crate key={k} x={16 + k * 18} y={y + 4} size={14} good={s.good} />
          : <rect key={k} x={16 + k * 18} y={y + 4} width="14" height="14" rx="2" className="rd-slot" />)}
        <text x={w + 18} y={y + 16} className="label">{s.good ? `${GOOD[s.good]} ${s.loaded}/${s.capacity}` : text(`empty · ${s.capacity}`, `空 · ${s.capacity}`)}</text>
      </g>;
    })}
  </svg>;
}

/** Workers in the hiring pool dealt one at a time from the chooser, who also takes 1 from the supply. */
function RecruitDiagram({ register, deal, text }: Extract<RoleDiagram, { kind: 'recruit' }> & { text: Text }) {
  const rowY = (i: number) => 22 + i * 32;
  const mid = rowY((deal.length - 1) / 2), height = rowY(deal.length - 1) + 34;
  const shown = Math.min(register, 7);
  const chooser = deal.find(d => d.chooser)?.name ?? '';
  return <svg className="tutorial-diagram" viewBox={`0 0 300 ${height}`} role="img"
    aria-label={text(`${register} workers in the hiring pool are dealt one at a time starting with ${chooser}; ${chooser} also takes 1 extra worker.`,
      `招募池里的 ${register} 名工人从${chooser}开始轮流分发；${chooser}另外多领 1 名工人。`)}>
    <defs>
      <marker id="recruit-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
      </marker>
    </defs>
    <rect x="8" y={mid - 18} width="96" height="36" rx="10" className="rd-pool" />
    {Array.from({ length: shown }, (_, i) => <circle key={i} cx={56 + (i - (shown - 1) / 2) * 12} cy={mid} r="4.5" className="rd-worker" />)}
    {register > shown && <text x="98" y={mid + 14} textAnchor="end" className="note">+{register - shown}</text>}
    <text x="56" y={mid + 34} textAnchor="middle" className="note">{text(`Hiring pool: ${register}`, `招募池：${register}`)}</text>
    {deal.map((d, i) => <g key={d.name}>
      <line x1="110" y1={mid + 4} x2="176" y2={rowY(i)} markerEnd="url(#recruit-arrow)" className="arrow" />
      <circle cx="192" cy={rowY(i)} r="12" className={d.chooser ? 'rd-player chooser' : 'rd-player'} />
      <text x="192" y={rowY(i) + 4} textAnchor="middle" className="initial">{initial(d.name)}</text>
      {Array.from({ length: d.count }, (_, j) => <circle key={j} cx={216 + j * 11} cy={rowY(i)} r="4.5" className="rd-worker" />)}
      {d.chooser && <>
        <circle cx={216 + d.count * 11} cy={rowY(i)} r="4.5" className="rd-bonus" />
        <text x={226 + d.count * 11} y={rowY(i) + 4} className="note">{text('+1 privilege', '+1 特权')}</text>
      </>}
    </g>)}
  </svg>;
}

/** How many workers refill the hiring pool: each island's staffed and empty building slots, then the larger of empty slots and players. */
function RefillDiagram({ islands, players, refill, text }: Extract<RoleDiagram, { kind: 'refill' }> & { text: Text }) {
  const empty = islands.reduce((n, i) => n + i.empty, 0), most = 6;
  const w = Math.min(84, (284 - (islands.length - 1) * 8) / islands.length), x0 = (300 - islands.length * w - (islands.length - 1) * 8) / 2;
  return <svg className="tutorial-diagram" viewBox="0 0 300 104" role="img"
    aria-label={text(`${empty} empty building slots and ${players} players, so the hiring pool gets ${refill} workers.`,
      `${empty} 个空建筑工人位、${players} 位玩家，所以招募池补充 ${refill} 名工人。`)}>
    {islands.map((island, i) => {
      const x = x0 + i * (w + 8), shown = Math.min(most, island.filled + island.empty), step = Math.min(13, (w - 12) / Math.max(1, shown));
      const start = x + w / 2 - (shown * step - (step - 10)) / 2;
      return <g key={island.name}>
        <rect x={x} y="4" width={w} height="34" rx="8" className="rd-chip" />
        {shown === 0 && <text x={x + w / 2} y="25" textAnchor="middle" className="rd-chip-label">{text('no buildings', '无建筑')}</text>}
        {Array.from({ length: shown }, (_, j) => <g key={j}>
          <rect x={start + j * step} y="14" width="10" height="13" rx="2" className={j < island.filled ? 'rd-slot filled' : 'rd-slot'} />
          {j < island.filled && <circle cx={start + j * step + 5} cy="20.5" r="3" className="rd-worker" />}
        </g>)}
        <text x={x + w / 2} y="52" textAnchor="middle" className="rd-chip-label">{text(`${island.name}: ${island.empty} empty`, `${island.name}：空 ${island.empty}`)}</text>
      </g>;
    })}
    <text x="150" y="72" textAnchor="middle" className="note">{text(`${empty} empty slots · ${players} players`, `${empty} 个空工人位 · ${players} 位玩家`)}</text>
    <text x="150" y="94" textAnchor="middle" className="label">{text(`Refill = the larger one = ${refill}`, `补充数量 = 两者中较大的 = ${refill}`)}</text>
  </svg>;
}

/** Refill workers moving from the supply to the hiring pool; the game ends when the supply runs short. */
function SupplyDiagram({ refill, supply, text }: Extract<RoleDiagram, { kind: 'supply' }> & { text: Text }) {
  return <svg className="tutorial-diagram" viewBox="0 0 300 76" role="img"
    aria-label={text(`${refill} workers move from the supply of ${supply} into the hiring pool.`, `${refill} 名工人从供应区（${supply}）进入招募池。`)}>
    <defs>
      <marker id="supply-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
      </marker>
    </defs>
    <rect x="18" y="4" width="92" height="44" rx="8" className="rd-chip" />
    <text x="64" y="26" textAnchor="middle" className="rd-num">{supply}</text>
    <text x="64" y="41" textAnchor="middle" className="rd-chip-label">{text('Supply', '供应区')}</text>
    <line x1="114" y1="26" x2="184" y2="26" markerEnd="url(#supply-arrow)" className="arrow" />
    <text x="149" y="20" textAnchor="middle" className="note">{text(`${refill} workers`, `${refill} 名工人`)}</text>
    <rect x="190" y="4" width="92" height="44" rx="10" className="rd-pool" />
    <text x="236" y="26" textAnchor="middle" className="rd-num">{refill}</text>
    <text x="236" y="41" textAnchor="middle" className="rd-chip-label">{text('Hiring pool', '招募池')}</text>
    <text x="150" y="68" textAnchor="middle" className={supply < refill ? 'rd-warning' : 'rd-chip-label'}>
      {text(`Fewer than ${refill} left in the supply → the game ends`, `供应区少于 ${refill} 名 → 游戏结束`)}
    </text>
  </svg>;
}

/** cost − quarries − privilege = price, as chips. */
function PriceDiagram({ cost, quarries, privilege, price, text }: Extract<RoleDiagram, { kind: 'price' }> & { text: Text }) {
  const chips = [
    { value: `${cost}`, label: text('Cost', '售价') },
    { value: `−${quarries}`, label: text('Quarries', '采石场') },
    ...(privilege ? [{ value: '−1', label: text('Privilege', '特权') }] : []),
    { value: `${price}`, label: text('Pays', '支付'), pay: true },
  ];
  const w = 56, gap = 20, total = chips.length * w + (chips.length - 1) * gap, x0 = (300 - total) / 2;
  return <svg className="tutorial-diagram" viewBox="0 0 300 58" role="img"
    aria-label={text(`Cost ${cost}, minus ${quarries} for quarries${privilege ? ', minus 1 for the privilege' : ''}, pays ${price}.`,
      `售价 ${cost}，采石场减 ${quarries}${privilege ? '，特权减 1' : ''}，支付 ${price}。`)}>
    {chips.map((c, i) => {
      const x = x0 + i * (w + gap);
      return <g key={c.label}>
        {i > 0 && <text x={x - gap / 2} y="27" textAnchor="middle" className="rd-op">{i === chips.length - 1 ? '=' : ''}</text>}
        <rect x={x} y="4" width={w} height="48" rx="8" className={c.pay ? 'rd-chip pay' : 'rd-chip'} />
        <text x={x + w / 2} y="28" textAnchor="middle" className={c.pay ? 'rd-num pay' : 'rd-num'}>{c.value}</text>
        <text x={x + w / 2} y="44" textAnchor="middle" className={c.pay ? 'rd-chip-label pay' : 'rd-chip-label'}>{c.label}</text>
      </g>;
    })}
  </svg>;
}
