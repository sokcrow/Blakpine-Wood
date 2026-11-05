/* Forest Horror — lector de cobertura luminosa compartida.
 * No crea lámparas ni altera JSON. Unifica focos y bloquea paredes rojas/azules.
 */
(function(root,factory){
 const api=factory();
 if(root)root.FHLightCoverage=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MIN=.00001;
 const MAX_LIGHT_RADIUS_FT=120,MAX_DIM_FALLOFF_FT=120,LEGACY_MAX_DIM_RADIUS_FT=112,DIM_RADIUS_RATIO=1.4;
 const BUILTIN={bulb:{radiusFt:16,beamAngleDeg:360},strip:{radiusFt:27,beamAngleDeg:360},
  panel:{radiusFt:22,beamAngleDeg:360},wall_sconce:{radiusFt:15,beamAngleDeg:160},
  wall_flood:{radiusFt:29,beamAngleDeg:110}};
 const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
 const isFinitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const wallTypes=new Set(['red_wall','wall']);
 function segments(items,{doors=true}={}){
  return (items||[]).filter(it=>isFinitePoint(it.a)&&isFinitePoint(it.b)&&(
   wallTypes.has(it.type)||(doors&&['door','peephole_door'].includes(it.type)&&it.open!==true&&it.open!==1)
  )).map(it=>({x1:it.a.x,y1:it.a.y,x2:it.b.x,y2:it.b.y,type:it.type}));
 }
 // Tramo AB de lámpara a objetivo contra pared CD; los extremos abiertos se respetan.
 function blocked(ax,ay,bx,by,walls){
  const dx=bx-ax,dy=by-ay;
  if(dx*dx+dy*dy<MIN*MIN)return false;
  for(const s of walls){
   const sx=s.x2-s.x1,sy=s.y2-s.y1,den=dx*sy-dy*sx;
   if(Math.abs(den)<1e-10)continue;
   const px=s.x1-ax,py=s.y1-ay;
   const t=(px*sy-py*sx)/den,u=(px*dy-py*dx)/den;
   if(t>0.002&&t<.998&&u>=-0.0001&&u<=1.0001)return true;
  }
  return false;
 }
 function sources(items,feetPerCell,presetFor){
  const feet=Number(feetPerCell)>0?Number(feetPerCell):5;
  const meters=feet*.3048;
  const output=[];
  for(const lamp of items||[]){
   if(lamp.type!=='light_fixture'||!Number.isFinite(Number(lamp.x))||!Number.isFinite(Number(lamp.y)))continue;
   const kind=lamp.lightKind||'bulb',defaultPreset=BUILTIN[kind]||BUILTIN.bulb;
   const preset=typeof presetFor==='function'?presetFor(kind)||defaultPreset:defaultPreset;
   const rotation=Number(lamp.rotation)||0,angle=rotation*Math.PI/180;
   const wall=kind==='wall_sconce'||kind==='wall_flood';
   const explicitDim=Number(lamp.lightDimFalloffFt),legacyOuter=Number(lamp.lightDimRadiusFt);
   const brightFt=clamp(Number(lamp.lightRadiusFt)||preset.radiusFt||16,5,Number.isFinite(explicitDim)?MAX_LIGHT_RADIUS_FT:80);
   const dimFalloffFt=Number.isFinite(explicitDim)?clamp(explicitDim,0,MAX_DIM_FALLOFF_FT):
    Number.isFinite(legacyOuter)?clamp(legacyOuter,brightFt,LEGACY_MAX_DIM_RADIUS_FT)-brightFt:
    clamp(brightFt*(DIM_RADIUS_RATIO-1),0,MAX_DIM_FALLOFF_FT);
   const brightRadius=brightFt/feet,dimRadius=(brightFt+dimFalloffFt)/feet;
   output.push({
    x:Number(lamp.x)-(wall?Math.sin(angle)*.15/meters:0),
    y:Number(lamp.y)+(wall?Math.cos(angle)*.15/meters:0),
    radius:brightRadius,brightRadius,dimRadius,
    cone:clamp(Number(lamp.beamAngleDeg)||preset.beamAngleDeg||360,20,360),
    rotation, id:lamp.id||''
   });
  }
  return output;
 }
 function strength(source,x,y,walls){
  const dx=x-source.x,dy=y-source.y,dist2=dx*dx+dy*dy;
  const bright=source.brightRadius||source.radius,dim=Math.max(bright,source.dimRadius||bright);
  if(dist2>dim*dim+MIN)return 0;
  if(source.cone<359.5&&dist2>MIN){
   const a=source.rotation*Math.PI/180;
   const facing=(-Math.sin(a)*dx+Math.cos(a)*dy)/Math.sqrt(dist2);
   if(facing<Math.cos(source.cone*Math.PI/360))return 0;
  }
  if(blocked(source.x,source.y,x,y,walls))return 0;
  const distance=Math.sqrt(dist2);
  if(distance<=bright||dim<=bright+MIN)return 1;
  return clamp(1-(distance-bright)/(dim-bright),0,1);
 }
 function reaches(source,x,y,walls){return strength(source,x,y,walls)>0}
 function resolution(columns,rows){
  const tiles=columns*rows;
  return tiles<=3000?5:tiles<=15000?3:tiles<=70000?2:1;
 }
 function compute(floor,units,options={}){
  const columns=clamp(Math.floor(Number(units?.columns)||1),1,500);
  const rows=clamp(Math.floor(Number(units?.rows)||1),1,500);
  const scale=clamp(Number(options.scale)||resolution(columns,rows),1,6)|0;
  const width=columns*scale,height=rows*scale;
  const items=floor?.items||[],walls=segments(items);
  const lamps=sources(items,units?.feetPerCell,options.presetFor);
  const mask=new Uint8Array(width*height);
  for(const light of lamps){
   const x0=Math.max(0,Math.floor((light.x-light.dimRadius)*scale));
   const x1=Math.min(width-1,Math.ceil((light.x+light.dimRadius)*scale));
   const y0=Math.max(0,Math.floor((light.y-light.dimRadius)*scale));
   const y1=Math.min(height-1,Math.ceil((light.y+light.dimRadius)*scale));
   const relevant=walls.filter(w=>{
    const left=Math.min(w.x1,w.x2),right=Math.max(w.x1,w.x2);
    const top=Math.min(w.y1,w.y2),bottom=Math.max(w.y1,w.y2);
    return right>=light.x-light.dimRadius&&left<=light.x+light.dimRadius&&bottom>=light.y-light.dimRadius&&top<=light.y+light.dimRadius;
   });
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=y*width+x,value=Math.round(strength(light,(x+.5)/scale,(y+.5)/scale,relevant)*255);
    if(value>mask[i])mask[i]=value; // unión: conservar la contribución más fuerte
   }
  }
  const sampleStrength=(x,y)=>{
   const ix=Math.floor(x*scale),iy=Math.floor(y*scale);
   return ix>=0&&iy>=0&&ix<width&&iy<height?mask[iy*width+ix]/255:0;
  };
  const sample=(x,y)=>sampleStrength(x,y)>0;
  function roomCoverage(room){
   const spans=room.spans?.length?room.spans:[room],areaTypes=spans.filter(s=>s&&[s.x,s.y,s.w,s.h].every(Number.isFinite)&&s.w>0&&s.h>0);
   let area=0,lit=0;
   for(const span of areaTypes){
    const lx=Math.max(0,Math.floor(span.x*scale)),rx=Math.min(width,Math.ceil((span.x+span.w)*scale));
    const ty=Math.max(0,Math.floor(span.y*scale)),by=Math.min(height,Math.ceil((span.y+span.h)*scale));
    for(let y=ty;y<by;y++)for(let x=lx;x<rx;x++){
     const cx=(x+.5)/scale,cy=(y+.5)/scale;
     if(cx<span.x||cx>=span.x+span.w||cy<span.y||cy>=span.y+span.h)continue;
     area++;if(mask[y*width+x])lit++;
    }
   }
   return {lit,total:area,percent:area?Math.round(lit/area*100):0};
  }
  return {width,height,scale,mask,lights:lamps.length,walls:walls.length,sample,sampleStrength,roomCoverage};
 }
 return Object.freeze({segments,blocked,sources,strength,reaches,compute,resolution});
});
