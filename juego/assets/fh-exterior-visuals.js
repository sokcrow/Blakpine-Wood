/* Electricidad 03: cableado exterior y luces mediante los sistemas 3D/FOW existentes.
 * Los GLB pertenecen a FHAssets: no se renderizan por segunda vez aquí.
 */
(function(root,factory){
 'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.FHExteriorVisuals=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const FT=.3048;
 function install({THREE,DATA,CELL,stories,service,applyFOW}){
  const grid=service?.exteriorGrid;
  if(!grid||!THREE||!stories)return null;
  const meshes=[];
  function tip(node){
   const it=node.it;
   // Los transformadores de suelo y cajas tienen la salida cerca de su carcasa.
   const head=(it.modelId==='transformador_caja_superficie'?3.6:
    it.modelId==='caja_distribucion_exterior'?4.2:
    (root.FHExteriorGrid.CONFIG[it.modelId]?.heightFt||20)*.87);
   return new THREE.Vector3(Number(it.x)*CELL,head*FT,Number(it.y)*CELL);
  }
  function cable(f,a,b,id){
   if(!stories[f]||!a||!b)return;
   const distance=a.distanceTo(b);
   if(distance<.04)return;
   const mid=a.clone().lerp(b,.5);mid.y-=Math.min(.9,distance*.034);
   const curve=new THREE.CatmullRomCurve3([a,mid,b],false,'centripetal');
   const geometry=new THREE.TubeGeometry(curve,Math.max(8,Math.min(32,Math.ceil(distance*2))),.009,3,false);
   const material=new THREE.MeshStandardMaterial({color:0x252b30,roughness:1});
   const mesh=new THREE.Mesh(geometry,material);
   mesh.name='FH_EXTERIOR_CABLE_'+id;mesh.userData.fhExteriorWire=true;
   mesh.castShadow=false;mesh.receiveShadow=false;
   if(typeof applyFOW==='function')applyFOW(mesh);
   stories[f].add(mesh);meshes.push(mesh);
  }
  for(const link of grid.links()){
   // No atravesar plantas/sótanos con una línea geométrica ficticia.
   if(link.from.f!==link.to.f)continue;
   cable(link.from.f,tip(link.from),tip(link.to),link.from.id+'_'+link.to.id);
  }
  for(const link of grid.panelLinks()){
   if(link.f!==link.node.f)continue;
   const panel=link.panel;
   cable(link.f,tip(link.node),new THREE.Vector3(Number(panel.x)*CELL,Math.max(.45,Number(panel.mountHeightFt)||5.5)*FT,Number(panel.y)*CELL),
    link.node.id+'_breaker_'+String(panel.id));
  }
  const lightIds=new Set();
  const update=()=>{
   const lights=root.FHLights;
   if(!lights)return;
   for(const node of grid.nodes){
    if(node.role!=='lamp')continue;
    const key='fh_exterior_'+node.floorId+'_'+node.id;
    lightIds.add(key);
    if(!grid.energized(node)){
     lights.removeDynamicSource(key);continue;
    }
    const brightFt=Math.max(1,Math.min(120,Number(node.it.exteriorBrightFt)||30));
    const dimFt=Math.max(0,Math.min(120,Number(node.it.exteriorDimFt)||30));
    lights.setDynamicSource(key,{floor:node.f,x:Number(node.it.x)*CELL,z:Number(node.it.y)*CELL,
     brightRadius:brightFt*FT,dimRadius:(brightFt+dimFt)*FT,radius:brightFt*FT,
     angleDeg:360});
   }
  };
  const dispose=()=>{
   for(const mesh of meshes){mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
   for(const id of lightIds)root.FHLights?.removeDynamicSource(id);
  };
  update();return Object.freeze({update,dispose,meshes});
 }
 return Object.freeze({install});
});
