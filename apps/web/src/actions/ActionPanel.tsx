import type { Option } from './options.js';
import type { SceneTarget } from '../scene/Selection.js';

/**
 * Actions for the object selected in the scene, submitted through the same command channel as the DOM
 * forms. Selecting never changes game state; an object with no legal action offers nothing to run.
 */
export function ActionPanel({ target, options, submit, clear }: {
  target: SceneTarget | null; options: readonly Option[]; submit: (o: Option) => void; clear: () => void;
}) {
  if (!target) return null;
  return (
    // Escape closes the panel; the first option takes focus so the keyboard can act at once.
    <div className="action-panel" role="group" aria-label="所选对象的行动" onKeyDown={e => { if (e.key === 'Escape') clear(); }}>
      {options.length === 0
        ? <span>此对象当前没有可执行的行动</span>
        : options.map((o, i) => <button key={JSON.stringify(o.action)} autoFocus={i === 0} onClick={() => { submit(o); clear(); }}>{o.label}</button>)}
      <button autoFocus={options.length === 0} onClick={clear}>取消选择</button>
    </div>
  );
}
