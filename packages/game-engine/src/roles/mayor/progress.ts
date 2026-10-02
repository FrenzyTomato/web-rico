import type { GameState } from '../../model/state.js';

/** Older snapshots used a clockwise cursor; newer ones record confirmations in any order. */
export function confirmedWorkers(state: Pick<GameState, 'phase' | 'seatOrder'>) {
  const phase = state.phase;
  if (phase.kind !== 'recruiter-placement') return [];
  if (phase.confirmedPlayerIds) return phase.confirmedPlayerIds;
  const start = state.seatOrder.indexOf(phase.roleChooserId);
  return Array.from({ length: phase.actorIndex }, (_, i) => state.seatOrder[(start + i) % state.seatOrder.length]!);
}
