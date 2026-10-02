"""Create 512px textured intermediate GLBs; source art stays untouched."""
from pathlib import Path
from PIL import Image
import json,struct,io
ROOT=Path(__file__).resolve().parents[2];art=ROOT/'apps/web/public/art';out=Path('/tmp/rico-runtime');out.mkdir(exist_ok=True)
entries=[]
for folder in ['meshy-buildings','meshy-resources']:
 for f in sorted((art/folder).glob('*.glb')):entries.append((f,f.stem))
for name,file in [('Corn Estate','corn-cleaned'),('Banana Estate','banana'),('Sugar Estate','sugar'),('Tobacco Estate','tobacco'),('Quarry','quarry')]:entries.append((art/'meshy-estates'/f'{file}.glb',name))
entries.append((art/'meshy-coffee'/'original.glb','Coffee Estate'))
manifest=[]
for f,name in entries:
 data=f.read_bytes();jl=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jl]);binary=data[28+jl:];replacements={}
 for image in doc['images']:
  idx=image['bufferView'];v=doc['bufferViews'][idx];im=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');im.thumbnail((512,512));buf=io.BytesIO();im.save(buf,format='JPEG',quality=85);replacements[idx]=buf.getvalue();image['mimeType']='image/jpeg'
 chunks=bytearray()
 for idx,v in enumerate(doc['bufferViews']):
  b=replacements.get(idx,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=len(chunks);v['byteLength']=len(b);chunks.extend(b);chunks.extend(b'\0'*((-len(chunks))%4))
 doc['buffers'][0]['byteLength']=len(chunks);j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(j)+len(chunks))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(chunks),0x004e4942)+chunks
 (out/f'{name}.glb').write_bytes(result);manifest.append(dict(name=name,source=str(f.relative_to(ROOT))))
(ROOT/'assets/runtime/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(len(entries),'texture-prepared assets')
