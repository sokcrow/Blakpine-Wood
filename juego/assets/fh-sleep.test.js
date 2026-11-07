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
 return {ops,save(){},restore(){},fillRect(){ops.push('fillRect');},
  createRadialGradient(){ops.push('gradient');return {addColorStop(){}};},
  strokeText(s){ops.push('stroke:'+s);},fillText(s){ops.push('text:'+s);},
  set globalCompositeOperation(v){ops.push('blend:'+v);}
 };
}
test('dormir cierra completamente la visión y oculta el HUD',()=>{
 const {sleep,classes}=controller();
 for(let i=0;i<110;i++)sleep.update(.1,'lying','lie','bed');
 assert.equal(sleep.status().stage,'asleep');
 assert.ok(classes.has('fh-sleeping'));
 const canvas=ctx();
 assert.equal(sleep.renderMask(canvas,360,640,180,320),true);
 assert.equal(canvas.ops.includes('gradient'),false,'no debe conservar un agujero visual');
 assert.equal(canvas.ops.some(s=>s.startsWith('text:')),false,'Zzz tiene una espera');
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
});
test('la integración carga la hoja de sueño y conserva acción rápida/radial',()=>{
 const root=path.resolve(__dirname,'../..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'fh-sleep.css'),'utf8');
 assert.match(html,/const sleepCss=/);
 assert.match(html,/bridge\+sleepCss\+sleepStrings\+sleepModule/);
 assert.match(html,/back=\{x:-Math\.sin\(face\),z:-Math\.cos\(face\)\}/);
 assert.match(html,/maskRect\.width\*\.5,maskRect\.height\*\.5,breathX,breathY/);
 assert.match(css,/#actions \.action:not\(#use\)/);
 assert.match(css,/#actions #use/);
 assert.match(css,/#fhContextRadial/);
});
