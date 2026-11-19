'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const migration=fs.readFileSync('supabase/migrations/202611190001_portal.sql','utf8');
const DM='00000000-0000-4000-8000-000000000001', MEMBER='00000000-0000-4000-8000-000000000002', OTHER='00000000-0000-4000-8000-000000000003';

test('PostgreSQL: persistencia, RLS, invitaciones y expulsión por cuenta',async t=>{
 const db=new PGlite({extensions:{pgcrypto}});
 t.after(()=>db.close());
 // Fixtures de identidad SOLO para probar SQL: no certifican Supabase Auth real.
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 insert into auth.users values('${DM}'),('${MEMBER}'),('${OTHER}');`);
 await db.exec(migration);
 async function as(user,sql,args=[]){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
  await db.exec(`set role ${user?'authenticated':'anon'}`);
  return db.query(sql,args);
 }
 const value=async(user,sql,args)=>(await as(user,sql,args)).rows[0]?.value;
 const rpc=(user,name,args=[],casts=[])=>value(user,`select public.${name}(${args.map((_,i)=>`$${i+1}${casts[i]?'::'+casts[i]:''}`).join(',')}) as value`,args);
 const denied=async(fn,pattern)=>assert.rejects(fn,pattern);
 let campaign,invite,second;
 await t.test('anónimo no crea ni lee campañas',async()=>{
  await denied(()=>rpc(null,'bw_create_campaign',['Intrusión','legacy']),/permission denied/);
  await denied(()=>as(null,'select * from public.bw_campaigns'),/permission denied/);
 });
 await t.test('DM crea una campaña; validación de nombre y Moon en servidor',async()=>{
  campaign=await rpc(DM,'bw_create_campaign',['El bosque','legacy']);assert.match(campaign,/^[0-9a-f-]{36}$/);
  await denied(()=>rpc(DM,'bw_create_campaign',['  ','legacy']),/BW_INVALID_NAME/);
  await denied(()=>rpc(DM,'bw_create_campaign',['Moon','moon-system']),/BW_RULESET_UNAVAILABLE/);
  await denied(()=>rpc(DM,'bw_create_campaign',['Vacía',null]),/BW_RULESET_UNAVAILABLE/);
  assert.equal((await as(OTHER,'select * from public.bw_campaigns')).rows.length,0);
 });
 await t.test('solo DM invita; código seguro independiente e inaccesible por tablas',async()=>{
  await denied(()=>rpc(OTHER,'bw_create_invitation',[campaign]),/BW_DM_REQUIRED/);
  invite=await rpc(DM,'bw_create_invitation',[campaign]);assert.match(invite.code,/^[0-9a-f]{48}$/);assert.notEqual(invite.code,campaign);
  await denied(()=>as(DM,'select * from public.bw_invitations'),/permission denied/);
  await denied(()=>rpc(OTHER,'bw_list_invitations',[campaign]),/BW_DM_REQUIRED/);
  await denied(()=>rpc(MEMBER,'bw_join_campaign',[campaign]),/BW_INVITATION_INVALID/);
 });
 await t.test('segunda cuenta se une, ingreso idempotente y membresía persistente',async()=>{
  assert.equal(await rpc(MEMBER,'bw_join_campaign',[invite.code.toUpperCase()]),campaign);
  assert.equal(await rpc(MEMBER,'bw_join_campaign',[invite.code]),campaign);
  assert.equal((await as(MEMBER,'select * from public.bw_campaigns')).rows.length,1);
  assert.equal((await as(DM,'select * from public.bw_memberships')).rows.length,1);
  await as(null,'select 1'); // Reingreso a otra conexión lógica/identidad.
  assert.equal((await as(MEMBER,'select * from public.bw_memberships')).rows[0].status,'active');
  assert.equal((await as(DM,'select * from public.bw_campaigns')).rows[0].owner_id,DM);
 });
 await t.test('membresía no otorga permisos DM; escrituras directas denegadas',async()=>{
  await denied(()=>rpc(MEMBER,'bw_expel_member',[campaign,OTHER]),/BW_DM_REQUIRED/);
  await denied(()=>rpc(MEMBER,'bw_revoke_invitation',[campaign,invite.id]),/BW_DM_REQUIRED/);
  await denied(()=>as(MEMBER,'update public.bw_campaigns set owner_id=$1 where id=$2',[MEMBER,campaign]),/permission denied/);
  await denied(()=>as(MEMBER,'insert into public.bw_memberships(campaign_id,user_id) values($1,$2)',[campaign,OTHER]),/permission denied/);
  await denied(()=>as(MEMBER,'delete from public.bw_memberships'),/permission denied/);
 });
 await t.test('revocar impide nuevos ingresos y conserva miembros existentes',async()=>{
  await rpc(DM,'bw_revoke_invitation',[campaign,invite.id]);
  await denied(()=>rpc(OTHER,'bw_join_campaign',[invite.code]),/BW_INVITATION_INVALID/);
  assert.equal((await as(MEMBER,'select * from public.bw_campaigns')).rows.length,1);
  second=await rpc(DM,'bw_create_invitation',[campaign]);assert.notEqual(second.code,invite.code);
  assert.equal(await rpc(MEMBER,'bw_join_campaign',[second.code]),campaign);
 });
 await t.test('expulsión retira acceso RLS y bloquea el mismo código y códigos nuevos',async()=>{
  await rpc(DM,'bw_expel_member',[campaign,MEMBER]);
  assert.equal((await as(MEMBER,'select * from public.bw_campaigns')).rows.length,0);
  assert.equal((await as(MEMBER,'select * from public.bw_memberships')).rows.length,0);
  await denied(()=>rpc(MEMBER,'bw_join_campaign',[second.code]),/BW_MEMBERSHIP_EXPELLED/);
  const third=await rpc(DM,'bw_create_invitation',[campaign]);
  await denied(()=>rpc(MEMBER,'bw_join_campaign',[third.code]),/BW_MEMBERSHIP_EXPELLED/);
  await denied(()=>rpc(MEMBER,'bw_join_campaign',[invite.code]),/BW_INVITATION_INVALID/);
  assert.equal((await as(DM,'select * from public.bw_memberships')).rows[0].status,'expelled');
  await denied(()=>rpc(DM,'bw_expel_member',[campaign,DM]),/BW_CANNOT_EXPEL_DM/);
 });
 await t.test('invitación caducada y campaña archivada no admiten cuentas',async()=>{
  await db.exec('reset role');await db.query('update public.bw_invitations set expires_at=now()-interval \'1 day\' where id=$1',[second.id]);
  await denied(()=>rpc(OTHER,'bw_join_campaign',[second.code]),/BW_INVITATION_INVALID/);
  const fresh=await rpc(DM,'bw_create_invitation',[campaign]);
  await db.exec('reset role');await db.query("update public.bw_campaigns set status='archived' where id=$1",[campaign]);
  await denied(()=>rpc(OTHER,'bw_join_campaign',[fresh.code]),/BW_INVITATION_INVALID/);
  await denied(()=>rpc(DM,'bw_create_invitation',[campaign]),/BW_DM_REQUIRED/);
 });
 await t.test('otra campaña no hereda membresías ni invitaciones',async()=>{
  const own=await rpc(OTHER,'bw_create_campaign',['Otra','dnd']);
  assert.deepEqual((await as(OTHER,'select id from public.bw_campaigns')).rows.map(r=>r.id),[own]);
  await denied(()=>rpc(OTHER,'bw_revoke_invitation',[own,second.id]),/BW_INVITATION_INVALID/);
 });
});
