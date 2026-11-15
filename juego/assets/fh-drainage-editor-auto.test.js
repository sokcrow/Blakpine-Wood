const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('./fh-drainage.js');
const Draw=require('./fh-drainage-draw.js');
const units={columns:120,rows:120,feetPerCell:5};
const strings={
 blocked:'Sin permiso',overlap:'Solapamiento',place:'Colocado',pathPlaced:'Conectado',
 pathExists:'Ya existe',first:'Inicio',drag:'No arrastrar',autoShape:'Automático',
 rotate:'Girar',audit:'Auditoría',flow:'Corriente',auto:'Auto',
 labels:{straight:'Recta',elbow:'Codo',tee:'T',cross:'Cruz',dead_end:'Extremo'}
};
const section=(kind,x,y,id,rotation=0)=>D.makeSection(kind,{x:x+D.SIZES[kind]/2,y:y+D.SIZES[kind]/2},units,id,rotation);
const at=(items,x,y)=>items.find(it=>it.x===x&&it.y===y);
function editorSetup(){
 let seq=0,records=0,inspections=0,anchor=null;
 const project={schema:'forest-horror-map-v1',units,floors:[{id:'f0',items:[]}]};
 const message=[];
 const root={FHDrainage:D,FHDrainageDraw:Draw,FH_DRAIN_TEXT:strings};
 const dom={
  createElement(tag){return {tag,children:[],style:{},append(...values){this.children.push(...values);},
   className:'',textContent:'',value:'',set innerHTML(value){this.html=value;}};},
  getElementById(){return {style:{}};}
 };
 root.document=dom;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-drainage-editor.js'),'utf8'),root);
 const env={project:()=>project,current:()=>project.floors[0],floorIndex:()=>0,
  newId:()=>String(++seq),record:()=>records++,inspect:()=>inspections++,
  render(){},toast:msg=>message.push(msg),
  anchor(value){if(arguments.length)anchor=value;return anchor;}};
 root.FHDrainageEditor.install(env);
 return {root,editor:root.FHDrainageEditor,project,items:()=>project.floors[0].items,
  recordCount:()=>records,inspectCount:()=>inspections,messages:message};
}
function vertical(ctx){ctx.editor.place('drain_draw',{x:5,y:25},true,{x:5,y:5});return ctx.items();}
test('colocar un premade manual crea el codo automático contiguo',()=>{
 const ctx=editorSetup();vertical(ctx);
 const end=at(ctx.items(),0,0);assert.deepEqual(D.ports(end),['s']);
 ctx.editor.place('drain_straight',{x:15,y:5},false);
 const manual=at(ctx.items(),10,0);
 assert.ok(manual&&!Draw.isAuto(manual));
 assert.equal(at(ctx.items(),0,0),end,'la referencia del inspector se conserva');
 assert.equal(end.drainage.kind,'elbow');
 assert.ok(D.touches(end,manual));
 assert.equal(D.topology(ctx.project).warnings.length,0);
});
test('rotar una sección manual actualiza las conexiones automáticas',()=>{
 const ctx=editorSetup();vertical(ctx);
 const manual=section('straight',10,0,'manual',90);
 ctx.items().push(manual);
 assert.deepEqual(D.ports(at(ctx.items(),0,0)),['s']);
 ctx.editor.rotate(manual);
 assert.equal(manual.rotation,180);
 assert.equal(at(ctx.items(),0,0).drainage.kind,'elbow');
 assert.ok(D.touches(at(ctx.items(),0,0),manual));
});
test('mover una sección manual conecta y desconecta los vecinos',()=>{
 const ctx=editorSetup();vertical(ctx);
 const manual=section('straight',20,0,'manual');
 ctx.items().push(manual);
 const end=at(ctx.items(),0,0);
 manual.x=10;
 assert.equal(ctx.editor.afterMove(manual),true);
 assert.equal(end.drainage.kind,'elbow');
 assert.ok(D.touches(end,manual));
 manual.x=20;
 assert.equal(ctx.editor.afterMove(manual),true);
 assert.equal(end.drainage.kind,'dead_end');
 assert.equal(D.touches(end,manual),false);
});
test('no permite modificar secciones automáticas fuera de permisos al colocar',()=>{
 const ctx=editorSetup();vertical(ctx);
 const original=JSON.stringify(ctx.project),count=ctx.recordCount();
 ctx.root.FHStyleEditor={hasActor:()=>true,canEditAt:p=>p.x>=10};
 ctx.editor.place('drain_straight',{x:15,y:5},false);
 assert.equal(JSON.stringify(ctx.project),original);
 assert.equal(ctx.recordCount(),count);
});
test('rotar manual revierte si se modificaría un vecino sin permiso',()=>{
 const ctx=editorSetup();vertical(ctx);
 const manual=section('straight',10,0,'manual',90);
 ctx.items().push(manual);
 ctx.root.FHStyleEditor={hasActor:()=>true,canEditAt:p=>p.x>=10};
 const original=JSON.stringify(ctx.project),count=ctx.recordCount();
 ctx.editor.rotate(manual);
 assert.equal(JSON.stringify(ctx.project),original);
 assert.equal(ctx.recordCount(),count);
});
test('mover manual rechaza conexión si se modifica un vecino protegido',()=>{
 const ctx=editorSetup();vertical(ctx);
 const manual=section('straight',20,0,'manual'),before={x:manual.x,y:manual.y};
 ctx.items().push(manual);
 ctx.root.FHStyleEditor={hasActor:()=>true,canEditAt:p=>p.x>=10};
 manual.x=10;
 assert.equal(ctx.editor.afterMove(manual),false);
 Object.assign(manual,before); // igual que el rollback del pointerup en index.html
 assert.equal(at(ctx.items(),0,0).drainage.kind,'dead_end');
 assert.equal(manual.x,20);
});
test('rechaza mover un premade manual sobre otra sección',()=>{
 const ctx=editorSetup();
 const a=section('straight',10,10,'a'),b=section('straight',30,10,'b');
 ctx.items().push(a,b);
 b.x=10;
 assert.equal(ctx.editor.afterMove(b),false);
 assert.ok(ctx.messages.includes(strings.overlap));
});
test('al dibujar un cruce el inspector conserva la referencia del objeto seleccionado',()=>{
 const ctx=editorSetup();
 ctx.editor.place('drain_draw',{x:35,y:25},true,{x:5,y:25});
 const selected=at(ctx.items(),10,20);
 const id=selected.id;
 ctx.editor.place('drain_draw',{x:15,y:45},true,{x:15,y:5});
 assert.equal(ctx.items().find(it=>it.id===id),selected);
 assert.equal(selected.drainage.kind,'cross');
 assert.ok(ctx.inspectCount()>0,'se refresca el inspector cuando cambia la pieza');
});
test('un trazado idéntico no reemplaza objetos ni modifica el inspector',()=>{
 const ctx=editorSetup();
 ctx.editor.place('drain_draw',{x:35,y:5},true,{x:5,y:5});
 const previous=ctx.items().slice(),inspections=ctx.inspectCount(),records=ctx.recordCount();
 ctx.editor.place('drain_draw',{x:35,y:5},true,{x:5,y:5});
 assert.deepEqual(ctx.items(),previous);
 assert.ok(ctx.items().every((it,index)=>it===previous[index]));
 assert.equal(ctx.inspectCount(),inspections);
 assert.equal(ctx.recordCount(),records);
});
test('el inspector conserva sus handlers sobre el item original después de ampliar la red',()=>{
 const ctx=editorSetup();
 ctx.root.FH_DRAIN_TEXT={...strings,directions:{n:'Norte',e:'Este',s:'Sur',w:'Oeste'},
  nativeInfo:()=>'',disconnected:'Desconectado'};
 ctx.editor.place('drain_draw',{x:35,y:5},true,{x:5,y:5});
 const selected=at(ctx.items(),10,0),fields={children:[],append(it){this.children.push(it);}};
 assert.equal(ctx.editor.inspector(selected,fields),true);
 const labels=fields.children.filter(el=>el.tag==='label');
 const dropdown=labels.flatMap(el=>el.children).find(el=>el.tag==='select');
 assert.ok(dropdown&&typeof dropdown.onchange==='function');
 ctx.editor.place('drain_draw',{x:15,y:25},true,{x:15,y:5});
 assert.equal(ctx.items().find(it=>it.id===selected.id),selected);
 dropdown.value=String(at(ctx.items(),10,10).id);
 dropdown.onchange();
 assert.equal(ctx.items().find(it=>it.id===selected.id).drainage.flowTo,dropdown.value);
});
test('index.html invoca la validación de movimiento antes de registrar',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.ok(html.includes('window.FHDrainageEditor?.afterMove(it)===false'));
 assert.ok(html.includes('Object.assign(it,a.original);render();return'));
 assert.ok(html.indexOf('window.FHStyleEditor.canEditItem(it)')<html.indexOf('window.FHDrainageEditor?.afterMove(it)===false'),
  'los permisos del editor se validan antes de recalcular las conexiones');
});