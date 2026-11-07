/* Regresión del radial y la integración del motor embebido.
 * Ejecutar: node --test juego/assets/fh-context-engine-hook.test.js
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const entry=read('index.html');
const hook=read('juego/assets/fh-context-engine-hook.js');
const engineFiles=Array.from({length:13},(_,i)=>'juego/assets/engine-'+String(i).padStart(2,'0')+'.js');

function generateEngine(){
 const parts=engineFiles.map(file=>{
  const match=read(file).match(/\|\|""\)\+"([^"]+)"\s*;/);
  assert.ok(match,'Falta un fragmento del motor: '+file);
  return match[1];
 });
 const original=Buffer.from(parts.join(''),'base64').toString('utf8');
 const document={baseURI:'https://example.test/Blakpine-Wood/'},window={document};
 new Function('window','URL',hook)(window,URL);
 const start=entry.indexOf('function addLiveTextToEngine(doc){');
 const end=entry.indexOf('let fhCharacterLaunchPending=false;',start);
 assert.ok(start>=0&&end>start);
 const factory=new Function('window','document','URL',
  entry.slice(start,end)+';return prepareGLBEngineDoc;');
 return factory(window,document,URL)(original);
}

test('el HTML generado integra radial y decoración sin afectar el editor 2D',()=>{
 const output=generateEngine();
 assert.match(output,/function fhContextRefresh\(\)/);
 assert.match(output,/fhContextRefresh\(\)/);
 assert.match(output,/fh-interaction-radial\.js/);
 assert.match(output,/fh-interaction-strings\.js/);
 assert.match(output,/fh-interaction-radial\.css/);
 assert.match(output,/id:'knock',label:t\.knock\|\|'Llamar',disabled:true/);
 assert.match(output,/id:'examine',label:t\.examine\|\|'Examinar',disabled:true/);
 assert.match(output,/const canLook=target\.kind==='peephole_door'/);
 assert.match(output,/id='fhDecorModeBtn'/);
 assert.match(output,/if\(!fhDeliveryUiActive\)moveUpdate\(dt\)/);
 assert.doesNotMatch(output,/if\(!fhDeliveryUiActive&&!fhDecorationActive\)moveUpdate\(dt\)/);
 assert.doesNotMatch(output,/pixelSize=pixelSize===2\?3/);
 assert.match(output,/let pixelSize=2/);
 assert.match(output,/intersectObjects\(a\.roots\.map\(entry=>entry\.root\),true\)/);
 const inline=[...output.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);
 assert.ok(inline.length>0);
 for(const script of inline)assert.doesNotThrow(()=>new Function(script));
});

test('solo muebles decorables, no puertas ni estructura',()=>{
 const decoration=require('./fh-decoration.js');
 assert.equal(decoration.isMovable({id:'armario1',type:'wardrobe'}),true);
 assert.equal(decoration.isMovable({id:'sofa1',type:'sofa'}),true);
 assert.equal(decoration.isMovable({id:'modelo1',type:'misc',modelId:'mesa_pixel'}),true);
 assert.equal(decoration.isMovable({id:'puerta1',type:'door'}),false);
 assert.equal(decoration.isMovable({id:'lector1',type:'card_reader'}),false);
 assert.equal(decoration.isMovable({id:'puerta2',type:'misc',modelId:'puerta_electronica'}),false);
});
