/* Forest Horror · integración UI de luminarias.
 * Ejecutar: node juego/assets/fh-light-editor-ui.test.js
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
let passed=0;
function test(label,run){run();passed++;console.log('PASS',label)}

test('Seleccionar una herramienta de luz no inserta un panel que reduzca el mapa',()=>{
 assert.doesNotMatch(html,/id="lightToolConfig"/);
 assert.doesNotMatch(html,/#lightToolConfig/);
 assert.doesNotMatch(html,/lightToolDrafts/);
 assert.doesNotMatch(html,/syncLightToolConfig/);
});
test('Elegir una herramienta conserva el mismo flujo que los demás objetos',()=>{
 assert.match(html,/function chooseTool\(tool\)\{activeTool=tool;anchor=null;preview=null;/);
 assert.doesNotMatch(html,/chooseTool\(tool\).*openInspector/);
});
test('Las luminarias nuevas nacen con su preset y se editan después',()=>{
 assert.ok(html.includes("Object.assign(it,window.FHLights.presetFields(kind));"));
 assert.doesNotMatch(html,/presetFields\(kind\),lightToolDraft/);
});
test('Colocar una luminaria no abre el inspector automáticamente',()=>{
 assert.doesNotMatch(html,/it\.type==='light_switch'\|\|it\.type==='light_fixture'\|\|it\.type==='breaker_panel'/);
 assert.match(html,/it\.type==='light_switch'\|\|it\.type==='breaker_panel'/);
});
test('El inspector individual conserva brillante, tenue, cono y altura',()=>{
 assert.ok(html.includes("FH_LIGHT_TEXT.brightRange,'lightRadiusFt'"));
 assert.ok(html.includes("FH_LIGHT_TEXT.dimRange,'lightDimFalloffFt'"));
 assert.ok(html.includes("FH_LIGHT_TEXT.angle,'beamAngleDeg'"));
 assert.ok(html.includes("put('Altura (pies)','heightFt'"));
});
test('Cambiar el tipo conserva radios, cono y altura personalizados',()=>{
 assert.ok(html.includes("const custom={lightRadiusFt:"));
 assert.ok(html.includes("lightDimFalloffFt:window.FHLights.dimFalloffFt(before)"));
 assert.ok(html.includes("beamAngleDeg:Number.isFinite(Number(before.beamAngleDeg))"));
 assert.ok(html.includes("heightFt:Number.isFinite(Number(before.heightFt))"));
});
console.log(passed+' pruebas correctas');
