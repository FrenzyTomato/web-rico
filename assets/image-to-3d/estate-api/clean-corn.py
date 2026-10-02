import json,struct,collections
from pathlib import Path
p=Path(__file__).resolve().parents[3] / 'apps/web/public/art/meshy-estates/corn.glb';data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];d=json.loads(data[20:20+n]);b=data[28+n:]
prim=d['meshes'][0]['primitives'][0]
def arr(aid,fmt,width):
 a=d['accessors'][aid];v=d['bufferViews'][a['bufferView']];return list(struct.iter_unpack('<'+fmt*width,b[v.get('byteOffset',0)+a.get('byteOffset',0):v.get('byteOffset',0)+a.get('byteOffset',0)+a['count']*struct.calcsize(fmt)*width]))
pos=arr(prim['attributes']['POSITION'],'f',3);ix=[v[0] for v in arr(prim['indices'],'I',1)];parent=list(range(len(pos)))
def root(a):
 while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
 return a

def join(a,b):
 a=root(a);b=root(b)
 if a!=b:parent[b]=a
seen={}
for i,v in enumerate(pos):
 key=tuple(round(x,6) for x in v)
 if key in seen:join(i,seen[key])
 else:seen[key]=i
for i in range(0,len(ix),3):join(ix[i],ix[i+1]);join(ix[i],ix[i+2])
comps=collections.defaultdict(list)
for i in range(0,len(ix),3):comps[root(ix[i])].append(i)
ranked=sorted(comps.values(),key=len,reverse=True)
for k,faces in enumerate(ranked[:25]):
 vertices=set(ix[i+j] for i in faces for j in range(3));lo=[min(pos[v][j] for v in vertices) for j in range(3)];hi=[max(pos[v][j] for v in vertices) for j in range(3)];print(k,len(faces),'min',list(map(lambda x:round(x,4),lo)),'max',list(map(lambda x:round(x,4),hi)))
print('components',len(ranked))

# Remove only the two inspected floating leaves. The smaller interior components
# remain: a largest-component-only filter would incorrectly remove valid details.
assert [len(v) for v in ranked] == [479154, 6824, 5632, 1708, 1580], 'Source changed; re-inspect components'
removed=set(ranked[1]+ranked[2])
kept=[ix[i+j] for i in range(0,len(ix),3) if i not in removed for j in range(3)]
a=d['accessors'][prim['indices']];a['count']=len(kept)
index_view=a['bufferView'];assert a.get('byteOffset',0)==0
replacement=struct.pack('<'+str(len(kept))+'I',*kept)
chunks=[];offset=0
for i,v in enumerate(d['bufferViews']):
 old_offset=v.get('byteOffset',0);chunk=replacement if i==index_view else b[old_offset:old_offset+v['byteLength']]
 v['byteOffset']=offset;v['byteLength']=len(chunk);chunks.append(chunk);offset+=len(chunk)
 pad=(-offset)%4;chunks.append(bytes(pad));offset+=pad
# Unused vertices are intentionally retained; all surviving vertex/UV/normal and
# texture payloads remain byte-identical to the original.
d['buffers'][0]['byteLength']=offset
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<IIIII',0x46546c67,2,28+len(j)+offset,len(j),0x4e4f534a)+j+struct.pack('<II',offset,0x004e4942)+b''.join(chunks)
out=p.with_name('corn-cleaned.glb');out.write_bytes(result)
assert len(kept)//3==482442
print('Removed',len(removed),'triangles in exactly two components; saved',out.name)
