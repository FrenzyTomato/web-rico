import type { Room, RoomStore, StoredRoom } from './store.js';

export class InMemoryRoomStore implements RoomStore {
  readonly #rooms = new Map<string, StoredRoom>();
  readonly #codes = new Map<string, string>();

  async create(room: Room): Promise<boolean> {
    if (this.#rooms.has(room.roomId) || this.#codes.has(room.roomCode)) return false;
    this.#rooms.set(room.roomId, { room, revision: 0 });
    this.#codes.set(room.roomCode, room.roomId);
    return true;
  }
  async get(roomId: string): Promise<StoredRoom | undefined> { return this.#rooms.get(roomId); }
  async findByCode(roomCode: string): Promise<StoredRoom | undefined> {
    const roomId = this.#codes.get(roomCode);
    return roomId === undefined ? undefined : this.#rooms.get(roomId);
  }
  async update(room: Room, expectedRevision: number): Promise<'ok' | 'stale'> {
    const current = this.#rooms.get(room.roomId);
    if (!current || current.revision !== expectedRevision) return 'stale';
    this.#rooms.set(room.roomId, { room, revision: expectedRevision + 1 });
    return 'ok';
  }
  async delete(roomId: string, expectedRevision: number): Promise<'ok' | 'stale'> {
    const current = this.#rooms.get(roomId);
    if (!current || current.revision !== expectedRevision) return 'stale';
    this.#rooms.delete(roomId);
    this.#codes.delete(current.room.roomCode);
    return 'ok';
  }
}
