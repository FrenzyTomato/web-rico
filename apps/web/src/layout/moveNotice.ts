import type { PlayerEvent } from '@vibe-rico/protocol';
import { describeEvent } from '../i18n/chronicle.js';
import { t } from '../i18n/language.js';
import { GOOD } from '../i18n/terms.js';

/** Who made the move a broadcast carries: the first player its events name. */
function actorOf(events: readonly PlayerEvent[]): string | undefined {
  for (const e of events) {
    if ('playerId' in e) return e.playerId;
    if (e.kind === 'goods-moved') {
      if ('playerId' in e.from) return e.from.playerId;
      if ('playerId' in e.to) return e.to.playerId;
    }
  }
  return undefined;
}

/** One notice: the move itself, then what everyone received from it, one chip per player. */
export interface MoveNotice { readonly title: string; readonly groups: readonly { readonly label: string; readonly items: readonly string[] }[] }

/** Another player's move, so a bot's or friend's turn can be followed without the chronicle. The viewer is "You". */
export function moveNotice(events: readonly PlayerEvent[], viewerId: string, names: Readonly<Record<string, string>>): MoveNotice | null {
  const actor = actorOf(events);
  if (!actor || actor === viewerId) return null;
  const who = (id: string) => id === viewerId ? t('你') : names[id] ?? id;
  const shown = { ...names, [viewerId]: t('你') };
  // Each label sums per player (and good): the Recruiter's bonus worker and their share read as one "+3".
  const sums = new Map<string, Map<string, number>>();
  const add = (label: string, item: string, n: number) => {
    const group = sums.get(label) ?? new Map<string, number>();
    group.set(item, (group.get(item) ?? 0) + n);
    sums.set(label, group);
  };
  const lines: string[] = [];
  for (const e of events) {
    if (e.kind === 'workers-received') add(t('获得工人'), who(e.playerId), e.quantity);
    else if (e.kind === 'goods-moved' && e.from.kind === 'supply' && e.to.kind === 'player') add(t('获得货物'), `${who(e.to.playerId)} ${GOOD[e.good]}`, e.quantity);
    else if (e.kind !== 'coins-changed') { const line = describeEvent(e, shown); if (line && !lines.includes(line)) lines.push(line); }
  }
  // Coin changes are the price or payout of the move itself; they show only when nothing else happened.
  if (!lines.length && !sums.size) for (const e of events) if (e.kind === 'coins-changed') add(t('金币'), who(e.playerId), e.delta);
  const list = [...sums].map(([label, items]) => ({ label, items: [...items].map(([item, n]) => `${item} ${n > 0 ? '+' : ''}${n}`) }));
  if (lines.length) return { title: lines.slice(0, 2).join(' · '), groups: list };
  return list.length ? { title: list[0]!.label, groups: [{ label: '', items: list[0]!.items }, ...list.slice(1)] } : null;
}
