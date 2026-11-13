"""Verifica la integridad GLB / PNG del mini-pack Comercio 02 (sin cambios al motor)."""
from pathlib import Path
import json
import struct
import sys
import trimesh
from PIL import Image

ROOT=Path(__file__).resolve().parent
catalog=json.loads((ROOT/'catalogo_muebles.json').read_text(encoding='utf-8'))
assert catalog['schema']=='forest-horror-furniture-catalog-v1'
assert len(catalog['furniture'])==8
assert len({x['id'] for x in catalog['furniture']})==8

total=0
for item in catalog['furniture']:
    p=ROOT/item['glb'];thumb=ROOT/item['thumbnail']
    assert p.exists() and p.stat().st_size>2000,p
    assert thumb.exists() and thumb.stat().st_size>1000,thumb
    with Image.open(thumb) as im:
        assert im.size==(320,320) and im.mode=='RGBA',(thumb,im.size,im.mode)
        assert im.getbbox() is not None, thumb
    data=p.read_bytes()
    magic,version,length=struct.unpack_from('<III',data,0)
    assert magic==0x46546C67 and version==2 and length==len(data)
    json_bytes,json_chunk_type=struct.unpack_from('<II',data,12)
    assert json_chunk_type==0x4E4F534A
    gltf=json.loads(data[20:20+json_bytes])
    assert len(gltf.get('meshes',[]))==1
    assert len(gltf.get('materials',[]))==1
    assert len(gltf.get('textures',[]))==1
    assert len(gltf.get('images',[]))==1
    assert len(gltf.get('samplers',[]))==1
    assert gltf['samplers'][0].get('magFilter')==9728
    assert gltf['samplers'][0].get('minFilter')==9728
    assert gltf['materials'][0].get('alphaMode')=='OPAQUE'
    s=trimesh.load(p,force='scene')
    assert len(s.geometry)==1
    mesh=next(iter(s.geometry.values()))
    assert mesh.visual.kind=='texture'
    assert mesh.visual.uv.shape[0]==len(mesh.vertices)
    assert mesh.visual.material.baseColorTexture.size==(256,256)
    bounds=s.bounds
    width,height,depth=(bounds[1]-bounds[0])/0.3048
    assert width<=item['widthFt']+.021 and height<=item['heightFt']+.021 and depth<=item['depthFt']+.021,(item['id'],width,height,depth)
    assert bounds[0,1] >= -.021*0.3048,item['id']
    assert (bounds[1,1]-bounds[0,1])> .3048*.6,item['id']
    total+=len(mesh.faces)
    print('PASS',item['id'],len(mesh.faces),'tris')
assert total<=1500
print('PASS: 8 GLB, 8 miniaturas reales RGBA, atlas embebido 256x256, NEAREST, Y arriba, 1 mesh/material')
print('TOTAL:',total,'triángulos')
