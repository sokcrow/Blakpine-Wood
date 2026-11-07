const test = require('node:test');
const assert = require('node:assert/strict');
require('./fh-live-text-strings.js');
require('./fh-live-text.js');
const ui = globalThis.FHLiveText;

test('la puntuación define distintas pausas y puntos suspensivos únicos', () => {
  const chars = Array.from('Eh, espera... ¡No! ¿Quién?');
  assert.equal(ui.delayAfter(chars,2),ui.PAUSE.comma);
  const dot = chars.indexOf('.');
  assert.equal(ui.delayAfter(chars,dot),ui.PAUSE.letter);
  assert.equal(ui.delayAfter(chars,dot+1),ui.PAUSE.letter);
  assert.equal(ui.delayAfter(chars,dot+2),ui.PAUSE.ellipsis);
  assert.equal(ui.delayAfter(chars,chars.indexOf('!')),ui.PAUSE.exclamation);
  assert.equal(ui.delayAfter(chars,chars.lastIndexOf('?')),ui.PAUSE.question);
  assert.equal(ui.delayAfter(['.'],0),ui.PAUSE.period);
});

test('el texto de distintas emociones ocupa una sola medición completa', () => {
  const pages = ui.normalizePages({
    speaker:'Guardabosques',kind:'npc',mood:'normal',
    text:'No te acerques...',
    segments:[{text:'No te acerques',mood:'miedo'},{text:'...',mood:'grito'}]
  });
  assert.equal(pages.length,1);
  assert.equal(pages[0].text,'No te acerques...');
  assert.equal(pages[0].kind,'npc');
  assert.equal(pages[0].speaker,'Guardabosques');
  assert.deepEqual(pages[0].segments.map(s=>s.mood),['miedo','grito']);
});

test('un evento sin hablante se distingue de diálogo de NPC', () => {
  const pages=ui.normalizePages({pages:['Se oyen pasos.','La puerta se abre.']});
  assert.deepEqual(pages.map(p=>p.kind),['event','event']);
  assert.deepEqual(pages.map(p=>p.text),['Se oyen pasos.','La puerta se abre.']);
});

test('la proximidad auditiva respeta distancia 3D y datos inválidos', () => {
  const listener={x:0,y:2,z:0};
  assert.equal(ui.audible({x:3,y:2,z:4},listener,5),true);
  assert.equal(ui.audible({x:3,y:8,z:4},listener,5),false);
  assert.equal(ui.audible({x:3,y:2,z:4},listener,4.99),false);
  assert.equal(ui.audible({x:NaN,y:2,z:0},listener,10),false);
  assert.equal(ui.audible({x:0,y:2,z:0},listener,0),false);
});


test('los textos extensos se dividen sin perder palabras ni emoción', () => {
  const scary = 'Algo camina detrás de la puerta. '.repeat(9);
  const shout = '¡SAL DE AHÍ!';
  const pages=ui.normalizePages({speaker:'Guardabosques',segments:[{text:scary,mood:'miedo'},{text:shout,mood:'impacto'}]});
  assert.ok(pages.length>1);
  assert.equal(pages.map(p=>p.text).join(''),scary+shout);
  assert.equal(pages.flatMap(p=>p.segments).map(s=>s.text).join(''),scary+shout);
  assert.equal(pages.at(-1).segments.at(-1).mood,'impacto');
  assert.ok(pages.every(p=>p.kind==='npc' && p.speaker==='Guardabosques'));
});


test('las acciones tienen onomatopeyas en español y ninguna se inventa para ids desconocidos', () => {
  assert.equal(ui.actionWord('door_open'), '¡ÑIIIC…!');
  assert.equal(ui.actionWord('door_close'), '¡CLAC!');
  assert.equal(ui.actionWord('flashlight_on'), '¡CLIC!');
  assert.equal(ui.actionWord('flashlight_off'), '¡CLIC!');
  assert.equal(ui.actionWord('lamp_click'), '¡TIC!');
  assert.equal(ui.actionWord('breaker_toggle'), '¡CLACK!');
  assert.equal(ui.actionWord('computer_use'), '¡BIP!');
  assert.equal(ui.actionWord('not_an_action'), '');
});

test('las acciones propias usan el estilo del TOC, se ven en oscuridad y evitan duplicados', () => {
  const previous = { document: globalThis.document, THREE: globalThis.THREE, addEventListener: globalThis.addEventListener };
  let layer;
  const node = () => ({
    style: {}, children: [], hidden: false,
    classList: { add() {}, remove() {} },
    appendChild(el) { this.children.push(el); },
    remove() { this.removed = true; },
    querySelector() { return node(); },
    setAttribute() {}, addEventListener() {}
  });
  try {
    globalThis.document = {
      head: node(),
      body: { appendChild(el) { if (el.id === 'fhSpatialLayer') layer = el; } },
      createElement: node,
      getElementById() { return null; }
    };
    globalThis.addEventListener = () => {};
    globalThis.THREE = { Vector3: class {
      constructor(x,y,z) { this.x=x; this.y=y; this.z=z; }
      project() { this.x=0; this.y=0; this.z=.5; return this; }
    }};
    ui.configure({ view: () => ({
      floor: 0, listener: {x:0,y:1.5,z:0}, hearingRadius: 19,
      visible: () => false,
      camera: {}, canvas: {getBoundingClientRect: () => ({left:0,top:0,width:200,height:100})}
    }) });
    assert.equal(ui.actionAt({id:'flashlight_on',x:0,y:1.5,z:0,floor:0,self:true,key:'flashlight'}),true);
    assert.equal(layer.children[0].className,'fh-sound');
    assert.equal(layer.children[0].textContent,'¡CLIC!');
    assert.equal(layer.children[0].hidden,false);
    assert.equal(ui.actionAt({id:'flashlight_off',x:0,y:1.5,z:0,floor:0,self:true,key:'flashlight'}),false);
    assert.equal(layer.children.length,1);
    assert.equal(ui.actionAt({id:'door_open',x:1,y:1.5,z:0,floor:0,key:'other-door'}),true);
    assert.equal(layer.children[1].hidden,true);
    assert.equal(ui.actionAt({id:'unknown',x:0,y:1.5,z:0,floor:0,self:true}),false);
    assert.equal(layer.children.length,2);
  } finally {
    globalThis.document = previous.document;
    globalThis.THREE = previous.THREE;
    globalThis.addEventListener = previous.addEventListener;
  }
});

test('Zzz cómic es visible sin visibilidad 3D y desaparece por caducidad',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  let layer,now=100;
  function node(){
    return {style:{},children:[],hidden:false,removed:false,classList:{add(){},remove(){}},
      appendChild(child){this.children.push(child);},
      remove(){this.removed=true;},
      querySelector(){return node();},setAttribute(){},addEventListener(){}};
  }
  const win={FH_LIVE_TEXT_STRINGS:{},performance:{now:()=>now},addEventListener(){},
    document:{head:node(),body:{appendChild(el){if(el.id==='fhSpatialLayer')layer=el;}},
      createElement:node}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-live-text.js'),'utf8'),{window:win});
  win.FHLiveText.configure({view:()=>null});
  assert.equal(win.FHLiveText.soundAt({
    kind:'sleep',text:'Zzz',x:15,y:3,z:20,floor:0,self:true,
    screenX:180,screenY:240
  }),true);
  assert.equal(layer.children.length,1);
  const zzz=layer.children[0];
  assert.equal(zzz.className,'fh-sound fh-sleep-comic');
  assert.equal(zzz.hidden,false);
  assert.equal(zzz.style.left,'180px');
  assert.equal(zzz.style.top,'240px');
  assert.equal(zzz.textContent,'Zzz');
  // Las acciones comunes conservan su validación de cámara y visibilidad.
  assert.equal(win.FHLiveText.soundAt({id:'door_open',text:'CLAC',x:1,y:2,z:3,floor:0}),false);
  now=2900;
  win.FHLiveText.tick();
  assert.equal(zzz.removed,true);
});
test('el adaptador cómic encuentra sus puntos de conexión en el motor empaquetado', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  require('./fh-comic-action-engine-hook.js');
  let base64 = '';
  for (let i=0; i<=12; i++) {
    const file = path.join(__dirname, 'engine-' + String(i).padStart(2,'0') + '.js');
    const match = fs.readFileSync(file,'utf8').match(/\+"([A-Za-z0-9+/=]+)";/);
    assert.ok(match, 'fragmento de motor '+i);
    base64 += match[1];
  }
  let doc = Buffer.from(base64,'base64').toString('utf8');
  const originalDoor = " notice(d.open?'Abres la puerta.':'Cierras la puerta.',1800);";
  const originalSwitch = "  const result=lighting.toggleRoom(currentFloor,r?.roomId||r?.id||item.roomId);";
  assert.equal(doc.split(originalDoor).length,2);
  assert.equal(doc.split(originalSwitch).length,2);
  doc = doc.replace(originalDoor,
    " window.FHLiveText?.playSfxAt({id:d.open?'door_open':'door_close',x:d.cx,z:d.cz,y:floorElev[d.f]+1.1,floor:d.f});");
  doc = doc.replace(originalSwitch,
    "  const result=lighting.toggleRoom(currentFloor,r?.roomId||r?.id||item.roomId);if(result.ok)window.FHLiveText?.playSfxAt({id:'lamp_click',x:item.x*CELL,z:item.y*CELL,y:floorElev[currentFloor]+1.2,floor:currentFloor});");
  // Esta llamada la añade el adaptador de computadora antes del de texto cómic.
  doc += "\nonOpen:(item,floor)=>window.FHDeliveryRuntime?.onComputerOpen(item,floor),";
  const patched = globalThis.FHComicActionEngine.patch(doc);
  assert.ok(patched.includes("fhComicOnActor(out.enabled?'flashlight_on'"));
  assert.ok(patched.includes("fhComicOnItem(verb==='hide'"));
  assert.ok(patched.includes("fhComicWorld('elevator_call'"));
  const entry = fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
  assert.ok(entry.includes('fh-comic-action-engine-hook.js'));
  assert.ok(entry.includes('FHComicActionEngine.patch'));
});
