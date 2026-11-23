'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),api=require('../juego/assets/fh-medieval-catalog.js');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'forest-horror/biblioteca/catalogo_muebles.json'),'utf8')).furniture;
test('DnD muestra únicamente el pack medieval y mobiliario reutilizable explícito',()=>{
 const actual=api.entries(catalog,'dnd');
 const required=['barril_madera_medieval','tonel_bodega_medieval','banco_largo_medieval','arcon_reforzado_medieval','cama_paja_medieval','estanteria_madera_medieval','mesa_taberna_medieval','armario_rustico_medieval','silla_madera','mesa_pequena','mesa_cocina_rectangular','cama_individual','estante_bajo'];
 assert.equal(actual.length,required.length);
 for(const id of required)assert.ok(actual.some(x=>x.id===id),'Falta '+id);
 for(const id of ['refrigerador','televisor_crt','monitor_crt','microondas','inodoro_clasico','silla_oficina','escritorio_pc'])assert.ok(!actual.some(x=>x.id===id),'Se filtró mal '+id);
 for(const x of actual)assert.equal(api.compatible(x,'dnd'),true);
});
test('Legacy y Moon conservan el catálogo entero y no hay mutaciones',()=>{
 const snapshot=JSON.stringify(catalog);
 assert.equal(api.entries(catalog,'legacy').length,catalog.length);
 assert.equal(api.entries(catalog,'moon-system').length,catalog.length);
 assert.equal(JSON.stringify(catalog),snapshot);
});
test('DnD oculta herramientas de tecnología contemporánea sin alterar los otros modos',()=>{
 for(const [cat,id] of [['furniture','tv'],['furniture','kitchen'],['furniture','bath'],['furniture','car'],['lighting','power_outlet'],['lighting','light_switch'],['network','router'],['water','water_boiler'],['structure','elevator'],['areas','parking'],['roads','road_signal']]){
  assert.equal(api.toolAllowed(cat,id,'dnd'),false,cat+'/'+id);
  assert.equal(api.toolAllowed(cat,id,'legacy'),true,cat+'/'+id);
  assert.equal(api.toolAllowed(cat,id,'moon-system'),true,cat+'/'+id);
 }
 for(const [cat,id] of [['furniture','misc'],['structure','door'],['areas','dirt'],['areas','cobblestone'],['areas','stairs'],['areas','spawn']])assert.equal(api.toolAllowed(cat,id,'dnd'),true,cat+'/'+id);
});
test('Portal transmite modo del contexto y no publica campañas DnD como Legacy',()=>{
 const app=fs.readFileSync(path.join(root,'portal/app.js'),'utf8');
 const workspace=fs.readFileSync(path.join(root,'portal/editor-workspace.js'),'utf8');
 const library=fs.readFileSync(path.join(root,'portal/map-library.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const room=fs.readFileSync(path.join(root,'portal/game-room.js'),'utf8');
 assert.match(room,/api\.setRuleset\(fresh\.context\.rulesetId\)/);
 assert.match(app,/\['legacy','dnd'\]\.includes\(c\.ruleset\)/);
 assert.match(workspace,/api\.setRuleset\(context\.rulesetId\)/);
 assert.match(library,/api\.setRuleset\(this\.context\.rulesetId\)/);
 assert.match(html,/window\.FHEditorCatalog\.setRuleset\(rulesetId\)/);
 assert.match(html,/lumenEditorRuleset==='dnd'/);
 assert.match(html,/fh-medieval-catalog\.js/);
});

test('Cartucho DnD conserva el modelId al guardar y no acepta mezclas de identidad',async()=>{
 const m=await import('../portal/cartridge.js');
 const context={uid:'director',ownerUid:'director',campaignId:'campana-medieval',rulesetId:'dnd',status:'active'};
 const created=m.createCartridge(context);
 const project={schema:'forest-horror-map-v1',version:1,floors:[{id:'PB',items:[{id:'a1',type:'misc',modelId:'arcon_reforzado_medieval',x:2,y:3,blocksMovement:true}]}]};
 const updated=m.changeMap(created,context,p=>{assert.equal(p.schema,'forest-horror-map-v1');return true;},{
  name:'Taberna',project,expectedRevision:1
 });
 assert.equal(updated.cartridge.rulesetId,'dnd');
 assert.equal(updated.cartridge.maps[0].project.floors[0].items[0].modelId,'arcon_reforzado_medieval');
 assert.equal(updated.cartridge.maps[0].project.floors[0].items[0].blocksMovement,true);
 assert.throws(()=>m.validateCartridge(updated.cartridge,{...context,rulesetId:'legacy'},()=>true),/IDENTITY/);
 assert.throws(()=>m.authorize({...context,rulesetId:'moon-system'}),/ACCESS/);
});

test('Selector independiente notifica el modo y respeta el contexto de cartucho',()=>{
 const selector=fs.readFileSync(path.join(root,'juego/assets/fh-multimode-selector.js'),'utf8');
 assert.match(selector,/globalThis\.FHEditorCatalog\?\.setRuleset\?\.\(selectedRule\)/);
 assert.match(selector,/get\('lumenCartridge'\)!=='1'/);
});
