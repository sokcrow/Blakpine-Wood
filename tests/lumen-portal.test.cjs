'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');

test('Los códigos son 192 bits hexadecimales e impredecibles con Web Crypto',async()=>{
 const model=await import('../portal/campaign-model.js');
 const samples=new Set();
 for(let i=0;i<128;i++){
  const code=model.makeInvitationCode();
  assert.match(code,/^[A-F0-9]{48}$/);
  samples.add(code);
 }
 assert.equal(samples.size,128);
});
test('El generador rechaza RNG ausente o inseguro',async()=>{
 const model=await import('../portal/campaign-model.js');
 assert.throws(()=>model.makeInvitationCode({}),/INVITE_CRYPTO_REQUIRED/);
});
test('Normalización de códigos no altera longitud ni permite espacios',async()=>{
 const model=await import('../portal/campaign-model.js');
 const example='abcdef'.repeat(8);
 assert.equal(model.cleanInvitationCode(' '+example+' '),example.toUpperCase());
 for(const v of ['', 'ABC', 'g'.repeat(48), '0'.repeat(47), '0'.repeat(49)]){
  assert.throws(()=>model.cleanInvitationCode(v),/INVITATION_INVALID/);
 }
});
test('Creación permite Legacy y prototipo DnD, nunca Moon',async()=>{
 const model=await import('../portal/campaign-model.js');
 assert.equal(model.availableRuleset('legacy'),'legacy');
 assert.equal(model.availableRuleset('dnd'),'dnd');
 assert.throws(()=>model.availableRuleset('moon-system'),/RULESET_NOT_AVAILABLE/);
});
test('Los nombres de campaña se validan antes de enviarse',async()=>{
 const model=await import('../portal/campaign-model.js');
 assert.equal(model.campaignName('  Una campaña  '),'Una campaña');
 assert.throws(()=>model.campaignName('   '),/CAMPAIGN_NAME_INVALID/);
 assert.throws(()=>model.campaignName('a'.repeat(81)),/CAMPAIGN_NAME_INVALID/);
});
test('FireStore se configura para rechazar todo por defecto',()=>{
 const rules=fs.readFileSync(path.join(base,'firestore.rules'),'utf8');
 assert.match(rules,/rules_version\s*=\s*'2'/);
 assert.match(rules,/match \/\{document=\*\*\} \{ allow read, write: if false; \}/);
 assert.match(rules,/allow delete: if false;/);
 assert.match(rules,/getAfter\(campaignPath\(cid\)\)/);
 assert.match(rules,/resource\.data\.status == 'active'/);
 assert.match(rules,/request\.resource\.data\.status == 'removed'/);
 assert.match(rules,/invitationValid\(request\.resource\.data\.inviteCode, cid\)/);
});
test('No hay claves administrativas ni credenciales privadas en configuración pública',()=>{
 const config=fs.readFileSync(path.join(base,'portal/config.js'),'utf8');
 assert.match(config,/projectId: 'rol-serv'/);
 assert.doesNotMatch(config,/serviceAccount|private_key|BEGIN PRIVATE KEY/);
 const app=fs.readFileSync(path.join(base,'portal/app.js'),'utf8');
 assert.doesNotMatch(app,/supabase|service_role|admin\.auth\./i);
 assert.match(app,/createUserWithEmailAndPassword/);
 assert.match(app,/sendPasswordResetEmail/);
 assert.match(app,/collectionGroup/);
 assert.match(app,/runTransaction/);
});
test('Editor intacto en la raíz con vía explícita de entrada',()=>{
 const entry=fs.readFileSync(path.join(base,'portal/entry.js'),'utf8');
 assert.match(entry,/editor/);
 const editor=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.match(editor,/\.\/portal\/entry\.js/);
 const legacyEntry=fs.readFileSync(path.join(base,'juego/index.html'),'utf8');
 assert.match(legacyEntry,/searchParams\.set\('editor', '1'\)/);
});

test('LUMEN: portada editorial, acciones de campaña y navegación accesible',()=>{
 const html=fs.readFileSync(path.join(base,'portal/index.html'),'utf8');
 const app=fs.readFileSync(path.join(base,'portal/app.js'),'utf8');
 const css=fs.readFileSync(path.join(base,'portal/portal.css'),'utf8');
 assert.match(html,/class="brand-symbol"/);
 assert.match(html,/aria-label="Navegación principal"/);
 assert.match(app,/class="hero"/);
 assert.match(app,/class="workflow"/);
 assert.match(app,/class="workspace-head"/);
 assert.match(app,/class="empty-state"/);
 assert.match(app,/form id="create"/);
 assert.match(app,/form id="join"/);
 assert.match(css,/:focus-visible\s*\{/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css, /prefers-reduced-motion/);
});
test('Textos del portal disponibles desde el módulo de cadenas',async()=>{
 const {S}=await import('../portal/strings.js');
 for(const key of ['workspaceKicker','workspaceIntro','workflowTitle','workflowOne',
   'workflowTwo','workflowThree','workflowFoot','workflowRight','modesTitle',
   'modesSubtitle','modeReady','modePrototype','modePending','reset']){
   assert.equal(typeof S[key],'string',key);
   assert.ok(S[key].trim(),key);
 }
});
