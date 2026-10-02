"""Texture-only UASTC variant. Never writes into art/runtime (the backup)."""
import argparse,gzip,hashlib,io,json,struct,subprocess,tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'apps/web/public/art/runtime';OUT=ROOT/'apps/web/public/art/runtime-ktx2'
ap=argparse.ArgumentParser();ap.add_argument('--toktx',required=True);args=ap.parse_args();OUT.mkdir(exist_ok=True)
report={};checksums={}
def mip_bytes(w,h,block=None):
 total=0
 while True:
  total+=w*h*4 if block is None else ((w+3)//4)*((h+3)//4)*block
  if w==h==1:return total
  w=max(1,w//2);h=max(1,h//2)
for source in sorted(SOURCE.glob('*.glb.gz')):
 name=source.name.removesuffix('.glb.gz');raw=source.read_bytes();checksums[source.name]=hashlib.sha256(raw).hexdigest();data=gzip.decompress(raw);jl=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jl]);binary=data[28+jl:];replacements={};textures=[]
 color_images=set()
 for mat in doc.get('materials',[]):
  for info in [mat.get('pbrMetallicRoughness',{}).get('baseColorTexture'),mat.get('emissiveTexture')]:
   if info:color_images.add(doc['textures'][info['index']]['source'])
 keep=name.endswith('Command Tile');limit=256 if name.startswith('Worker ') or name.endswith(' Crate') else 512
 with tempfile.TemporaryDirectory(prefix='rico-ktx-') as temp:
  for i,image in enumerate(doc['images']):
   v=doc['bufferViews'][image['bufferView']];im=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]));ow,oh=im.size
   im.thumbnail((limit,limit),Image.Resampling.LANCZOS);w,h=im.size
   row=dict(original=[ow,oh],size=[w,h],beforeRGBA=mip_bytes(ow,oh),afterRGBA=mip_bytes(w,h))
   if keep:
    row.update(after8bit=row['beforeRGBA'],after4bit=row['beforeRGBA']);textures.append(row);continue
   inp=Path(temp)/f'{i}.png';dest=Path(temp)/f'{i}.ktx2';im.save(inp)
   cmd=[args.toktx,'--t2','--encode','uastc','--uastc_quality','2','--zcmp','18','--genmipmap','--assign_oetf','srgb' if i in color_images else 'linear','--assign_primaries','bt709','--threads','2',str(dest),str(inp)]
   subprocess.run(cmd,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   result=dest.read_bytes();assert result[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
   replacements[image['bufferView']]=result;image['mimeType']='image/ktx2';row.update(after8bit=mip_bytes(w,h,16),after4bit=mip_bytes(w,h,8));textures.append(row)
 if keep:output=raw
 else:
  for tex in doc['textures']:
   tex.setdefault('extensions',{})['KHR_texture_basisu']={'source':tex.pop('source')}
  for key in ['extensionsUsed','extensionsRequired']:
   doc[key]=list(dict.fromkeys(doc.get(key,[])+['KHR_texture_basisu']))
  chunks=bytearray()
  for idx,v in enumerate(doc['bufferViews']):
   b=replacements.get(idx,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=len(chunks);v['byteLength']=len(b);chunks.extend(b);chunks.extend(b'\0'*((-len(chunks))%4))
  doc['buffers'][0]['byteLength']=len(chunks);j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
  output=gzip.compress(struct.pack('<III',0x46546c67,2,28+len(j)+len(chunks))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(chunks),0x004e4942)+chunks,mtime=0)
 (OUT/source.name).write_bytes(output);report[name]=dict(originalDownload=len(raw),download=len(output),textures=textures,unchanged=keep)
 print(name, len(output),flush=True)
(OUT/'stats.json').write_text(json.dumps(report,indent=2)+'\n');(ROOT/'assets/runtime/backup-sha256.json').write_text(json.dumps(checksums,indent=2)+'\n')
summary={k:sum(t[k] for r in report.values() for t in r['textures']) for k in ['beforeRGBA','afterRGBA','after8bit','after4bit']};summary.update(originalDownload=sum(r['originalDownload'] for r in report.values()),download=sum(r['download'] for r in report.values()))
(ROOT/'assets/runtime/compression-estimate.json').write_text(json.dumps(summary,indent=2)+'\n');print(summary)
