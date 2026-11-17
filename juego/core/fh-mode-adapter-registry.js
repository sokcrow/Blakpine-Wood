/* Registro explícito, sin adaptadores ficticios ni activación automática. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHModeAdapterRegistry=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create(){
  const entries=new Map();
  function register({adapter,start}={}){
   if(!adapter||typeof adapter.id!=='string'||typeof adapter.rulesetId!=='string'||
    adapter.rulesetId==='legacy'||adapter.contract!=='blakpine-combat-adapter-v1'||
    typeof adapter.evaluate!=='function'||typeof start!=='function'||entries.has(adapter.rulesetId)){
    throw new TypeError('MODE_ADAPTER_INVALID');
   }
   entries.set(adapter.rulesetId,Object.freeze({kind:'adapter',adapter,start}));
  }
  function registerNativeLegacy(start){
   if(typeof start!=='function'||entries.has('legacy'))throw new TypeError('MODE_NATIVE_INVALID');
   entries.set('legacy',Object.freeze({kind:'native',start}));
  }
  function resolve(manifest){
   if(!manifest||typeof manifest.id!=='string')return null;
   const entry=entries.get(manifest.id);
   if(!entry)return null;
   if(entry.kind==='native')return manifest.id==='legacy'?entry:null;
   return manifest.status==='implemented'&&manifest.adapter?.id===entry.adapter.id&&
    manifest.adapter?.contract===entry.adapter.contract&&entry.adapter.rulesetId===manifest.id?entry:null;
  }
  return Object.freeze({register,registerNativeLegacy,resolve});
 }
 return Object.freeze({create});
});