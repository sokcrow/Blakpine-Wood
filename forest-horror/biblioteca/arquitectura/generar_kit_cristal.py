"""Genera los tres GLB de cristal del hotfix (siempre una sola hoja)."""
from pathlib import Path
import struct,json
from PIL import Image,ImageDraw
import trimesh
from trimesh.visual.material import PBRMaterial
from generar_kit import Build,glb_nearest,WIDTH,DOOR_H,FRAME_H
R=Path(__file__).resolve().parent
W=WIDTH
NAMES=['puerta_cristal_simple','puerta_cristal_antipanico','puerta_cristal_tintada']
COLORS={
 'puerta_cristal_simple':{'metal':'#88999b','light':'#c7d2cf','dark':'#2d4146','glass':'#85b3b5','tint':124},
 'puerta_cristal_antipanico':{'metal':'#63777b','light':'#c0c6c4','dark':'#283b40','glass':'#7fa7aa','tint':113},
 'puerta_cristal_tintada':{'metal':'#262d35','light':'#6d7a7c','dark':'#141e25','glass':'#304e5a','tint':196},
}
def tex(name):
 p=COLORS[name]; im=Image.new('RGBA',(128,128),(28,33,35,255));d=ImageDraw.Draw(im)
 d.rectangle((0,0,63,95),fill=p['metal'])
 for x in range(0,64,4):
  if x%8==0:d.line((x,0,x,95),fill=p['light'],width=1)
 for y in range(0,96,9):d.line((0,y,63,y),fill=p['dark'],width=1)
 d.rectangle((64,0,95,95),fill=p['dark'])
 for x in [66,68,90,92]:d.line((x,0,x,95),fill=p['light'],width=1)
 for y in range(4,95,16):d.line((70,y,89,y),fill=p['metal'],width=2)
 d.rectangle((96,0,127,95),fill=p['light'])
 for y in range(2,96,10):d.line((98,y,125,y),fill=p['metal'],width=1)
 d.rectangle((0,96,63,127),fill=p['dark'])
 d.rectangle((64,96,127,127),fill=p['glass'])
 d.polygon([(66,119),(80,98),(88,98),(74,126)],fill=p['metal'])
 d.polygon([(108,98),(113,98),(94,126),(90,126)],fill=p['light'])
 for y in [104,119]:d.line((66,y,125,y),fill=p['dark'],width=1)
 if name=='puerta_cristal_antipanico':
  d.rectangle((0,35,63,48),fill='#85918b');d.rectangle((0,39,63,44),fill='#d3b96a')
 if name=='puerta_cristal_tintada':
  d.rectangle((64,113,127,127),fill=p['dark']);d.line((78,100,68,117),fill='#74949a',width=1)
 im.save(R/'texturas'/f'{name}.png')
 return im
def rectparts(builder):
 builder.box(.045,FRAME_H/2,0,.09,FRAME_H,.125,faces=(64,0,95,95))
 builder.box(W-.045,FRAME_H/2,0,.09,FRAME_H,.125,faces=(64,0,95,95))
 builder.box(W/2,FRAME_H-.048,0,W,.096,.14,faces=(64,0,95,95))
def leafmesh(mode):
 frame=Build();glass=Build();xmid=W/2
 for x in (.095,W-.095):frame.box(x,DOOR_H/2,.0,.13,DOOR_H,.105,faces=(64,0,95,95))
 for y in (.095,DOOR_H-.095):frame.box(xmid,y,0,W-.18,.15,.105,faces=(64,0,95,95))
 if mode=='puerta_cristal_antipanico':
  for zz in (-.10,.10):
    frame.box(xmid,1.03,zz,W-.25,.055,.075,faces=(96,0,127,95))
    for xx in (.24,W-.24):frame.box(xx,1.02,zz,.045,.18,.09,faces=(64,0,95,95))
 else:
  for zz in (-.102,.102):
   frame.box(W-.30,1.04,zz,.047,.42,.06,faces=(96,0,127,95))
   for yy in (.87,1.22):frame.box(W-.30,yy,zz/2,.055,.04,.16,faces=(96,0,127,95))
 glass.plane(xmid,DOOR_H/2,0,W-.31,DOOR_H-.32,rect=(64,96,127,127))
 return frame,glass
def patch_group(blob):
 n=struct.unpack_from('<I',blob,12)[0]; g=json.loads(blob[20:20+n]); nodes=g['nodes'];scene=g['scenes'][g.get('scene',0)];roots=scene['nodes']
 for suffix,newname in [('A','HOJA_PIVOTE')]:
  kids=[i for i,v in enumerate(nodes) if v.get('name') in (f'HOJA_MARCO_{suffix}',f'HOJA_VIDRIO_{suffix}')]
  assert len(kids)==2,(suffix,nodes)
  node={'name':newname,'children':kids}
  idx=len(nodes);nodes.append(node)
  for k in kids:
   if k in roots:roots.remove(k)
   for ancestor in nodes[:-1]:
    if k in ancestor.get('children',[]):ancestor['children'].remove(k)
  roots.append(idx)
 jb=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4)
 rem=blob[20+n:]
 out=b'glTF'+struct.pack('<II',2,12+8+len(jb)+len(rem))+struct.pack('<I4s',len(jb),b'JSON')+jb+rem
 assert len(out)==struct.unpack_from('<I',out,8)[0]
 return out
def main():
 for name in NAMES:
  texture=tex(name); c=COLORS[name]
  opaque=PBRMaterial(name='MARCO_PIXEL_ART',baseColorTexture=texture,metallicFactor=0,roughnessFactor=.72,doubleSided=False)
  glass=PBRMaterial(name='VIDRIO_REAL',baseColorTexture=texture,baseColorFactor=[255,255,255,c['tint']],metallicFactor=0,roughnessFactor=.18,doubleSided=True,alphaMode='BLEND')
  sc=trimesh.Scene();fixed=Build();rectparts(fixed)
  sc.add_geometry(fixed.geom('MARCO_FIJO',opaque),node_name='MARCO_FIJO',geom_name='MARCO_FIJO')
  f,g=leafmesh(name)
  sc.add_geometry(f.geom('HOJA_MARCO_A',opaque),node_name='HOJA_MARCO_A',geom_name='HOJA_MARCO_A')
  sc.add_geometry(g.geom('HOJA_VIDRIO_A',glass),node_name='HOJA_VIDRIO_A',geom_name='HOJA_VIDRIO_A')
  raw=patch_group(glb_nearest(sc.export(file_type='glb')))
  (R/'modelos_glb'/f'{name}.glb').write_bytes(raw)
  print('GLB de cristal:',name,len(raw))
if __name__=='__main__':main()
