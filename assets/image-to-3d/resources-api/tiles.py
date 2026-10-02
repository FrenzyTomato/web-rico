"""Build thin, rounded GLB command tiles with the exact imported face artwork."""
import json,struct,math
from pathlib import Path
from PIL import Image
P=Path(__file__).parent; OUT=P.resolve().parents[2]/'apps/web/public/art/meshy-resources';OUT.mkdir(parents=True,exist_ok=True)
for item in json.loads((P/'manifest.json').read_text()):
 if item['method']!='local-textured-tile':continue
 path=P/item['reference'];im=Image.open(path);w=1.;d=im.height/im.width;h=.035;r=.045
 ring=[]
 for cx,cz,start in [(w/2-r,-d/2+r,-90),(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180)]:
  for i in range(5):
   a=math.radians(start+i*90/4);ring.append((cx+r*math.cos(a),cz+r*math.sin(a)))
 blob=bytearray();views=[];acc=[]
 def view(data,target=None):
  while len(blob)%4:blob.append(0)
  v=dict(buffer=0,byteOffset=len(blob),byteLength=len(data));blob.extend(data)
  if target:v['target']=target
  views.append(v);return len(views)-1
 def accessor(values,n,typ,component=5126):
  v=view(struct.pack('<'+str(len(values))+('f' if component==5126 else 'H'),*values),34962 if component==5126 else 34963)
  a=dict(bufferView=v,componentType=component,count=len(values)//n,type=typ)
  if typ=='VEC3':a.update(min=[min(values[j::n]) for j in range(n)],max=[max(values[j::n]) for j in range(n)])
  acc.append(a);return len(acc)-1
 def primitive(positions,normals,uv,idx,mat):
  attrs=dict(POSITION=accessor(positions,3,'VEC3'),NORMAL=accessor(normals,3,'VEC3'))
  if uv:attrs['TEXCOORD_0']=accessor(uv,2,'VEC2')
  return dict(attributes=attrs,indices=accessor(idx,1,'SCALAR',5123),material=mat)
 count=len(ring);pos=[0,h,0];norm=[0,1,0];uv=[.5,.5];indices=[]
 for x,z in ring:pos.extend([x,h,z]);norm.extend([0,1,0]);uv.extend([x/w+.5,z/d+.5])
 for i in range(count):indices.extend([0,(i+1)%count+1,i+1])
 top=primitive(pos,norm,uv,indices,0)
 pos=[];norm=[];indices=[]
 for i,(x,z) in enumerate(ring):
  xx,zz=ring[(i+1)%count];dx=xx-x;dz=zz-z;l=math.hypot(dx,dz);base=len(pos)//3
  pos.extend([x,0,z,xx,0,zz,xx,h,zz,x,h,z]);norm.extend([dz/l,0,-dx/l]*4);indices.extend([base,base+1,base+2,base,base+2,base+3])
 base=len(pos)//3;pos.extend([0,0,0]);norm.extend([0,-1,0])
 for x,z in ring:pos.extend([x,0,z]);norm.extend([0,-1,0])
 for i in range(count):indices.extend([base,base+i+1,base+(i+1)%count+1])
 body=primitive(pos,norm,None,indices,1);imgview=view(path.read_bytes())
 doc=dict(asset=dict(version='2.0',generator='Vibe Rico textured tile'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0,name=item['name'])],meshes=[dict(primitives=[top,body])],buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=acc,images=[dict(bufferView=imgview,mimeType='image/png')],textures=[dict(source=0,sampler=0)],samplers=[dict(magFilter=9729,minFilter=9987,wrapS=33071,wrapT=33071)],materials=[dict(name='Original printed artwork',pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=.8)),dict(name='Warm cardboard edges and back',pbrMetallicRoughness=dict(baseColorFactor=[.55,.35,.17,1],metallicFactor=0,roughnessFactor=.95))])
 j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
 out=struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
 (OUT/item['file']).write_bytes(out);print(item['name'],len(out),'bytes')
