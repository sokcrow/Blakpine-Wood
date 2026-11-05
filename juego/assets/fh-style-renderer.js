/* Materiales pixel art Three.js r128. Una escala para paredes y suelos. */
(function(root){
 'use strict';
 const P=()=>root.FHStyleProperty;
 const textureCache=new Map(),materialCache=new Map();
 const hex=c=>(typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))?c:'#999999';
 function shade(color,ratio){
  const n=parseInt(hex(color).slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const move=v=>Math.max(0,Math.min(255,Math.round(v+(ratio>=0?(255-v)*ratio:v*ratio))));
  return '#'+[r,g,b].map(v=>move(v).toString(16).padStart(2,'0')).join('');
 }
 function makeTile(spec){
  const c=document.createElement('canvas');c.width=c.height=32;
  const x=c.getContext('2d',{alpha:false});x.imageSmoothingEnabled=false;
  const base=hex(spec.color),light=shade(base,.17),dark=shade(base,-.23),muted=shade(base,-.10);
  x.fillStyle=base;x.fillRect(0,0,32,32);
  const rect=(color,a,b,w,h)=>{x.fillStyle=color;x.fillRect(a,b,w,h);};
  switch(spec.preset){
   case 'ladrillo':
    rect(dark,0,0,32,32);
    for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
     const a=col*17+(row%2?-8:0)+1,b=row*8+1;
     rect((row+col)%3===0?light:base,a,b,16,6);
     rect(muted,a,b+5,16,1);
    }break;
   case 'concreto':case 'estuco':
    for(let y=0;y<32;y+=2)for(let a=0;a<32;a+=2){
      const seed=(a*71+y*131+a*y*17)%19;
      if(seed<(spec.preset==='estuco'?8:4))rect(seed%2?light:dark,a,y,2,2);
    }break;
   case 'metal-corrugado':
    for(let a=0;a<32;a+=8){rect(dark,a,0,2,32);rect(light,a+3,0,2,32);rect(muted,a+6,0,1,32);}break;
   case 'pintura-lisa':break;
   case 'tapiz':
    for(let y=0;y<32;y+=8)for(let a=0;a<32;a+=8){rect(dark,a+3,y+1,2,2);rect(light,a+2,y+3,4,2);rect(dark,a+3,y+5,2,2);}break;
   case 'lambrin':
    rect(muted,0,4,32,2);rect(dark,0,26,32,2);
    for(let a=0;a<32;a+=16){rect(dark,a,7,2,18);rect(light,a+3,8,1,16);}break;
   case 'azulejo':case 'baldosa':
    rect(dark,0,0,32,32);
    for(let y=0;y<32;y+=8)for(let a=0;a<32;a+=8){rect((y+a)%16?light:base,a+1,y+1,6,6);rect(muted,a+1,y+6,6,1);}break;
   case 'madera':
    for(let y=0;y<32;y+=8){rect(dark,0,y,32,1);rect(light,0,y+2,32,1);}
    for(let y=0;y<32;y+=8){rect(dark,(y*3)%32,y+1,1,7);rect(light,(y*3+1)%32,y+1,1,7);}break;
   case 'alfombra':
    for(let y=0;y<32;y+=2)for(let a=0;a<32;a+=2)if((a*7+y*11)%5<2)rect((a+y)%4?dark:light,a,y,1,1);
    break;
  }
  return c;
 }
 function imageSpec(map,style){
  const entry=(map.patterns||[]).find(p=>p.id===style.pattern);
  return entry&&typeof entry.png==='string'?entry:null;
 }
 function entryFor(THREE,map,style){
  const source=imageSpec(map,style);
  const key=style.preset+'|'+style.color+'|'+(source?.id||'')+'|'+(source?.png||'').length;
  if(textureCache.has(key))return textureCache.get(key);
  const tile=source?null:makeTile(style);
  const t=source?new THREE.TextureLoader().load(source.png):new THREE.CanvasTexture(tile);
  t.magFilter=t.minFilter=THREE.NearestFilter;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.generateMipmaps=false;t.encoding=THREE.sRGBEncoding;t.needsUpdate=true;
  const entry={texture:t,size:source?.width||32,key};textureCache.set(key,entry);
  return entry;
 }
 function material(THREE,map,style){
  const e=entryFor(THREE,map,style);
  if(materialCache.has(e.key))return materialCache.get(e.key);
  const m=new THREE.MeshLambertMaterial({map:e.texture,color:0xffffff,side:THREE.FrontSide});
  m.userData.fhTileSize=e.size;materialCache.set(e.key,m);return m;
 }
 function decorateWall(THREE,mesh,wall,map,{widthMeters,heightMeters}){
  if(!wall.finish&&!map.styleSystem)return;
  const shared=P();if(!shared)return;
  const floorId=map.floors[mesh.userData.fhFloor||0]?.id||wall.floorId||map.floors[0]?.id;
  for(const side of ['A','B']){
   const finish=shared.wallStyle(map,floorId,wall,side);
   if(finish.preset==='legacy')continue;
   const mat=material(THREE,map,finish),span=mat.userData.fhTileSize;
   const geom=new THREE.PlaneGeometry(widthMeters,heightMeters);
   const uv=geom.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setXY(i,
     uv.getX(i)*widthMeters/.3048*shared.TEXEL_PER_FOOT/span,
     uv.getY(i)*heightMeters/.3048*shared.TEXEL_PER_FOOT/span);
   const overlay=new THREE.Mesh(geom,mat);
   overlay.position.z=(side==='A'?1:-1)*(.13/2+.0017);
   if(side==='B')overlay.rotation.y=Math.PI;
   overlay.userData.fhFinishSide=side;
   mesh.add(overlay);
  }
 }
 function roomMaterial(THREE,room,map){
  if(!room.surfaceStyle&&!map.styleSystem)return null;
  const shared=P();if(!shared)return null;
  return material(THREE,map,shared.floorStyle(room));
 }
 function floorUV(geo,x,z,w,d,mat){
  if(!mat?.userData?.fhTileSize)return;
  const size=mat.userData.fhTileSize,scale=P().TEXEL_PER_FOOT/(.3048*size),uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++){
   uv.setXY(i,(x-w/2+uv.getX(i)*w)*scale,(z-d/2+uv.getY(i)*d)*scale);
  }
  uv.needsUpdate=true;
 }
 function preview(canvas,style,map){
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const src=imageSpec(map,style),tile=makeTile(style);
  const fill=img=>{ctx.clearRect(0,0,canvas.width,canvas.height);
   for(let y=0;y<canvas.height;y+=64)for(let x=0;x<canvas.width;x+=64)ctx.drawImage(img,x,y,64,64);
  };
  if(src){const im=new Image();im.onload=()=>fill(im);im.onerror=()=>fill(tile);im.src=src.png;}else fill(tile);
 }
 root.FHStyleRuntime=Object.freeze({decorateWall,roomMaterial,floorUV,preview});
})(typeof globalThis!=='undefined'?globalThis:this);
