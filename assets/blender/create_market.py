"""Original lightweight market: run with Blender --background --python this_file."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
random.seed(1897)
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/art/blender-market';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.82
 materials[name]=m;return m
for name,color in {'wood':(.20,.095,.039),'edge':(.34,.18,.075),'stone':(.50,.43,.31),'cream':(.88,.78,.54),'red':(.64,.055,.027),'teal':(.025,.29,.30),'orange':(.95,.30,.015),'green':(.12,.35,.045),'corn':(.92,.62,.055),'sack':(.46,.34,.19),'dark':(.075,.044,.02),'iron':(.07,.085,.08)}.items():mat(name,color)
# Shared original color atlas is packed into the blend and exported GLB.
atlas=bpy.data.images.load(str(ROOT/'apps/web/public/art/blender-market/market-original-atlas.png'));atlas.pack()
for name in ['wood','stone']:
 m=materials[name];tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas;tex.interpolation='Closest';m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def finish(o,name,material):
 o.name=name;o.data.materials.append(materials[material])
 if material in ['wood','stone']:
  if not o.data.uv_layers:o.data.uv_layers.new()
  tile=(.5,0) if material=='wood' else (0,.5)
  # glTF image top-left convention is inverted in Blender UV coordinates.
  for poly in o.data.polygons:
   axis=max(range(3),key=lambda k:abs(poly.normal[k]));axes=[k for k in range(3) if k!=axis]
   coords=[o.data.vertices[o.data.loops[i].vertex_index].co for i in poly.loop_indices]
   for i,co in zip(poly.loop_indices,coords):
    uv=[]
    for k in axes:
     lo=min(c[k] for c in coords);hi=max(c[k] for c in coords);uv.append((co[k]-lo)/max(hi-lo,1e-6))
    o.data.uv_layers.active.data[i].uv=(tile[0]+.02+uv[0]*.46,1-(tile[1]+.02+uv[1]*.46))
 return o
def box(name,loc,scale,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('soft carved edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,material)
def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material)
def cyl(name,loc,r,depth,material,vertices=10):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);return finish(bpy.context.object,name,material)
def beam(name,a,b,width,material='wood'):
 a,b=Vector(a),Vector(b);o=box(name,(a+b)/2,(width,width,(b-a).length),material);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
# Native Blender is Z up. Exporter converts to Three.js Y up.
box('stone plinth',(0,0,.06),(2.25,1.95,.12),'stone',.025)
for x in [-.94,.94]:
 for y in [-.68,.68]:
  box('timber post',(x,y,.96),(.115,.115,1.8),'wood',.012)
  box('post foot iron',(x,y,.22),(.13,.13,.15),'iron')
  beam('diagonal brace',(x,y,1.35),(x*.64,y,1.69),.065)
for y in [-.68,.68]:beam('roof crossbeam',(-1.07,y,1.73),(1.07,y,1.73),.12)
for x in [-.94,.94]:beam('roof side beam',(x,-.85,1.66),(x,.85,1.85),.10)
# Cloth curves gently over the ridge; no roof-shaped box or billboard.
def canopy(name,x0,x1,y0,y1,z0,z1,colors,stripes=10):
 for stripe in range(stripes):
  a=x0+(x1-x0)*stripe/stripes;b=x0+(x1-x0)*(stripe+1)/stripes;verts=[];faces=[]
  for j in range(9):
   t=j/8;y=y0+(y1-y0)*t;z=z0+(z1-z0)*t-.11*math.sin(math.pi*t)
   verts.extend([(a,y,z),(b,y,z)])
  for j in range(8):faces.append((j*2,j*2+1,j*2+3,j*2+2))
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,colors[stripe%len(colors)])
  solid=o.modifiers.new('cloth thickness','SOLIDIFY');solid.thickness=.008;bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=solid.name);o.select_set(False)
  box('cloth valance',((a+b)/2,y0,z0-.06),(b-a,.015,.12),colors[stripe%len(colors)])
canopy('red striped curved canopy',-1.08,1.08,-.95,.02,1.72,2.10,['red','cream'])
canopy('rear canopy',-1.08,1.08,.02,.88,2.10,1.79,['red','cream'])
# Side teal awning and its supports.
canopy('teal side canopy',1.0,1.62,-.55,.55,1.34,1.45,['teal','cream'],4)
for y in [-.55,.55]:box('side stall post',(1.55,y,.74),(.06,.06,1.28),'wood')
# Open shelving at rear makes the back a finished view too.
for z in [.37,.75,1.12]:box('back shelf',(0,.60,z),(1.70,.27,.055),'wood')
for x in [-.76,0,.76]:box('rear upright',(x,.70,.75),(.055,.055,1.15),'wood')
for y in [-.60,.10]:
 box('counter top',(0,y,.64),(1.65,.43,.075),'wood',.012)
 for x in [-.70,.70]:box('counter leg',(x,y,.35),(.07,.30,.50),'wood')
def crate(x,y,z,kind,index):
 box('crate bottom',(x,y,z),(.42,.32,.035),'wood')
 for side in [-1,1]:
  for h in [.065,.14]:
   box('crate slat',(x+side*.22,y,z+h),(.035,.35,.045),'edge')
   box('crate slat',(x,y+side*.175,z+h),(.47,.03,.045),'wood')
 for j in range(9):
  px=x+(j%3-1)*.115;py=y+(j//3-1)*.085
  sphere('produce '+kind,(px,py,z+.115+random.random()*.025),(.063,.054,.10 if kind=='corn' else .057),kind)
for row,y in enumerate([-.6,.1]):
 for i,x in enumerate([-.53,0,.53]):crate(x,y,.70,['orange','green','corn'][(i+row)%3],i)
for x in [-.52,0,.52]:
 for z in [.48,.87]:sphere('storage sack',(x,.58,z),(.13,.12,.16),'sack')
for x,y in [(-.85,-.94),(-1.0,.2),(1.32,-.22)]:
 sphere('sack',(x,y,.31),(.16,.14,.21),'sack');cyl('sack mouth',(x,y,.5),.075,.03,'dark')
for x,y in [(-.48,-1.02),(.03,-1.02)]:
 cyl('produce basket',(x,y,.24),.18,.23,'edge',12)
 for z in [.15,.23,.31]:
  bpy.ops.mesh.primitive_torus_add(major_radius=.18,minor_radius=.012,major_segments=12,minor_segments=4,location=(x,y,z));finish(bpy.context.object,'basket weave band','sack')
 for j in range(5):sphere('basket oranges',(x+math.cos(j*1.25)*.1,y+math.sin(j*1.25)*.1,.38),(.065,.065,.065),'orange')
# Join by material: compact draw-call count while retaining all real geometry.
for material in materials.values():
 bpy.ops.object.select_all(action='DESELECT');items=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
 if items:
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name='Market • '+material.name
bpy.ops.object.select_all(action='SELECT');bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/market.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'market.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
(OUT/'stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'glbBytes':(OUT/'market.glb').stat().st_size},indent=2))
print('MARKET_COMPLETE',triangles)
