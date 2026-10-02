"""Validate downloaded GLB structure and write review stats (no model edits)."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'apps/web/public/art/meshy-resources'
stats = {}
for item in json.loads((Path(__file__).parent / 'manifest.json').read_text()):
    name = item['name']
    file = OUTPUT / item['file']
    if not file.exists():
        continue
    data = file.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + size])
    bin_size, bin_kind = struct.unpack_from('<II', data, 20 + size)
    assert bin_kind == 0x004E4942
    binary = data[28 + size:28 + size + bin_size]
    assert len(binary) == bin_size
    for view in doc.get('bufferViews', []):
        assert view.get('buffer', 0) == 0
        assert view.get('byteOffset', 0) + view['byteLength'] <= len(binary)
    triangles = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            vertex_count = doc['accessors'][primitive['attributes']['POSITION']]['count']
            if 'indices' in primitive:
                a = doc['accessors'][primitive['indices']]
                view = doc['bufferViews'][a['bufferView']]
                code = {5121: 'B', 5123: 'H', 5125: 'I'}[a['componentType']]
                assert not view.get('byteStride') and not a.get('sparse')
                indices = struct.unpack_from('<' + str(a['count']) + code, binary, view.get('byteOffset', 0) + a.get('byteOffset', 0))
                assert max(indices) < vertex_count and len(indices) % 3 == 0
                triangles += len(indices) // 3
            else:
                triangles += vertex_count // 3
    assert doc.get('images') and doc.get('materials'), 'Expected textured model'
    for image in doc['images']:
        assert 'bufferView' in image, 'Expected self-contained textures'
    stats[name] = {'triangles': triangles, 'bytes': len(data), 'textures': len(doc['images']), 'sha256': hashlib.sha256(data).hexdigest()}
    print(f'{name}: {triangles:,} triangles; {len(data)/1e6:.1f} MB; {len(doc["images"])} embedded textures')
OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / 'stats.json').write_text(json.dumps(stats, indent=2) + '\n')
