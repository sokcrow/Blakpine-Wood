/* Ejecutar: node --test juego/assets/fh-sleep.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function controller(){
 const classes=new Set();
 const window={FH_SLEEP_TEXT:{breath:'Zzz'},document:{body:{classList:{
  toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
  remove(name){classes.delete(name);}
 }}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-sleep.js'),'utf8'),{window});
 return {sleep:window.FHCreateSleepController(),classes};
}
function ctx(){
 const ops=[];
 return {ops,save(){},restore(){},clearRect(){ops.push('clear');},
  fillRect(){ops.push(this.fillStyle==='#000'?'black':'gradientFill');},
  createRadialGradient(){ops.push('gradient');return {addColorStop(at,value){ops.push('stop:'+at+':'+value);}};},
  strokeText(s){ops.push('stroke:'+s);},fillText(s){ops.push('text:'+s);},
  set globalCompositeOperation(v){ops.push('blend:'+v);}
 };
}
test('dormir cierra completamente la visión y oculta el HUD',()=>{
 const {sleep,classes}=controller();
 for(let i=0;i<110;i++)sleep.update(.1,'lying','lie','bed');
 assert.equal(sleep.status().stage,'asleep');
 assert.ok(classes.has('fh-sleeping'));
 assert.ok(classes.has('fh-sleep-masking'));
 const canvas=ctx();
 assert.equal(sleep.renderMask(canvas,360,640,180,320),true);
 assert.equal(canvas.ops.includes('gradient'),false,'no debe conservar un agujero visual');
 assert.equal(canvas.ops.some(s=>s.startsWith('text:')),false,'Zzz tiene una espera');
});
test('el cierre usa un degradado opaco hacia negro sin destination-out',()=>{
 const {sleep,classes}=controller();
 for(let i=0;i<60;i++)sleep.update(.1,'lying','lie','bed');
 assert.equal(sleep.status().stage,'drowsy');
 assert.ok(classes.has('fh-sleep-masking'));
 const canvas=ctx();
 sleep.renderMask(canvas,360,640,180,320);
 assert.ok(canvas.ops.includes('gradient'));
 assert.ok(canvas.ops.includes('stop:0:rgba(0,0,0,0)'));
 assert.ok(canvas.ops.includes('stop:1:rgba(0,0,0,1)'));
 assert.ok(!canvas.ops.includes('blend:destination-out'));
});
test('cámara vertical fija y vector up horizontal para cualquier orientación de la cama',()=>{
 const {sleep}=controller();
 for(const facing of [0,Math.PI/4,Math.PI/2,Math.PI,3*Math.PI/2]){
  const p=sleep.cameraPose(5,9,2,facing);
  assert.equal(p.x,5);assert.equal(p.z,9);
  assert.ok(p.eyeY>p.focusY);
  assert.ok(Math.abs(Math.hypot(p.upX,p.upZ)-1)<1e-10);
  assert.ok(Math.abs(p.upX*Math.sin(facing)+p.upZ*Math.cos(facing)+1)<1e-10);
 }
});
test('Zzz aparece después de una pausa y sale de la posición del sprite',()=>{
 const {sleep}=controller();
 for(let i=0;i<140;i++)sleep.update(.1,'lying','lie','bed');
 const canvas=ctx();
 sleep.renderMask(canvas,360,640,180,320,170,275);
 assert.ok(canvas.ops.some(s=>s.startsWith('text:Z')));
});
test('despertar recupera controles y ejecuta la salida tras el retraso',()=>{
 const {sleep,classes}=controller();let awake=false;
 for(let i=0;i<110;i++)sleep.update(.1,'lying','lie','bed');
 assert.equal(sleep.requestWake(()=>{awake=true;return {ok:true};}).waking,true);
 assert.ok(!classes.has('fh-sleeping'));
 for(let i=0;i<20;i++)sleep.update(.1,'lying','lie','bed');
 assert.ok(awake);
 sleep.update(.1,'standing',null,null);
 assert.equal(sleep.status().stage,'awake');
 assert.ok(!classes.has('fh-sleep-masking'));
});
test('la integración carga la hoja de sueño y conserva acción rápida/radial',()=>{
 const root=path.resolve(__dirname,'../..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'fh-sleep.css'),'utf8');
 assert.match(html,/const sleepCss=/);
 assert.match(html,/bridge\+sleepCss\+sleepStrings\+sleepModule/);
 assert.match(html,/cam\.up\.set\(p\.upX,0,p\.upZ\)/);
 assert.match(html,/replace\(sleepCameraBefore,sleepCameraAfter\)/);
 assert.match(html,/maskRect\.width\*\.5,maskRect\.height\*\.5,breathX,breathY/);
 assert.match(css,/#actions \.action:not\(#use\)/);
 assert.match(css,/#actions #use/);
 assert.match(css,/#fhContextRadial/);
 assert.match(css,/body\.fh-sleep-masking #mist/);
});
