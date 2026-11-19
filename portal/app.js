import { createClient } from './vendor/supabase.js';
import { config } from './config.js';
import { S } from './strings.js';

const app=document.querySelector('#app'), nav=document.querySelector('#nav'), notice=document.querySelector('#notice');
document.title=S.title;
document.querySelector('#footer').textContent=S.footer;
const ready=Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) && config.publishableKey);
const client=ready ? createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'bw-portal-auth',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true},global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})}}) : null;
let session=null, epoch=0, busy=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleString('es-MX');
const rules={legacy:S.legacy,dnd:S.dnd,'moon-system':S.moon};
const link=(text,href,css='')=>`<a class="${css}" href="${esc(href)}">${esc(text)}</a>`;
const button=(text,id,disabled=false)=>`<button type="button" id="${id}" ${disabled?'disabled':''}>${esc(text)}</button>`;
function message(text='',error=false){notice.textContent=text;notice.className=error?'error':'';}
function errorText(error){return Object.entries(S.errors).find(([key])=>error?.message?.includes(key))?.[1]||S.error;}
function field(name,label,type='text',extra=''){return `<label for="${name}">${esc(label)}</label><input id="${name}" name="${name}" type="${type}" required ${extra}>`;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
function wireForm(id,action){
 document.getElementById(id)?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;message();
  const form=event.currentTarget, submit=form.querySelector('button[type=submit]');submit.disabled=true;form.setAttribute('aria-busy','true');
  try{await action(new FormData(form));}catch(error){message(errorText(error),true);}
  finally{busy=false;submit.disabled=!ready;form.removeAttribute('aria-busy');}
 });
}
function wireAction(id,action){document.getElementById(id)?.addEventListener('click',async event=>{
 if(busy)return;busy=true;event.currentTarget.disabled=true;message();
 try{await action();}catch(error){message(errorText(error),true);}
 finally{busy=false;if(event.target.isConnected)event.target.disabled=false;}
});}
function authForm(signup){
 app.innerHTML=`<section class="auth"><p class="kicker">${S.eyebrow}</p><h1>${signup?S.signup:S.login}</h1>${!ready?`<p class="setup">${S.setup}</p>`:''}<form id="auth"><fieldset ${!ready?'disabled':''}>${field('email',S.email,'email','autocomplete="email" maxlength="254"')}${field('password',S.password,'password',`autocomplete="${signup?'new-password':'current-password'}" ${signup?'minlength="12"':''} maxlength="128"`)}${signup?`<small>${S.passwordHint}</small>`:''}<button type="submit" class="primary">${signup?S.signup:S.login}</button></fieldset></form><p>${link(signup?S.login:S.signup,signup?'#acceso':'#registro')}</p></section>`;
 wireForm('auth',async data=>{
  const credentials={email:String(data.get('email')).trim(),password:String(data.get('password'))};
  const result=signup?await client.auth.signUp({...credentials,options:{emailRedirectTo:new URL('./',location.href).href.split('#')[0]}}):await client.auth.signInWithPassword(credentials);
  if(result.error){message(signup?S.signupError:S.authError,true);return;}
  if(result.data.session){session=result.data.session;location.hash='partidas';await render();}
  else {document.querySelector('#auth').reset();message(S.confirm);}
 });
}
function home(){
 app.innerHTML=`<p class="kicker">${S.phase} · ${S.scope}</p><h1>${S.hero}</h1><p class="intro">${S.intro}</p>${!ready?`<p class="setup">${S.setup}</p>`:''}<div class="actions">${link(session?S.games:S.signup,session?'#partidas':'#registro','button primary')}${link(S.editor,'../index.html?editor=1','button')}</div><p class="muted">${S.noMulti}</p><section class="rules" aria-label="${S.ruleset}">${[['legacy',S.legacyStatus],['dnd',S.dndStatus],['moon-system',S.moonStatus]].map(([id,text])=>`<article><h2>${rules[id]}</h2><p>${text}</p></article>`).join('')}</section>`;
}
function campaignCard(c,user){return `<article class="campaign"><h3>${link(c.name,`#${c.owner_id===user?'dm':'sala'}/${c.id}`)}</h3><p>${rules[c.ruleset]} · ${c.status==='active'?S.active:S.archived}</p><small>${S.createdAt}: ${date(c.created_at)}</small>${link(c.owner_id===user?S.dm:S.room,`#${c.owner_id===user?'dm':'sala'}/${c.id}`)}</article>`;}
async function games(ticket,user){
 const {data,error}=await client.from('bw_campaigns').select('*').order('created_at',{ascending:false});if(error)throw error;if(ticket!==epoch)return;
 const owned=data.filter(c=>c.owner_id===user),joined=data.filter(c=>c.owner_id!==user);
 app.innerHTML=`<h1>${S.games}</h1><p class="account">${esc(session.user.email)}</p><div class="grid"><section class="panel"><h2>${S.create}</h2><form id="create">${field('name',S.campaignName,'text','maxlength="80"')}<label for="ruleset">${S.ruleset}</label><select id="ruleset" name="ruleset"><option value="legacy">${S.legacy}</option><option value="dnd">${S.dnd} — ${S.dndStatus}</option><option value="moon-system" disabled>${S.moon} — ${S.moonStatus}</option></select><button type="submit" class="primary">${S.createAction}</button></form></section><section class="panel"><h2>${S.join}</h2><form id="join">${field('code',S.code,'text','pattern="[0-9a-fA-F]{48}" minlength="48" maxlength="48" autocomplete="off" spellcheck="false"')}<button type="submit">${S.joinAction}</button></form></section></div><div class="grid"><section><h2>${S.created}</h2>${owned.map(c=>campaignCard(c,user)).join('')||`<p>${S.emptyOwned}</p>`}</section><section><h2>${S.memberships}</h2>${joined.map(c=>campaignCard(c,user)).join('')||`<p>${S.emptyJoined}</p>`}</section></div>${button(S.refresh,'refresh')}`;
 wireForm('create',async form=>{const id=await rpc('bw_create_campaign',{p_name:form.get('name'),p_ruleset:form.get('ruleset')});location.hash=`dm/${id}`;});
 wireForm('join',async form=>{const id=await rpc('bw_join_campaign',{p_code:String(form.get('code')).trim()});location.hash=`sala/${id}`;});
 wireAction('refresh',()=>render());
}
async function campaign(ticket,id,user,requestedDM){
 if(!/^[0-9a-f-]{36}$/i.test(id)){app.textContent=S.noAccess;return;}
 const {data:c,error}=await client.from('bw_campaigns').select('*').eq('id',id).maybeSingle();if(error)throw error;if(ticket!==epoch)return;
 if(!c){app.textContent=S.noAccess;return;}
 const isDM=c.owner_id===user;
 if(requestedDM&&!isDM){app.textContent=S.noAccess;return;}
 let members=[],invites=[];
 if(isDM){
  const results=await Promise.all([client.from('bw_memberships').select('*').eq('campaign_id',id).order('joined_at'),rpc('bw_list_invitations',{p_campaign:id})]);
  if(results[0].error)throw results[0].error;members=results[0].data;invites=results[1];
 }
 if(ticket!==epoch)return;
 app.innerHTML=`${link(S.back,'#partidas')}<p class="kicker">${isDM?S.dm:S.room}</p><h1>${esc(c.name)}</h1><p>${rules[c.ruleset]} · ${c.status==='active'?S.active:S.archived}</p><p>${isDM?S.dmNotice:S.waiting}</p>${button(S.refresh,'refresh')}<small>${S.refreshNotice}</small>${isDM?`<div class="grid"><section class="panel"><h2>${S.members}</h2><ul class="list">${members.map((m,i)=>`<li><span class="account">${S.account}: ${esc(m.user_id)}</span><small>${S.joinedAt}: ${date(m.joined_at)}</small>${m.status==='active'?button(S.expel,`expel-${i}`):`<small>${S.expelled}: ${date(m.expelled_at)}</small>`}</li>`).join('')||`<li>${S.emptyMembers}</li>`}</ul></section><section class="panel"><h2>${S.invitations}</h2>${button(S.makeInvite,'invite',c.status!=='active')}<div id="new-invite" role="status"></div><ul class="list">${invites.map((v,i)=>`<li><span class="account">${esc(v.id)}</span><small>${S.expires}: ${date(v.expires_at)}</small>${v.revoked_at?`<small>${S.revoked}</small>`:new Date(v.expires_at)<=new Date()?`<small>${S.expired}</small>`:button(S.revoke,`revoke-${i}`)}</li>`).join('')||`<li>${S.emptyInvites}</li>`}</ul></section></div>`:''}<section class="pending"><h2>${S.inactive}</h2><p>${S.noMulti}</p><div class="actions">${button(S.launch,'launch',true)}${button(S.sync,'sync',true)}</div></section>`;
 wireAction('refresh',()=>render());
 wireAction('invite',async()=>{
  const invite=await rpc('bw_create_invitation',{p_campaign:id});
  await render();
  if(ticket+1!==epoch)return;
  const output=document.getElementById('new-invite');if(output)output.innerHTML=`<p>${S.inviteNotice}</p><code>${esc(invite.code)}</code><small>${S.expires}: ${date(invite.expires_at)}</small>`;
 });
 members.forEach((m,i)=>wireAction(`expel-${i}`,async()=>{if(confirm(S.confirmExpel)){await rpc('bw_expel_member',{p_campaign:id,p_user:m.user_id});await render();}}));
 invites.forEach((v,i)=>wireAction(`revoke-${i}`,async()=>{if(confirm(S.confirmRevoke)){await rpc('bw_revoke_invitation',{p_campaign:id,p_invitation:v.id});await render();}}));
}
async function render(){
 const ticket=++epoch;app.setAttribute('aria-busy','true');
 nav.innerHTML=`${link(S.home,'#inicio')}${session?link(S.games,'#partidas')+button(S.logout,'logout'):link(S.login,'#acceso')+link(S.signup,'#registro')}`;
 wireAction('logout',async()=>{const {error}=await client.auth.signOut();if(error)throw error;session=null;app.textContent='';location.hash='inicio';await render();message(S.signedOut);});
 const [route,id]=location.hash.slice(1).split('/');
 try{
  if(['partidas','dm','sala'].includes(route)){
   app.textContent=S.loading;
   if(!client||!session){authForm(false);if(ready)message(S.authRequired);return;}
   // La autorización final siempre se aplica por JWT + RLS/RPC en Supabase.
   const {data,error}=await client.auth.getUser();if(ticket!==epoch)return;
   if(error||!data.user){session=null;authForm(false);message(S.authError,true);return;}
   if(route==='partidas')await games(ticket,data.user.id);else await campaign(ticket,id,data.user.id,route==='dm');
  }else if(route==='registro'||route==='acceso'){if(session){location.hash='partidas';}else authForm(route==='registro');}
  else home();
 }catch(error){if(ticket===epoch){app.textContent=S.error;message(errorText(error),true);}}
 finally{if(ticket===epoch){app.setAttribute('aria-busy','false');app.focus({preventScroll:true});}}
}
window.addEventListener('hashchange',()=>{message();void render();});
if(client){
 client.auth.onAuthStateChange((event,next)=>{
  session=next;
  if(event==='INITIAL_SESSION'||event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='USER_UPDATED')setTimeout(()=>void render(),0);
 });
 app.textContent=S.loading;
}else void render();
