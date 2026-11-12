/* Blakpine-Wood: barreras metálicas. Dos variantes opcionales del segmento fence v1.
 * Ninguna variante se añade a los muros rojos, FOW u oclusión de luces.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHBarriers=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PROFILE=Object.freeze({
  railing:Object.freeze({heightFt:3.5,action:'jump',seconds:.48,lift:.55}),
  mesh:Object.freeze({heightFt:6,action:'climb',seconds:.95,lift:1.0})
 });
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const isBarrier=it=>it?.type==='fence'&&Object.prototype.hasOwnProperty.call(PROFILE,it.barrierKind);
 const kind=it=>isBarrier(it)?it.barrierKind:null;
 const heightFt=it=>finite(it?.heightFt)&&it.heightFt>=1&&it.heightFt<=12?it.heightFt:(PROFILE[kind(it)]?.heightFt||4);
 function crossing(it,x,z,cell,reach=.78){
  if(!isBarrier(it)||![x,z,cell,reach].every(finite)||cell<=0||reach<=0)return null;
  const a=it.a,b=it.b;
  if(!a||!b||![a.x,a.y,b.x,b.y].every(finite))return null;
  const ax=a.x*cell,az=a.y*cell,bx=b.x*cell,bz=b.y*cell;
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  if(len<.1)return null;
  const t=((x-ax)*dx+(z-az)*dz)/(len*len);
  // No atravesar los extremos, donde la proyección puede rozar otro muro.
  if(t<.035||t>.965)return null;
  const cx=ax+dx*t,cz=az+dz*t;
  const signed=(dx*(z-az)-dz*(x-ax))/len;
  const distance=Math.abs(signed);
  if(distance<.08||distance>reach)return null;
  const nx=-dz/len*Math.sign(signed),nz=dx/len*Math.sign(signed);
  // Cruzar al otro lado, dejando espacio suficiente para el radio del jugador.
  const goal={x:cx-nx*.64,z:cz-nz*.64};
  const p=PROFILE[it.barrierKind];
  return {item:it,distance,goal,action:p.action,seconds:p.seconds,lift:p.lift};
 }
 function nearest(items,x,z,cell,reach){
  let best=null;
  for(const item of items||[]){
   const option=crossing(item,x,z,cell,reach);
   if(option&&(!best||option.distance<best.distance))best=option;
  }
  return best;
 }
 let texture=null,textureTHREE=null;
 function chainTexture(THREE){
  if(texture&&textureTHREE===THREE)return texture;
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d');
  c.clearRect(0,0,64,64);
  c.strokeStyle='#bbc4b9';c.lineWidth=2;
  for(let shift=-128;shift<=128;shift+=16){
   c.beginPath();c.moveTo(shift,0);c.lineTo(shift+64,64);c.stroke();
   c.beginPath();c.moveTo(shift,64);c.lineTo(shift+64,0);c.stroke();
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  tex.generateMipmaps=false;tex.needsUpdate=true;
  textureTHREE=THREE;texture=tex;
  return tex;
 }
 function mount(THREE,parent,it,cell,railMaterial,register){
  if(!isBarrier(it)||!parent||!THREE||!finite(cell)||cell<=0)return false;
  const {a,b}=it;
  if(!a||!b||![a.x,a.y,b.x,b.y].every(finite))return false;
  const dx=(b.x-a.x)*cell,dz=(b.y-a.y)*cell,len=Math.hypot(dx,dz);
  if(len<.04)return false;
  const h=heightFt(it)*.3048;
  const root=new THREE.Group();
  root.position.set((a.x+b.x)*cell/2,0,(a.y+b.y)*cell/2);
  root.rotation.y=-Math.atan2(dz,dx);parent.add(root);
  const material=railMaterial||new THREE.MeshLambertMaterial({color:0x84938b});
  const piece=(x,y,z,w,high,deep,mat=material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,high,deep),mat);
   mesh.position.set(x,y,z);
   mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);
   if(register)register(mesh);
   return mesh;
  };
  const railing=it.barrierKind==='railing';
  const count=Math.max(1,Math.ceil(len/2.4));
  for(let i=0;i<=count;i++)piece(-len/2+len*i/count,h/2,0,railing?.065:.075,h,railing?.065:.075);
  if(railing){
   for(const level of [.18,.57,.98])piece(0,h*level,0,len,.055,.058);
  }else{
   piece(0,h*.07,0,len,.047,.05);
   piece(0,h*.98,0,len,.055,.055);
   const map=chainTexture(THREE);
   if(map){
    const geo=new THREE.PlaneGeometry(len,h*.88);
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*len/.36,uv.getY(i)*h*.88/.36);
    uv.needsUpdate=true;
    const mat=new THREE.MeshLambertMaterial({
     map,side:THREE.DoubleSide,alphaTest:.48,transparent:false,depthWrite:true,color:0xa4afa5
    });
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.y=h*.52;mesh.castShadow=false;mesh.receiveShadow=true;
    root.add(mesh);if(register)register(mesh);
   }
  }
  return true;
 }
 return Object.freeze({PROFILE,isBarrier,kind,heightFt,crossing,nearest,mount});
});
