/* Representación liviana y decorativa de obras. Sin colisión ni iluminación propias. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHConstructionVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function install({THREE,DATA,CELL,stories,runtime}={}){
  if(!THREE||!Array.isArray(stories)||!runtime)return null;
  const groups=[],posts=[],rails=[];
  const material=new THREE.MeshLambertMaterial({color:0xb18a52});
  const stripe=new THREE.MeshLambertMaterial({color:0xc99239});
  const placements=(DATA?.properties||[]).filter(p=>p?.construction?.simulated===true
   &&Array.isArray(p.polygon)&&p.polygon.length>=3);
  for(const prop of placements){
   const f=(DATA.floors||[]).findIndex(floor=>String(floor.id)===String(prop.floorId));
   if(f<0||!stories[f])continue;
   const points=prop.polygon.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(points.length<3)continue;
   const group=new THREE.Group();
   group.name='FH_OBRA_'+String(prop.id);
   const localPosts=[],localRails=[];
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const ax=a.x*CELL,az=a.y*CELL,bx=b.x*CELL,bz=b.y*CELL;
    const pole=new THREE.Mesh(new THREE.BoxGeometry(.07,1.35,.07),material);
    pole.position.set(ax,.675,az);pole.castShadow=false;group.add(pole);localPosts.push(pole);
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    if(length>.1){
     const beam=new THREE.Mesh(new THREE.BoxGeometry(length,.06,.06),stripe);
     beam.position.set((ax+bx)/2,.98,(az+bz)/2);
     beam.rotation.y=-Math.atan2(dz,dx);beam.castShadow=false;group.add(beam);localRails.push(beam);
    }
   }
   stories[f].add(group);groups.push({group,prop,localPosts,localRails});
   posts.push(...localPosts);rails.push(...localRails);
  }
  function update(){
   for(const entry of groups){
    const state=runtime.status(entry.prop.id);
    const unfinished=state&&!state.finished;
    entry.group.visible=!!unfinished;
    for(const rail of entry.localRails)rail.visible=!!unfinished&&state.progress>=15;
   }
  }
  function dispose(){
   for(const {group} of groups)group.parent?.remove(group);
   // Las geometrías son individuales; los dos materiales se comparten.
   for(const mesh of [...posts,...rails])mesh.geometry.dispose();
   material.dispose();stripe.dispose();
  }
  update();
  return Object.freeze({update,dispose,count:groups.length});
 }
 return Object.freeze({install});
});
