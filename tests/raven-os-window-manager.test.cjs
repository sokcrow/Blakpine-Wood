// Regresiones de interfaz RAVEN/OS. Ejecutar: node --test tests/raven-os-window-manager.test.cjs
// Sin dependencias ni cambios en forest-horror-map-v1.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const terminal=fs.readFileSync(path.join(root,'juego/assets/fh-terminal.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'juego/assets/fh-computer.js'),'utf8');
const strings=fs.readFileSync(path.join(root,'juego/assets/fh-computer-strings.js'),'utf8');
const editor=fs.readFileSync(path.join(root,'index.html'),'utf8');
function check(source,regex,description){
 assert.match(source,regex,description);
}
test('Los scripts de la computadora son sintácticamente válidos',()=>{
 const blocks=[...terminal.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
 assert.ok(blocks.length>0);
 for(const script of blocks)new vm.Script(script);
 new vm.Script(runtime);
});
test('El área de monitor conserva la proporción 16:10',()=>{
 check(terminal,/#focus \.focus-frame\s*\{[^}]*aspect-ratio:16\s*\/\s*10/s,'Falta 16:10');
 check(terminal,/function fitFocusFrame\(\)/,'Falta ajuste de monitor');
 check(terminal,/availableHeight\*1\.6/,'El cálculo debe conservar la proporción');
});
test('Las ventanas no se aplastan con scale(.5)',()=>{
 check(terminal,/#windowsLayer \.window\s*\{[^}]*transform:none!important/s,'Deben anularse los escalados anteriores');
 check(terminal,/#windowsLayer \.window:not\(\.maximized\)\s*\{[^}]*--fh-w/s,'Dimensiones independientes');
 check(terminal,/#windowsLayer \.window\.maximized\s*\{/,'Maximización real');
});
test('Cada aplicación tiene ventana independiente y estado de escritorio',()=>{
 check(terminal,/const winEls=new Map\(\)/,'Una instancia por app');
 check(terminal,/winEls\.set\(app,win\)/,'Apertura de múltiples apps');
 check(terminal,/function activateLastVisibleWindow\(/,'Relevo al minimizar');
 check(terminal,/win\.classList\.toggle\('maximized'\)/,'Maximizar o restaurar');
});
test('Arrastre y redimensionado táctiles sin bloqueo por ancho o alto',()=>{
 const begin=terminal.indexOf('function beginWindowPointer(');
 const end=terminal.indexOf('function createWindow(app)',begin);
 assert.ok(begin>=0&&end>begin);
 const handler=terminal.slice(begin,end);
 check(handler,/setPointerCapture/,'Captura del puntero');
 check(handler,/pointermove/,'Movimiento del puntero');
 check(handler,/pointercancel/,'Cancelación del puntero');
 assert.doesNotMatch(handler,/innerWidth|innerHeight/,'No bloquear interacción por tamaño');
 check(terminal,/resize\.addEventListener\('keydown'/,'Redimensión accesible con teclado');
});
test('La computadora oculta el HUD durante uso y lo restaura al salir',()=>{
 check(runtime,/classList\.add\('fh-pc-in-use'\)/,'Ocultar HUD al abrir');
 check(runtime,/classList\.remove\('fh-pc-in-use'\)/,'Restaurar HUD al cerrar');
 check(runtime,/#fhMenuToggle/,'Ocultar botón del menú');
 check(runtime,/z-index:160/,'Computadora por encima de overlays de jugador');
});
test('Versiones y textos españoles para los controles nuevos',()=>{
 for(const key of ['wmMaximize','wmRestore','wmResize'])check(strings,new RegExp(key+':'),'Cadena '+key);
 check(runtime,/fh-terminal\.html\?v=20261107-raven-16x10/,'Terminal versionada');
 check(editor,/fh-computer\.js\?v=20261107-raven-16x10/,'Runtime versionado');
});
