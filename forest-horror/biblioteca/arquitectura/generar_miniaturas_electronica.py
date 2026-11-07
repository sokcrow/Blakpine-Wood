"""Rasterizado isométrico de miniaturas transparentes desde los GLB del Kit 03."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import trimesh

ROOT=Path(__file__).resolve().parent
NAMES=['puerta_electronica_reja','puerta_electronica_opaca','teclado_pin','lector_tarjeta']
OUT=ROOT/'miniaturas'
OUT.mkdir(exist_ok=True)

def render(name):
    sc=trimesh.load(ROOT/'modelos_glb'/f'{name}.glb',force='scene')
    meshes=sc.dump()
    vv=np.concatenate([m.vertices for m in meshes])
    center=(vv.min(axis=0)+vv.max(axis=0))/2
    eye=center+np.array([2.8,2.45,3.5])
    toward=center-eye
    forward=toward/np.linalg.norm(toward)
    right=np.cross(forward,np.array([0,1.,0]))
    right=right/np.linalg.norm(right)
    up=np.cross(right,forward)
    def proj(pts):
        return np.stack([(pts-center)@right,-(pts-center)@up,(pts-center)@forward],axis=-1)
    bound=proj(vv)
    bmin=bound[:,:2].min(0)
    bmax=bound[:,:2].max(0)
    S=320
    scale=248/max(float((bmax-bmin).max()),.1)
    def coords(p):
        q=proj(p)
        return np.stack([(q[:,0]-(bmin[0]+bmax[0])/2)*scale+S/2,
                         (q[:,1]-(bmin[1]+bmax[1])/2)*scale+S/2,q[:,2]],axis=1)
    pixels=np.zeros((S,S,4),dtype=np.uint8)
    depthBuffer=np.full((S,S),np.inf)
    tris=[]
    for mesh in meshes:
        q=coords(mesh.vertices)
        uv=mesh.visual.uv
        mat=mesh.visual.material
        texture=np.asarray(mat.baseColorTexture.convert('RGBA'))
        factor=mat.baseColorFactor if mat.baseColorFactor is not None else [255,255,255,255]
        for f in mesh.faces:
            p=q[f]
            uvv=uv[f]
            a,b,c=mesh.vertices[f]
            normal=np.cross(b-a,c-a)
            normal=normal/(np.linalg.norm(normal)+1e-9)
            light=.70+.27*max(0,float(np.dot(normal,np.array([.25,.75,.62]))))
            tris.append((float(factor[3]) < 250,p,uvv,texture,factor,light))
    tris.sort(key=lambda t:t[0])
    for _,q,uv,tex,factor,light in tris:
        minx,maxx=max(int(np.floor(q[:,0].min())),0),min(int(np.ceil(q[:,0].max())),S-1)
        miny,maxy=max(int(np.floor(q[:,1].min())),0),min(int(np.ceil(q[:,1].max())),S-1)
        if maxx<minx or maxy<miny:continue
        a,b,c=q[:,:2]
        e0=b-a
        e1=c-a
        den=e0[0]*e1[1]-e1[0]*e0[1]
        if abs(den)<1e-7:continue
        Y,X=np.mgrid[miny:maxy+1,minx:maxx+1]
        D=np.stack([X+.5-a[0],Y+.5-a[1]],axis=-1)
        s=(D[...,0]*e1[1]-D[...,1]*e1[0])/den
        t=(e0[0]*D[...,1]-e0[1]*D[...,0])/den
        depth=q[0,2]+s*(q[1,2]-q[0,2])+t*(q[2,2]-q[0,2])
        mask=(s>=-1e-5)&(t>=-1e-5)&(s+t<=1.00001)
        mask &= depth<depthBuffer[miny:maxy+1,minx:maxx+1]-1e-6
        if not mask.any():continue
        U=uv[0,0]+s*(uv[1,0]-uv[0,0])+t*(uv[2,0]-uv[0,0])
        V=uv[0,1]+s*(uv[1,1]-uv[0,1])+t*(uv[2,1]-uv[0,1])
        tx=np.clip(np.floor(U*tex.shape[1]).astype(int),0,tex.shape[1]-1)
        ty=np.clip(np.floor((1-V)*tex.shape[0]).astype(int),0,tex.shape[0]-1)
        src=tex[ty,tx].astype(np.float32)
        src[:,:,:3]*=np.array(factor[:3])[None,None,:]/255*light
        src[:,:,3]*=factor[3]/255
        sy,sx=np.where(mask)
        previous=pixels[miny+sy,minx+sx].astype(np.float32)
        alpha=src[sy,sx,3:4]/255
        out=src[sy,sx,:3]*alpha+previous[:,:3]*(1-alpha)
        out_alpha=src[sy,sx,3]+previous[:,3]*(1-alpha[:,0])
        pixels[miny+sy,minx+sx,:3]=np.clip(out,0,255).astype('uint8')
        pixels[miny+sy,minx+sx,3]=np.clip(out_alpha,0,255).astype('uint8')
        if factor[3]>250:depthBuffer[miny+sy,minx+sx]=depth[sy,sx]
    im=Image.fromarray(pixels,'RGBA')
    im.save(OUT/f'{name}.png')
    return im

if __name__=='__main__':
    imgs=[render(n) for n in NAMES]
    width=2*350+33
    height=2*365+40
    sheet=Image.new('RGB',(width,height),(16,22,25))
    d=ImageDraw.Draw(sheet)
    labels=['Electrónica · reja','Electrónica · sólida','Teclado PIN','Lector de tarjeta']
    for i,im in enumerate(imgs):
        col=i%2
        row=i//2
        x=16+col*350
        y=20+row*365
        d.rounded_rectangle((x,y,x+333,y+331),radius=12,fill=(27,34,37),outline=(56,67,67),width=2)
        im=im.resize((305,305),Image.Resampling.NEAREST)
        sheet.paste(im,(x+14,y+10),im)
        d.text((x+8,y+335),labels[i],fill=(222,216,198))
    sheet.save(ROOT/'hoja_miniaturas_electronica.png')
    print('Miniaturas creadas:',len(imgs))
