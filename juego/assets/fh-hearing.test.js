const test = require('node:test');
const assert = require('node:assert/strict');
const hearing = require('./fh-hearing.js');

const listener = { x: 0, z: 0, y: 1.5 };
const source = (x, z = 0, extra = {}) => ({ x, z, y: 1.5, floor: 0, ...extra });
const view = (obstacles = []) => ({ listener, floor: 0, radius: 10.4, obstacles });

test('el máximo auditivo usa 10.4 m independientemente de la luz', () => {
  assert.equal(hearing.evaluate(source(9), view()).audible, true);
  assert.equal(hearing.evaluate(source(10.4), view()).audible, false);
  assert.equal(hearing.evaluate(source(10.5, 0, { range: 30 }), view()).audible, false);
  assert.equal(hearing.evaluate(source(5, 0, { range: 4 }), view()).audible, false);
});
test('paredes de borde: ninguna categoría de muro grueso y atenuación acumulable', () => {
  const walls = [
    {type:'wall', x1:1, z1:-1, x2:1, z2:1},
    {type:'wall', x1:2, z1:-1, x2:2, z2:1}
  ];
  const clear = hearing.evaluate(source(4), view());
  const one = hearing.evaluate(source(4), view(walls.slice(0, 1)));
  const two = hearing.evaluate(source(4), view(walls));
  assert.equal(one.barriers, 1);
  assert.equal(two.barriers, 2);
  assert.ok(clear.volume > one.volume && one.volume > two.volume);
  assert.ok(Math.abs(two.volume / one.volume - 0.25) < 1e-10);
});
test('dos segmentos de la misma pared en un punto no cuentan dos veces', () => {
  const parts = [
    {type:'wall', x1:1, z1:-2, x2:1, z2:0},
    {type:'wall', x1:1, z1:0, x2:1, z2:2}
  ];
  const result = hearing.evaluate(source(2), view(parts));
  assert.equal(result.barriers, 1);
});
test('las puertas abiertas no bloquean, las cerradas sí', () => {
  const items=[{type:'wall',a:{x:0,y:1},b:{x:2,y:1}},{type:'window',a:{x:0,y:2},b:{x:2,y:2}}];
  const door={block:{x1:1,z1:-1,x2:1,z2:1},open:false};
  const closed=hearing.buildObstacles(items,[door]);
  assert.equal(closed.length,3);
  assert.equal(closed[0].z1,1.524);
  assert.equal(hearing.evaluate(source(2),view(closed)).barriers,1);
  door.open=true;
  const opened=hearing.buildObstacles(items,[door]);
  assert.equal(hearing.evaluate(source(2),view(opened)).barriers,0);
});
test('fuentes en otra planta y coordenadas inválidas no se oyen', () => {
  assert.equal(hearing.evaluate(source(1,0,{floor:1}),view()).audible,false);
  assert.equal(hearing.evaluate(source(NaN),view()).audible,false);
  assert.equal(hearing.evaluate(source(1),{...view(),listener:{x:NaN,z:0}}).audible,false);
});
test('a través de varias paredes lejanas el sonido cae bajo el umbral', () => {
  const walls=[1,2,3].map(x=>({type:'red_wall',x1:x,z1:-1,x2:x,z2:1}));
  const result=hearing.evaluate(source(8),view(walls));
  assert.equal(result.audible,false);
  assert.equal(result.volume,0);
  assert.equal(result.barriers,3);
});
