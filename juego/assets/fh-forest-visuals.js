/* Three.js r128: GLB compartidos, instancias por especie/sector, sin alterar muebles. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FHForestVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function install({THREE,runtime,parent,baseURL,applySightMask,loader,onError,surfaceRects}={}){
  const group=new THREE.Group();group.name='FHForest';parent.add(group);
  const batches=new Map(),slots=new Map(),ownedGeometries=new Set(),ownedMaterials=new Set(),textures=new Set();
  let disposed=false;
  const hide=new THREE.Matrix4().makeScale(0,0,0);
  const unsubscribe=runtime.onRemove(tree=>{for(const {mesh,index} of slots.get(tree.id)||[]){mesh.setMatrixAt(index,hide);mesh.instanceMatrix.needsUpdate=true;}});
  function rememberMaterial(material){for(const m of Array.isArray(material)?material:[material]){ownedMaterials.add(m);for(const v of Object.values(m))if(v?.isTexture){v.magFilter=v.minFilter=THREE.NearestFilter;v.generateMipmaps=false;v.needsUpdate=true;textures.add(v);}}}
  function mountTerrain(){
   const t=runtime.terrain,material=new THREE.MeshLambertMaterial({color:0x34402a});ownedMaterials.add(material);
   // Hasta 16x16 celdas por malla: culling nativo y límites de geometría acotados.
   for(let z0=0;z0<t.nz;z0+=16)for(let x0=0;x0<t.nx;x0+=16){
    const w=Math.min(16,t.nx-x0),d=Math.min(16,t.nz-z0),positions=[],indices=[];
    const xOrigin=x0*t.sx,zOrigin=z0*t.sz;
    for(let z=0;z<=d;z++)for(let x=0;x<=w;x++)positions.push(x*t.sx,t.vertex(x+x0,z+z0),z*t.sz);
    for(let z=0;z<d;z++)for(let x=0;x<w;x++){
     const a=z*(w+1)+x,b=a+1,c=a+w+1,e=c+1;
     const left=(x+x0)*t.sx,top=(z+z0)*t.sz,right=left+t.sx,bottom=top+t.sz;
     if(!surfaceRects){indices.push(a,c,b,b,c,e);continue;}
     const cuts=surfaceRects.filter(r=>r.x<right&&r.x+r.w>left&&r.z<bottom&&r.z+r.d>top);
     if(cuts.some(r=>r.x<=left+1e-9&&r.x+r.w>=right-1e-9&&r.z<=top+1e-9&&r.z+r.d>=bottom-1e-9)){indices.push(a,c,b,b,c,e);continue;}
     for(const r of cuts)for(const triangle of [[a,c,b],[b,c,e]]){
      let polygon=triangle.map(i=>({x:positions[i*3]+xOrigin,y:positions[i*3+1],z:positions[i*3+2]+zOrigin}));
      for(const [axis,bound,sign] of [['x',r.x,1],['x',r.x+r.w,-1],['z',r.z,1],['z',r.z+r.d,-1]]){
       const clipped=[];
       for(let i=0;i<polygon.length;i++){
        const from=polygon[i],to=polygon[(i+1)%polygon.length],inA=(from[axis]-bound)*sign>=-1e-9,inB=(to[axis]-bound)*sign>=-1e-9;
        if(inA)clipped.push(from);
        if(inA!==inB){const u=(bound-from[axis])/(to[axis]-from[axis]);clipped.push({x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u,z:from.z+(to.z-from.z)*u});}
       }
       polygon=clipped;
      }
      const first=positions.length/3;
      for(const p of polygon)positions.push(p.x-xOrigin,p.y,p.z-zOrigin);
      for(let i=1;i<polygon.length-1;i++)indices.push(first,first+i,first+i+1);
     }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();ownedGeometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(xOrigin,0,zOrigin);mesh.frustumCulled=true;group.add(mesh);
   }
  }
  function mountModel(model,source){
   source.updateMatrixWorld(true);const parts=[];
   source.traverse(node=>{if(node.isMesh){rememberMaterial(node.material);const geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);geometry.scale(.3048,.3048,.3048);geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.add(geometry);parts.push({geometry,material:node.material});}});
   // La escala pertenece al pack. No se normaliza contra la copa ni contra muebles.
   const bySector=new Map();for(const tree of runtime.trees)if(tree.modelId===model.id){if(!bySector.has(tree.sector))bySector.set(tree.sector,[]);bySector.get(tree.sector).push(tree);}
   for(const [key,trees] of bySector){
    const sector=new THREE.Group();sector.name='forest:'+key+':'+model.id;
    const [ix,iz]=key.split(':').map(Number),size=runtime.terrain.config.forest.sectorM;sector.position.set(ix*size,0,iz*size);group.add(sector);
    for(const part of parts){
     const mesh=new THREE.InstancedMesh(part.geometry,part.material,trees.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
     // r128 no calcula límites de InstancedMesh: boundingSphere en coordenadas del sector.
     const geometry=part.geometry.clone();ownedGeometries.add(geometry);mesh.geometry=geometry;
     const radius=Math.max(...trees.map(t=>Math.hypot(t.canopyRadius,t.height+Math.abs(t.y))));
     geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(size/2,0,size/2),size+radius);
     const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),axis=new THREE.Vector3(0,1,0);
     trees.forEach((tree,index)=>{
      q.setFromAxisAngle(axis,tree.rotation);matrix.compose(new THREE.Vector3(tree.x-ix*size,tree.y,tree.z-iz*size),q,scale);mesh.setMatrixAt(index,matrix);
      if(!slots.has(tree.id))slots.set(tree.id,[]);slots.get(tree.id).push({mesh,index});
     });
     mesh.frustumCulled=true;sector.add(mesh);batches.set(model.id+':'+key+':'+sector.children.length,mesh);
    }
   }
  }
  const ready=(async()=>{
   if(!runtime.enabled)return;
   mountTerrain();applySightMask(group);
   const gltf=loader||new THREE.GLTFLoader();
   const used=new Set(runtime.trees.map(t=>t.modelId));
   await Promise.all([...used].map(async id=>{
    const model=runtime.catalog.get(id),url=new URL(model.archivo,baseURL).href;
    try{
     const source=await new Promise((resolve,reject)=>gltf.load(url,g=>resolve(g.scene),undefined,reject));
     if(disposed){source.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m?.dispose();});return;}
     mountModel(model,source);applySightMask(group);
     // Geometría original del cargador ya se copió; materiales/texturas siguen compartidos.
     source.traverse(n=>n.geometry?.dispose());
    }catch(error){onError?.(error,id);throw error;}
   }));
  })();
  return {group,batches,slots,ready,dispose(){if(disposed)return;disposed=true;unsubscribe();parent.remove(group);for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of textures)t.dispose();}};
 }
 return Object.freeze({install});
});
