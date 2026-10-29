type Text = (en: string, zh: string) => string;

/**
 * The turn loop on the "How a round flows" page: pick a role (the chooser's privilege), everyone carries it out
 * starting with the chooser, then the next player picks, until everyone has a role.
 */
export function RoundDiagram({ text }: { text: Text }) {
  const players = [text('B', 'B'), text('C', 'C'), text('You', '你')];
  return <svg className="tutorial-diagram" viewBox="0 0 300 160" role="img"
    aria-label={text('A turn: pick a role, everyone acts starting with the chooser, then the next player picks.', '一个回合：选择角色，从选择者开始所有人行动，然后下一位玩家选择。')}>
    <defs>
      <marker id="tutorial-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
      </marker>
    </defs>
    {[24, 76, 134].map((y, i) => <g key={y}>
      <circle cx="11" cy={y - 6} r="9" className="step" />
      <text x="11" y={y - 2} textAnchor="middle" className="step-number">{i + 1}</text>
    </g>)}

    <text x="28" y="22" className="label">{text('Pick a role', '选择一个角色')}</text>
    {[0, 1, 2, 3, 4].map(i => <rect key={i} x={28 + i * 27} y={i === 1 ? 27 : 31} width="21" height="15" rx="3" className={i === 1 ? 'rd-card picked' : 'rd-card'} />)}
    <text x="168" y="42" className="note">{text('+ privilege', '+ 特权')}</text>

    <text x="28" y="74" className="label">{text('Everyone does it, chooser first', '所有人依次执行，选择者先')}</text>
    {players.map((name, i) => <g key={i}>
      <circle cx={40 + i * 52} cy="96" r="11" className={i === 0 ? 'rd-player chooser' : 'rd-player'} />
      <text x={40 + i * 52} y="100" textAnchor="middle" className="initial">{name}</text>
      {i < 2 && <line x1={55 + i * 52} y1="96" x2={77 + i * 52} y2="96" markerEnd="url(#tutorial-arrow)" className="arrow" />}
    </g>)}

    <text x="28" y="132" className="label">{text('Next player picks a role', '下一位玩家选择角色')}</text>
    <text x="28" y="149" className="note">{text('Repeat until everyone has one', '重复，直到每人都选过')}</text>

    <path d="M 214 128 H 284 V 18 H 246" fill="none" markerEnd="url(#tutorial-arrow)" className="arrow loop" />
  </svg>;
}
