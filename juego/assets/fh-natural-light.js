/* Forest Horror — iluminación natural por hora y por aberturas.
 * El reloj existente es la única fuente temporal. No crea lámparas ni modifica mapas.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(root)root.FHNaturalLight=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const finite=(v,f)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):f;
 const smooth=t=>{const s=clamp(t,0,1);return s*s*(3-2*s)};
 const WALLS=new Set(['wall','red_wall','property_wall']);
 const PORTALS=new Set(['window','door','peephole_door','door_electronic','electronic_door']);
 const OUTER_BOUNDARIES=new Set([...WALLS,...PORTALS]);
 function lightAt(minutes){
  const h=((finite(minutes,480)%1440)+1440)%1440/60;
  const rise=smooth((h-5.7)/3.5);
  const set=smooth((19.2-h)/3.2);
  const sun=rise*set;
  // La luna tiene una fracción de la potencia máxima solar, sin simular fases todavía.
  const moon=.13*(1-smooth((h-5.6)/1.7))+
   .13*smooth((h-18.6)/1.8);
  return {hour:h,sun:clamp(sun,0,1),moon:clamp(moon,0,.13)};
 }
 function isBasement(floor){
  if(!floor)return false;
  if(Number.isFinite(Number(floor.elevationFt))&&Number(floor.elevationFt)<0)return true;
  const name=String(floor.name||'').trim();
  return /(?:^|[\s_-])(?:b[1-9]\d*|s[oó]tano(?:\s+\d+)?|subsuelo(?:\s+\d+)?|nivel\s*-[1-9]\d*)(?:$|[\s_-])/i.test(name)||/^-[1-9]\d*$/.test(name);
 }
 function segment(item){
  if(!item||!item.a||!item.b)return null;
  const {a,b}=item;
  if(![a.x,a.y,b.x,b.y].every(Number.isFinite))return null;
  return {x1:a.x,y1:a.y,x2:b.x,y2:b.y,item};
 }
 function intersection(a,b,s){
  const vx=b.x-a.x,vy=b.y-a.y,wx=s.x2-s.x1,wy=s.y2-s.y1;
  const det=vx*wy-vy*wx;
  if(Math.abs(det)<1e-10)return false;
  const dx=s.x1-a.x,dy=s.y1-a.y,t=(dx*wy-dy*wx)/det,u=(dx*vy-dy*vx)/det;
  return t>0.0001&&t<.9999&&u>=-.0001&&u<=1.0001;
 }
 function crossed(a,b,walls){
  for(const s of walls)if(intersection(a,b,s))return true;
  return false;
 }
 function computeAccess(floor,units={},options={}){
  const columns=clamp(Math.floor(finite(units.columns,16)),1,500);
  const rows=clamp(Math.floor(finite(units.rows,22)),1,500);
  const scale=columns*rows<=3000?2:1,w=columns*scale,h=rows*scale;
  const access=new Uint8Array(w*h);
  if(isBasement(floor))return {width:w,height:h,scale,access,exterior:0,portals:0};
  const items=Array.isArray(floor?.items)?floor.items:[];
  const blockers=[],lightBlockers=[],portals=[];
  for(const it of items){
   if(!OUTER_BOUNDARIES.has(it?.type))continue;
   const s=segment(it);if(!s)continue;
   blockers.push(s);
   const open=(typeof options.doorOpen==='function'?options.doorOpen(it.id,it):it.open===true);
   if(WALLS.has(it.type)||it.type!=='window'&&!open)lightBlockers.push(s);
   if(it.type==='window'||PORTALS.has(it.type)&&open)portals.push(s);
  }
  const inBounds=(x,y)=>x>=0&&y>=0&&x<w&&y<h;
  const pt=(x,y)=>({x:(x+.5)/scale,y:(y+.5)/scale});
  const outside=new Uint8Array(access.length);
  const queue=new Int32Array(access.length);
  let tail=0,head=0;
  function add(x,y){
   if(!inBounds(x,y))return;
   const i=y*w+x;
   if(!outside[i]){outside[i]=1;queue[tail++]=i}
  }
  for(let x=0;x<w;x++){add(x,0);add(x,h-1)}
  for(let y=0;y<h;y++){add(0,y);add(w-1,y)}
  while(head<tail){
   const i=queue[head++],x=i%w,y=(i-x)/w,a=pt(x,y);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,yy=y+dy;
    if(!inBounds(xx,yy)||outside[yy*w+xx])continue;
    if(crossed(a,pt(xx,yy),blockers))continue;
    add(xx,yy);
   }
  }
  for(let i=0;i<access.length;i++)if(outside[i])access[i]=255;
  // Solo filtraciones conectadas al exterior: no iluminar ventanas entre dos habitaciones.
  let activePortals=0;
  for(const s of portals){
   const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy);
   if(len<.001)continue;
   const nx=-dy/len,ny=dx/len;
   const steps=Math.max(1,Math.ceil(len*.8));
   for(let k=0;k<=steps;k++){
    const t=(k+.5)/(steps+1),cx=s.x1+dx*t,cy=s.y1+dy*t;
    const extSide=(sign)=>{
     const xx=Math.floor((cx+nx*sign*.6)*scale),yy=Math.floor((cy+ny*sign*.6)*scale);
     return inBounds(xx,yy)&&!!outside[yy*w+xx];
    };
    const plus=extSide(1),minus=extSide(-1);
    if(plus===minus)continue;
    activePortals++;
    const radius=5,base=itIsDoor(s.item.type)?.88:.78;
    const x0=Math.max(0,Math.floor((cx-radius)*scale)),x1=Math.min(w-1,Math.ceil((cx+radius)*scale));
    const y0=Math.max(0,Math.floor((cy-radius)*scale)),y1=Math.min(h-1,Math.ceil((cy+radius)*scale));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const i=y*w+x;if(outside[i])continue;
     const target=pt(x,y),d=Math.hypot(target.x-cx,target.y-cy);
     if(d>radius)continue;
     const sign=plus?-1:1;
     if((target.x-cx)*nx*sign+(target.y-cy)*ny*sign < -.05)continue;
     // Comprobar paredes y puertas reales, sin generar luces que atraviesen sólidos.
     const start={x:cx+nx*sign*.07,y:cy+ny*sign*.07};
     if(crossed(start,target,lightBlockers))continue;
     const strength=Math.round(255*base*Math.pow(1-d/radius,1.4));
     if(strength>access[i])access[i]=strength;
    }
   }
  }
  return {width:w,height:h,scale,access,exterior:tail,portals:activePortals};
 }
 function itIsDoor(type){return type!=='window'}
 function createRuntime({THREE,DATA,CELL,scene,ambient,clock,floor,doorOpen}={}){
  if(!THREE||!DATA||!scene)return null;
  const atlas=new Map(),installed=new WeakSet();
  const sizeX=clamp(finite(DATA.units?.columns,16),1,500)*CELL;
  const sizeZ=clamp(finite(DATA.units?.rows,22),1,500)*CELL;
  const uniformMask={value:null},uniformColor={value:new THREE.Color(0)};
  let current=-1,lastSignature='',lastMinutes=NaN;
  const empty=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);
  empty.magFilter=THREE.LinearFilter;empty.minFilter=THREE.LinearFilter;empty.needsUpdate=true;
  uniformMask.value=empty;
  function signature(f){
   const fl=DATA.floors[f],doors=(fl?.items||[]).filter(it=>PORTALS.has(it.type)&&it.type!=='window');
   return doors.map(it=>String(it.id||'')+':'+String(!!doorOpen?.(f,it.id,it))).join('|');
  }
  function textureFor(f,force){
   if(!force&&atlas.has(f))return atlas.get(f);
   const old=atlas.get(f);
   const mask=computeAccess(DATA.floors[f],DATA.units,{doorOpen:(id,it)=>doorOpen?.(f,id,it)??it.open===true});
   const data=new Uint8Array(mask.width*mask.height*4);
   for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
    const from=y*mask.width+x,to=((mask.height-1-y)*mask.width+x)*4;
    data[to]=data[to+1]=data[to+2]=mask.access[from];data[to+3]=255;
   }
   const tex=new THREE.DataTexture(data,mask.width,mask.height,THREE.RGBAFormat);
   tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
   atlas.set(f,tex);old?.dispose();return tex;
  }
  function attach(container=scene){
   if(!container?.traverse)return;
   container.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const mat of mats){
     if(!mat||installed.has(mat)||!mat.isMeshLambertMaterial&&!mat.isMeshPhongMaterial&&!mat.isMeshStandardMaterial)continue;
     installed.add(mat);
     const previous=mat.onBeforeCompile;
     mat.onBeforeCompile=function(shader){
      previous?.call(this,shader);
      if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <emissivemap_fragment>'))return;
      shader.uniforms.uFHNaturalMask=uniformMask;
      shader.uniforms.uFHNaturalColor=uniformColor;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
       '#include <common>\nvarying vec3 fhNaturalWorld;')
       .replace('#include <begin_vertex>',
       '#include <begin_vertex>\nfhNaturalWorld=(modelMatrix*vec4(position,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
       '#include <common>\nvarying vec3 fhNaturalWorld;\nuniform sampler2D uFHNaturalMask;\nuniform vec3 uFHNaturalColor;')
       .replace('#include <emissivemap_fragment>',
       '#include <emissivemap_fragment>\nvec2 fhNUV=vec2(fhNaturalWorld.x/'+sizeX.toFixed(6)+',1.-fhNaturalWorld.z/'+sizeZ.toFixed(6)+');\nif(fhNUV.x>=0.&&fhNUV.y>=0.&&fhNUV.x<=1.&&fhNUV.y<=1.) totalEmissiveRadiance+=texture2D(uFHNaturalMask,fhNUV).r*uFHNaturalColor;');
     };
     mat.needsUpdate=true;
    }
   });
  }
  function update(){
   const f=clamp(Math.floor(finite(floor?.(),0)),0,DATA.floors.length-1);
   const signatureNow=signature(f);
   if(f!==current||signatureNow!==lastSignature){
    uniformMask.value=textureFor(f,signatureNow!==lastSignature&&f===current);
    current=f;lastSignature=signatureNow;
   }
   const minutes=finite(clock?.(),480);
   if(minutes===lastMinutes)return;
   lastMinutes=minutes;
   const light=lightAt(minutes);
   uniformColor.value.setRGB(
    .92*light.sun+.32*light.moon,
    .82*light.sun+.46*light.moon,
    .69*light.sun+.68*light.moon
   );
  }
  update();
  return {update,attach,dispose:()=>{for(const t of atlas.values())t.dispose();empty.dispose()},access:()=>atlas.get(current)||empty};
 }
 return Object.freeze({lightAt,isBasement,computeAccess,createRuntime});
});
