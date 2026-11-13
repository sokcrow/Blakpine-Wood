"""Forest Horror · Comercio 01. Genera 20 GLB low-poly con atlas pixel-art.
Los productos exhibidos son texturas en grupos, no cientos de meshes.
Unidades de autoría: ft. Coordenadas GLB: metros, Y vertical.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import trimesh, json, struct, random, math
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import SimpleMaterial

ROOT=Path(__file__).resolve().parent
DEST=ROOT/'modelos_glb';DEST.mkdir(exist_ok=True)
TEXT=ROOT/'texturas_comercio';TEXT.mkdir(exist_ok=True)
CATALOG=json.loads((ROOT/'catalogo_muebles.json').read_text(encoding='utf8'))
ITEMS={a['id']:a for a in CATALOG['furniture'] if a['pack']=='comercio_02'}
FT=.3048
COLS=4;CELL=64;ATLAS=256

COLORS={
 'wood':(113,81,54),'wood_dark':(65,53,42),'metal':(115,124,123),
 'metal_dark':(57,66,72),'cream':(183,179,150),'plastic':(162,151,116),
 'black':(35,39,42),'red':(153,61,51),'yellow':(210,167,73),
 'green':(81,122,76),'blue':(75,108,124),'slate':(82,87,85),
 'glass':(64,104,109),'white':(200,194,165),'floor':(76,78,69),
 'snacks':(127,74,50),'cereal':(192,150,88),'cans':(102,129,128),
 'bottles':(79,112,115),'candy':(144,75,105),'sign':(198,180,130),
 'screen':(34,66,65),'keypad':(52,60,57),'grate':(75,78,79),
 'receipt':(216,212,185),'register':(135,133,118),'freezer':(117,152,157),
 'basket':(73,111,105),'wire':(92,103,101),'barcode':(210,204,169),
 'frutas':(90,71,52),'frutas2':(84,63,49),'atm':(45,67,78),'atm_frame':(64,88,91),'atm_sign':(95,146,160),'beverage':(71,108,118)
}

def tile(name):
    rng=random.Random(sum((i+13)*ord(v) for i,v in enumerate(name)))
    color=COLORS[name]; img=Image.new('RGB',(32,32),color);d=ImageDraw.Draw(img)
    for _ in range(22):
        x=rng.randrange(32);y=rng.randrange(32)
        delta=rng.choice([-18,-12,-9,9,13,17]); c=tuple(max(0,min(255,v+delta)) for v in color)
        d.rectangle((x,y,min(31,x+rng.randrange(1,4)),y),fill=c)
    if name in ('snacks','cereal','cans','bottles','candy'):
        d.rectangle((0,0,31,31),fill=(52,56,50))
        family={'snacks':[(190,70,49),(219,167,67),(76,120,80),(165,83,82)],
                'cereal':[(198,169,89),(173,98,62),(92,130,156),(176,142,75)],
                'cans':[(170,54,50),(80,143,124),(200,165,84),(79,116,146)],
                'bottles':[(57,116,99),(141,66,56),(91,116,148),(175,152,92)],
                'candy':[(169,87,140),(217,155,84),(83,141,161),(150,92,74)]}[name]
        # Cuatro columnas: fachadas de productos (sin geometría individual).
        for i,x in enumerate(range(2,32,8)):
            c=family[i%len(family)]
            if name=='bottles':
                d.rectangle((x+2,5,x+4,28),fill=c);d.rectangle((x+2,2,x+4,5),fill=(180,182,156));d.rectangle((x+1,15,x+5,18),fill=(217,201,154))
            elif name=='cans':
                d.rounded_rectangle((x,7,x+6,28),radius=2,fill=c)
                d.line((x+1,7,x+5,7),fill=(206,207,193));d.rectangle((x+1,16,x+5,20),fill=(220,198,144))
            elif name=='snacks':
                d.polygon([(x+1,7),(x+6,8),(x+7,28),(x,28)],fill=c)
                d.rectangle((x+1,15,x+5,19),fill=(218,192,134))
            elif name=='cereal':
                d.rectangle((x,4,x+6,28),fill=c);d.rectangle((x+1,11,x+5,15),fill=(232,208,156));d.rectangle((x+1,20,x+5,25),fill=(101,79,51))
            else:
                d.rectangle((x,10,x+6,26),fill=c);d.rectangle((x+1,14,x+5,20),fill=(230,182,142))
        d.rectangle((0,29,31,31),fill=(40,44,41))
    if name=='sign':
        d.rectangle((0,0,31,31),fill=(214,193,135));d.rectangle((2,3,29,28),outline=(128,57,43),width=2)
        d.rectangle((4,8,27,15),fill=(152,65,51));d.rectangle((5,19,25,21),fill=(100,81,54));d.rectangle((5,24,22,25),fill=(100,81,54))
    if name=='screen':
        d.rectangle((2,3,29,28),fill=(24,46,44));d.rectangle((5,6,24,8),fill=(98,157,143));d.rectangle((6,12,19,13),fill=(61,101,86));d.rectangle((6,18,25,19),fill=(61,101,86))
    if name=='keypad':
        d.rectangle((3,3,28,28),fill=(37,42,42))
        for y in range(7,25,6):
            for x in range(6,25,6):d.rectangle((x,y,x+3,y+3),fill=(144,150,136))
    if name=='register':
        d.rectangle((2,2,29,13),fill=(61,75,69));d.rectangle((4,4,27,11),fill=(91,144,123))
        for y in (19,24):
            for x in range(4,28,6):d.rectangle((x,y,x+3,y+3),fill=(88,86,70))
    if name=='grate':
        for y in range(4,30,5):d.line((2,y,29,y),fill=(33,38,39),width=2)
    if name=='barcode':
        d.rectangle((3,4,28,26),fill=(213,209,178))
        for x in range(5,27):
            if rng.random()<.55:d.line((x,7,x,23),fill=(33,39,37),width=rng.choice([1,1,2]))
    if name=='freezer':
        d.rectangle((1,1,30,30),fill=(62,99,108))
        for x in range(5,28,5): d.line((x,2,x-3,29),fill=(133,175,175),width=1)
    if name=='glass':
        d.polygon([(0,0),(11,0),(0,13)],fill=(100,145,149));d.polygon([(17,0),(23,0),(4,32),(0,32)],fill=(91,132,136))
    if name in ('basket','wire'):
        for x in range(3,32,6):d.line((x,0,x,31),fill=(44,59,60),width=1)
        for y in range(3,32,6):d.line((0,y,31,y),fill=(44,59,60),width=1)
    if name in ('frutas','frutas2'):
        d.rectangle((0,0,31,31),fill=(84,65,45));d.rectangle((2,2,29,29),outline=(130,97,59),width=2)
        colors=[(194,65,48),(208,142,48),(202,188,84),(89,145,74)] if name=='frutas' else [(94,149,76),(180,53,43),(224,167,57),(196,160,70)]
        for yy in (7,18):
            for j,xx in enumerate((6,14,22)):
                c=colors[(j+(yy//10))%len(colors)]
                d.ellipse((xx-4,yy-3,xx+4,yy+5), fill=c)
                d.rectangle((xx-1,yy-4,xx+1,yy-3),fill=(70,91,46))
        d.line((3,25,28,25),fill=(128,87,49),width=2)
    if name=='atm':
        d.rectangle((2,3,29,28),fill=(32,52,61))
        d.rectangle((5,6,26,17),fill=(58,136,134));d.rectangle((7,8,22,9),fill=(125,205,180))
        d.rectangle((7,12,22,13),fill=(87,166,142));d.rectangle((7,19,25,20),fill=(151,158,156))
        for yy in (22,25):
            for xx in range(7,24,5):d.rectangle((xx,yy,xx+2,yy+1),fill=(159,166,163))
    if name=='atm_sign':
        d.rectangle((1,1,30,30),fill=(64,107,120));d.rectangle((4,9,27,12),fill=(193,202,184));d.rectangle((5,18,25,20),fill=(179,189,177))
    if name=='beverage':
        d.rectangle((0,0,31,31),fill=(43,59,63))
        for i,x in enumerate(range(3,32,7)):
            col=[(181,58,54),(65,121,153),(206,165,71),(75,139,94)][i%4]
            d.rectangle((x+2,4,x+4,7),fill=(185,194,185));d.rectangle((x,8,x+6,27),fill=col)
            d.rectangle((x+1,16,x+5,20),fill=(213,196,153))
        d.line((0,29,31,29),fill=(102,114,112))
    if name=='receipt':
        for y in (5,10,15,20,25):d.line((4,y,rng.randrange(15,27),y),fill=(94,90,76))
    if name in ('wood','wood_dark'):
        for y in (6,14,22,29):d.line((0,y,31,y+1),fill=tuple(max(0,v-18) for v in color))
    return img.resize((60,60),Image.Resampling.NEAREST)

class Builder:
    def __init__(self):
        self.v=[];self.uv=[];self.faces=[];self.uses=[]
    def quad(self,pts,tex):
        i=len(self.v);self.v.extend(pts);self.uses.append((i,tex))
        self.faces.extend([(i,i+1,i+2),(i,i+2,i+3)])
    def box(self,w,h,d,x,y,z,tex,front=None,top=None,side=None):
        xh=w/2;zh=d/2;yh=h/2
        quads=[
          ([(-xh,-yh,zh),(xh,-yh,zh),(xh,yh,zh),(-xh,yh,zh)],front or tex),
          ([(xh,-yh,-zh),(-xh,-yh,-zh),(-xh,yh,-zh),(xh,yh,-zh)],tex),
          ([(xh,-yh,zh),(xh,-yh,-zh),(xh,yh,-zh),(xh,yh,zh)],side or tex),
          ([(-xh,-yh,-zh),(-xh,-yh,zh),(-xh,yh,zh),(-xh,yh,-zh)],side or tex),
          ([(-xh,yh,zh),(xh,yh,zh),(xh,yh,-zh),(-xh,yh,-zh)],top or tex),
          ([(-xh,-yh,-zh),(xh,-yh,-zh),(xh,-yh,zh),(-xh,-yh,zh)],tex)
        ]
        for vs,tx in quads:self.quad([(xx+x,yy+y,zz+z) for xx,yy,zz in vs],tx)
    def card(self,w,h,x,y,z,tex):
        self.quad([(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)],tex)
    def board(self,w,d,x,y,z,tex):
        self.quad([(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x+w/2,y,z-d/2),(x-w/2,y,z-d/2)],tex)
    def finish(self,item):
        used=list(dict.fromkeys(tex for _,tex in self.uses))
        assert len(used)<=16,(item['id'],used)
        atlas=Image.new('RGB',(ATLAS,ATLAS),(30,31,29)); coords={}
        for i,tex in enumerate(used):
            x=(i%COLS)*CELL+2;y=(i//COLS)*CELL+2
            atlas.paste(tile(tex),(x,y)); coords[tex]=(x,y)
        atlas.save(TEXT/f"{item['id']}_atlas.png",optimize=True)
        UV=np.zeros((len(self.v),2),dtype=np.float32)
        for i,tex in self.uses:
            px,py=coords[tex]
            # UV inferior izquierda de OpenGL; tarjeta coherente con cara frontal.
            for j,(u,v) in enumerate(((0,0),(1,0),(1,1),(0,1))):
                UV[i+j]=((px+.5+u*59)/ATLAS,1-(py+.5+(1-v)*59)/ATLAS)
        mesh=trimesh.Trimesh(vertices=np.asarray(self.v,dtype=np.float32)*FT,faces=np.asarray(self.faces),process=False)
        mesh.visual=TextureVisuals(uv=UV,material=SimpleMaterial(image=atlas,glossiness=0))
        sc=trimesh.Scene();sc.add_geometry(mesh,geom_name=item['id'],node_name=item['id'])
        glb=trimesh.exchange.gltf.export_glb(sc)
        magic,vers,total=struct.unpack_from('<III',glb,0)
        jl,jt=struct.unpack_from('<II',glb,12)
        js=json.loads(glb[20:20+jl]); assert len(js['meshes'])==len(js['materials'])==1
        mat=js['materials'][0];mat['doubleSided']=True;mat['alphaMode']='OPAQUE'
        pbr=mat.setdefault('pbrMetallicRoughness',{});pbr.update({'metallicFactor':0.,'roughnessFactor':1.,'baseColorFactor':[1,1,1,1]})
        js['samplers']=[{'minFilter':9728,'magFilter':9728,'wrapS':33071,'wrapT':33071}]
        for tex in js.get('textures',[]):tex['sampler']=0
        txt=json.dumps(js,separators=(',',':'),ensure_ascii=False).encode();txt+=b' '*((-len(txt))%4)
        glb=struct.pack('<III',magic,vers,20+len(txt)+len(glb)-20-jl)+struct.pack('<II',len(txt),jt)+txt+glb[20+jl:]
        (DEST/f"{item['id']}.glb").write_bytes(glb)
        s=trimesh.load(DEST/f"{item['id']}.glb",force='scene')
        bb=s.bounds;span=(bb[1]-bb[0])/FT
        expected=np.array([item['widthFt'],item['heightFt'],item['depthFt']])
        assert np.all(span<=expected+.02),(item['id'],span,expected)
        assert bb[0,1]/FT>=-.02,(item['id'],'below ground',bb[0,1]/FT)
        return {'id':item['id'],'triangles':len(mesh.faces),'vertices':len(mesh.vertices),'textures':len(used),'glbBytes':len(glb)}


def shelves(b,w,d,h,levels,front='snacks',outer='metal_dark'):
    for x in (-w/2+.07,w/2-.07):
        b.box(.14,h,.14,x,h/2,-d/2+.08,outer)
    b.box(w-.15,h-.06,.08,0,h/2,-d/2+.06,outer)
    for y in levels:
        b.box(w,.10,d,0,y,0,'metal')
        if y+.22<h:b.card(w-.22,.68,0,y+.42,d/2-.01,front)
    b.box(w,.12,d,0,h-.06,0,outer)

def build(id):
    b=Builder()
    if id=='caja_registradora_c02':
        # Caja robusta, cajón, teclado y display cliente sobre un pedestal.
        b.box(1.46,.42,1.13,0,.23,0,'register',front='register',top='keypad')
        b.box(1.40,.20,1.03,0,.54,-.03,'register',top='keypad')
        b.box(1.10,.47,.24,0,.78,-.39,'metal_dark',front='screen')
        b.box(.16,.22,.14,.51,.70,.12,'metal_dark')
        b.box(.55,.18,.29,.51,1.04,.11,'black',front='screen')
        b.box(.25,.47,.20,-.48,.88,-.16,'plastic',front='receipt',top='receipt')
        b.box(.43,.06,.06,0,.17,.575,'black')
    elif id=='mostrador_caja_c02':
        b.box(4.80,2.82,2.27,0,1.49,-.10,'wood_dark',front='wood',side='wood_dark')
        b.box(4.94,.20,2.45,0,3.15,0,'cream',top='cream')
        b.box(4.56,.16,.07,0,.55,1.095,'metal_dark')
        b.card(2.10,.50,-1.10,1.85,1.045,'sign')
        b.box(1.15,.05,.65,1.52,3.06,0,'register',top='register')
        b.box(.80,.18,.11,1.47,2.43,1.06,'slate')
    elif id=='refrigerador_vertical_bebidas_c02':
        b.box(3.38,6.95,2.88,0,3.48,-.03,'cream',front='glass',side='slate')
        b.box(3.24,.10,2.99,0,6.92,0,'metal_dark',top='metal_dark')
        b.box(3.06,5.57,.09,0,3.77,1.44,'glass',front='glass')
        for y in (1.48,2.58,3.68,4.78,5.88):
            b.card(2.70,.69,0,y,1.498,'beverage')
            b.box(2.90,.07,.16,0,y-.43,1.41,'metal_dark')
        for x in (-1.57,1.57):b.box(.11,5.78,.15,x,3.78,1.46,'metal_dark')
        b.box(.10,2.00,.24,1.41,3.75,1.58,'metal')
        b.box(2.95,.49,.10,0,.44,1.48,'grate')
        b.box(3.12,.45,.12,0,6.53,1.47,'red',front='sign')
    elif id=='congelador_horizontal_c02':
        b.box(4.88,3.06,2.64,0,1.56,0,'cream',front='white',side='cream')
        b.box(4.97,.12,2.72,0,3.12,0,'metal_dark')
        for x in (-1.15,1.15): b.box(2.16,.04,2.47,x,3.21,0,'freezer',top='freezer')
        b.box(.12,.20,2.56,0,3.22,0,'metal')
        for x in (-2.41,2.41):b.box(.07,3.02,2.63,x,1.52,0,'metal_dark')
        b.box(4.48,.37,.10,0,.78,1.34,'grate')
        b.box(4.50,.18,.09,0,2.34,1.34,'blue')
    elif id=='rack_snacks_c02':
        for x in (-1.02,1.02):b.box(.12,4.84,.13,x,2.48,-.70,'metal_dark')
        b.box(2.10,4.85,.10,0,2.52,-.72,'metal_dark')
        b.box(2.23,.18,1.66,0,.12,0,'metal_dark')
        for y in (.55,1.56,2.56,3.57,4.52):
            b.box(2.20,.10,1.57,0,y,.02,'metal')
            if y<4.4:b.card(1.96,.68,0,y+.40,.81,'snacks' if y<2.6 else 'candy')
        b.box(2.12,.22,.18,0,4.87,-.69,'red')
        b.card(1.85,.22,0,4.82,.83,'sign')
    elif id=='gondola_simple_c02':
        shelves(b,2.98,1.23,6.23,[.25,1.44,2.62,3.80,4.98],front='cereal')
        b.box(2.98,.17,1.23,0,.09,0,'metal_dark')
        b.card(2.70,.46,0,5.63,.61,'snacks')
    elif id=='exhibidor_frutas_c02':
        # Estructura inclinada mediante módulos escalonados. Fruta pintada sobre cajones.
        for x in (-1.82,1.82):
            for z in (-.96,.90):b.box(.15,2.70,.14,x,1.42,z,'wood_dark')
        b.box(3.88,.19,2.12,0,.20,0,'wood_dark')
        for index,(y,z) in enumerate(((.84,.72),(1.62,.11),(2.40,-.49))):
            b.box(3.85,.14,.66,0,y,z,'wood')
            for x in (-1.25,0,1.25):
                b.box(1.15,.47,.64,x,y+.29,z,'wood_dark',front='wood')
                b.card(1.02,.42,x,y+.35,z+.332,'frutas' if (index+int(x*3))%2 else 'frutas2')
        b.box(3.74,.19,.14,0,3.50,-.92,'wood_dark')
        b.card(3.49,.42,0,3.33,-.84,'sign')
    elif id=='cajero_atm_c02':
        b.box(2.44,5.87,1.91,0,2.98,-.02,'slate',front='atm_frame')
        b.box(2.18,.10,1.85,0,5.78,-.02,'atm_frame')
        b.box(2.06,.08,.10,0,4.85,1.0,'atm_sign',front='atm_sign')
        b.box(1.72,2.23,.14,0,3.43,.965,'metal_dark',front='atm')
        b.box(1.26,.82,.035,0,3.91,1.055,'screen',front='screen')
        b.box(1.22,.44,.09,0,3.02,1.06,'black',front='keypad')
        b.box(.76,.11,.08,0,2.47,1.075,'black',front='black')
        b.box(1.23,.15,.32,0,2.19,1.025,'metal',top='metal')
        b.box(.55,.08,.11,.52,3.52,1.07,'black')
        b.box(1.80,.12,.11,0,.48,1.0,'metal_dark')
    else:raise KeyError(id)
    return b

def main():
    stats=[]
    for item in CATALOG['furniture']:
        stats.append(build(item['id']).finish(item))
    (ROOT/'reporte_topologia.json').write_text(json.dumps(stats,indent=2),encoding='utf8')
    print(json.dumps(stats,indent=2))

if __name__=='__main__':main()
