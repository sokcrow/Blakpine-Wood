import { firebaseConfig, configured } from './config.js';
import { S } from './strings.js';
import { makeInvitationCode, cleanInvitationCode, campaignName, availableRuleset } from './campaign-model.js';

const app = document.querySelector('#app');
const nav = document.querySelector('#nav');
const notice = document.querySelector('#notice');
document.title = S.title;
document.querySelector('#footer').textContent = S.footer;
const names = { legacy: S.legacy, dnd: S.dnd, 'moon-system': S.moon };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (text, url, cls='') => '<a class="'+esc(cls)+'" href="'+esc(url)+'">'+esc(text)+'</a>';
const button = (text, id, disabled=false) => '<button type="button" id="'+id+'" '+(disabled?'disabled':'')+'>'+esc(text)+'</button>';
const date = v => { try { return (v?.toDate?.() ?? new Date(v)).toLocaleString('es-MX'); } catch { return ''; } };
const input = (id, label, type='text', extra='') => '<label for="'+id+'">'+esc(label)+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" required '+extra+'>';
let fb=null, auth=null, db=null, user=null, initError=null, epoch=0, busy=false;

function message(text='', bad=false) {
  notice.textContent=text; notice.className=bad?'error':'';
}
function readableError(error) {
  const c=error?.code || error?.message || '';
  if (/permission-denied|unauthenticated/.test(c)) return 'Acceso denegado. Revisa tus permisos de campaña o la configuración de Firestore.';
  if (/email-already-in-use/.test(c)) return 'Ya existe una cuenta con ese correo.';
  if (/invalid-email/.test(c)) return 'El correo electrónico no es válido.';
  if (/weak-password/.test(c)) return 'La contraseña no cumple los requisitos de Firebase.';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return S.authError;
  if (/CAMPAIGN_NAME_INVALID/.test(c)) return 'El nombre debe tener entre 1 y 80 caracteres.';
  if (/RULESET_NOT_AVAILABLE/.test(c)) return 'Ese reglamento no está habilitado.';
  if (/INVITATION_INVALID|INVITE_/.test(c)) return 'Invitación inválida, revocada o caducada.';
  if (/MEMBERSHIP_REMOVED/.test(c)) return 'Fuiste expulsado y no puedes reincorporarte con invitaciones.';
  if (/failed-precondition/.test(c)) return 'Falta un índice de Firestore o una configuración de la base de datos.';
  return S.error;
}
function wireForm(id, handler) {
  document.getElementById(id)?.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !auth) return;
    busy=true; message();
    const form=event.currentTarget, submit=form.querySelector('button[type=submit]');
    submit.disabled=true;form.setAttribute('aria-busy','true');
    try { await handler(new FormData(form)); }
    catch(error) { message(readableError(error),true); }
    finally { busy=false; if(submit.isConnected)submit.disabled=false;form.removeAttribute('aria-busy'); }
  });
}
function wireAction(id, handler) {
  document.getElementById(id)?.addEventListener('click', async event => {
    if (busy) return;
    busy=true;message();const b=event.currentTarget;b.disabled=true;
    try { await handler(); }
    catch(error) { message(readableError(error),true); }
    finally { busy=false;if(b.isConnected)b.disabled=false; }
  });
}
function home() {
  const modeRows=[
    ['legacy','01',S.legacyStatus,S.modeReady],
    ['dnd','02',S.dndStatus,S.modePrototype],
    ['moon-system','03',S.moonStatus,S.modePending]
  ];
  const entry=user?'#partidas':'#acceso';
  const illustration=`
    <svg class="hero-illustration" viewBox="0 0 440 340" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lumen-glow"><stop stop-color="#f9c875" stop-opacity=".58"/><stop offset="1" stop-color="#f9c875" stop-opacity="0"/></radialGradient>
        <linearGradient id="lumen-gilt" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#f5d898"/><stop offset="1" stop-color="#926332"/></linearGradient>
      </defs>
      <ellipse cx="222" cy="150" rx="147" ry="147" fill="url(#lumen-glow)"/>
      <circle cx="222" cy="125" r="102" fill="none" stroke="#b68c51" stroke-width="1" opacity=".42"/>
      <path d="M65 242 Q142 208 222 250 Q307 206 375 242 L381 296 Q303 275 222 314 Q139 277 60 296Z" fill="#1f1510" stroke="#d7ad6a" stroke-width="3"/>
      <path d="M79 243 Q145 230 218 264 L219 301 Q154 265 72 284Z" fill="#594027" stroke="#e5bb77" stroke-width="1.5"/>
      <path d="M365 243 Q298 228 226 264 L225 301 Q298 265 373 284Z" fill="#473321" stroke="#e5bb77" stroke-width="1.5"/>
      <path d="M222 246 V140" stroke="#f4d18b" stroke-width="16" stroke-linecap="round"/>
      <path d="M222 249 V138" stroke="#7a4829" stroke-width="2"/>
      <path d="M222 65 C192 105 223 123 222 137 C255 103 238 83 222 65Z" fill="url(#lumen-gilt)" stroke="#f9d891" stroke-width="2"/>
      <path d="M222 85 Q215 104 224 120" fill="none" stroke="#fff2c4" stroke-width="2"/>
      <path d="M104 255 Q152 245 206 277 M340 255 Q297 243 239 277" fill="none" stroke="#cba566" stroke-width="1" opacity=".65"/>
    </svg>`;
  app.innerHTML=
    '<section class="hero" aria-labelledby="portal-title">'+
      '<div class="hero-copy">'+
        '<p class="kicker">'+S.phase+' / '+S.scope+'</p>'+
        '<div class="hero-title-line">'+
          '<img class="hero-mark" src="./assets/lumen-logo.webp" width="160" height="160" alt="">'+
          '<h1 id="portal-title">LUMEN</h1>'+
        '</div>'+
        '<p class="hero-subtitle">'+S.hero+'</p>'+
        '<p class="intro">'+S.intro+'</p>'+
        (!configured?'<p class="setup">'+S.setup+'</p>':'')+
        (initError?'<p class="setup">'+S.error+'</p>':'')+
        '<div class="actions">'+
          link(user?S.games:S.signup,user?'#partidas':'#registro','button primary')+
          link(user?S.games:S.login,user?'#partidas':'#acceso','button')+
        '</div>'+
        '<p class="hero-note">'+S.noMulti+'</p>'+
      '</div>'+
      illustration+
      '<aside class="workflow" aria-label="'+S.workflowTitle+'">'+
        '<div class="workflow-head"><strong>'+S.workflowTitle+'</strong><span>01—03</span></div>'+
        '<ol class="workflow-list">'+
          '<li><span><b>01</b></span>'+S.workflowOne+'</li>'+
          '<li><span><b>02</b></span>'+S.workflowTwo+'</li>'+
          '<li><span><b>03</b></span>'+S.workflowThree+'</li>'+
        '</ol>'+
        '<div class="workflow-foot"><span>'+S.workflowFoot+'</span><span>'+S.workflowRight+'</span></div>'+
      '</aside>'+
    '</section>'+
    '<section class="mode-section" aria-label="'+S.ruleset+'">'+
      '<div class="section-head"><h2>'+S.modesTitle+'</h2><p>'+S.modesSubtitle+'</p></div>'+
      '<div class="rules">'+modeRows.map(([id,number,desc,status])=>
        '<article data-mode="'+esc(id)+'">'+
          '<span class="mode-id">/ '+number+'</span>'+
          '<h3>'+esc(names[id])+'</h3>'+
          '<p>'+esc(desc)+'</p>'+
          '<span class="mode-status">'+esc(status)+'</span>'+
        '</article>'
      ).join('')+'</div>'+
    '</section>'+
    '<section class="home-campaigns" aria-labelledby="home-campaigns-title">'+
      '<div class="section-head"><h2 id="home-campaigns-title">'+S.games+'</h2><p>'+S.workspaceIntro+'</p></div>'+
      '<div class="home-campaign-grid">'+
        '<a class="home-campaign-tile" href="'+entry+'"><span aria-hidden="true" class="tile-symbol">✧</span><strong>'+S.create+'</strong><small>'+S.homeCreateHint+'</small><span class="tile-arrow" aria-hidden="true">→</span></a>'+
        '<a class="home-campaign-tile" href="'+entry+'"><span aria-hidden="true" class="tile-symbol">⚿</span><strong>'+S.join+'</strong><small>'+S.homeJoinHint+'</small><span class="tile-arrow" aria-hidden="true">→</span></a>'+
        '<a class="home-campaign-tile" href="'+entry+'"><span aria-hidden="true" class="tile-symbol">♛</span><strong>'+S.created+'</strong><small>'+S.homeCreatedHint+'</small><span class="tile-arrow" aria-hidden="true">→</span></a>'+
        '<a class="home-campaign-tile" href="'+entry+'"><span aria-hidden="true" class="tile-symbol">♟</span><strong>'+S.memberships+'</strong><small>'+S.homeJoinedHint+'</small><span class="tile-arrow" aria-hidden="true">→</span></a>'+
      '</div>'+
    '</section>';
}
function authForm(mode) {
  const reset=mode==='recuperar', signup=mode==='registro';
  const heading=reset?S.reset:signup?S.signup:S.login;
  app.innerHTML='<section class="auth"><p class="kicker">'+S.eyebrow+'</p><h1>'+heading+'</h1>'+
    (!configured?'<p class="setup">'+S.setup+'</p>':'')+
    '<form id="auth"><fieldset '+(!auth?'disabled':'')+'>'+
    input('email',S.email,'email','autocomplete="email" maxlength="254"')+
    (reset?'':input('password',S.password,'password',
      'autocomplete="'+(signup?'new-password':'current-password')+'" minlength="'+(signup?'12':'6')+'" maxlength="128"'))+
    (signup?'<small>'+S.passwordHint+'</small>':'')+
    '<button type="submit" class="primary">'+(reset?S.resetAction:heading)+'</button></fieldset></form>'+
    '<p>'+link(S.login,'#acceso')+' · '+link(S.signup,'#registro')+
    ' · '+link(S.reset,'#recuperar')+'</p></section>';
  wireForm('auth',async data=>{
    const email=String(data.get('email')).trim(), password=String(data.get('password')||'');
    if(reset) {
      await fb.auth.sendPasswordResetEmail(auth,email,{url:new URL('./',location.href).href});
      message(S.resetSent);
    } else if(signup) {
      const result=await fb.auth.createUserWithEmailAndPassword(auth,email,password);
      try { await fb.auth.sendEmailVerification(result.user);message(S.verifyEmail); }
      catch { message(S.confirm); }
      location.hash='partidas';
    } else {
      await fb.auth.signInWithEmailAndPassword(auth,email,password);
      location.hash='partidas';
    }
  });
}
async function createCampaign(name,ruleset) {
  const fs=fb.fs, ref=fs.doc(fs.collection(db,'campaigns'));
  const batch=fs.writeBatch(db), now=fs.serverTimestamp();
  batch.set(ref,{ownerId:user.uid,name:campaignName(name),ruleset:availableRuleset(ruleset),
    status:'active',createdAt:now,updatedAt:now});
  batch.set(fs.doc(db,'campaigns',ref.id,'members',user.uid),{
    userId:user.uid,role:'dm',status:'active',joinedAt:now,
    inviteCode:null,removedAt:null
  });
  await batch.commit();
  return ref.id;
}
async function joinCampaign(value) {
  const code=cleanInvitationCode(value), fs=fb.fs;
  const invitation=fs.doc(db,'invitations',code);
  return fs.runTransaction(db,async tx=>{
    const snapshot=await tx.get(invitation);
    if(!snapshot.exists())throw Error('INVITATION_INVALID');
    const data=snapshot.data();
    if(data.revoked!==false || data.expiresAt?.toMillis?.()<=Date.now())throw Error('INVITATION_INVALID');
    const member=fs.doc(db,'campaigns',data.campaignId,'members',user.uid);
    const previous=await tx.get(member);
    if(previous.exists()) {
      if(previous.data().status==='removed')throw Error('MEMBERSHIP_REMOVED');
      return data.campaignId;
    }
    tx.set(member,{userId:user.uid,role:'member',status:'active',joinedAt:fs.serverTimestamp(),
      inviteCode:code,removedAt:null});
    return data.campaignId;
  });
}
function campaignCard(c) {
  const dm=c.ownerId===user.uid, place=dm?'dm':'sala';
  return '<article class="campaign"><h3>'+link(c.name,'#'+place+'/'+c.id)+'</h3>'+
    '<p>'+esc(names[c.ruleset])+' · '+(c.status==='active'?S.active:S.archived)+'</p>'+
    '<small>'+S.createdAt+': '+date(c.createdAt)+'</small>'+
    link(dm?S.dm:S.room,'#'+place+'/'+c.id)+'</article>';
}
async function games(ticket) {
  const fs=fb.fs, uid=user.uid;
  const [ownedDocs,membershipDocs]=await Promise.all([
    fs.getDocs(fs.query(fs.collection(db,'campaigns'),fs.where('ownerId','==',uid))),
    fs.getDocs(fs.query(fs.collectionGroup(db,'members'),fs.where('userId','==',uid)))
  ]);
  const owned=ownedDocs.docs.map(d=>({id:d.id,...d.data()}));
  const eligible=membershipDocs.docs.filter(d=>d.data().role==='member'&&d.data().status==='active');
  const joined=(await Promise.all(eligible.map(async m=>{
    const campaign=await fs.getDoc(m.ref.parent.parent);
    return campaign.exists()?{id:campaign.id,...campaign.data()}:null;
  }))).filter(Boolean);
  if(ticket!==epoch)return;
  const latest=(a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0);
  owned.sort(latest);joined.sort(latest);
  app.innerHTML=
    '<section class="workspace-head">'+
      '<div><p class="kicker">'+S.workspaceKicker+'</p>'+
      '<h1>'+S.games+'</h1><p class="workspace-intro">'+S.workspaceIntro+'</p></div>'+
      '<p class="account">'+esc(user.email)+'</p>'+
    '</section>'+
    '<div class="grid">'+
      '<section class="panel"><p class="panel-eyebrow">01 / '+S.create+'</p><h2>'+S.create+'</h2>'+
        '<form id="create">'+
          input('name',S.campaignName,'text','maxlength="80"')+
          '<label for="ruleset">'+S.ruleset+'</label>'+
          '<select id="ruleset" name="ruleset">'+
            '<option value="legacy">'+S.legacy+'</option>'+
            '<option value="dnd">'+S.dnd+' — '+S.modePrototype+'</option>'+
            '<option value="moon-system" disabled>'+S.moon+' — '+S.modePending+'</option>'+
          '</select>'+
          '<button type="submit" class="primary">'+S.createAction+'</button>'+
        '</form>'+
      '</section>'+
      '<section class="panel"><p class="panel-eyebrow">02 / '+S.join+'</p><h2>'+S.join+'</h2>'+
        '<form id="join">'+
          input('code',S.code,'text','pattern="[A-Fa-f0-9]{48}" maxlength="48" minlength="48" autocomplete="off" spellcheck="false"')+
          '<button type="submit">'+S.joinAction+'</button>'+
        '</form>'+
      '</section>'+
    '</div>'+
    '<div class="grid">'+
      '<section class="workspace-section"><h2>'+S.created+'</h2>'+
        (owned.map(campaignCard).join('')||'<p class="empty-state">'+S.emptyOwned+'</p>')+
      '</section>'+
      '<section class="workspace-section"><h2>'+S.memberships+'</h2>'+
        (joined.map(campaignCard).join('')||'<p class="empty-state">'+S.emptyJoined+'</p>')+
      '</section>'+
    '</div>'+
    button(S.refresh,'refresh');
  wireForm('create',async data=>{location.hash='dm/'+await createCampaign(data.get('name'),data.get('ruleset'));});
  wireForm('join',async data=>{location.hash='sala/'+await joinCampaign(data.get('code'));});
  wireAction('refresh',()=>render());
}
async function campaign(ticket,id,dmRequested) {
  if(!/^[A-Za-z0-9]{20}$/.test(id)){app.textContent=S.noAccess;return;}
  const fs=fb.fs, snap=await fs.getDoc(fs.doc(db,'campaigns',id));
  if(ticket!==epoch)return;
  if(!snap.exists()){app.textContent=S.noAccess;return;}
  const c=snap.data(), dm=c.ownerId===user.uid;
  if(dmRequested&&!dm){app.textContent=S.noAccess;return;}
  let members=[],invites=[];
  if(dm){
    const [m,i]=await Promise.all([
      fs.getDocs(fs.collection(db,'campaigns',id,'members')),
      fs.getDocs(fs.query(fs.collection(db,'invitations'),fs.where('campaignId','==',id)))
    ]);
    members=m.docs.map(d=>({id:d.id,...d.data()}));
    invites=i.docs.map(d=>({id:d.id,...d.data()}));
  }
  if(ticket!==epoch)return;
  app.innerHTML=link(S.back,'#partidas')+
    '<p class="kicker">'+(dm?S.dm:S.room)+'</p><h1>'+esc(c.name)+'</h1>'+
    '<p>'+esc(names[c.ruleset])+' · '+(c.status==='active'?S.active:S.archived)+'</p>'+
    '<p>'+(dm?S.dmNotice:S.waiting)+'</p>'+
    button(S.refresh,'refresh')+'<small>'+S.refreshNotice+'</small>'+
    (dm?'<div class="grid"><section class="panel"><h2>'+S.members+'</h2><ul class="list">'+
      members.map((m,i)=>'<li><span class="account">'+S.account+': '+esc(m.userId)+(m.role==='dm'?' (DM)':'')+
      '</span><small>'+S.joinedAt+': '+date(m.joinedAt)+'</small>'+
      (m.role==='member'&&m.status==='active'?button(S.expel,'expel-'+i):
        m.status==='removed'?'<small>'+S.expelled+': '+date(m.removedAt)+'</small>':'')+'</li>').join('')+
      '</ul></section><section class="panel"><h2>'+S.invitations+'</h2>'+
      button(S.makeInvite,'invite',c.status!=='active')+
      '<div id="new-invite" role="status"></div><ul class="list">'+
      invites.map((v,i)=>'<li><small>'+S.expires+': '+date(v.expiresAt)+'</small>'+
      (v.revoked?'<small>'+S.revoked+'</small>':
        v.expiresAt?.toMillis?.()<=Date.now()?'<small>'+S.expired+'</small>':
        button(S.revoke,'revoke-'+i))+'</li>').join('')+'</ul></section></div>':'')+
    '<section class="pending"><h2>'+S.inactive+'</h2><p>'+S.noMulti+'</p>'+
    '<div class="actions">'+button(S.launch,'launch',true)+button(S.sync,'sync',true)+'</div></section>';
  wireAction('refresh',()=>render());
  if(!dm)return;
  wireAction('invite',async()=>{
    const code=makeInvitationCode();
    const expiry=fs.Timestamp.fromMillis(Date.now()+6*24*60*60*1000);
    await fs.setDoc(fs.doc(db,'invitations',code),{
      campaignId:id,createdBy:user.uid,createdAt:fs.serverTimestamp(),
      expiresAt:expiry,revoked:false
    });
    await render();
    const el=document.getElementById('new-invite');
    if(el)el.innerHTML='<p>'+S.inviteNotice+'</p><code>'+esc(code)+'</code>'+
      '<small>'+S.expires+': '+date(expiry)+'</small>';
  });
  members.forEach((m,i)=>{
    if(m.role!=='member'||m.status!=='active')return;
    wireAction('expel-'+i,async()=>{
      if(!confirm(S.confirmExpel))return;
      await fs.updateDoc(fs.doc(db,'campaigns',id,'members',m.id),{
        status:'removed',removedAt:fs.serverTimestamp()
      });
      await render();
    });
  });
  invites.forEach((v,i)=>{
    if(v.revoked||v.expiresAt?.toMillis?.()<=Date.now())return;
    wireAction('revoke-'+i,async()=>{
      if(!confirm(S.confirmRevoke))return;
      await fs.updateDoc(fs.doc(db,'invitations',v.id),{revoked:true});
      await render();
    });
  });
}
async function render() {
  const ticket=++epoch;
  app.setAttribute('aria-busy','true');
  nav.innerHTML=link(S.home,'#inicio')+
    (user?link(S.games,'#partidas')+button(S.logout,'logout'):
      link(S.login,'#acceso')+link(S.signup,'#registro'));
  wireAction('logout',async()=>{
    await fb.auth.signOut(auth); user=null;
    location.hash='inicio';message(S.signedOut);await render();
  });
  const [route,id]=location.hash.slice(1).split('/');
  try {
    if(['partidas','dm','sala'].includes(route)){
      app.textContent=S.loading;
      if(!auth||!user){authForm('acceso');if(auth)message(S.authRequired);return;}
      if(route==='partidas')await games(ticket);
      else await campaign(ticket,id,route==='dm');
    } else if(['registro','acceso','recuperar'].includes(route)) {
      if(user){location.hash='partidas';return;}
      authForm(route);
    } else home();
  } catch(error) {
    if(ticket===epoch){app.textContent=S.error;message(readableError(error),true);}
  } finally {
    if(ticket===epoch){app.setAttribute('aria-busy','false');app.focus({preventScroll:true});}
  }
}
window.addEventListener('hashchange',()=>{message();void render();});
async function initialize() {
  if(!configured){await render();return;}
  app.textContent=S.loading;
  try{
    const [appSdk, authSdk, fsSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js')
    ]);
    const instance=appSdk.initializeApp(firebaseConfig);
    fb={auth:authSdk,fs:fsSdk};auth=authSdk.getAuth(instance);db=fsSdk.getFirestore(instance);
    authSdk.onAuthStateChanged(auth, next=>{user=next;void render();},error=>{
      initError=error;user=null;void render();
    });
  }catch(error){initError=error;await render();message(S.error,true);}
}
void initialize();
