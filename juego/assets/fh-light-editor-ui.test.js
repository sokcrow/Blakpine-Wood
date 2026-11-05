/* Forest Horror · integración UI de luminarias.
 * Ejecutar: node juego/assets/fh-light-editor-ui.test.js
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
let passed=0;
function test(label,run){run();passed++;console.log('PASS',label)}

test('La paleta expone brillante, tenue, cono y altura antes de colocar',()=>{
 assert.match(html,/id="lightToolBright"/);
 assert.match(html,/id="lightToolDim"/);
 assert.match(html,/id="lightToolAngle"/);
 assert.match(html,/id="lightToolHeight"/);
 assert.match(html,/id="lightToolTotal"/);
});
test('Elegir una luminaria sincroniza el panel',()=>{
 assert.match(html,/syncLightToolConfig\(tool\);\$\$\('#tools button'\)\.forEach/);
});
test('Las luminarias nuevas usan la configuración editada de la paleta',()=>{
 assert.ok(html.includes("Object.assign(it,window.FHLights.presetFields(kind),lightToolDraft(kind)||{});"));
});
test('Una luminaria recién colocada abre su inspector',()=>{
 assert.match(html,/it\.type==='light_switch'\|\|it\.type==='light_fixture'\|\|it\.type==='breaker_panel'/);
});
test('Cambiar el tipo conserva radios, cono y altura personalizados',()=>{
 assert.ok(html.includes("const custom={lightRadiusFt:"));
 assert.ok(html.includes("lightDimFalloffFt:window.FHLights.dimFalloffFt(before)"));
 assert.ok(html.includes("beamAngleDeg:Number.isFinite(Number(before.beamAngleDeg))"));
 assert.ok(html.includes("heightFt:Number.isFinite(Number(before.heightFt))"));
});
test('Los módulos de luz llevan versión para evitar caché obsoleta',()=>{
 assert.ok(html.includes("fh-light-strings.js?v=20261105-light-ui2"));
 assert.ok(html.includes("fh-light-coverage.js?v=20261105-light-ui2"));
 assert.ok(html.includes("fh-lights.js?v=20261105-light-ui2"));
 assert.ok(html.includes("fh-light-editor-overlay.js?v=20261105-light-ui2"));
});
console.log(passed+' pruebas correctas');
