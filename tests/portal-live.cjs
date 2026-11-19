'use strict';
// Aceptación REAL por API. Requiere dos cuentas de prueba autorizadas y confirmadas.
// No usa service_role, no crea identidades ficticias ni borra el historial de expulsión.
const {createClient}=require('@supabase/supabase-js');
const assert=require('node:assert/strict');
const required=['BW_SUPABASE_URL','BW_SUPABASE_PUBLISHABLE_KEY','BW_DM_EMAIL','BW_DM_PASSWORD','BW_MEMBER_EMAIL','BW_MEMBER_PASSWORD'];
if(required.some(key=>!process.env[key])){console.error('NEEDS WORK: faltan configuración y cuentas reales autorizadas.');process.exit(2);}
const env=process.env;
if(env.BW_DM_EMAIL===env.BW_MEMBER_EMAIL)throw Error('Se requieren cuentas diferentes.');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,opts={})=>fetch(url,{...opts,signal:AbortSignal.timeout(15000)})}};
const dm=createClient(env.BW_SUPABASE_URL,env.BW_SUPABASE_PUBLISHABLE_KEY,options);
const member=createClient(env.BW_SUPABASE_URL,env.BW_SUPABASE_PUBLISHABLE_KEY,options);
const unwrap=async promise=>{const {data,error}=await promise;if(error)throw Error('Falló una operación real: '+(error.code||error.status||'servicio'));return data;};
async function login(client,prefix){return (await unwrap(client.auth.signInWithPassword({email:env[`BW_${prefix}_EMAIL`],password:env[`BW_${prefix}_PASSWORD`]}))).user;}
(async()=>{
 try{
  if(env.BW_REGISTER_TEST_ACCOUNTS==='1'){
   // Solo ejecutar con dos correos nuevos, controlados por el equipo de pruebas.
   for(const [client,prefix] of [[dm,'DM'],[member,'MEMBER']]){
    const data=await unwrap(client.auth.signUp({email:env[`BW_${prefix}_EMAIL`],password:env[`BW_${prefix}_PASSWORD`]}));
    assert.ok(data.user?.identities?.length,'El correo debe corresponder a una cuenta nueva.');
   }
   console.log('Registro real aceptado. Confirma ambos correos antes de ejecutar la fase de acceso.');return;
  }
  const owner=await login(dm,'DM'),player=await login(member,'MEMBER');assert.notEqual(owner.id,player.id);
  const id=await unwrap(dm.rpc('bw_create_campaign',{p_name:'Aceptación portal '+new Date().toISOString(),p_ruleset:'legacy'}));
  const invite=await unwrap(dm.rpc('bw_create_invitation',{p_campaign:id}));
  assert.equal(await unwrap(member.rpc('bw_join_campaign',{p_code:invite.code})),id);
  await unwrap(dm.auth.signOut());await unwrap(member.auth.signOut());await login(dm,'DM');await login(member,'MEMBER');
  for(const client of [dm,member])assert.equal((await unwrap(client.from('bw_campaigns').select('id').eq('id',id))).length,1);
  const denied=await member.rpc('bw_expel_member',{p_campaign:id,p_user:owner.id});assert.match(denied.error?.message||'',/BW_DM_REQUIRED/);
  await unwrap(dm.rpc('bw_revoke_invitation',{p_campaign:id,p_invitation:invite.id}));
  assert.equal((await unwrap(member.from('bw_campaigns').select('id').eq('id',id))).length,1);
  const revoked=await member.rpc('bw_join_campaign',{p_code:invite.code});assert.match(revoked.error?.message||'',/BW_INVITATION_INVALID/);
  const fresh=await unwrap(dm.rpc('bw_create_invitation',{p_campaign:id}));
  await unwrap(dm.rpc('bw_expel_member',{p_campaign:id,p_user:player.id}));
  assert.equal((await unwrap(member.from('bw_campaigns').select('id').eq('id',id))).length,0);
  for(const code of [invite.code,fresh.code])assert.ok((await member.rpc('bw_join_campaign',{p_code:code})).error);
  await unwrap(dm.rpc('bw_revoke_invitation',{p_campaign:id,p_invitation:fresh.id}));
  console.log('PASS: dos cuentas reales, persistencia tras login, permisos DM, revocación y expulsión.');
 }finally{await dm.auth.signOut();await member.auth.signOut();}
})().catch(()=>{console.error('NEEDS WORK: falló la aceptación real. Revisar el servicio autorizado sin publicar credenciales.');process.exitCode=1;});
