"""Verify unchanged backups and exact geometry preservation across the texture variant."""
from pathlib import Path
import gzip,json,struct,hashlib
ROOT=Path(__file__).resolve().parents[2];art=ROOT/'apps/web/public/art';checks=json.loads((ROOT/'assets/runtime/backup-sha256.json').read_text())
def read(p):
 b=gzip.decompress(p.read_bytes());assert struct.unpack_from('<I',b,8)[0]==len(b);n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def view(d,b,i):
 v=d['bufferViews'][i];return b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
assert len(checks)==53
for name,sha in checks.items():
 before=art/'runtime'/name;after=art/'runtime-ktx2'/name;assert hashlib.sha256(before.read_bytes()).hexdigest()==sha,name
 a,ab=read(before);d,db=read(after);assert a['accessors']==d['accessors'] and a['meshes']==d['meshes'],name
 images={im['bufferView'] for im in a['images']}
 for i in range(len(a['bufferViews'])):
  if i not in images:assert view(a,ab,i)==view(d,db,i),name
 if 'Command Tile' in name:assert before.read_bytes()==after.read_bytes(),name
 else:
  assert 'KHR_texture_basisu' in d['extensionsRequired']
  for texture in d['textures']:assert 'KHR_texture_basisu' in texture['extensions'] and 'source' not in texture
  for im in d['images']:
   assert im['mimeType']=='image/ktx2';blob=view(d,db,im['bufferView']);assert blob[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
   assert struct.unpack_from('<I',blob,40)[0]>=9
print('53 backups unchanged; 53 models preserve geometry; KTX2 containers and command tiles verified.')
