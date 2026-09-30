/** One serial queue per room (PROTOCOL.md step 2): a room's tasks run one at a time, in arrival order. */
export class RoomQueues {
  readonly #tails = new Map<string, Promise<void>>();

  run<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const result = (this.#tails.get(roomId) ?? Promise.resolve()).then(task);
    // A failed task must not block later tasks in the same room.
    const tail = result.then(() => {}, () => {});
    this.#tails.set(roomId, tail);
    void tail.then(() => { if (this.#tails.get(roomId) === tail) this.#tails.delete(roomId); });
    return result;
  }
}
