const {test}=require('node:test'),assert=require('node:assert/strict');
const context={uid:'dm',ownerUid:'dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
test('Autorización usa lectura externa y vuelve a comprobar sesión, dueño, reglamento y estado',async()=>{
 const {campaignAccess}=await import('../portal/cartridge-access.js');
 let current='dm',data={ownerId:'dm',ruleset:'legacy',status:'active'},calls=0;
 const args={uid:'dm',campaignId:context.campaignId,currentUid:()=>current,readCampaign:async()=>{calls++;return {exists:()=>true,data:()=>data};}};
 assert.equal((await campaignAccess(args)).ownerUid,'dm');assert.equal(calls,1);
 data={...data,ruleset:'dnd'};
 assert.equal((await campaignAccess(args)).rulesetId,'dnd');
 data={...data,ruleset:'legacy'};
 for(const patch of [{ownerId:'player'},{ruleset:'moon-system'},{status:'archived'}]){
  data={ownerId:'dm',ruleset:'legacy',status:'active',...patch};await assert.rejects(()=>campaignAccess(args),/ACCESS/);
 }
 data={ownerId:'dm',ruleset:'legacy',status:'active'};
 await assert.rejects(()=>campaignAccess({...args,readCampaign:async()=>{current='other';return {exists:()=>true,data:()=>data};}}),/ACCESS/);
 current='dm';await assert.rejects(()=>campaignAccess({...args,readCampaign:async()=>{throw Error('permission-denied')}}),/permission-denied/);
});
class Element {
 children=[];hidden=false;value='';textContent='';
 append(...els){this.children.push(...els);}replaceChildren(){this.children=[];}
}
test('Biblioteca conserva proyecto ante importación inválida, error de memoria y denegación de sesión',async()=>{
 global.window={addEventListener(){}};global.document={getElementById:()=>new Element(),createElement:()=>new Element()};
 const {MapLibrary}=await import('../portal/map-library.js'),m=await import('../portal/cartridge.js');
 const elements=new Map(),root={querySelector:k=>{if(!elements.has(k))elements.set(k,new Element());return elements.get(k);}};
 const state={doc:m.createCartridge(context),exported:null,dirty:true,editorDirty:false,recoveryTokens:new Map(),saveQueue:Promise.resolve(),mapId:null};
 const view=new MapLibrary(root,state,context,async()=>context,()=>{});view.api={validate:p=>{if(p.bad)throw Error('MAP_INVALID')},read:()=>({bad:false})};view.frame=new Element();view.paint();
 const before=JSON.stringify(state.doc);
 await view.run(()=>view.add({bad:true},'Incompatible'));assert.equal(JSON.stringify(state.doc),before);
 await view.run(()=>{throw new RangeError('Invalid string length')});assert.equal(JSON.stringify(state.doc),before);
 view.verify=async()=>({...context,uid:'player'});
 await view.run(()=>view.setDoc(m.createCartridge(context)));assert.equal(JSON.stringify(state.doc),before);
 assert.match(root.querySelector('#cartridge-status').textContent,/permiso/);
 state.doc=m.changeMap(state.doc,context,view.validate,{name:'Edición incompleta',project:{bad:false},expectedRevision:state.doc.revision}).cartridge;
 state.mapId=state.doc.maps[0].mapId;state.editorDirty=true;root.querySelector('#map-name').value='Edición incompleta';
 view.api.read=()=>{throw Error('MAP_INVALID')};
 assert.equal(view.dispose(),false);assert.equal(view.alive,true);assert.equal(state.editorDirty,true);
 assert.match(root.querySelector('#cartridge-status').textContent,/conserva/);
});
