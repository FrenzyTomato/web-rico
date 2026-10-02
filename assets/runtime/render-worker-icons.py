"""Render transparent dock portraits from the existing worker models; originals stay intact."""
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
out = ROOT / 'assets/runtime/worker-icons'
out.mkdir(exist_ok=True)
for index in range(1, 6):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'apps/web/public/art/meshy-resources/Worker {index:02}.glb'))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    points = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    centre = (lo + hi) / 2
    size = hi - lo
    bpy.ops.object.camera_add(location=centre + Vector((.35, -3, .5)) * size.z)
    camera = bpy.context.object
    camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = max(size.z, size.x * 256 / 192) * 1.12
    scene.camera = camera
    scene.world = bpy.data.worlds.new('Soft studio'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .8
    for offset, energy, diameter in [((-2,-3,4), 450, 4), ((3,-1,2), 220, 3)]:
        bpy.ops.object.light_add(type='AREA', location=centre + Vector(offset) * size.z)
        lamp = bpy.context.object; lamp.data.energy = energy * size.z**2; lamp.data.shape = 'DISK'; lamp.data.size = diameter * size.z
        lamp.rotation_euler = (centre - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = 192; scene.render.resolution_y = 256; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
    scene.render.filepath = str(out / f'Worker {index:02} Cutout.png')
    bpy.ops.render.render(write_still=True)
