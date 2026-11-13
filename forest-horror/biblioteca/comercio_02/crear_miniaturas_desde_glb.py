"""Renderizador isométrico pixelado de miniaturas DESDE los GLB exportados.
Carga mallas, triangulación, UV y atlas embebido en cada modelo. Z-buffer por píxel;
los cilindros (mesa redonda, platos, etc.) ya no se reducen a un punto.
Requisitos: numpy, pillow, trimesh. Mantiene PNG RGBA transparentes.
"""
import json
import math
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'miniaturas'
OUT.mkdir(exist_ok=True)
CATALOG=[x for x in json.loads((ROOT/'catalogo_muebles.json').read_text(encoding='utf8'))['furniture'] if x['pack']=='comercio_02']
SIZE=160
SCALE=2
LIGHT=np.array([.42,.87,.27],dtype=np.float64)
LIGHT/=np.linalg.norm(LIGHT)


def proj(v):
    v=np.asarray(v)
    return np.column_stack(((v[:,0]-v[:,2])*.70710678118, -v[:,1]*.90+(v[:,0]+v[:,2])*.41))


def dep(v):
    v=np.asarray(v)
    return (v[:,0]+v[:,2])*.636 + v[:,1]*.580


def render(path):
    scene=trimesh.load(path,force='scene')
    meshes=scene.dump()
    assert len(meshes)==1, (path,len(meshes))
    mesh=meshes[0]
    xyz=np.asarray(mesh.vertices,dtype=np.float64)
    xy=proj(xyz)
    mins=xy.min(axis=0);maxs=xy.max(axis=0)
    span=max(np.max(maxs-mins),.01)
    zoom=126/span
    pts=(xy-(mins+maxs)/2)*zoom + np.array([SIZE/2,SIZE/2])
    zz=dep(xyz)
    uv=np.asarray(mesh.visual.uv,dtype=np.float64)
    assert len(uv)==len(xyz)
    material=mesh.visual.material
    tex=np.asarray(material.baseColorTexture.convert('RGB'))
    th,tw=tex.shape[:2]
    zbuf=np.full((SIZE,SIZE),-np.inf,dtype=np.float64)
    out=np.zeros((SIZE,SIZE,4),dtype=np.uint8)
    for face in np.asarray(mesh.faces):
        p=pts[face]
        minx=max(int(math.floor(p[:,0].min())),0);maxx=min(int(math.ceil(p[:,0].max())),SIZE-1)
        miny=max(int(math.floor(p[:,1].min())),0);maxy=min(int(math.ceil(p[:,1].max())),SIZE-1)
        if maxx<minx or maxy<miny:continue
        a,b,c=p
        det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        if abs(det)<1e-10:continue
        yy,xx=np.mgrid[miny:maxy+1,minx:maxx+1]
        # Coordenadas baricéntricas. Evitar grietas entre triángulos compartidos.
        w1=((xx-a[0])*(c[1]-a[1])-(yy-a[1])*(c[0]-a[0]))/det
        w2=((yy-a[1])*(b[0]-a[0])-(xx-a[0])*(b[1]-a[1]))/det
        w0=1-w1-w2
        coverage=(w0>=-1e-5)&(w1>=-1e-5)&(w2>=-1e-5)
        if not coverage.any():continue
        depth=w0*zz[face[0]]+w1*zz[face[1]]+w2*zz[face[2]]
        front=coverage & (depth>zbuf[yy,xx]+1e-8)
        if not front.any():continue
        ys,xs=np.where(front)
        global_ys=ys+miny;global_xs=xs+minx
        uvs=uv[face]
        us=w0[front]*uvs[0,0]+w1[front]*uvs[1,0]+w2[front]*uvs[2,0]
        vs=w0[front]*uvs[0,1]+w1[front]*uvs[1,1]+w2[front]*uvs[2,1]
        ux=np.clip((us*tw).astype(np.int32),0,tw-1)
        vy=np.clip(((1-vs)*th).astype(np.int32),0,th-1)
        normal=np.cross(xyz[face[1]]-xyz[face[0]],xyz[face[2]]-xyz[face[0]])
        norm=np.linalg.norm(normal)
        normal=normal/norm if norm>1e-10 else np.array([0,1,0])
        intensity=np.clip(.71+.34*np.dot(normal,LIGHT),.58,1.08)
        rgb=np.clip(tex[vy,ux].astype(np.float64)*intensity,0,255).astype(np.uint8)
        out[global_ys,global_xs,:3]=rgb
        out[global_ys,global_xs,3]=255
        zbuf[global_ys,global_xs]=depth[front]
    return Image.fromarray(out,'RGBA').resize((SIZE*SCALE,SIZE*SCALE),Image.Resampling.NEAREST)


def font(size,bold=False):
    name='DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:return ImageFont.truetype(name,size)
    except OSError:return ImageFont.load_default()


def sheet(items,path,cols=5):
    w,h=250,295
    rows=math.ceil(len(items)/cols)
    result=Image.new('RGB',(cols*w,rows*h),(23,26,29))
    d=ImageDraw.Draw(result)
    for i,item in enumerate(items):
        x=(i%cols)*w;y=(i//cols)*h
        d.rounded_rectangle((x+7,y+7,x+w-8,y+h-8),radius=10,fill=(38,43,46),outline=(65,70,72),width=1)
        pic=Image.open(OUT/(item['id']+'.png')).convert('RGBA')
        pic.thumbnail((225,225),Image.Resampling.NEAREST)
        result.paste(pic,(x+(w-pic.width)//2,y+8),pic)
        name=item['name']
        if len(name)>28:name=name[:25]+'…'
        d.text((x+16,y+235),name,fill=(228,225,215),font=font(12,True))
        dims=f"{item['widthFt']:g} × {item['depthFt']:g} × {item['heightFt']:g} ft"
        d.text((x+16,y+256),dims,fill=(175,181,178),font=font(11))
    result.save(path,optimize=True)


for item in CATALOG:
    source=ROOT/item['glb']
    target=OUT/(item['id']+'.png')
    result=render(source)
    assert result.getbbox() is not None,item['id']
    result.save(target,optimize=True)
    print(item['id'],result.size,'RGBA')
sheet(CATALOG,ROOT/'hoja_miniaturas_comercio_02.png',cols=4)
all_items=json.loads((ROOT/'catalogo_muebles.json').read_text(encoding='utf8'))['furniture']
# Hoja acumulada no necesaria en un pack suelto
