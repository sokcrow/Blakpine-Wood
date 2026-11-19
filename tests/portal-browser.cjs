'use strict';
// Pruebas UI con transporte Supabase interceptado. NO certifican cuentas reales.
const {chromium}=require('playwright');
const {createServer}=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=createServer((req,res)=>{
 let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
const dm='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
const invId='00000000-0000-4000-8000-000000000004',code='a'.repeat(48),now=new Date().toISOString();
let campaign=null,membership=null,invite=null;
const user=uid=>({id:uid,aud:'authenticated',role:'authenticated',email:uid===dm?'dm@example.test':'member@example.test',email_confirmed_at:now,created_at:now,app_metadata:{provider:'email'},user_metadata:{}});
async function fixture(context){
 await context.route('**/portal/config.js',route=>route.fulfill({contentType:'text/javascript',body:"export const config={supabaseUrl:'https://fixture.supabase.co',publishableKey:'sb_publishable_test_fixture'};"}));
 await context.route('https://fixture.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON(),uid=req.headers().authorization?.includes('fixture-member')?member:dm;
  let data={},status=200;
  if(url.pathname.endsWith('/signup'))data={user:user(member),session:null};
  else if(url.pathname.endsWith('/token')){
   const target=body.email==='dm@example.test'?dm:member;
   data={access_token:target===dm?'fixture-dm':'fixture-member',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:user(target)};
  }else if(url.pathname.endsWith('/user'))data=user(uid);
  else if(url.pathname.endsWith('/logout'))data={};
  else if(url.pathname.endsWith('/bw_campaigns')){
   const allowed=campaign&&(uid===dm||membership?.status==='active');
   data=allowed?[campaign]:[];
   if(url.searchParams.has('id'))data=allowed?campaign:null;
  }else if(url.pathname.endsWith('/bw_memberships'))data=membership?[membership]:[];
  else if(url.pathname.endsWith('/bw_create_campaign')){campaign={id,owner_id:dm,name:body.p_name,ruleset:body.p_ruleset,status:'active',created_at:now};data=id;}
  else if(url.pathname.endsWith('/bw_create_invitation')){invite={id:invId,code,created_at:now,expires_at:new Date(Date.now()+86400000).toISOString(),revoked_at:null};data=invite;}
  else if(url.pathname.endsWith('/bw_list_invitations'))data=invite?[invite]:[];
  else if(url.pathname.endsWith('/bw_join_campaign')){
   if(membership?.status==='expelled'){status=400;data={message:'BW_MEMBERSHIP_EXPELLED'};}
   else if(invite?.revoked_at){status=400;data={message:'BW_INVITATION_INVALID'};}
   else{membership={campaign_id:id,user_id:member,status:'active',joined_at:now};data=id;}
  }else if(url.pathname.endsWith('/bw_expel_member')){assert.equal(body.p_user,member);assert.equal(body.p_campaign,id);membership.status='expelled';membership.expelled_at=now;data=null;}
  else if(url.pathname.endsWith('/bw_revoke_invitation')){assert.equal(body.p_invitation,invId);invite.revoked_at=now;data=null;}
  else throw Error('Unhandled fixture '+url.pathname);
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
}
async function login(page,email){await page.goto(base+'/portal/#acceso');await page.locator('#email').fill(email);await page.locator('#password').fill('fixture-password-only');await page.locator('button[type=submit]').click();await page.waitForURL('**/#partidas');await page.locator('#create').waitFor();}
let base;
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.waitForURL('**/portal/');await page.getByRole('heading',{level:1}).waitFor();
  assert.match(await page.locator('main').innerText(),/no está configurado/);
  await page.getByRole('link',{name:'Crear cuenta',exact:true}).first().click();await page.locator('#email').waitFor();assert.equal(await page.locator('#email').isDisabled(),true);
  for(const width of [390,1440]){await page.setViewportSize({width,height:844});await page.goto(base+'/portal/');await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  // El enlace al editor conserva origen y todas las claves locales existentes.
  await page.evaluate(()=>localStorage.setItem('bw-legacy-sentinel','conservar'));
  await page.getByRole('link',{name:'Abrir editor original'}).click();await page.locator('#map').waitFor();
  assert.match(page.url(),/editor=1/);assert.equal(await page.evaluate(()=>localStorage.getItem('bw-legacy-sentinel')),'conservar');
  assert.equal(await page.locator('#play3DBtn').count()+await page.getByText('Probar 3D',{exact:false}).count()>0,true);
  console.log('PASS: entrada, servicio inactivo, móvil/escritorio, editor original y almacenamiento.');
  errors.length=0;
  const a=await browser.newContext(),b=await browser.newContext();await fixture(a);await fixture(b);
  const dmPage=await a.newPage(),player=await b.newPage();
  for(const p of [dmPage,player])p.on('pageerror',e=>errors.push(e.message));
  await player.goto(base+'/portal/#registro');await player.locator('#email').fill('member@example.test');await player.locator('#password').fill('fixture-password-only');await player.locator('button[type=submit]').click();await player.getByText(/revisa tu correo/).waitFor();
  await login(dmPage,'dm@example.test');await dmPage.locator('#name').fill('<El bosque>');await dmPage.locator('#create button').click();await dmPage.locator('#invite').waitFor();
  assert.equal(await dmPage.locator('h1').innerText(),'<El bosque>');
  await dmPage.locator('#invite').click();await dmPage.locator('#new-invite code').waitFor();assert.equal(await dmPage.locator('#new-invite code').innerText(),code);
  await login(player,'member@example.test');await player.locator('#code').fill(code);await player.locator('#join button').click();await player.getByRole('heading',{name:'Funciones pendientes'}).waitFor();assert.equal(await player.locator('#launch').isDisabled(),true);
  // Relogin en ambas cuentas conserva la lista (persistencia del contrato UI).
  for(const [p,email] of [[dmPage,'dm@example.test'],[player,'member@example.test']]){
   await p.locator('#logout').click();await p.waitForURL('**/#inicio');await login(p,email);await p.getByRole('link',{name:'<El bosque>'}).waitFor();
  }
  await player.goto(base+'/portal/#dm/'+id);await player.getByText('Esta campaña no está disponible para tu cuenta.',{exact:true}).waitFor();
  await dmPage.getByRole('link',{name:'Panel DM',exact:true}).click();await dmPage.locator('#expel-0').waitFor();dmPage.on('dialog',d=>d.accept());await dmPage.locator('#expel-0').click();await dmPage.getByText(/Expulsado:/).waitFor();
  await player.goto(base+'/portal/#sala/'+id);await player.getByText('Esta campaña no está disponible para tu cuenta.',{exact:true}).waitFor();
  await player.goto(base+'/portal/#partidas');await player.locator('#code').fill(code);await player.locator('#join button').click();await player.getByText(/fue expulsada/).waitFor();
  await dmPage.locator('#revoke-0').click();await dmPage.getByText('Revocada',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: contrato UI con SDK oficial y fixtures: registro, login, creación, invitación, reingreso, expulsión, revocación. No es aceptación con Supabase real.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
