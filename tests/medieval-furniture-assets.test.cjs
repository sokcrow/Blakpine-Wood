'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'forest-horror/biblioteca');
const catalog = JSON.parse(fs.readFileSync(path.join(LIB, 'catalogo_muebles.json'), 'utf8'));
const IDS = [
 'barril_madera_medieval','tonel_bodega_medieval','banco_largo_medieval',
 'arcon_reforzado_medieval','cama_paja_medieval','estanteria_madera_medieval',
 'mesa_taberna_medieval','armario_rustico_medieval'
];
test('El catálogo conserva IDs únicos y registra las ocho piezas medievales', () => {
 assert.equal(new Set(catalog.furniture.map(x => x.id)).size, catalog.furniture.length);
 for (const id of IDS) {
  const item = catalog.furniture.find(x => x.id === id);
  assert.ok(item, 'Falta registro '+id);
  assert.equal(item.pack, 'medieval_01');
  assert.ok(item.tags.includes('medieval'));
  assert.ok(item.widthFt > 0 && item.depthFt > 0 && item.heightFt > 0);
 }
});
test('Cada GLB tiene geometría y textura PNG incrustada; su miniatura es válida', () => {
 for (const id of IDS) {
  const item = catalog.furniture.find(x => x.id === id);
  const g = fs.readFileSync(path.join(LIB,item.glb));
  assert.equal(g.toString('ascii',0,4),'glTF',id);
  assert.equal(g.readUInt32LE(4),2,id);
  assert.equal(g.readUInt32LE(8),g.length,id);
  assert.equal(g.readUInt32LE(16),0x4e4f534a,id);
  const jsonLength=g.readUInt32LE(12);
  const doc=JSON.parse(g.toString('utf8',20,20+jsonLength));
  const binLen=g.readUInt32LE(20+jsonLength);
  assert.equal(doc.buffers[0].byteLength,binLen,id);
  assert.equal(g.length,28+jsonLength+binLen,id);
  assert.equal(doc.samplers[0].magFilter,9728,id);
  assert.equal(doc.samplers[0].minFilter,9728,id);
  assert.equal(doc.images[0].mimeType,'image/png',id);
  const imageView=doc.bufferViews[doc.images[0].bufferView];
  const imageAt=28+jsonLength+imageView.byteOffset;
  assert.equal(g.toString('hex',imageAt,imageAt+8),'89504e470d0a1a0a',id);
  assert.ok(doc.accessors[1].count>0,id);
  assert.ok(doc.accessors[1].min[1]>-.05,id);
  const p=fs.readFileSync(path.join(LIB,item.thumbnail));
  assert.equal(p.toString('hex',0,8),'89504e470d0a1a0a',id);
  assert.equal(p.readUInt32BE(16),112,id);
  assert.equal(p.readUInt32BE(20),112,id);
  const len=p.readUInt32BE(33);
  const raw=zlib.inflateSync(p.subarray(41,41+len));
  assert.equal(raw.length,112*(1+112*4),id);
  let painted=0;
  for(let y=0;y<112;y++)for(let x=0;x<112;x++)if(raw[y*(1+112*4)+1+x*4+3])painted++;
  assert.ok(painted>250,'Miniatura vacía: '+id);
 }
});
