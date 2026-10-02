// One-off conversion for the inspected Meshy coffee GLB; preserves UVs and textures.
import fs from 'node:fs';
import { MeshoptSimplifier as S } from '../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/meshopt_simplifier.js';
import { gzipSync } from 'node:zlib';
const outputDir = new URL('../../apps/web/public/art/runtime/',import.meta.url);fs.mkdirSync(outputDir,{recursive:true});
const report={};
for(const {name} of JSON.parse(fs.readFileSync(new URL('manifest.json',import.meta.url)))){
const source=fs.readFileSync('/tmp/rico-runtime/'+name+'.glb');
if(name.endsWith('Command Tile')){fs.writeFileSync(new URL(encodeURIComponent(name)+'.glb.gz',outputDir),gzipSync(source));report[name]={triangles:80,bytes:gzipSync(source).length};continue;}
const jsonLength = source.readUInt32LE(12);
const doc = JSON.parse(source.subarray(20, 20 + jsonLength));
const bin = source.subarray(28 + jsonLength);
if (doc.meshes.length !== 1 || doc.meshes[0].primitives.length !== 1) throw Error('Unexpected mesh layout');
const p = doc.meshes[0].primitives[0];
function array(id, Type) {
  const a = doc.accessors[id], v = doc.bufferViews[a.bufferView];
  if (v.byteStride || a.sparse) throw Error('Unsupported accessor layout');
  const bytes = bin.subarray((v.byteOffset || 0) + (a.byteOffset || 0), (v.byteOffset || 0) + v.byteLength);
  return new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
await S.ready;
const positions = array(p.attributes.POSITION, Float32Array);
const uvs = array(p.attributes.TEXCOORD_0, Float32Array);
const normals = array(p.attributes.NORMAL, Float32Array);
const attributes = new Float32Array(uvs.length / 2 * 5);
for(let i=0;i<uvs.length/2;i++) {attributes.set(uvs.subarray(i*2,i*2+2),i*5);attributes.set(normals.subarray(i*3,i*3+3),i*5+2);}
// The 60k trial damaged thin leaf surfaces. Lock boundaries and let the error
// limit stop above the requested count rather than forcing the mesh down.
const [indices, error] = S.simplifyWithAttributes(array(p.indices, Uint32Array), positions, 3, attributes, 5, [0.5, 0.5, 0.25, 0.25, 0.25], null, 12000 * 3, 0.003, ['LockBorder']);
const [remap, count] = S.compactMesh(indices);
const replacements = new Map();
for (const id of Object.values(p.attributes)) {
  const a = doc.accessors[id], old = array(id, Float32Array);
  const width = a.type === 'VEC2' ? 2 : 3;
  const next = new Float32Array(count * width);
  for (let i = 0; i < remap.length; i++) if (remap[i] < count) next.set(old.subarray(i * width, i * width + width), remap[i] * width);
  replacements.set(a.bufferView, Buffer.from(next.buffer)); a.count = count;
  a.min = Array.from({length: width}, (_, c) => {let v=Infinity;for(let i=c;i<next.length;i+=width)v=Math.min(v,next[i]);return v;});
  a.max = Array.from({length: width}, (_, c) => {let v=-Infinity;for(let i=c;i<next.length;i+=width)v=Math.max(v,next[i]);return v;});
}
doc.accessors[p.indices].count = indices.length;
replacements.set(doc.accessors[p.indices].bufferView, Buffer.from(indices.buffer));
const chunks = []; let offset = 0;
for (let i = 0; i < doc.bufferViews.length; i++) {
  const v = doc.bufferViews[i];
  const data = replacements.get(i) || bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  v.byteOffset = offset; v.byteLength = data.length;
  chunks.push(data); offset += data.length;
  const pad = (4 - offset % 4) % 4; chunks.push(Buffer.alloc(pad)); offset += pad;
}
doc.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(doc));
const padded = Buffer.concat([json, Buffer.alloc((4-json.length%4)%4,32)]);
const header = Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+offset,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh = Buffer.alloc(8);bh.writeUInt32LE(offset);bh.writeUInt32LE(0x004e4942,4);
const output = Buffer.concat([header,padded,bh,...chunks]);
const compressed=gzipSync(output);fs.writeFileSync(new URL(encodeURIComponent(name)+'.glb.gz',outputDir),compressed);report[name]={triangles:indices.length/3,bytes:compressed.length,error};console.log(name,report[name]);
}
fs.writeFileSync(new URL('stats.json',outputDir),JSON.stringify(report,null,2));
