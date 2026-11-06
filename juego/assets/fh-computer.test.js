/* Ejecutar: node juego/assets/fh-computer.test.js */
const assert=require('node:assert/strict');
const ASSEMBLY=require('./fh-pc-assembly.js');
const PC=require('./fh-computer.js');
const table=(id,x=10)=>({id,modelId:'mesa_cocina_rectangular',type:'dining',x,y:10,w:1.1,h:.6});
const setupParts=(host)=>['monitor_crt','teclado_pc','mouse_pc','gabinete_pc'].map((modelId,i)=>({
 id:host.id+'_part_'+i,modelId,x:host.x+(i-1.5)*.1,y:host.y+i*.02
}));
const left=table('mesa_a'),right=table('mesa_b',25);
const camera={id:'cam_norte',label:'Pasillo norte',place:'Pasillo norte',online:true};
const items=[left,...setupParts(left),right,...setupParts(right)];
let passed=0;
function test(name,fn){fn();passed++;console.log('OK',name)}
test('Una PC fija armada sirve sobre cualquier mesa compatible',()=>{
 assert.equal(PC.inspect(left,items,5,ASSEMBLY).ready,true);
 assert.equal(PC.isPc(left,items,5,ASSEMBLY),true);
});
test('La estación incompleta informa las piezas faltantes',()=>{
 const miss=items.filter(x=>x.id!==left.id+'_part_2');
 assert.deepEqual(PC.inspect(left,miss,5,ASSEMBLY).missing,['mouse']);
});
test('Un modelo antiguo de escritorio conserva la compatibilidad',()=>{
 const older={id:'older',modelId:'escritorio_pc',x:1,y:1};
 assert.equal(PC.inspect(older,[older],5,ASSEMBLY).ready,true);
 assert.equal(PC.sessionFor(older,[older],{assembly:ASSEMBLY}).legacy,true);
});
test('Una PC nueva exige sus componentes explícitamente',()=>{
 const empty={id:'new',modelId:'escritorio_pc',pcAssemblyRequired:true,x:1,y:1};
 assert.deepEqual(PC.inspect(empty,[empty],5,ASSEMBLY).missing,['monitor','keyboard','mouse','cabinet']);
});
test('Un monitor solo no se convierte en una PC funcional',()=>{
 const monitor={id:'m',modelId:'monitor_crt',x:1,y:1};
 assert.equal(PC.isPc(monitor,[monitor],5,ASSEMBLY),false);
});
test('El mismo jugador mantiene su cuenta en dos estaciones',()=>{
 const state={playerId:'GUARDIA_03',computer:{mails:[{id:'m1',subject:'Turno'}]}};
 const a=PC.sessionFor(left,items,{state,assembly:ASSEMBLY});
 const b=PC.sessionFor(right,items,{state,assembly:ASSEMBLY});
 assert.equal(a.userId,b.userId);
 assert.deepEqual(a.mails,b.mails);
 assert.notEqual(a.stationId,b.stationId);
});
test('Las cámaras no se comparten automáticamente entre estaciones',()=>{
 const a=PC.sessionFor(left,items,{assembly:ASSEMBLY,cameras:[camera]});
 assert.deepEqual(a.cameras,[]);
 const secure={...right,pcConnections:{cameras:['cam_norte']}};
 const b=PC.sessionFor(secure,[...items.filter(x=>x!==right),secure],{assembly:ASSEMBLY,cameras:[camera]});
 assert.equal(b.cameras[0].id,'cam_norte');
});
test('Una cámara desconocida no crea conexiones ficticias',()=>{
 const connected={...left,pcConnections:{cameras:['inexistente']}};
 assert.deepEqual(PC.sessionFor(connected,[connected,...setupParts(connected)],{assembly:ASSEMBLY,cameras:[camera]}).cameras,[]);
});
test('Cada PC tiene su propia lista de aplicaciones y los valores desconocidos se ignoran',()=>{
 const modified={...left,pcApps:['mail','cams','inexistente']};
 const a=PC.sessionFor(modified,[modified,...setupParts(modified)],{assembly:ASSEMBLY});
 assert.deepEqual(a.apps,['mail','cams']);
 const b=PC.sessionFor(right,items,{assembly:ASSEMBLY});
 assert.equal(b.apps.includes('hamazon'),true);
});
test('Las PCs no obtienen una laptop ni inventario desde este módulo',()=>{
 assert.equal('createLaptopRuntime' in PC,false);
 assert.equal('laptop' in PC,false);
});
test('El runtime abre RAVEN/OS y pasa contexto de esa estación sin involucrar pedidos',()=>{
 const events=[],on={},state={playerId:'GUARDIA_03'};
 const make=tag=>{
  const obj={tag,classList:{add:v=>events.push('class+'+v),remove:v=>events.push('class-'+v)},
   setAttribute(){},addEventListener(name,fn){on[name]=fn},append(...nodes){for(const n of nodes)n.parentElement=obj},
   parentElement:null,style:{}};
  if(tag==='iframe')obj.contentWindow={ForestTerminal3D:{
   setSession:c=>events.push(['session',c.stationId,c.userId,c.cameras.length]),
   power:p=>events.push(['power',p]),open:()=>events.push('open')
  }};
  return obj;
 };
 const document={head:{append(){}},body:{append(){}},baseURI:'https://example.test/juego/assets/',
  createElement:make};
 const runtime=PC.createRuntime({
  document,state,assembly:ASSEMBLY,feetPerCell:5,currentFloor:()=>0,
  floorItems:()=>items,baseUrl:'https://example.test/juego/assets/fh-computer.js',
  freeze:value=>events.push(['freeze',value]),
  onOpen:()=>events.push('connected'),
  onClose:()=>events.push('disconnected')
 });
 assert.equal(runtime.open(left,0),true);
 assert.deepEqual(events.find(v=>Array.isArray(v)&&v[0]==='session').slice(1),['mesa_a','GUARDIA_03',0]);
 assert.equal(events.includes('open'),true);
 runtime.close();
 assert.equal(runtime.isOpen,false);
 assert.equal(events.includes('disconnected'),true);
});
test('El runtime no abre una PC incompleta ni bloquea al jugador',()=>{
 const empty={id:'new',modelId:'escritorio_pc',pcAssemblyRequired:true,x:2,y:3};
 let freezeCount=0,noticeCount=0;
 const runtime=PC.createRuntime({
  assembly:ASSEMBLY,state:{},floorItems:()=>[empty],currentFloor:()=>0,
  freeze:()=>freezeCount++,notice:()=>noticeCount++,
  strings:{pcMissing:n=>'Falta: '+n.join(', ')}
 });
 assert.equal(runtime.open(empty,0),false);
 assert.equal(freezeCount,0);
 assert.equal(noticeCount,1);
});

test('La estación apagada inicia entre 5 y 10 segundos sin saltarse la espera',()=>{
 let now=1000;
 const power=PC.createPowerStore({now:()=>now,random:()=>.5});
 assert.equal(power.read('0:a').mode,'off');
 assert.equal(power.draw('0:a'),0);
 assert.equal(power.start('0:a').mode,'booting');
 assert.equal(power.read('0:a').durationMs,7500);
 now+=7499;assert.equal(power.read('0:a').mode,'booting');
 now+=1;assert.equal(power.read('0:a').mode,'on');
 assert.equal(power.draw('0:a'),1);
});
test('Reposo tarda menos de un segundo; apagar reinicia el ciclo completo',()=>{
 let now=20000;
 const power=PC.createPowerStore({now:()=>now,random:()=>0});
 power.start('0:a');now+=5000;
 assert.equal(power.read('0:a').mode,'on');
 assert.equal(power.sleep('0:a').mode,'sleep');
 assert.equal(power.draw('0:a'),.15);
 assert.equal(power.start('0:a').mode,'waking');
 now+=649;assert.equal(power.read('0:a').mode,'waking');
 now+=1;assert.equal(power.read('0:a').mode,'on');
 assert.equal(power.shutdown('0:a').mode,'off');
 assert.equal(power.start('0:a').durationMs,5000);
});
test('Distintas estaciones mantienen su consumo y arranque sin compartir estado',()=>{
 let now=0;
 const power=PC.createPowerStore({now:()=>now,random:()=>1});
 power.start('0:a');now+=10000;power.read('0:a');power.sleep('0:a');
 assert.equal(power.read('0:a').mode,'sleep');
 assert.equal(power.read('0:b').mode,'off');
 assert.equal(power.start('0:b').durationMs,10000);
 assert.equal(power.draw('0:a'),.15);
 assert.equal(power.draw('0:b'),1);
});
test('Salir durante el BIOS no cancela el arranque y el menú controla energía',()=>{
 let now=50000;
 const listeners={},events=[];
 const make=tag=>{
  const el={tag,classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},
   append(...nodes){for(const n of nodes)n.parentElement=el},parentElement:null};
  if(tag==='iframe')el.contentWindow={ForestTerminal3D:{
   setSession:v=>events.push(['session',v.stationId]),
   setPowerState:v=>events.push(['status',v.mode]),
   open:()=>events.push('open')
  }};
  return el;
 };
 const document={head:{append(){}},body:{append(){}},baseURI:'https://example.test/juego/assets/',
  createElement:make};
 const runtime=PC.createRuntime({document,assembly:ASSEMBLY,
  hostWindow:{addEventListener:(name,fn)=>listeners[name]=fn},
  now:()=>now,random:()=>0,floorItems:()=>items,currentFloor:()=>0,
  baseUrl:'https://example.test/juego/assets/fh-computer.js'});
 assert.equal(runtime.open(left,0),true);
 assert.equal(runtime.powerFor(left,0).mode,'booting');
 assert.equal(runtime.consumptionFor(left,0),1);
 assert.ok(!document.querySelector,'El DOM simulado solo expone lo necesario');
 const send=(action,stationId='mesa_a',origin='https://example.test')=>listeners.message({
  source:runtime.frame.contentWindow,origin,data:{type:'FOREST_TERMINAL_EVENT',name:'control',detail:{action,stationId}}
 });
 send('salir','otra_estacion');
 assert.equal(runtime.isOpen,true);
 send('salir');assert.equal(runtime.isOpen,false);
 now+=5000;
 assert.equal(runtime.open(left,0),true);
 assert.equal(runtime.powerFor(left,0).mode,'on');
 assert.deepEqual(events.at(-2),['status','on']);
 send('reposo');assert.equal(runtime.isOpen,false);
 assert.equal(runtime.powerFor(left,0).mode,'sleep');
 assert.equal(runtime.open(left,0),true);
 assert.equal(runtime.powerFor(left,0).mode,'waking');
 now+=650;
 assert.equal(runtime.powerFor(left,0).mode,'on');
 send('apagar');
 assert.equal(runtime.powerFor(left,0).mode,'off');
 assert.equal(runtime.open(right,0),true);
 assert.equal(runtime.powerFor(right,0).mode,'booting');
 assert.equal(runtime.powerFor(left,0).mode,'off');
});
test('Terminal RAVEN/OS incluye un único menú inferior, BIOS y reglas móviles',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
 assert.match(html,/id="bootTrack"[^>]+role="progressbar"/);
 assert.match(html,/id="startButton"/);
 assert.match(html,/function requestControl\(action\)/);
 assert.match(html,/setPowerState,/);
 assert.match(html,/@media\(max-width:730px\)/);
 assert.match(html,/env\(safe-area-inset-bottom\)/);
 assert.doesNotMatch(html,/id="focusPower"|id="leaveBtn"|id="fhPcExit"/);
 const script=html.slice(html.indexOf('<script>\n')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(script));
});

console.log(passed+' pruebas correctas');
