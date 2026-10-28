import type { PlayerView } from '@vibe-rico/protocol';
import type { BoardView } from '../scene/Camera.js';

/** The camera shortcut showing where each decision is made (same views as the board's shortcut buttons). */
const ACTION_VIEW: Partial<Record<PlayerView['phase']['kind'], BoardView>> = {
  'planter-before': 'estates', 'planter-choice': 'estates', 'planter-worker': 'mine',
  'builder-choice': 'buildings-1',
  'recruiter-advantage': 'mine', 'recruiter-placement': 'mine',
  'craftsman-production': 'mine', 'craftsman-bonus': 'mine',
  'trader-choice': 'depot',
  'captain-loading': 'boats', 'captain-retention': 'mine',
};

/** Camera target for the viewer's own decision, or null (role choice stays where the player is looking). */
export function actionView(view: PlayerView, deciding: boolean): { view: BoardView; playerId?: string } | null {
  const target = deciding ? ACTION_VIEW[view.phase.kind] : undefined;
  if (!target) return null;
  return target === 'mine' ? { view: target, playerId: view.viewer.playerId } : { view: target };
}
