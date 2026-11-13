/* Ejecutar: node juego/assets/fh-cctv.test.js */
const assert=require('node:assert/strict');
const test=require('node:test');
const CCTV=require('./fh-cctv.js');
const floors=[
 {items:[
  {id:'manual',modelId:'camara_seguridad',cameraMode:'manual',rotation:90,cameraManualDeg:0,mountHeightFt:7,x:2,y:4},
  {id:'automatic',modelId:'camara_seguridad',cameraMode:'automatic',rotation:0,x:5,y:6},
  {id:'fixed',modelId:'camara_seguridad',cameraMode:'fixed',rotation:135,x:1,y:3},
  {id:'legacy',modelId:'camara_seguridad',rotation:0,x:2,y:2}
 ]},
 {items:[{id:'offline',modelId:'camara_seguridad',cameraMode:'manual',cameraOnline:false}]}
];
test('tres tipos separados y compatibilidad con el modelo antiguo',()=>{
 const rt=CCTV.createRuntime(floors);
 assert.deepEqual(rt.list().map(x=>x.mode),['manual','automatic','fixed','automatic','manual']);
});
test('la cámara manual se mueve progresivamente hasta ±45 grados y no salta al destino',()=>{
 const rt=CCTV.createRuntime(floors);
 assert.equal(rt.setManualAngle('manual',120,1000),true);
 assert.equal(rt.angleFor('manual',1000),0);
 assert.equal(rt.angleFor('manual',1500),15);
 assert.equal(rt.angleFor('manual',2500),45);
 assert.equal(rt.setManualAngle('manual',-120,2500),true);
 assert.equal(rt.angleFor('manual',2500),45);
 assert.equal(rt.angleFor('manual',3000),30);
 assert.equal(rt.angleFor('manual',5500),-45);
 assert.equal(rt.setManualAngle('manual','incorrecto',5500),false);
 assert.equal(rt.setManualAngle('automatic',15),false);
 assert.equal(rt.setManualAngle('fixed',15),false);
});
test('la cámara manual retoma el ángulo visible cuando cambia el objetivo durante el giro',()=>{
 const rt=CCTV.createRuntime(floors);
 rt.setManualAngle('manual',45,1000);
 assert.equal(rt.angleFor('manual',1500),15);
 rt.setManualAngle('manual',-45,1500);
 assert.equal(rt.angleFor('manual',1500),15);
 assert.equal(rt.angleFor('manual',2000),0);
});
test('barrido automático 9 s ida + 1 s espera + 9 s vuelta + 1 s espera',()=>{
 const rt=CCTV.createRuntime(floors),angle=t=>rt.angleFor('automatic',t);
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
 near(angle(0),-45);
 near(angle(4500),0);
 near(angle(9000),45);
 near(angle(9500),45);
 near(angle(10000),45);
 near(angle(14500),0);
 near(angle(19000),-45);
 near(angle(19500),-45);
 near(angle(20000),-45);
 near(angle(24500),0);
});
test('la cámara fija conserva su orientación al pasar tiempo',()=>{
 const rt=CCTV.createRuntime(floors);
 assert.equal(rt.angleFor('fixed',999999),0);
 const view=rt.view('fixed',100,1.524,[0,3]);
 assert.equal(view.bearing,135*Math.PI/180);
});
test('la vista utiliza piso, escala y altura reales del mapa',()=>{
 const rt=CCTV.createRuntime(floors);
 const view=rt.view('manual',0,1.5,[3,6]);
 assert.deepEqual([view.x,view.z,view.y],[3,6,7*.3048+3]);
 assert.equal(view.bearing,Math.PI/2);
 assert.equal(rt.view('offline'),null);
 assert.equal(rt.view('missing'),null);
});
test('las cámaras no heredan conexiones de una terminal',()=>{
 const rt=CCTV.createRuntime(floors);
 assert.equal(rt.list().length,5);
 assert.equal(rt.has('unknown'),false);
});

test('la lente montada se coloca delante del muro sin alterar el giro manual',()=>{
 const rt=CCTV.createRuntime([{items:[{
  id:'mounted',modelId:'camara_seguridad',cameraMode:'manual',
  wallId:'pared-1',rotation:90,cameraManualDeg:0,mountHeightFt:7,x:4,y:6
 }]}]);
 const pose=rt.view('mounted',0,1.5,[0]);
 assert.ok(Math.abs(pose.x-(4*1.5-.2))<1e-8);
 assert.ok(Math.abs(pose.z-(6*1.5))<1e-8);
 rt.setManualAngle('mounted',45,0);
 const angled=rt.view('mounted',1500,1.5,[0]);
 assert.equal(angled.x,pose.x,'El giro no atraviesa el muro moviendo la lente');
 assert.equal(angled.z,pose.z);
 assert.equal(angled.bearing,135*Math.PI/180);
 assert.equal(angled.fovDeg,48,'Por defecto, campo óptico de 48° como la cámara principal del juego');
});
