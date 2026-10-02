/** A failed compressed asset must never prevent the existing art from loading. */
export async function withArtBackup<T>(compressed: () => Promise<T>, original: () => Promise<T>): Promise<T> {
  try { return await compressed(); } catch { return original(); }
}
