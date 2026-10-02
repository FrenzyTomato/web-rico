// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeModel } from './modelBytes.js';
import { gunzipSync } from 'node:zlib';
import { BUILDING_MODEL, ESTATE_MODEL, GOODS_MODEL, ROLE_MODEL } from './modelCatalog.js';
import { BUILDING_ORDER } from './pieces.js';

describe('runtime art coverage', () => {
  it('maps every catalog building and uses bananas for fruit', () => {
    expect(Object.keys(BUILDING_MODEL).sort()).toEqual([...BUILDING_ORDER].sort());
    expect(ESTATE_MODEL.fruit).toBe('Banana Estate');
    expect(GOODS_MODEL.fruit).toBe('Banana Crate');
  });
  it('every scene asset is a self-contained, decompressible GLB', () => {
    const names = [...Object.values(BUILDING_MODEL), ...Object.values(ESTATE_MODEL), ...Object.values(GOODS_MODEL), ...Object.values(ROLE_MODEL),
      ...[4,5,6,7,8].map(n => `${n}-Slot Boat`), ...[1,2,3,4,5].map(n => `Worker ${String(n).padStart(2,'0')}`), 'Private Boat', 'Trader Depot'];
    expect(new Set(names).size).toBe(53);
    for (const name of names) {
      const bytes = gunzipSync(readFileSync(`public/art/runtime/${name}.glb.gz`));
      expect(bytes.readUInt32LE(0), name).toBe(0x46546c67);
      expect(bytes.readUInt32LE(8), name).toBe(bytes.length);
      const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      expect(doc.images.every((image: { uri?: string; bufferView?: number }) => image.uri === undefined && image.bufferView !== undefined), name).toBe(true);
    }
  });
});

it('accepts raw gzip and HTTP-decoded model responses, and rejects bad responses', async () => {
  const compressed = readFileSync('public/art/runtime/City Hall.glb.gz');
  const plain = gunzipSync(compressed);
  const asArrayBuffer = (b: Uint8Array) => Uint8Array.from(b).buffer;
  expect(new Uint8Array(await decodeModel(asArrayBuffer(compressed)))).toEqual(new Uint8Array(plain));
  expect(new Uint8Array(await decodeModel(asArrayBuffer(plain)))).toEqual(new Uint8Array(plain));
  await expect(decodeModel(new TextEncoder().encode('404 missing').buffer)).rejects.toThrow('Invalid model response');
});
