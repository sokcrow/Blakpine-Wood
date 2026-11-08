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
  const cv=document.createElement('canvas');cv.width=cv.height=64;
  const g=cv.getContext('2d'),id=g.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const i=(y*64+x)*4;
   const wave=Math.sin(x*.27+y*.13)+Math.cos(y*.31-x*.17)+Math.sin((x+y)*.39);
   const alpha=kind==='snow'?(wave>-.7?165+Math.min(80,wave*34):0):
     Math.max(0,185-Math.hypot(x-32,y-32)*9);
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
 function createRuntime({THREE,scene,columns=16,rows=22,cell=1.524,actor,floorY}={}){
  if(!THREE||!scene)return null;
  const maxX=columns*cell,maxZ=rows*cell,originalFog=scene.fog;
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
  for(let i=0;i<puddleCount;i++){
   dummy.position.set(rand(.7,Math.max(.71,maxX-.7)),.044,rand(.7,Math.max(.71,maxZ-.7)));
   dummy.rotation.set(-Math.PI/2,0,rand(0,Math.PI*2));
   dummy.scale.set(rand(.55,1.6),rand(.35,.9),1);
   dummy.updateMatrix();puddles.setMatrixAt(i,dummy.matrix);
  }
  puddles.instanceMatrix.needsUpdate=true;puddles.visible=false;scene.add(puddles);
  let oldFog=-1,lastSnow=-1,lastWet=-1;
  function update(dt=0,v){
   if(!v)return;
   const y=Number(floorY?.())||0,where=actor?.()||{x:maxX/2,z:maxZ/2};
   const rainN=v.phase==='lluvia'?Math.round(drops*v.intensity):
     v.phase==='aguanieve'?Math.round(drops*v.intensity*.5):0;
   const snowN=v.phase==='nieve'?Math.round(flakes*v.intensity):
     v.phase==='aguanieve'?Math.round(flakes*v.intensity*.55):0;
   particles.position.set(Number(where.x)||0,y,Number(where.z)||0);
   rain.visible=rainN>0;snow.visible=snowN>0;
   const delta=clamp(Number(dt)||0,0,.06);
   if(rainN>0){
    const speed=v.type==='tormenta'?11:8;
    for(let i=0;i<rainN;i++){
     const p=rainPoints[i];p.y-=delta*speed;
     if(p.y<0){p.y+=8;p.x=rand(-9,9);p.z=rand(-9,9)}
     let o=i*6;rainPos[o]=p.x;rainPos[o+1]=p.y;rainPos[o+2]=p.z;
     rainPos[o+3]=p.x+.04;rainPos[o+4]=p.y+.28;rainPos[o+5]=p.z+.02;
    }
    rainGeometry.setDrawRange(0,rainN*2);
    rainGeometry.attributes.position.needsUpdate=true;
   }
   if(snowN>0){
    for(let i=0;i<snowN;i++){
     const p=snowPoints[i];p.y-=delta*(.65+p.s);
     p.x+=Math.sin(p.y*1.4+i)*delta*.12;
     if(p.y<0){p.y+=8;p.x=rand(-9,9);p.z=rand(-9,9)}
     const o=i*3;snowPos[o]=p.x;snowPos[o+1]=p.y;snowPos[o+2]=p.z;
    }
    snowGeometry.setDrawRange(0,snowN);
    snowGeometry.attributes.position.needsUpdate=true;
   }
   if(v.fog!==oldFog){
    oldFog=v.fog;
    scene.fog=v.fog?new THREE.FogExp2(0x69777d,[0,.022,.041,.071][v.fog]):originalFog;
   }
   snowGround.position.y=y+.032;puddles.position.y=y;
   const snowCoverage=clamp(Number(v.snow)||0,0,1),wet=clamp(Number(v.wetness)||0,0,1);
   if(Math.abs(snowCoverage-lastSnow)>.002){
    lastSnow=snowCoverage;snowGround.visible=snowCoverage>.025;
    snowGroundMaterial.opacity=snowCoverage*.88;
   }
   if(Math.abs(wet-lastWet)>.002){
    lastWet=wet;puddles.visible=wet>.12;puddleMaterial.opacity=wet*.46;
   }
  }
  function dispose(){
   scene.remove(particles,snowGround,puddles);scene.fog=originalFog;
   rainGeometry.dispose();snowGeometry.dispose();rainMat.dispose();snowMat.dispose();
   groundGeometry.dispose();snowGroundMaterial.dispose();puddleGeometry.dispose();puddleMaterial.dispose();
   snowTex.dispose();puddleTex.dispose();
  }
  return {update,dispose};
 }
 return Object.freeze({createRuntime});
});