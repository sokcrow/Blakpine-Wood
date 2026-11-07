'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../..');
const code=fs.readFileSync(path.join(__dirname,'fh-structure-health.js'),'utf8');
const hookCode=fs.readFileSync(path.join(__dirname,'fh-structure-engine-hook.js'),'utf8');
const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
const legacy=()=>JSON.parse(fs.readFileSync(path.join(base,'forest-horror/maps/DEMO_Interacciones.json'),'utf8'));
function api(){const window={};vm.runInNewContext(code,{window,console,structuredClone});return window.FHStructureHealth;}
function door(variant='wood',rest={}){return {id:'d1',type:'door',a:{x:1,y:2},b:{x:2,y:2},variant,...rest};}
function win(rest={}){return {id:'w1',type:'window',a:{x:3,y:2},b:{x:4,y:2},...rest};}
function scene(){
 const roots=[],removed=[];
 function root(id){const n={id,parent:{remove(r){removed.push(r.id);r.parent=null;}}};roots.push(n);return n;}
 return {root,roots,removed};
}
test('multiplicadores aprobados, 500 PG electrónicos, 10 PG lectores, doble con un total',()=>{
 const H=api();
 const expected={wood:10,metal:20,glass:5,grille:15,reinforced:30};
 for(const [m,pg] of Object.entries(expected))assert.equal(H.maxPG(door('wood',{doorMaterial:m})),pg);
 assert.equal(H.maxPG(win()),2.5);
 assert.equal(H.maxPG(win({windowMaterial:'reinforced'})),15);
 assert.equal(H.maxPG(door('metal',{architectureSkin:'puerta_electronica_opaca'})),500);
 assert.equal(H.maxPG(door('glass',{architectureSkin:'puerta_electronica_reja'})),500);
 assert.equal(H.maxPG(door('wood',{accessDoorType:'electronic'})),500);
 assert.equal(H.maxPG(door('wood',{accessDevice:'pin'}),'reader'),10);
 assert.equal(H.maxPG(door('wood',{accessDevice:'card'}),'reader'),10);
 assert.equal(H.maxPG(door('wood',{accessDevice:'none'}),'reader'),0);
 assert.equal(H.maxPG(door('wood',{b:{x:3,y:2}})),10,
  'una puerta doble, sin duplicar PG por hoja');
});
test('daño físico y mágico aplican vulnerabilidad ×2; sin elemental y nunca más que máximo',()=>{
 const H=api(),registry={},it=door('metal',{damageVulnerabilities:['magical']});
 assert.equal(H.damage(registry,'p1',it,4,'physical').pg,16);
 const magical=H.damage(registry,'p1',it,3,'magical');
 assert.equal(magical.pg,10);
 assert.equal(magical.damage,6);
 assert.equal(magical.vulnerabilityApplied,true);
 assert.equal(H.damage(registry,'p1',it,500,'magical').pg,0);
 assert.equal(H.damage(registry,'p1',it,1,'physical').changed,false);
 assert.equal(H.stateFor(registry,'p1',it).destroyed,true);
 assert.throws(()=>H.damage(registry,'p1',it,-1,'physical'),/no negativo/);
 assert.throws(()=>H.damage(registry,'p1',it,1,'fire'),/no admitido/);
 assert.equal(H.initialPG(door('metal',{initialPG:999})),20,'lectura defensiva limita valores externos');
});
test('PG iniciales, vulnerabilidades y valores inválidos: contrato opcional del mapa',()=>{
 const H=api(),map=legacy(),old=JSON.stringify(map);
 H.validateMap(map);
 assert.equal(JSON.stringify(map),old,'la validación no agrega campos al mapa antiguo');
 let d=map.floors.flatMap(f=>f.items).find(it=>it.type==='door');
 let w=map.floors.flatMap(f=>f.items).find(it=>it.type==='window');
 d.initialPG=5;d.damageVulnerabilities=['physical','magical'];
 w.windowMaterial='reinforced';w.initialPG=11;
 H.validateMap(map);
 assert.equal(JSON.parse(JSON.stringify(map)).floors.flatMap(f=>f.items).find(x=>x.id===d.id).initialPG,5);
 w.initialPG=200;assert.throws(()=>H.validateMap(map),/initialPG/);
 w.initialPG=10;d.damageVulnerabilities=['physical','physical'];
 assert.throws(()=>H.validateMap(map),/damageVulnerabilities/);
});
test('el daño persiste en partida sin cambiar el mapa, incluso tras reiniciar el runtime',()=>{
 const H=api(),it=door('wood',{accessDevice:'card'}),map={floors:[{id:'f1',items:[it]}]};
 const scenes=scene(),c1=scenes.root('leaf'),c2=scenes.root('frame');
 const d={f:0,hinge:c1,frame:c2,passable:false,angle:0,open:false,accessVisuals:[]};
 const state={doors:{},structures:{}},doorList=[[d]],blockers=[[]],events=[];
 let saves=0,updates=0;
 const rt=H.createRuntime({data:map,state,doorList,blockers,save:()=>saves++,refresh:()=>updates++,
  events:{emit:(type,payload)=>events.push({type,payload})}});
 rt.registerDoor(d,it);
 assert.equal(rt.takeDamage({floorId:'f1',id:'d1',amount:3}).pg,7);
 const destroyed=rt.takeDamage({floorId:'f1',id:'d1',amount:8});
 assert.equal(destroyed.destroyed,true);
 assert.equal(d.destroyed,true);assert.equal(d.passable,true);
 assert.deepEqual(scenes.removed,['leaf','frame']);
 assert.equal(saves,2);assert.equal(updates,2);
 assert.equal(events.length,2);
 assert.equal(it.initialPG,undefined,'el mapa de autoría sigue intacto');
 const serialized=JSON.parse(JSON.stringify({version:1,state}));
 assert.equal(serialized.state.structures.f1.d1.structure.pg,0);
 const scenes2=scene(),restored={f:0,hinge:scenes2.root('leaf2'),frame:scenes2.root('frame2'),passable:false};
 const rt2=H.createRuntime({data:map,state:serialized.state,doorList:[[restored]],blockers:[[]]});
 rt2.registerDoor(restored,it);
 assert.equal(restored.destroyed,true);
 assert.equal(rt2.getState('f1','d1').pg,0);
});
test('ventana destruida elimina colisión y geometría, sin borrar el registro ni otras paredes',()=>{
 const H=api(),it=win(),map={floors:[{id:'f1',items:[it]}]};
 const sceneGraph=scene();
 const own={id:'own'},another={id:'other'},blockers=[[another,own]];
 const roots=[sceneGraph.root('pane'),sceneGraph.root('sill')];
 let dirty=0,saveCount=0;
 const rt=H.createRuntime({data:map,state:{},doorList:[[]],blockers,refresh:()=>dirty++,save:()=>saveCount++});
 rt.registerWindow(0,it,[own],roots);
 assert.equal(H.maxPG(it),2.5);
 const result=rt.takeDamage({floorId:'f1',id:'w1',amount:10,kind:'physical'});
 assert.equal(result.pg,0);
 assert.equal(result.destroyed,true);
 assert.deepEqual(blockers[0],[another]);
 assert.deepEqual(sceneGraph.removed,['pane','sill']);
 assert.equal(dirty,1);assert.equal(saveCount,1);
 assert.equal(map.floors[0].items.length,1);
 const delayed=sceneGraph.root('late-glb');
 rt.registerWindowVisual(0,'w1',delayed);
 assert.ok(sceneGraph.removed.includes('late-glb'),'carga tardía de GLB no revive la ventana');
});
test('lector de 10 PG se destruye visualmente sin afectar los PG ni la colisión de la puerta',()=>{
 const H=api(),it=door('metal',{accessDevice:'pin'}),map={floors:[{id:'f1',items:[it]}]};
 const g=scene(),frame=g.root('frame'),leaf=g.root('leaf'),pad=g.root('pad');
 const d={f:0,hinge:leaf,frame,passable:false,accessVisuals:[pad]};
 const rt=H.createRuntime({data:map,state:{},doorList:[[d]],blockers:[[]]});
 rt.registerDoor(d,it);
 const result=rt.takeDamage({floorId:'f1',id:'d1',amount:10,part:'reader',kind:'magical'});
 assert.equal(result.destroyed,true);
 assert.deepEqual(g.removed,['pad']);
 assert.equal(rt.getState('f1','d1').pg,20);
 assert.equal(d.passable,false);assert.equal(d.destroyed,undefined);
});
test('editor y motor comparten una sola función de colisión y preservan mapas anteriores',()=>{
 assert.match(index,/if\(d\.destroyed===true\|\|d\.open===true/);
 assert.match(index,/ForestShared\.solidAt\(x,z,/);
 assert.match(index,/ForestShared\.solidAt\(x,y,/);
 assert.match(index,/FHStructureHealth\?\.validateMap\(doc\)/);
 assert.match(index,/FHStructureHealth\?\.validateMap\(obj\)/);
 assert.match(index,/FHStructureHealthEngine\.patch\(window\.FHArchitectureSkins\.patchEngineDoc/);
 assert.match(index,/fh-structure-editor\.js/);
 assert.doesNotMatch(index,/const MAP_SCHEMA='forest-horror-map-v2'/);
});
test('hook 3D compone contra el motor Base64 y el adaptador de GLB real',()=>{
 const sections=Array.from({length:13},(_,i)=>{
  const shard=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  const hit=shard.match(/\+"([A-Za-z0-9+/=]+)";/);
  assert.ok(hit);return hit[1];
 });
 const doc=Buffer.from(sections.join(''),'base64').toString('utf8');
 const archCode=fs.readFileSync(path.join(__dirname,'fh-architecture-skins.js'),'utf8');
 const a={};const ctx={window:a,document:{currentScript:{src:'https://example.test/juego/assets/fh-architecture-skins.js'},baseURI:'https://example.test/'},URL};
 vm.runInNewContext(archCode,ctx);
 const installed=a.FHArchitectureSkins.patchEngineDoc(doc);
 const b={},hctx={window:b,document:{currentScript:{src:'https://example.test/juego/assets/fh-structure-engine-hook.js'},baseURI:'https://example.test/'},URL};
 vm.runInNewContext(hookCode,hctx);
 const patched=b.FHStructureHealthEngine.patch(installed);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerWindow/);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerDoor/);
 assert.match(patched,/const fhHealthRuntime=window\.FHStructureHealth\.createRuntime/);
 assert.match(patched,/window\.ForestHorrorStructureAPI=Object\.freeze/);
 assert.match(patched,/structures:structuredClone\(initial\.structures\|\|\{\}\)/);
 assert.match(patched,/d\.passable=d\.destroyed===true\|\|/);
 assert.match(patched,/fh-structure-health\.js\?v=/);
 assert.match(patched,/fh-structure-strings\.js\?v=/);
 const body=patched.slice(patched.indexOf('<script>')+8,patched.indexOf('</script>',patched.indexOf('<script>')));
 assert.doesNotThrow(()=>new vm.Script(body), 'el motor parcheado compila');
});

test('colisión real compartida: puerta abierta por destrucción y ventanal sin antepecho',()=>{
 const start=index.indexOf('const ForestShared=(()=>{'),end=index.indexOf('\n})();',start);
 assert.ok(start>=0&&end>start);
 const scope={};vm.runInNewContext(index.slice(start,end+6)+'\nthis.shared=ForestShared;',scope);
 const solidAt=scope.shared.solidAt;
 const barrier={x1:2,z1:0,x2:2,z2:4};
 const position={width:10,height:10,radius:.2,walls:[],doors:[{block:barrier,open:false,passable:false}]};
 assert.equal(solidAt(2,2,position),true);
 position.doors[0].destroyed=true;
 assert.equal(solidAt(2,2,position),false);
 const H=api(),w=win(),map={floors:[{id:'f1',items:[w]}]},walls=[[barrier]];
 const rt=H.createRuntime({data:map,state:{},doorList:[[]],blockers:walls});
 rt.registerWindow(0,w,[barrier],[]);
 assert.equal(solidAt(2,2,{...position,doors:[],walls:walls[0]}),true);
 rt.takeDamage({floorId:'f1',id:'w1',amount:2.5});
 assert.equal(solidAt(2,2,{...position,doors:[],walls:walls[0]}),false);
});
test('IDs de mapas arbitrarios siguen siendo claves JSON, nunca prototipos',()=>{
 const H=api(),it=door('wood',{id:'__proto__'}),registry={};
 const result=H.damage(registry,'__proto__',it,1);
 assert.equal(result.pg,9);
 assert.equal(Object.hasOwn(registry,'__proto__'),true);
 assert.equal(Object.hasOwn(registry['__proto__'],'__proto__'),true);
 assert.equal(Object.getPrototypeOf(registry),Object.prototype);
 assert.equal(JSON.parse(JSON.stringify(registry))['__proto__']['__proto__'].structure.pg,9);
});
