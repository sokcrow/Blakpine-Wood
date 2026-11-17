/* Validador de las palabras clave utilizadas por los contratos multimodo v1. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHMultimodeSchemaValidator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function matchesType(value,type){
  if(type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(type==='array')return Array.isArray(value);
  if(type==='integer')return Number.isInteger(value);
  return typeof value===type;
 }
 function assert(condition,path){if(!condition)throw new TypeError('CONTRACT_INVALID: '+path);}
 function walk(value,schema,path){
  assert(schema&&typeof schema==='object'&&!Array.isArray(schema),path);
  if(Object.hasOwn(schema,'const'))assert(value===schema.const,path+'.const');
  if(schema.enum)assert(schema.enum.includes(value),path+'.enum');
  if(schema.type)assert(matchesType(value,schema.type),path+'.type');
  if(schema.type==='string'){
   if(schema.minLength!=null)assert(value.length>=schema.minLength,path+'.minLength');
   if(schema.pattern)assert(new RegExp(schema.pattern).test(value),path+'.pattern');
  }
  if(schema.type==='object'){
   for(const key of schema.required||[])assert(Object.hasOwn(value,key),path+'.'+key);
   for(const [key,child] of Object.entries(value)){
    if(!Object.hasOwn(schema.properties||{},key))assert(schema.additionalProperties!==false,path+'.'+key);
    else walk(child,schema.properties[key],path+'.'+key);
   }
  }
  if(schema.type==='array'){
   if(schema.uniqueItems)assert(new Set(value.map(item=>JSON.stringify(item))).size===value.length,path+'.uniqueItems');
   if(schema.items)value.forEach((item,index)=>walk(item,schema.items,path+'['+index+']'));
  }
 }
 return Object.freeze({validate(value,schema){walk(value,schema,'$');return true;}});
});