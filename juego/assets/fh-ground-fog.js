/* Blakpine Wood — niebla física exterior y ocultación del límite de cámara.
   Three.js r128. No modifica visibilidad, colisiones ni el contrato del mapa. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(root)root.FHGroundFog=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULTS=Object.freeze({radiusFeet:3,recoverySeconds:4,density:.65,maskSize:128});
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
 function settings(cfg={}){
  return {radius:clamp(finite(cfg.radiusFeet,3),.25,20)*.3048,
   recovery:clamp(finite(cfg.recoverySeconds,4),.5,30),
   density:clamp(finite(cfg.density,.65),0,1),
   maskSize:clamp(Math.floor(finite(cfg.maskSize,128)),32,256)};
 }
 function surface(size){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas 2D no disponible');
  return {canvas,ctx,image:ctx.createImageData(size,size)};
 }
 function createRuntime({THREE,scene,camera,columns=16,rows=22,cell=1.524,
  actor,floorY,floorIndex,isOutside,sightTexture=null,visionDistance=null,config={}}={}){
  if(!THREE||!scene)return null;
  const cfg=settings(config),size=cfg.maskSize;
  const maxX=Math.max(.1,columns*cell),maxZ=Math.max(.1,rows*cell);
  const exposure=surface(size),footprints=surface(size);
  const exteriorMap=new THREE.CanvasTexture(exposure.canvas);
  const trailMap=new THREE.CanvasTexture(footprints.canvas);
  for(const tex of [exteriorMap,trailMap]){
   tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;
   tex.generateMipmaps=false;
  }
  const trail=new Float32Array(size*size);
  const initialSight=typeof sightTexture==='function'?sightTexture():sightTexture;
  const uniforms={
   uTime:{value:0},uOutside:{value:exteriorMap},uTrail:{value:trailMap},
   uSight:{value:initialSight},uHasSight:{value:initialSight?1:0},
   uDensity:{value:cfg.density},uActor:{value:new THREE.Vector2()},
   uClearRadius:{value:cfg.radius},
   uRadius:{value:Math.min(14,Math.max(6,Math.min(maxX,maxZ)))}
  };
  const noise=[
   'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
   'float noise(vec2 p){',
   ' vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
   ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),',
   ' mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);',
   '}'
  ].join('\n');
  const material=new THREE.ShaderMaterial({
   uniforms,transparent:true,depthWrite:false,depthTest:true,
   side:THREE.DoubleSide,
   vertexShader:[
    'varying vec2 vUv; varying vec2 vWorld;',
    'uniform float uTime;',noise,
    'void main(){',
    ' vUv=uv; vec3 p=position;',
    ' float heightNoise=noise(uv*15.0+vec2(uTime*.055,uTime*.024));',
    ' p.z+=.19*heightNoise;', // Tras rotación -90°, Z local corresponde a altura.
    ' vec4 world=modelMatrix*vec4(p,1.0);vWorld=world.xz;',
    ' gl_Position=projectionMatrix*viewMatrix*world;',
    '}'
   ].join('\n'),
   fragmentShader:[
    'varying vec2 vUv; varying vec2 vWorld;',
    'uniform sampler2D uOutside; uniform sampler2D uTrail;',
    'uniform sampler2D uSight; uniform float uHasSight;',
    'uniform float uDensity; uniform float uTime; uniform float uRadius;',
    'uniform float uClearRadius;',
    'uniform vec2 uActor;',noise,
    'void main(){',
    ' if(texture2D(uOutside,vUv).r<.5)discard;',
    ' float sight=1.0;',
    ' if(uHasSight>.5)sight=texture2D(uSight,vUv).r;',
    ' if(sight<.015)discard;',
    ' vec2 wind=vec2(uTime*.025,-uTime*.014);',
    ' float n=.68*noise(vUv*18.0+wind)+.32*noise(vUv*39.0-wind*.6);',
    ' float alpha=uDensity*smoothstep(.24,.78,n);',
    ' float nearClear=1.0-smoothstep(uClearRadius*.7,uClearRadius,distance(vWorld,uActor));',
    ' alpha*=1.0-max(texture2D(uTrail,vUv).r,nearClear);',
    ' alpha*=sight;',
    ' alpha*=1.0-smoothstep(uRadius*.75,uRadius,distance(vWorld,uActor));',
    ' if(alpha<.012)discard;',
    ' gl_FragColor=vec4(vec3(.65,.70,.72),alpha);',
    '}'
   ].join('\n')
  });
  const geometry=new THREE.PlaneGeometry(maxX,maxZ,64,64);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(maxX/2,.07,maxZ/2);
  mesh.visible=false;mesh.renderOrder=1;
  scene.add(mesh);
  // La niebla de distancia de Three.js afecta toda la escena. Bajo techo se
  // sustituye por velos situados SOLO sobre las celdas exteriores: se ven
  // por ventanas o puertas sin cubrir los muebles ni las habitaciones.
  const hazeUniforms={
   uOutside:uniforms.uOutside,uTrail:uniforms.uTrail,
   uSight:uniforms.uSight,uHasSight:uniforms.uHasSight,
   uActor:uniforms.uActor,uRadius:uniforms.uRadius,
   uClearRadius:uniforms.uClearRadius,uTime:uniforms.uTime,
   uStrength:{value:.15}
  };
  const hazeMaterial=new THREE.ShaderMaterial({
   uniforms:hazeUniforms,transparent:true,depthWrite:false,depthTest:true,
   side:THREE.DoubleSide,
   vertexShader:[
    'varying vec2 vUv; varying vec2 vWorld;',
    'void main(){',
    ' vUv=uv; vec4 world=modelMatrix*vec4(position,1.0);',
    ' vWorld=world.xz; gl_Position=projectionMatrix*viewMatrix*world;',
    '}'
   ].join('\n'),
   fragmentShader:[
    'varying vec2 vUv; varying vec2 vWorld;',
    'uniform sampler2D uOutside,uTrail,uSight;',
    'uniform float uHasSight,uRadius,uClearRadius,uStrength,uTime;',
    'uniform vec2 uActor;',
    'void main(){',
    ' if(texture2D(uOutside,vUv).r<.5)discard;',
    ' float sight=uHasSight>.5?texture2D(uSight,vUv).r:1.0;',
    ' if(sight<.015)discard;',
    ' float dist=distance(vWorld,uActor);',
    ' float fade=smoothstep(1.0,uRadius,dist);',
    ' float clear=1.0-smoothstep(uClearRadius*.7,uClearRadius,dist);',
    ' float ripple=.92+.08*sin(vWorld.x*.73+vWorld.y*.49+uTime*.28);',
    ' float alpha=uStrength*(.32+.68*fade)*sight*ripple;',
    ' alpha*=1.0-max(texture2D(uTrail,vUv).r,clear);',
    ' if(alpha<.012)discard;',
    ' gl_FragColor=vec4(vec3(.65,.70,.72),alpha);',
    '}'
   ].join('\n')
  });
  // Tres capas planas, compartiendo la misma geometría y máscara GPU.
  // Evita las partículas circulares antiguas y las múltiples celdas 3D.
  const hazeHeights=[.55,1.35,2.25];
  const hazeLayers=hazeHeights.map(height=>{
   const layer=new THREE.Mesh(geometry,hazeMaterial);
   layer.rotation.x=-Math.PI/2;
   layer.position.set(maxX/2,height,maxZ/2);
   layer.visible=false;layer.renderOrder=2;
   scene.add(layer);
   return layer;
  });
  const previousFog=scene.fog;
  const distanceFog=new THREE.Fog(0x69777d,1,2);
  let activeFloor=NaN,accumulator=0,clock=0,lastX=NaN,lastZ=NaN,farUsed=NaN,climateUsed=-1;
  function upload(s,source){
   const data=s.image.data;
   for(let i=0;i<source.length;i++){
    const value=source[i];
    data[i*4]=value;data[i*4+1]=value;data[i*4+2]=value;data[i*4+3]=255;
   }
   s.ctx.putImageData(s.image,0,0);
  }
  function loadFloor(){
   const mask=new Uint8Array(size*size);
   let open=0;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const exposed=isOutside?.((x+.5)*maxX/size,(y+.5)*maxZ/size)===true;
    mask[y*size+x]=exposed?255:0;
    if(exposed)open++;
   }
   upload(exposure,mask);exteriorMap.needsUpdate=true;
   trail.fill(0);upload(footprints,trail);trailMap.needsUpdate=true;
   accumulator=0;lastX=lastZ=NaN;mesh.visible=open>0;
   for(const layer of hazeLayers)layer.visible=open>0;
  }
  function stamp(x,z){
   const cx=x/maxX*size,cy=z/maxZ*size;
   const rx=Math.max(.5,cfg.radius/maxX*size),ry=Math.max(.5,cfg.radius/maxZ*size);
   for(let py=Math.max(0,Math.floor(cy-ry));py<=Math.min(size-1,Math.ceil(cy+ry));py++){
    for(let px=Math.max(0,Math.floor(cx-rx));px<=Math.min(size-1,Math.ceil(cx+rx));px++){
     const dist=Math.hypot((px+.5-cx)/rx,(py+.5-cy)/ry);
     if(dist>=1)continue;
     const i=py*size+px;
     trail[i]=Math.max(trail[i],255*clamp((1-dist)/.35,0,1));
    }
   }
  }
  function updateTrail(seconds,x,z,clear){
   const fade=255*seconds/cfg.recovery;
   for(let i=0;i<trail.length;i++)trail[i]=Math.max(0,trail[i]-fade);
   if(clear){
    const dist=Math.hypot(x-lastX,z-lastZ);
    if(Number.isFinite(dist)&&dist<cfg.radius*3){
     const steps=Math.max(1,Math.ceil(dist/Math.max(.2,cfg.radius*.4)));
     for(let i=1;i<steps;i++)stamp(lastX+(x-lastX)*i/steps,lastZ+(z-lastZ)*i/steps);
    }
    stamp(x,z);lastX=x;lastZ=z;
   }else lastX=lastZ=NaN;
   upload(footprints,trail);trailMap.needsUpdate=true;
  }
  function update(dt=0,weather=null){
   const f=Math.floor(finite(floorIndex?.(),0));
   if(f!==activeFloor){activeFloor=f;loadFloor();}
   const position=actor?.()||{x:0,z:0},x=finite(position.x,0),z=finite(position.z,0);
   const outside=isOutside?.(x,z)===true;
   const seconds=clamp(finite(dt,0),0,.25);
   accumulator+=seconds;clock+=seconds;
   const baseY=finite(floorY?.(),0);
   mesh.position.y=baseY+.07;
   for(let i=0;i<hazeLayers.length;i++)hazeLayers[i].position.y=baseY+hazeHeights[i];
   uniforms.uActor.value.set(x,z);uniforms.uTime.value=clock;
   const sight=typeof sightTexture==='function'?sightTexture():sightTexture;
   uniforms.uSight.value=sight;uniforms.uHasSight.value=sight?1:0;
   const climate=clamp(Math.floor(finite(weather?.fog,0)),0,3);
   hazeUniforms.uStrength.value=.15+climate*.025;
   const cameraFar=finite(camera?.far,Math.hypot(maxX,maxZ));
   const requested=typeof visionDistance==='function'?visionDistance():visionDistance;
   const limit=Number.isFinite(requested)&&requested>0?Math.min(cameraFar,requested):cameraFar;
   const far=Math.max(10,limit);
   if(farUsed!==far||climateUsed!==climate){
    farUsed=far;climateUsed=climate;
    distanceFog.near=far*(.60-climate*.065);
    distanceFog.far=far*(.88-climate*.075);
   }
   scene.fog=outside?distanceFog:previousFog;
   if(accumulator>=.1){
    updateTrail(accumulator,x,z,outside);accumulator=0;
   }
  }
  function dispose(){
   scene.remove(mesh);
   for(const layer of hazeLayers)scene.remove(layer);
   if(scene.fog===distanceFog)scene.fog=previousFog;
   geometry.dispose();material.dispose();hazeMaterial.dispose();
   exteriorMap.dispose();trailMap.dispose();
  }
  return {update,dispose,mesh,hazeLayers,settings:cfg};
 }
 return Object.freeze({DEFAULTS,settings,createRuntime});
});
