/* Blakpine Wood — partículas y superficies meteorológicas ligeras (Three.js r128). */
(function(root,factory){
 'use strict';
 const api=factory();
 if(root)root.FHWeatherRenderer=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function createMaskTexture(THREE,kind){
  const cv=document.createElement('canvas');cv.width=cv.height=128;
  const g=cv.getContext('2d'),id=g.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const i=(y*128+x)*4;
   const wave=Math.sin(x*.27+y*.13)+Math.cos(y*.31-x*.17)+Math.sin((x+y)*.39);
   const alpha=kind==='snow'?(wave>-.7?165+Math.min(80,wave*34):0):
     Math.max(0,185-Math.hypot(x-64,y-64)*4.5);
   id.data[i]=kind==='snow'?232:70;
   id.data[i+1]=kind==='snow'?238:97;
   id.data[i+2]=kind==='snow'?240:109;
   id.data[i+3]=clamp(alpha,0,255);
  }
  g.putImageData(id,0,0);
  const tex=new THREE.CanvasTexture(cv);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearFilter;
  tex.needsUpdate=true;
  return tex;
 }
 // Mismas regiones exteriores que utiliza el motor; nunca se simulan interiores.
 function createOutsideCache(isOutside, floorIndex, cell=1.524){
  let activeFloor=null;
  const cache=new Map();
  const scale=Math.max(.08,Math.min(.15,cell/8));
  function outside(x,z){
   const f=Number(floorIndex?.())||0;
   if(f!==activeFloor){cache.clear();activeFloor=f;}
   const key=Math.floor(x/scale)+','+Math.floor(z/scale);
   if(cache.has(key))return cache.get(key);
   const result=isOutside?.(x,z)===true;
   if(cache.size>8192)cache.clear();
   cache.set(key,result);
   return result;
  }
  return {outside,floor:()=>Number(floorIndex?.())||0};
 }
 function createRuntime({THREE,scene,columns=16,rows=22,cell=1.524,actor,floorY,isOutside,floorIndex}={}){
  if(!THREE||!scene)return null;
  const maxX=columns*cell,maxZ=rows*cell,originalFog=scene.fog;
  const outdoor=createOutsideCache(isOutside,floorIndex,cell);
  const drops=180,flakes=190;
  const rainPos=new Float32Array(drops*6),snowPos=new Float32Array(flakes*3);
  const rainPoints=[],snowPoints=[];
  const rand=(a,b)=>a+Math.random()*(b-a);
  for(let i=0;i<drops;i++)rainPoints.push({x:rand(-9,9),y:rand(.3,8),z:rand(-9,9)});
  for(let i=0;i<flakes;i++)snowPoints.push({x:rand(-9,9),y:rand(.3,8),z:rand(-9,9),s:rand(.4,1.2)});
  const rainGeometry=new THREE.BufferGeometry();
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  rainGeometry.setDrawRange(0,0);
  const snowGeometry=new THREE.BufferGeometry();
  snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
  snowGeometry.setDrawRange(0,0);
  const rainMat=new THREE.LineBasicMaterial({color:0x8aaec8,transparent:true,opacity:.62,depthWrite:false});
  const snowMat=new THREE.PointsMaterial({color:0xe4e9ed,size:.12,sizeAttenuation:true,transparent:true,opacity:.92,depthWrite:false});
  const rain=new THREE.LineSegments(rainGeometry,rainMat),snow=new THREE.Points(snowGeometry,snowMat);
  rain.frustumCulled=false;snow.frustumCulled=false;rain.visible=snow.visible=false;
  const particles=new THREE.Group();particles.add(rain,snow);scene.add(particles);
  const snowTex=createMaskTexture(THREE,'snow'),puddleTex=createMaskTexture(THREE,'puddle');
  // La máscara de intemperie es estática por piso. No se recalcula por fotograma.
  const imageSources=[snowTex,puddleTex].map(tex=>{
   const cv=tex.image,g=cv.getContext('2d');
   return {tex,g,pixels:new Uint8ClampedArray(g.getImageData(0,0,128,128).data)};
  });
  let maskedFloor=null,visibleOutdoorPixels=0;
  function refreshGroundMask(){
   const floor=outdoor.floor();
   if(maskedFloor===floor)return;
   maskedFloor=floor;
   const outdoorPixels=new Uint8Array(128*128);
   visibleOutdoorPixels=0;
   for(let py=0;py<128;py++)for(let px=0;px<128;px++){
    const outside=isOutside?.((px+.5)/128*maxX,(py+.5)/128*maxZ)===true;
    outdoorPixels[py*128+px]=outside?1:0;
    if(outside)visibleOutdoorPixels++;
   }
   for(const source of imageSources){
    const image=source.g.createImageData(128,128);
    image.data.set(source.pixels);
    for(let p=0;p<outdoorPixels.length;p++)if(!outdoorPixels[p])image.data[p*4+3]=0;
    source.g.putImageData(image,0,0);
    source.tex.needsUpdate=true;
   }
  }
  const groundGeometry=new THREE.PlaneGeometry(maxX,maxZ);
  const snowGroundMaterial=new THREE.MeshLambertMaterial({
   map:snowTex,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
  });
  const snowGround=new THREE.Mesh(groundGeometry,snowGroundMaterial);
  snowGround.rotation.x=-Math.PI/2;snowGround.position.set(maxX/2,.032,maxZ/2);
  snowGround.visible=false;scene.add(snowGround);
  const puddleGeometry=new THREE.PlaneGeometry(1,1);
  const puddleMaterial=new THREE.MeshLambertMaterial({
   map:puddleTex,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
   color:0x93a7b6,side:THREE.DoubleSide
  });
  const puddleCount=14,puddles=new THREE.InstancedMesh(puddleGeometry,puddleMaterial,puddleCount);
  const dummy=new THREE.Object3D();
  const puddleSites=Array.from({length:puddleCount},()=>({
   x:rand(.7,Math.max(.71,maxX-.7)),z:rand(.7,Math.max(.71,maxZ-.7)),
   rotation:rand(0,Math.PI*2),sx:rand(.55,1.6),sz:rand(.35,.9)
  }));
  let visiblePuddles=0;
  function refreshPuddleSites(){
   visiblePuddles=0;
   for(let i=0;i<puddleCount;i++){
    const p=puddleSites[i];
    if(outdoor.outside(p.x,p.z)){
     dummy.position.set(p.x,.044,p.z);
     dummy.rotation.set(-Math.PI/2,0,p.rotation);
     dummy.scale.set(p.sx,p.sz,1);
     dummy.updateMatrix();puddles.setMatrixAt(visiblePuddles++,dummy.matrix);
    }
   }
   puddles.count=visiblePuddles;
   puddles.instanceMatrix.needsUpdate=true;
  }
  puddles.visible=false;scene.add(puddles);
  let oldFog=-1,lastSnow=-1,lastWet=-1,lastFloor=null;
  const fogModes=[null,
   new THREE.FogExp2(0x69777d,.022),
   new THREE.FogExp2(0x69777d,.041),
   new THREE.FogExp2(0x69777d,.071)];
  function update(dt=0,v){
   if(!v)return;
   const f=outdoor.floor();
   if(lastFloor!==f){
    lastFloor=f;
    refreshGroundMask();
    refreshPuddleSites();
    lastFog=-1;lastSnow=-1;lastWet=-1;
   }
   const y=Number(floorY?.())||0,where=actor?.()||{x:maxX/2,z:maxZ/2};
   const x=Number(where.x)||0,z=Number(where.z)||0;
   const actorOutside=outdoor.outside(x,z);
   const rainN=v.phase==='lluvia'?Math.round(drops*v.intensity):
     v.phase==='aguanieve'?Math.round(drops*v.intensity*.5):0;
   const snowN=v.phase==='nieve'?Math.round(flakes*v.intensity):
     v.phase==='aguanieve'?Math.round(flakes*v.intensity*.55):0;
   particles.position.set(x,y,z);
   const delta=clamp(Number(dt)||0,0,.06);
   let visibleRain=0;
   if(rainN>0){
    const speed=v.type==='tormenta'?11:8;
    for(let i=0;i<rainN;i++){
     const p=rainPoints[i];p.y-=delta*speed;
     if(p.y<0){p.y+=8;p.x=rand(-9,9);p.z=rand(-9,9)}
     if(!outdoor.outside(x+p.x,z+p.z))continue;
     const o=visibleRain*6;
     rainPos[o]=p.x;rainPos[o+1]=p.y;rainPos[o+2]=p.z;
     rainPos[o+3]=p.x+.04;rainPos[o+4]=p.y+.28;rainPos[o+5]=p.z+.02;
     visibleRain++;
    }
    if(visibleRain){
     rainGeometry.setDrawRange(0,visibleRain*2);
     rainGeometry.attributes.position.needsUpdate=true;
    }
   }
   rain.visible=visibleRain>0;
   let visibleSnow=0;
   if(snowN>0){
    for(let i=0;i<snowN;i++){
     const p=snowPoints[i];p.y-=delta*(.65+p.s);
     p.x+=Math.sin(p.y*1.4+i)*delta*.12;
     if(p.y<0){p.y+=8;p.x=rand(-9,9);p.z=rand(-9,9)}
     if(!outdoor.outside(x+p.x,z+p.z))continue;
     const o=visibleSnow*3;
     snowPos[o]=p.x;snowPos[o+1]=p.y;snowPos[o+2]=p.z;
     visibleSnow++;
    }
    if(visibleSnow){
     snowGeometry.setDrawRange(0,visibleSnow);
     snowGeometry.attributes.position.needsUpdate=true;
    }
   }
   snow.visible=visibleSnow>0;
   // La niebla pertenece al exterior. No cubrir el corredor ni la cabina.
   const fogLevel=actorOutside?clamp(Math.floor(Number(v.fog)||0),0,3):0;
   if(fogLevel!==oldFog){
    oldFog=fogLevel;
    scene.fog=fogLevel?fogModes[fogLevel]:originalFog;
   }
   snowGround.position.y=y+.032;puddles.position.y=y;
   const snowCoverage=clamp(Number(v.snow)||0,0,1),wet=clamp(Number(v.wetness)||0,0,1);
   if(Math.abs(snowCoverage-lastSnow)>.002){
    lastSnow=snowCoverage;
    snowGround.visible=visibleOutdoorPixels>0&&snowCoverage>.025;
    snowGroundMaterial.opacity=snowCoverage*.88;
   }
   if(Math.abs(wet-lastWet)>.002){
    lastWet=wet;
    puddles.visible=visiblePuddles>0&&wet>.12;
    puddleMaterial.opacity=wet*.46;
   }else if(visiblePuddles===0)puddles.visible=false;
  }
  function dispose(){
   scene.remove(particles,snowGround,puddles);scene.fog=originalFog;
   rainGeometry.dispose();snowGeometry.dispose();rainMat.dispose();snowMat.dispose();
   groundGeometry.dispose();snowGroundMaterial.dispose();puddleGeometry.dispose();puddleMaterial.dispose();
   snowTex.dispose();puddleTex.dispose();
  }
  return {update,dispose};
 }
 return Object.freeze({createRuntime,createOutsideCache});
});