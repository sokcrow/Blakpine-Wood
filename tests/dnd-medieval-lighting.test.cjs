'use strict';
/* node --test tests/dnd-medieval-lighting.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),lib=path.join(root,'forest-horror/biblioteca');
const mod=require('../juego/assets/fh-medieval-lighting.js');
const catalog=require('../juego/assets/fh-medieval-catalog.js');
const coverage=require('../juego/assets/fh-light-coverage.js');
const adapter=require('../juego/assets/fh-medieval-light-engine.js');
const items=JSON.parse(fs.readFileSync(path.join(lib,'catalogo_muebles.json'),'utf8')).furniture;
const entries=items.filter(x=>x.pack==='medieval_lighting_01');
const clock=(minutes=100)=>({year:2026,month:11,day:21,minutes});
test('9 luminarias medievales, modelos reales y presupuesto bajo de triángulos',()=>{
 assert.equal(entries.length,9);
 assert.equal(new Set(entries.map(x=>x.id)).size,9);
 let tris=0;
 for(const [kind,spec] of Object.entries(mod.definitions)){
  const item=entries.find(x=>x.id===spec.modelId);
  assert.ok(item,kind);assert.equal(item.lightKind,kind);
  assert.ok(item.ambientations.includes('medieval'));
  const file=fs.readFileSync(path.join(lib,item.glb));
  assert.equal(file.toString('ascii',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length);
  const jLen=file.readUInt32LE(12),info=JSON.parse(file.toString('utf8',20,20+jLen));
  const binOffset=28+jLen;
  assert.equal(file.readUInt32LE(20+jLen),info.buffers[0].byteLength);
  assert.equal(binOffset+info.buffers[0].byteLength,file.length);
  assert.equal(info.images[0].mimeType,'image/png');
  assert.equal(info.samplers[0].magFilter,9728);
  assert.ok(info.accessors[1].count>0);
  const num=info.accessors[0].count/3;assert.ok(num>0&&num<=200,kind+' polys');
  tris+=num;
  const img=fs.readFileSync(path.join(lib,item.thumbnail));
  assert.equal(img.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(img.readUInt32BE(16),64);
  assert.equal(img.readUInt32BE(20),64);
 }
 assert.ok(tris<=1100,'Triángulos totales '+tris);
});
test('DnD muestra solo 13 muebles y las nueve herramientas; Legacy/Moon no se modifican',()=>{
 const original=JSON.stringify(items);
 assert.equal(catalog.entries(items,'dnd').length,13);
 assert.equal(catalog.entries(items,'legacy').length,items.length);
 assert.equal(catalog.entries(items,'moon-system').length,items.length);
 for(const id of Object.keys(mod.tools)){
  assert.equal(catalog.toolAllowed('lighting',id,'dnd'),true,id);
  assert.equal(catalog.toolAllowed('lighting',id,'legacy'),false,id);
  assert.equal(catalog.toolAllowed('lighting',id,'moon-system'),false,id);
 }
 assert.equal(catalog.toolAllowed('lighting','light_fixture','legacy'),true);
 assert.equal(catalog.toolAllowed('lighting','light_fixture','dnd'),false);
 assert.equal(JSON.stringify(items),original);
});
test('Luz medieval independiente de electricidad, oscuridad y reloj de juego',()=>{
 const fire={id:'f',type:'light_fixture',lightKind:'campfire',x:2,y:2,lightOn:true};
 const crystal={id:'c',type:'light_fixture',lightKind:'magic_crystal',x:3,y:3};
 const state={flags:{power_global:false},inventory:[],clock:clock(100)},floor={items:[fire,crystal]};
 let minute=100;
 const runtime=mod.createRuntime({floors:[floor],state,clock:()=>minute});
 assert.equal(runtime.lit(0,fire),true);assert.equal(runtime.lit(0,crystal),true);
 runtime.tick();minute+=60;assert.equal(runtime.tick(),true);
 assert.equal(runtime.view('f').remaining,60);
 assert.equal(runtime.view('c').remaining,null);
 assert.equal(runtime.interact(0,fire).action,'off');assert.equal(runtime.lit(0,fire),false);
 minute+=120;runtime.tick();assert.equal(runtime.view('f').remaining,60,'Apagada no consume');
 assert.equal(runtime.interact(0,fire).action,'on');
 minute+=65;runtime.tick();assert.equal(runtime.lit(0,fire),false);
 assert.equal(runtime.view('f').remaining,0);
 assert.equal(runtime.lit(0,crystal),true);
});
test('Reabastecimiento consume un ítem real y persiste con serialización',()=>{
 const light={id:'o',type:'light_fixture',lightKind:'oil_lantern',lightFuelMinutes:0,x:1,y:1};
 const state={inventory:['aceite_lampara'],clock:clock(100)};
 const a=mod.createRuntime({floors:[{items:[light]}],state,clock:()=>100});
 const res=a.interact(0,light);assert.equal(res.action,'refueled');
 assert.deepEqual(state.inventory,[]);assert.equal(a.view('o').remaining,240);
 const saved=JSON.parse(JSON.stringify(state));
 const b=mod.createRuntime({floors:[{items:[light]}],state:saved,clock:()=>150});
 assert.equal(b.view('o').remaining,240);
 const noFuel=b.refuel('o');assert.equal(noFuel.ok,false);
});
test('Antorcha portátil sigue al personaje y se suelta en la posición correcta',()=>{
 const torch={id:'hand',type:'light_fixture',lightKind:'torch_hand',x:2,y:3};
 let minute=100,player={floor:0,x:3.048,z:4.572};
 const calls=[],lights={setDynamicSource:(id,source)=>{calls.push(['set',id,source]);return true;},removeDynamicSource:id=>{calls.push(['remove',id]);return true;}};
 const state={inventory:[],clock:clock(100)};
 const a=mod.createRuntime({floors:[{items:[torch]}],state,clock:()=>minute,player:()=>player,lights,cell:1.524});
 assert.equal(a.interact(0,torch).action,'carried');
 a.tick();assert.equal(calls[0][1],'dnd:hand-torch');
 player.x=6.096;player.z=7.62;minute+=2;a.tick();
 assert.equal(calls.at(-1)[2].x,6.096);assert.equal(calls.at(-1)[2].z,7.62);
 assert.equal(a.drop(),true);
 assert.equal(torch.x,4);assert.equal(torch.y,5);
 assert.equal(a.isCarried('hand'),false);
 assert.equal(calls.at(-1)[0],'remove');
 const saved=JSON.parse(JSON.stringify(state)),reopened={...torch,x:2,y:3};
 const again=mod.createRuntime({floors:[{items:[reopened]}],state:saved,clock:()=>minute,
   player:()=>player,lights,cell:1.524});
 assert.equal(again.itemFor('hand').x,4);
 assert.equal(again.itemFor('hand').y,5);
});
test('La antorcha de pared mantiene oclusión y respeta intensidad',()=>{
 const wall={type:'wall',a:{x:5,y:0},b:{x:5,y:10}};
 const light={id:'t',type:'light_fixture',lightKind:'torch_wall',x:3,y:5,rotation:0,lightRadiusFt:20,lightDimFalloffFt:10};
 const settings={columns:10,rows:10,feetPerCell:5};
 const presetFor=k=>mod.preset(k);
 const mask=coverage.compute({items:[light,wall]},settings,{presetFor,scale:2});
 assert.equal(mask.sample(4,5),true);
 assert.equal(mask.sample(7,5),false);
 const disabled=coverage.compute({items:[{...light,lightOn:false},wall]},settings,{presetFor,scale:2});
 assert.equal(disabled.lights,0);
});
test('El editor y el adaptador registran nueve herramientas antes de construir la barra',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const group=html.slice(html.indexOf("lighting:[['select'"),html.indexOf('  water:[',html.indexOf("lighting:[['select'")));
 for(const tool of Object.keys(mod.tools))assert.ok(group.includes(tool),tool);
 assert.match(html,/FHMedievalLightEngine\.patchEngineDoc\(engineDoc,document\.baseURI\)/);
 assert.match(html,/window\.FHLights\.presetFields\(kind,Number\(project\.units\?\.feetPerCell\)\|\|5\)/);
 const example=['<!DOCTYPE html><html><head></head><body><script>',
  'function fixtureLit(floor,room,fixture){}',
  'const GameState=createGameState(restored||DATA.initialGameState);',
  'const lighting=ForestShared.createLightingSystem(DATA.floors,GameState);',
  'const GameEvents=createEventBus();',
  'function useFurniture(item,selectedSeat=null){}',
  'function render(){lighting.tick(dt);}',
  "const py=Math.min(Math.max(1.9,(Number(DATA.floors[fi].ceilingHeightFt)||11.5)*.3048-.19),\n   Math.max(1.6,entry.heightFt*.3048));",
  'box(root,MAT.metal,0,y,0,width,.09,depth);',
  'if(wall)box(root,MAT.edge,0,y+.06,-depth*.48,.18,.22,.065);',
  'roomLampEntries.push({...entry,root,lit,dark});',
  'entry.lit.visible=lit;entry.dark.visible=!lit;',
  'function refreshLampGlow(){entry.lit.visible=lit;entry.dark.visible=!lit;}',
  'const exteriorLayers=DATA.floors.map(()=>new THREE.Group());scene.add(...exteriorLayers);',
  "const nested='</head>';","</script></body></html>"].join('\n');
 const doc=adapter.patchEngineDoc(example,'https://example.org/index.html');
 assert.ok(doc.includes('fhMedievalRuntime.interact(currentFloor,item)'));
 assert.ok(doc.includes('FHAssets?.attach(model,entry.lamp)'));
 assert.ok(doc.includes('fhMedievalRuntime.tick()'));
 assert.ok(doc.includes('fh-medieval-fire-vfx.js'));
 assert.ok(doc.includes('FHMedievalFireVisual?.attach(THREE,root,entry.lamp,fi)'));
 assert.ok(doc.includes('FHMedievalFireVisual?.buildChimneys'));
 assert.ok(doc.includes('FHMedievalFireVisual?.tick(dt,fhMedievalRuntime)'));
 const corrected='entry.lit.visible=lit&&!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind);';
 assert.equal(doc.split(corrected).length-1,2,'ambas rutas de visibilidad se corrigen');
 assert.ok(!doc.includes('entry.lit.visible=lit;entry.dark.visible=!lit;'));
 const once=adapter.patchEngineDoc(example.replace(
  'function refreshLampGlow(){entry.lit.visible=lit;entry.dark.visible=!lit;}', ''),
  'https://example.org/index.html');
 assert.equal(once.split(corrected).length-1,1,'retrocompatibilidad con motor de una ruta');
 assert.throws(()=>adapter.patchEngineDoc(
  example.replace('</script>','function duplicateLamp(){entry.lit.visible=lit;entry.dark.visible=!lit;}</script>'),
  'https://example.org/index.html'),/lamp visibility count 3/,'rechazar más de dos coincidencias');
 assert.ok(doc.indexOf('fh-medieval-lighting.js')<doc.indexOf('</head>'));
});
