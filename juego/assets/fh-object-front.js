/* Geometría de orientación para la IU del editor.
 * Contrato existente: rotation en grados, 0° apunta a +Y del mapa / +Z en 3D.
 * El motor sigue siendo la única fuente de colisiones e interacciones.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHObjectFront=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const visualTypes=Object.freeze(['light_fixture','training_dummy','plant','battery_pickup',
  'generator','generator_emergency','generator_ats','generator_tank','power_strip',
  'phone_charger']);
 const normalize=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return ((n%360)+360)%360;
 };
 const turn=(angle,step)=>normalize(normalize(angle)+step);
 // Frente local +Y: la rotación del mapa es horaria en coordenadas de pantalla.
 const forward=angle=>{
  const rad=normalize(angle)*Math.PI/180;
  return Object.freeze({x:-Math.sin(rad),y:Math.cos(rad)});
 };
 const hasFront=(item,existing)=>!!item&&(
  existing?.has?.(item.type)===true||visualTypes.includes(item.type)||
  typeof item.modelId==='string'&&item.modelId.trim().length>0);
 return Object.freeze({visualTypes,normalize,turn,forward,hasFront});
});
