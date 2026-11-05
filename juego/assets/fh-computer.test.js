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
console.log(passed+' pruebas correctas');
