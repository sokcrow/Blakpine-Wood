/* Compone el motor REAL del repositorio; no sustituye adaptadores por mocks. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function prepare(){
 const root=path.resolve(__dirname,'../..'),editor=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const document={baseURI:'https://example.test/',currentScript:null};
 const window={document,__FOREST_EMBEDDED_ENGINE__:''};
 const context=vm.createContext({window,document,URL,console});
 const from=editor.indexOf('const ForestShared=(()=>{'),to=editor.indexOf("\n'use strict';",from);
 vm.runInContext(editor.slice(from,to),context);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync(path.join(root,'juego/assets/engine-'+String(i).padStart(2,'0')+'.js'),'utf8'),context);
 for(const file of ['fh-roof-engine-hook.js','fh-architecture-skins.js','fh-comic-action-engine-hook.js','fh-context-engine-hook.js','fh-structure-engine-hook.js','fh-internet-catalog.js','fh-internet-visuals.js','fh-electric-catalog.js','fh-electric-visuals.js','fh-water-catalog.js','fh-water-visuals.js','fh-services-engine-hook.js','fh-barriers-engine-hook.js','fh-cctv-engine-hook.js','fh-forest-engine-hook.js']){
  document.currentScript={src:new URL('juego/assets/'+file,document.baseURI).href};vm.runInContext(fs.readFileSync(path.join(root,'juego/assets',file),'utf8'),context);
 }
 const start=editor.indexOf('function addLiveTextToEngine('),end=editor.indexOf('\nlet fhCharacterLaunchPending=false;',start);
 vm.runInContext(editor.slice(start,end),context);
 const base=Buffer.from(window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const prepared=context.prepareGLBEngineDoc(base);
 const services=window.FHServicesEngine.patch(prepared),architecture=window.FHArchitectureSkins.patchEngineDoc(services),structure=window.FHStructureHealthEngine.patch(architecture),barriers=window.FHBarriersEngine.patch(structure),cctv=window.FHCCTVEngine.patch(barriers);
 return {html:window.FHForestEngine.patch(cctv),beforeForest:cctv,window};
};
