"""Derive a separate board-scale asset. The original market is never overwritten."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/art/blender-market'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/market.blend'))
# Simplify material groups: rounded produce and basket rings benefit most.
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('board scale simplification','DECIMATE');mod.ratio=.28 if any(n in o.name for n in ['orange','green','corn','sack']) else .48
 bpy.ops.object.modifier_apply(modifier=mod.name)
# Small board pieces do not need a large atlas. Blender downsamples its own packed texture.
for im in bpy.data.images:
 if im.source=='FILE' and im.size[0]>256:
  if im.packed_file: im.unpack(method='REMOVE')
  im.scale(256,256);im.filepath_raw=str(OUT/'market-lite-atlas.png');im.file_format='PNG';im.save();im.reload();im.pack()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/market-lite.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'market-lite.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
(OUT/'stats-lite.json').write_text(json.dumps({'triangles':triangles,'meshes':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'glbBytes':(OUT/'market-lite.glb').stat().st_size},indent=2))
print('LITE_COMPLETE',triangles)
