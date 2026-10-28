import { createReplay, replay } from '@vibe-rico/game-engine';
import type { GameCommand, GameState, PlayerId } from '@vibe-rico/game-engine';
import type { LobbyResult } from './lobby.js';
import type { RoomStore } from './store.js';

/**
 * Takes back the requester's role choice while nothing has followed it: the last accepted command must be their
 * own `choose-role`. The game is rebuilt from history without it, so the role, its bonus coins and the turn return.
 * Other seats saw the choice briefly; nothing hidden is revealed beyond that. Run inside the room queue.
 */
export async function rewindRole(store: RoomStore, roomId: string, playerId: PlayerId): Promise<LobbyResult<GameState>> {
  const stored = await store.get(roomId);
  if (!stored) return { ok: false, code: 'ROOM_CLOSED' };
  const { room, revision } = stored;
  const game = room.game;
  const last = game?.commands.at(-1);
  if (!game || !last || last.playerId !== playerId || last.action.kind !== 'choose-role') return { ok: false, code: 'ILLEGAL_COMMAND' };
  const commands = game.commands.slice(0, -1);
  const rebuilt = replay(createReplay(game.initialState, commands.map(c => ({ ...c.action, actorId: c.playerId }) as GameCommand), game.seed));
  if (!rebuilt.ok) return { ok: false, code: 'ILLEGAL_COMMAND' };
  if (await store.update({ ...room, game: { ...game, state: rebuilt.state, commands } }, revision) === 'stale') return { ok: false, code: 'STALE_REVISION' };
  return { ok: true, value: rebuilt.state };
}
