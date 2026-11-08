/* Ejecutar: node --test juego/assets/fh-sleep.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function controller(){
 const classes=new Set(),nodes=new Map(),breaths=[];
 const body={classList:{
  toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
  remove(name){classes.delete(name);}
 },appendChild(element){element.parentNode=this;nodes.set(element.id,element);}};
 const document={body,getElementById(id){return nodes.get(id)||null;},
  createElement(){return {id:'',style:{},setAttribute(){},parentNode:null};},
  documentElement:{clientWidth:360,clientHeight:640}};
 const window={FH_SLEEP_TEXT:{breath:'Zzz',comfort:'Qué cómodo...'},document,innerWidth:360,innerHeight:640,
  FHLiveText:{soundAt(spec){breaths.push(spec);return true;},clearKind(kind){breaths.push({clearKind:kind});}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-sleep.js'),'utf8'),{window});
 return {sleep:window.FHCreateSleepController(),classes,nodes,breaths};
}
function advance(sleep,seconds,phase='lying',verb='lie',type='bed'){
 const ticks=Math.round(seconds*10);
 for(let i=0;i<ticks;i++)sleep.update(.1,phase,verb,type);
}
test('el iris mantiene centro visible incluso al llegar a sueño profundo',()=>{
 const {sleep,classes,nodes}=controller();
 advance(sleep,11);
 assert.equal(sleep.status().stage,'asleep');
 assert.ok(classes.has('fh-sleeping'));
 assert.ok(classes.has('fh-sleep-masking'));
 const veil=nodes.get('fhSleepVeil');
 assert.equal(veil.style.display,'block');
 assert.match(veil.style.background,/^radial-gradient\(circle /);
 assert.notEqual(veil.style.background,'#000');
 assert.match(veil.style.background,/transparent /);
 const expected=Math.min(360,640)*.24;
 assert.ok(Math.abs(sleep.irisRadius(360,640,1)-expected)<.001);
 assert.ok(sleep.irisRadius(360,640,.4)>expected);
});
test('el círculo se cierra lentamente y se reabre al despertar',()=>{
 const {sleep,nodes,classes}=controller();
 advance(sleep,4);
 const veil=nodes.get('fhSleepVeil');
 const drowsy=sleep.irisRadius(360,640);
 advance(sleep,7);
 assert.ok(sleep.irisRadius(360,640)<drowsy);
 assert.equal(sleep.requestWake(()=>({ok:true})).waking,true);
 assert.ok(!classes.has('fh-sleeping'));
 advance(sleep,.5);
 assert.ok(sleep.irisRadius(360,640)>Math.min(360,640)*.24);
 advance(sleep,4,'standing',null,null);
 assert.equal(sleep.status().stage,'awake');
 assert.equal(veil.style.display,'none');
 assert.ok(!classes.has('fh-sleep-masking'));
});
test('dice Qué cómodo una sola vez tras acostarse y se reinicia en otro descanso',()=>{
 const {sleep,breaths}=controller(),head={x:1,y:2,z:3,floor:0,screenX:100,screenY:160};
 advance(sleep,2.9);
 assert.equal(sleep.needsComfort(),false);
 advance(sleep,.2);
 assert.equal(sleep.needsComfort(),true);
 assert.equal(sleep.emitComfort(head),true);
 assert.equal(sleep.emitComfort(head),false);
 assert.equal(breaths[0].text,'Qué cómodo...');
 assert.equal(breaths[0].kind,'sleep');
 advance(sleep,4);
 assert.equal(sleep.needsComfort(),false);
 advance(sleep,1,'standing',null,null);
 advance(sleep,3.2);
 assert.equal(sleep.needsComfort(),true);
 assert.equal(sleep.emitComfort(head),true);
 assert.equal(breaths.filter(item=>item.text==='Qué cómodo...').length,2);
});
test('respiración cómic solo durante sueño: pausas y coordenadas de la cabeza',()=>{
 const {sleep,breaths}=controller(),head={x:4.6,y:1.8,z:7.1,floor:0,screenX:180,screenY:245};
 advance(sleep,11);
 assert.equal(sleep.needsBreath(),false,'primer Zzz espera unos segundos');
 advance(sleep,2.2);
 assert.equal(sleep.needsBreath(),true);
 assert.equal(sleep.emitBreath(head),true);
 assert.equal(sleep.emitBreath(head),false,'no duplica por frame');
 assert.equal(breaths.length,1);
 assert.equal(breaths[0].kind,'sleep');
 assert.equal(breaths[0].text,'Zzz');
 assert.equal(breaths[0].x,head.x);
 assert.equal(breaths[0].y,head.y);
 assert.equal(breaths[0].z,head.z);
 assert.equal(breaths[0].self,true);
 assert.equal(breaths[0].screenX,180);
 assert.equal(breaths[0].screenY,245);
 advance(sleep,3.7);
 assert.equal(sleep.needsBreath(),false);
 advance(sleep,.1);
 assert.equal(sleep.needsBreath(),true);
 assert.equal(sleep.emitBreath(head),true);
 assert.equal(breaths.filter(x=>x.kind==='sleep').length,2);
 sleep.requestWake(()=>({ok:true}));
 assert.equal(sleep.needsBreath(),false);
 assert.ok(breaths.some(x=>x.clearKind==='sleep'));
});
test('cámara cenital mantiene el vector arriba horizontal para camas rotadas',()=>{
 const {sleep}=controller();
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,3*Math.PI/2]){
  const p=sleep.cameraPose(5,9,2,angle);
  assert.equal(p.x,5);assert.equal(p.z,9);
  assert.ok(p.eyeY>p.focusY);
  assert.ok(Math.abs(Math.hypot(p.upX,p.upZ)-1)<1e-10);
 }
});
test('integración utiliza iris único y texto cómic con su propio fade',()=>{
 const root=path.resolve(__dirname,'../..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'fh-sleep.css'),'utf8');
 const live=fs.readFileSync(path.join(__dirname,'fh-live-text.js'),'utf8');
 assert.match(html,/bridge\+sleepCss\+sleepStrings\+sleepModule/);
 assert.match(html,/cam\.up\.set\(p\.upX,0,p\.upZ\)/);
 assert.match(html,/window\.FHSleep\.emitBreath\(\{x:head\.x,y:head\.y,z:head\.z,floor:currentFloor,screenX:x,screenY:y\}\)/);
 assert.match(html,/const shown=Number\.isFinite\(ndc\.x\)/);
 assert.doesNotMatch(html,/window\.FHSleep\.renderMask\(/);
 assert.match(html,/hero\.localToWorld\(new THREE\.Vector3\(0,HERO_H\*\.82,0\)\)/);
 assert.match(css,/#fhSleepVeil/);
 assert.match(css,/#fhSpatialLayer/);
 assert.match(css,/#actions \{z-index:90/);
 assert.match(css,/#fhContextRadial/);
 assert.match(live,/fh-sound fh-sleep-comic/);
 assert.match(live,/@keyframes fh-sleep-breath/);
 assert.match(live,/sleep\?2600:580/);
});
