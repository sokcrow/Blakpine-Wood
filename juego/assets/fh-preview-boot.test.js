'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const editor=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(start,end){
 const from=editor.indexOf(start),to=editor.indexOf(end,from);
 assert.ok(from>=0&&to>from,'No se encontró el código de arranque: '+start);
 return editor.slice(from,to);
}
test('decodifica UTF-8 cuando un carácter queda dividido entre bloques Base64',()=>{
 const source=extract('function decodeEmbedded3DEngine(base64){','\nconst play3DLayer=').trim();
 const decode=new Function('PREVIEW_TEXT','return ('+source+')')({missing:'Faltan archivos del motor 3D.'});
 const original='x'.repeat(98302)+'🌲'+'ñ'.repeat(72000);
 assert.equal(decode(Buffer.from(original,'utf8').toString('base64')),original);
 assert.throws(()=>decode(''),/Faltan archivos/);
});
test('el documento 3D integra Three.js local, comunica el estado real y mantiene sintaxis válida',()=>{
 const sandbox={window:{}};
 for(let i=0;i<=12;i++){
  const name='engine-'+String(i).padStart(2,'0')+'.js';
  vm.runInNewContext(fs.readFileSync(path.join(root,'juego/assets',name),'utf8'),sandbox,{filename:name});
 }
 const base64=sandbox.window.__FOREST_EMBEDDED_ENGINE__;
 assert.ok(base64&&base64.length>10000000,'Se requieren los 13 fragmentos del motor');
 const motor=Buffer.from(base64,'base64').toString('utf8');
 const source=extract('function prepareGLBEngineDoc(source){','\nlet fhCharacterLaunchPending=false;').trim();
 const prepare=new Function('document','URL','return ('+source+')')({baseURI:'https://example.test/Blakpine-Wood/'},URL);
 const resultado=prepare(motor);
 assert.match(resultado,/juego\/assets\/vendor\/three\.min\.js/);
 assert.match(resultado,/FOREST_PREVIEW_RUNNING/);
 assert.match(resultado,/FOREST_PREVIEW_ERROR/);
 const start=resultado.lastIndexOf('<script>')+8;
 const end=resultado.lastIndexOf('</script>');
 assert.ok(start>7&&end>start);
 assert.doesNotThrow(()=>new vm.Script(resultado.slice(start,end)));
 const vendor=fs.readFileSync(path.join(root,'juego/assets/vendor/three.min.js'),'utf8');
 assert.match(vendor,/SPDX-License-Identifier: MIT/);
});
