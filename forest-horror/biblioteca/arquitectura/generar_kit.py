"""Generador reproducible: cinco GLB estructurales de bajo polígonaje.
Unidades GLB: metros; puerta 1 tile (1.524 m) de ancho y 7 ft (2.1336 m) hoja.
Ventana: 1 tile x 1 tile (1.524 m x 1.524 m), origen en su antepecho.
"""
import io, json, math, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'modelos_glb'; OUT.mkdir(exist_ok=True)
TEXT=ROOT/'texturas'; TEXT.mkdir(exist_ok=True)
WIDTH=1.524
DOOR_H=2.1336
FRAME_H=2.25
WINDOW_H=1.524
RES=(128,128)

PALETTES={
 'puerta_madera':dict(base='#78604a',light='#927658',dark='#49372c',trim='#50443c',trim_hi='#796a55',metal='#a59c80',glass='#55707b'),
 'puerta_metal':dict(base='#73777a',light='#929695',dark='#353e42',trim='#474e51',trim_hi='#7c8587',metal='#c1b5a3',glass='#53666c'),
 'puerta_mirilla':dict(base='#635043',light='#87694b',dark='#302821',trim='#43372e',trim_hi='#6d5946',metal='#c8ac79',glass='#53666c'),
 'ventana_clasica':dict(base='#8a8880',light='#c6bb9a',dark='#4d5555',trim='#676d6c',trim_hi='#a6b0aa',metal='#b9bbb3',glass='#6b8991'),
 'ventana_dividida':dict(base='#947b59',light='#bba37a',dark='#4d473d',trim='#584d40',trim_hi='#b29a75',metal='#c3b08a',glass='#708b90'),
}

def rgb(v): return tuple(bytes.fromhex(v.lstrip('#')))
def blend(a,b,t):return tuple(round(x*(1-t)+y*t) for x,y in zip(rgb(a) if isinstance(a,str) else a,rgb(b) if isinstance(b,str) else b))

def texture(name,kind):
    p=PALETTES[name]; im=Image.new('RGBA',RES,(29,26,23,255));d=ImageDraw.Draw(im)
    d.rectangle((0,0,63,95),fill=p['base'])
    for y in range(0,96,4):
        if kind=='door':
            d.line((0,y,63,y),fill=blend(p['base'],p['dark'],.23),width=1)
            for x in [4,28,53]:
                n=((x*13+y*31)%11)
                if n<4:d.rectangle((x+2,y+1,x+4,y+1),fill=blend(p['base'],p['light'],.31))
        else:
            if y%12==0:d.line((0,y,63,y),fill=blend(p['base'],p['dark'],.09))
    if kind=='door':
        for box in [(6,8,57,44),(6,51,57,86)]:
            d.rectangle(box,outline=p['dark'],width=2)
            x0,y0,x1,y1=box
            d.line((x0+3,y0+3,x1-3,y0+3),fill=p['light'],width=1)
            d.line((x0+3,y0+3,x0+3,y1-3),fill=blend(p['base'],p['light'],.6),width=1)
            d.line((x1-3,y0+3,x1-3,y1-3),fill=blend(p['base'],p['dark'],.7),width=1)
        for ix in range(8):
            xx=(ix*19+13)%54+5;yy=(ix*23+17)%87+4
            d.line((xx,yy,xx+3,yy),fill=blend(p['base'],p['dark'],.35))
        d.rectangle((49,47,54,52),fill=p['metal'],outline=p['dark'])
        if name=='puerta_mirilla':
            d.ellipse((27,18,35,26),fill=p['metal'],outline=p['dark'],width=1)
            d.ellipse((30,21,32,23),fill='#171d20')
        if name=='puerta_metal':
            for yy in (6,91):d.rectangle((3,yy,59,yy+2),fill=blend(p['base'],p['metal'],.26))
    d.rectangle((64,0,95,95),fill=p['trim'])
    for x in (66,68,90,93):d.line((x,0,x,95),fill=blend(p['trim'],p['trim_hi'],.24),width=1)
    for y in range(4,96,12):d.line((68,y,91,y),fill=blend(p['trim'],p['dark'],.18))
    d.rectangle((96,0,127,95),fill=p['metal'])
    for y in range(2,96,5):d.line((98,y,125,y),fill=blend(p['metal'],p['dark'],.13))
    d.rectangle((0,96,63,127),fill=p['dark'])
    d.rectangle((64,96,127,127),fill=p['glass'])
    for xx in (78,107):d.line((xx,98,xx+13,126),fill=blend(p['glass'],'#f4f3df',.22),width=2)
    im.save(TEXT/(name+'.png'))
    return im

class Build:
    def __init__(self):self.v=[];self.uv=[];self.f=[]
    def quad(self,points,uv_rect):
        x0,y0,x1,y1=uv_rect
        coords=[(x0+.5,y1-.5),(x1-.5,y1-.5),(x1-.5,y0+.5),(x0+.5,y0+.5)]
        start=len(self.v)
        self.v.extend(points)
        self.uv.extend([(x/128,1-y/128) for x,y in coords])
        self.f.extend([(start,start+1,start+2),(start,start+2,start+3)])
    def box(self,x,y,z,w,h,d,faces=(0,0,63,95),trim=(64,0,95,95)):
        xa,xb=x-w/2,x+w/2;ya,yb=y-h/2,y+h/2;za,zb=z-d/2,z+d/2
        q=[([(xa,ya,zb),(xb,ya,zb),(xb,yb,zb),(xa,yb,zb)],faces),
           ([(xb,ya,za),(xa,ya,za),(xa,yb,za),(xb,yb,za)],faces),
           ([(xa,ya,za),(xa,ya,zb),(xa,yb,zb),(xa,yb,za)],trim),
           ([(xb,ya,zb),(xb,ya,za),(xb,yb,za),(xb,yb,zb)],trim),
           ([(xa,yb,zb),(xb,yb,zb),(xb,yb,za),(xa,yb,za)],trim),
           ([(xa,ya,za),(xb,ya,za),(xb,ya,zb),(xa,ya,zb)],trim)]
        for vv,uv in q:self.quad(vv,uv)
    def plane(self,x,y,z,w,h,rect=(64,96,127,127)):
        self.quad([(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)],rect)
    def geom(self,name,material):
        mesh=trimesh.Trimesh(vertices=np.array(self.v),faces=np.array(self.f),process=False,validate=False)
        mesh.visual=TextureVisuals(uv=np.array(self.uv),material=material)
        mesh.metadata['name']=name
        return mesh

def glb_nearest(data):
    assert data[0:4]==b'glTF'
    n=struct.unpack_from('<I',data,12)[0]
    j=json.loads(data[20:20+n]);
    for s in j.get('samplers',[]):s.update(magFilter=9728,minFilter=9984,wrapS=33071,wrapT=33071)
    if j.get('textures') and not j.get('samplers'):
        j['samplers']=[dict(magFilter=9728,minFilter=9984,wrapS=33071,wrapT=33071)]
        for tex in j['textures']:tex['sampler']=0
    jb=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode()
    jb+=b' ' * ((4-len(jb)%4)%4)
    remain=data[20+n:]
    out=bytearray(b'glTF'+struct.pack('<II',2,12+8+len(jb)+len(remain))+struct.pack('<I4s',len(jb),b'JSON')+jb+remain)
    assert len(out)==struct.unpack_from('<I',out,8)[0]
    return bytes(out)

def make(name,kind):
    tex=texture(name,kind)
    opaque=PBRMaterial(name='PixelArt_Material',baseColorTexture=tex,metallicFactor=0,roughnessFactor=1.0,doubleSided=False)
    glass=PBRMaterial(name='Vidrio_Transparente',baseColorFactor=[255,255,255,90],baseColorTexture=tex,metallicFactor=0,roughnessFactor=.25,doubleSided=True,alphaMode='BLEND')
    sc=trimesh.Scene()
    if kind=='door':
        frame=Build()
        frame.box(.045,1.115,0,.09,2.23,.13,trim=(64,0,95,95),faces=(64,0,95,95))
        frame.box(WIDTH-.045,1.115,0,.09,2.23,.13,trim=(64,0,95,95),faces=(64,0,95,95))
        frame.box(WIDTH/2,2.217,0,WIDTH,.072,.14,trim=(64,0,95,95),faces=(64,0,95,95))
        leaf=Build(); leaf_w=WIDTH-.16
        leaf.box(WIDTH/2,DOOR_H/2,0,leaf_w,DOOR_H,.060)
        leaf.box(WIDTH-.245,1.025,.07,.052,.080,.049,faces=(96,0,127,95),trim=(96,0,127,95))
        sc.add_geometry(frame.geom('MARCO_FIJO',opaque),node_name='MARCO_FIJO',geom_name='MARCO_FIJO')
        sc.add_geometry(leaf.geom('HOJA_PIVOTE',opaque),node_name='HOJA_PIVOTE',geom_name='HOJA_PIVOTE')
    else:
        frame=Build()
        frame.box(.045,WINDOW_H/2,0,.09,WINDOW_H,.105,faces=(64,0,95,95))
        frame.box(WIDTH-.045,WINDOW_H/2,0,.09,WINDOW_H,.105,faces=(64,0,95,95))
        frame.box(WIDTH/2,.047,0,WIDTH,.095,.105,faces=(64,0,95,95))
        frame.box(WIDTH/2,WINDOW_H-.047,0,WIDTH,.095,.105,faces=(64,0,95,95))
        if name=='ventana_dividida':
            frame.box(WIDTH/2,WINDOW_H/2,0,.065,WINDOW_H,.11,faces=(64,0,95,95))
            frame.box(WIDTH/2,WINDOW_H/2,0,WIDTH,.060,.11,faces=(64,0,95,95))
        pane=Build();pane.plane(WIDTH/2,WINDOW_H/2,-.012,WIDTH-.13,WINDOW_H-.13,rect=(64,96,127,127))
        sc.add_geometry(frame.geom('MARCO_FIJO',opaque),node_name='MARCO_FIJO',geom_name='MARCO_FIJO')
        sc.add_geometry(pane.geom('VIDRIO',glass),node_name='VIDRIO',geom_name='VIDRIO')
    bin=glb_nearest(sc.export(file_type='glb'))
    (OUT/(name+'.glb')).write_bytes(bin)
    verify=trimesh.load(OUT/(name+'.glb'),force='scene')
    n=struct.unpack_from('<I',bin,12)[0]
    gltf=json.loads(bin[20:20+n])
    return dict(id=name,tipo=kind,triangulos=sum(len(g.faces) for g in verify.geometry.values()),mallas=len(gltf.get('meshes',[])),materiales=len(gltf.get('materials',[])),nodos=list(verify.graph.nodes_geometry),bytes=len(bin))

if __name__=='__main__':
    info=[make(n,'door' if n.startswith('puerta') else 'window') for n in PALETTES]
    (ROOT/'reporte_topologia_arquitectura.json').write_text(json.dumps({'glb':info},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(info,ensure_ascii=False,indent=2))
