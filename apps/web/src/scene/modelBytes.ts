/** Accept both raw gzip files and responses already decoded by HTTP Content-Encoding. */
export async function decodeModel(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const magic = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
  if (magic[0] === 31 && magic[1] === 139) {
    bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  if (bytes.byteLength < 20 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw Error('Invalid model response');
  return bytes;
}
