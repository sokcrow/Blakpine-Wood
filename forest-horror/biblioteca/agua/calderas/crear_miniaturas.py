#!/usr/bin/env python3
"""Miniaturas renderizadas de los GLB, usando rasterización UV por software."""
from pathlib import Path
import math,json
import numpy as np,trimesh
from PIL import Image, ImageDraw,ImageFont
R=Path(__file__).resolve().parent
CAT=json.loads((R/'catalogo_calderas.json').read_text())['models']

def render(glb,size=290,azim=30,elev=22):
 scene=trimesh.load(glb,force='scene'); geom=next(iter(scene.geometry.values()))
 v=np.asarray(geom.vertices,dtype=np.float64);f=np.asarray(geom.faces);uv=np.asarray(geom.visual.uv)
 tx=np.asarray(geom.visual.material.baseColorTexture.convert('RGB'))
 mid=(geom.bounds[0]+geom.bounds[1])/2
 azim,elev=math.radians(azim),math.radians(elev)
 direction=np.array([math.sin(azim)*math.cos(elev),math.sin(elev),math.cos(azim)*math.cos(elev)])
 eye=mid+direction*5; fw=mid-eye;fw/=np.linalg.norm(fw)
 right=np.cross(fw,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,fw);up/=np.linalg.norm(up)
 cv=v-mid;px=cv@right;py=cv@up;sw=max(.00001,np.ptp(px));sh=max(.00001,np.ptp(py))
 scale=min((size*.80)/sw,(size*.80)/sh)
 sx=px*scale+size*.50;sy=-py*scale+size*.51;depth=(v-eye)@fw
 out=np.zeros((size,size,4),dtype=np.uint8);zbuffer=np.full((size,size),np.inf,np.float32)
 L=np.array([-.45,.85,.75]);L/=np.linalg.norm(L)
 for j,tri in enumerate(f):
  x=sx[tri];y=sy[tri];minx=max(0,int(math.floor(x.min())));maxx=min(size-1,int(math.ceil(x.max())));miny=max(0,int(math.floor(y.min())));maxy=min(size-1,int(math.ceil(y.max())))
  if minx>maxx or miny>maxy:continue
  x0,x1,x2=map(float,x);y0,y1,y2=map(float,y)
  denom=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
  if abs(denom)<1e-6:continue
  gy,gx=np.mgrid[miny:maxy+1,minx:maxx+1];gx=gx.astype(np.float32)+.5;gy=gy.astype(np.float32)+.5
  a=((y1-y2)*(gx-x2)+(x2-x1)*(gy-y2))/denom
  b=((y2-y0)*(gx-x2)+(x0-x2)*(gy-y2))/denom
  c=1-a-b
  mask=(a>=-1e-4)&(b>=-1e-4)&(c>=-1e-4)
  if not mask.any():continue
  zz=a*depth[tri[0]]+b*depth[tri[1]]+c*depth[tri[2]]
  subz=zbuffer[miny:maxy+1,minx:maxx+1];keep=mask&(zz<subz)
  if not keep.any():continue
  uu=a*uv[tri[0],0]+b*uv[tri[1],0]+c*uv[tri[2],0]
  vv=a*uv[tri[0],1]+b*uv[tri[1],1]+c*uv[tri[2],1]
  ix=np.clip((uu*(tx.shape[1]-1)).astype(np.int32),0,tx.shape[1]-1)
  iy=np.clip(((1-vv)*(tx.shape[0]-1)).astype(np.int32),0,tx.shape[0]-1)
  col=tx[iy,ix]
  n=geom.face_normals[j];brightness=np.clip(.80+.24*np.dot(n,L),.58,1.07)
  lit=np.clip(col*brightness,0,255).astype(np.uint8)
  p=out[miny:maxy+1,minx:maxx+1];p[keep,:3]=lit[keep];p[keep,3]=255;subz[keep]=zz[keep]
 return Image.fromarray(out,'RGBA')

def main():
 thumbs={};(R/'miniaturas').mkdir(exist_ok=True)
 for e in CAT:
  view=render(R/e['glb'],size=320,azim=29,elev=22 if e['placement']=='floor' else 12)
  view.save(R/e['thumbnail'],optimize=True)
  thumbs[e['id']]=view
 W=1260;H=840
 im=Image.new('RGB',(W,H),(15,23,28));d=ImageDraw.Draw(im)
 fb=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',31)
 fm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',15)
 fs=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
 d.text((30,17),'AGUA 02 / CALDERAS',font=fb,fill=(235,229,209))
 d.text((33,63),'8 GLB independientes  •  Sala técnica  •  Pixel Art / Low Poly  •  SOLO VISUAL',font=fs,fill=(153,193,191))
 for i,e in enumerate(CAT):
  x=22+(i%4)*311;y=104+(i//4)*350
  d.rounded_rectangle((x,y,x+301,y+333),9,fill=(30,43,50),outline=(70,89,91),width=2)
  thumb=thumbs[e['id']].resize((263,263),Image.Resampling.NEAREST)
  im.paste(thumb,(x+18,y+1),thumb)
  d.text((x+10,y+265),e['name'],font=fm,fill=(232,226,209))
  d.text((x+10,y+291),('Pared' if e['placement']=='wall' else 'Piso')+'  •  '+e['description'],font=fs,fill=(143,189,185))
  d.text((x+10,y+310),f"{e['widthFt']:.2f} × {e['heightFt']:.2f} × {e['depthFt']:.2f} ft   ·   {e['triangles']} tris",font=fs,fill=(179,179,167))
 im.save(R/'hoja_miniaturas_calderas.png',optimize=True)
 compare=Image.new('RGB',(1260,670),(15,23,28));dc=ImageDraw.Draw(compare)
 for i,e in enumerate(CAT):
  v=render(R/e['glb'],size=260,azim=0,elev=0)
  x=17+(i%4)*310;y=12+(i//4)*323
  compare.paste(v,(x+18,y+8),v)
  dc.text((x+9,y+276),e['id'],font=fs,fill=(218,228,214))
 compare.save(R/'revision_frontal_calderas.png',optimize=True)
 print('Miniaturas renderizadas:',len(thumbs))
if __name__=='__main__':main()
