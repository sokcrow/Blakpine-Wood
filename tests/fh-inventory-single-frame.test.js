'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'juego/assets/fh-game-ui.css'),'utf8');
const hook=fs.readFileSync(path.join(root,'juego/assets/fh-services-engine-hook.js'),'utf8');
const editor=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('los sprites respaldados por PNG no reciben una segunda caja ni fondo',()=>{
 assert.match(hook,/node\.classList\.add\('fh-item-art'\)/);
 assert.match(css,/\.itemSprite\.fh-item-art[\s\S]*?background:transparent!important;/);
 assert.match(css,/\.itemSprite\.fh-item-art[\s\S]*?box-shadow:none!important;/);
 assert.match(css,/\.itemSprite\.fh-item-art[\s\S]*?border:0!important;/);
 assert.match(css,/\.itemSprite\.fh-item-art > img[\s\S]*?object-fit:contain!important;/);
});

test('sigue existiendo una sola casilla exterior con selección y numeración',()=>{
 assert.match(css,/#fhPlayerMenu #inventorySlots \.inventorySlot\.active/);
 assert.match(css,/#fhPlayerMenu #inventorySlots \.inventorySlot \.slotIndex/);
 assert.match(css,/\.inventorySlot \.itemSprite\.fh-item-art/);
});

test('los cuatro PNG de usuario conservan canal alfa y no se reemplazan',()=>{
 for(const id of ['cargador-celular','cargador-rapido','celular','cartera']){
  const file=fs.readFileSync(path.join(root,'juego/assets/items',id+'.png'));
  assert.equal(file.subarray(1,4).toString(),'PNG',id);
  const colorType=file[25];
  assert.ok(colorType===6||colorType===4||colorType===3&&file.includes(Buffer.from('tRNS')),id+' sin transparencia');
 }
});

test('editor y motor cargan versión actualizada de CSS y adaptador',()=>{
 assert.match(editor,/fh-game-ui\.css\?v=20261113-single-item-frame-1/);
 assert.match(editor,/fh-services-engine-hook\.js\?v=20261113-single-item-frame-1/);
});
