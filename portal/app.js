import { campaignAccess } from './cartridge-access.js';
import { mountMapLibrary, clearMapLibraries, confirmDiscardMapLibraries } from './map-library.js';
import { C, cartridgeError } from './cartridge-strings.js';
import { firebaseConfig, configured } from './config.js';
import { S } from './strings.js';
import { makeInvitationCode, cleanInvitationCode, campaignName, availableRuleset } from './campaign-model.js';
import { cleanDisplayName, visibleDisplayName } from './profile-model.js';
import { makeLobbyId, isWaitingLobby, isJoinedParticipant } from './lobby-model.js';
import { playStore } from './play-session.js';
import { mountGameRoom } from './game-room.js';
import { P } from './play-strings.js';

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
const nameField = (current='') =>
  '<label for="displayName">'+S.displayName+'</label>'+
  '<input id="displayName" name="displayName" type="text" required minlength="3" maxlength="32" autocomplete="nickname" placeholder="'+esc(S.displayNamePlaceholder)+'" value="'+esc(current)+'">'+
  '<small class="field-hint">'+S.displayNameHelp+'</small>';
const eyeIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const passwordField = (signup) =>
  '<label for="password">'+S.password+'</label>'+
  '<div class="password-control">'+
    '<input id="password" name="password" type="password" required autocomplete="'+(signup?'new-password':'current-password')+'" minlength="'+(signup?'12':'6')+'" maxlength="128" spellcheck="false">'+
    '<button type="button" id="toggle-password" class="password-toggle" aria-controls="password" aria-pressed="false" aria-label="'+S.showPassword+'" title="'+S.showPassword+'">'+eyeIcon+'</button>'+
  '</div>';
function wirePasswordToggle() {
  const field=document.getElementById('password'), toggle=document.getElementById('toggle-password');
  if(!field || !toggle)return;
  toggle.addEventListener('click',()=>{
    const visible=field.type==='password';
    field.type=visible?'text':'password';
    toggle.setAttribute('aria-pressed',String(visible));
    toggle.setAttribute('aria-label',visible?S.hidePassword:S.showPassword);
    toggle.title=visible?S.hidePassword:S.showPassword;
  });
}

let fb=null, auth=null, db=null, user=null, initError=null, epoch=0, busy=false, chosenName='', profileIssue='';
let stopLobbyListeners=()=>{};
let stopMapLibrary=()=>{};
let stopGameRoom=()=>{};
const gameStore=()=>playStore(fb.fs,db,()=>user?.uid===auth?.currentUser?.uid?user?.uid:null);
let activeMapHash=location.hash;
const ownName=()=>visibleDisplayName(chosenName || user?.displayName,S.unnamed);

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
  if (/auth\/unsupported-persistence|auth\/web-storage-unsupported/.test(c)) return S.sessionStorageError;
  if (/CAMPAIGN_NAME_INVALID/.test(c)) return 'El nombre debe tener entre 1 y 80 caracteres.';
  if (/DISPLAY_NAME_INVALID/.test(c)) return S.profileNameInvalid;
  if (/LOBBY_/.test(c)) return S.lobbyActionError;
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
async function saveDisplayName(authUser, suppliedName) {
  const name=cleanDisplayName(suppliedName);
  // Firebase Auth almacena la etiqueta elegida; el UID sigue siendo la identidad real.
  await fb.auth.updateProfile(authUser,{displayName:name});
  if(user?.uid===authUser.uid)chosenName=name;
  // Perfil compartible: sólo nombre visible y fecha. No guardar correo ni contraseña.
  try {
    await fb.fs.setDoc(fb.fs.doc(db,'profiles',authUser.uid),{
      displayName:name,updatedAt:fb.fs.serverTimestamp()
    });
    return true;
  } catch {
    // Las reglas de perfiles podrían no estar desplegadas aún. No borrar la cuenta.
    return false;
  }
}
function accountProfile() {
  app.innerHTML='<section class="auth account-profile"><p class="kicker">'+S.eyebrow+'</p>'+
    '<h1>'+S.profileTitle+'</h1><p class="profile-subtitle">'+S.profileSubtitle+'</p>'+
    (profileIssue?'<p class="query-warning" role="alert">'+esc(profileIssue)+'</p>':'')+
    '<p class="profile-current">'+esc(ownName())+'</p>'+
    '<form id="profile-form"><fieldset>'+
      nameField(chosenName || user.displayName || '')+
      '<button type="submit" class="primary">'+S.profileSave+'</button>'+
    '</fieldset></form>'+
    '<p class="profile-note">'+S.profileVisibility+'</p></section>';
  wireForm('profile-form',async data=>{
    const synced=await saveDisplayName(user,data.get('displayName'));
    profileIssue=synced?'':S.profileSyncPending;
    await render();
    message(synced?S.profileSaved:S.profileSyncPending,!synced);
  });
}
function authForm(mode) {
  const reset=mode==='recuperar', signup=mode==='registro';
  const heading=reset?S.reset:signup?S.signup:S.login;
  app.innerHTML='<section class="auth"><p class="kicker">'+S.eyebrow+'</p><h1>'+heading+'</h1>'+
    (!configured?'<p class="setup">'+S.setup+'</p>':'')+
    '<form id="auth"><fieldset '+(!auth?'disabled':'')+'>'+
    (signup?nameField(): '')+
    input('email',S.email,'email','autocomplete="email" maxlength="254"')+
    (reset?'':passwordField(signup))+
    (signup?'<small>'+S.passwordHint+'</small>':'')+
    (!reset&&!signup?'<label class="remember-row" for="remember-me"><input id="remember-me" name="remember-me" type="checkbox" value="yes"><span>'+S.rememberMe+'<small>'+S.rememberHint+'</small></span></label>':'')+
    '<button type="submit" class="primary">'+(reset?S.resetAction:heading)+'</button></fieldset></form>'+
    '<p>'+link(S.login,'#acceso')+' · '+link(S.signup,'#registro')+
    ' · '+link(S.reset,'#recuperar')+'</p></section>';
  wirePasswordToggle();
  wireForm('auth',async data=>{
    const email=String(data.get('email')).trim(), password=String(data.get('password')||'');
    if(reset) {
      await fb.auth.sendPasswordResetEmail(auth,email,{url:new URL('./',location.href).href});
      message(S.resetSent);
    } else if(signup) {
      // Validar antes de crear credenciales para no dejar cuentas medio registradas.
      const wantedName=cleanDisplayName(data.get('displayName'));
      await fb.auth.setPersistence(auth,fb.auth.browserSessionPersistence);
      const result=await fb.auth.createUserWithEmailAndPassword(auth,email,password);
      let synced=false;
      try { synced=await saveDisplayName(result.user,wantedName); }
      catch { profileIssue=S.profileSaveError; }
      if(!synced && !profileIssue)profileIssue=S.profileSyncPending;
      try { await fb.auth.sendEmailVerification(result.user);message(S.verifyEmail); }
      catch { message(S.confirm); }
      location.hash=synced?'partidas':'perfil';
    } else {
      const remember=data.get('remember-me')==='yes';
      await fb.auth.setPersistence(auth,remember?fb.auth.browserLocalPersistence:fb.auth.browserSessionPersistence);
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
function queryFailure(error, title) {
  const rawCode=String(error?.code || 'unknown').slice(0,80);
  const reason=readableError(error);
  const messageText=String(error?.message || '');
  const candidate=messageText.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/)?.[0];
  let indexLink='';
  if(candidate) {
    try {
      const url=new URL(candidate.replace(/[.,;]+$/,''));
      if(url.protocol==='https:' && url.hostname==='console.firebase.google.com' &&
          url.pathname.startsWith('/project/rol-serv/')) {
        indexLink='<p>'+link(S.openIndex,url.href)+'</p>';
      }
    } catch { /* No publicar vínculos que Firebase no generó correctamente. */ }
  }
  return '<div class="query-warning" role="alert"><strong>'+esc(title)+'</strong><p>'+S.queryError+' '+esc(reason)+'</p>'+
    '<small>'+S.firebaseCode+': '+esc(rawCode)+'</small>'+
    (/failed-precondition/.test(rawCode)?'<p>'+S.queryHelp+'</p>':'')+indexLink+'</div>';
}
async function games(ticket) {
  const fs=fb.fs, uid=user.uid;
  // No ocultar la pantalla completa si falla una de las dos consultas independientes.
  const [ownedResult,membershipResult]=await Promise.allSettled([
    fs.getDocs(fs.query(fs.collection(db,'campaigns'),fs.where('ownerId','==',uid))),
    fs.getDocs(fs.query(fs.collectionGroup(db,'members'),fs.where('userId','==',uid)))
  ]);
  if(ticket!==epoch)return;
  const ownedError=ownedResult.status==='rejected'?ownedResult.reason:null;
  const owned=ownedResult.status==='fulfilled'?
    ownedResult.value.docs.map(d=>({id:d.id,...d.data()})):[];
  let joinedError=membershipResult.status==='rejected'?membershipResult.reason:null;
  let joined=[];
  if(membershipResult.status==='fulfilled') {
    const eligible=membershipResult.value.docs.filter(d=>d.data().role==='member'&&d.data().status==='active');
    const lookups=await Promise.allSettled(eligible.map(async m=>{
      const campaign=await fs.getDoc(m.ref.parent.parent);
      return campaign.exists()?{id:campaign.id,...campaign.data()}:null;
    }));
    joined=lookups.filter(r=>r.status==='fulfilled').map(r=>r.value).filter(Boolean);
    joinedError=lookups.find(r=>r.status==='rejected')?.reason || null;
  }
  if(ticket!==epoch)return;
  const latest=(a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0);
  owned.sort(latest);joined.sort(latest);
  app.innerHTML=
    '<section class="workspace-head">'+
      '<div><p class="kicker">'+S.workspaceKicker+'</p>'+
      '<h1>'+S.games+'</h1><p class="workspace-intro">'+S.workspaceIntro+'</p></div>'+
      '<p class="account">'+esc(ownName())+' · '+link(S.profile,'#perfil')+'</p>'+
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
        (ownedError?queryFailure(ownedError,S.created):(owned.map(campaignCard).join('')||'<p class="empty-state">'+S.emptyOwned+'</p>'))+
      '</section>'+
      '<section class="workspace-section"><h2>'+S.memberships+'</h2>'+
        (joinedError?queryFailure(joinedError,S.memberships):'')+
        (joined.map(campaignCard).join('')||(joinedError?'':'<p class="empty-state">'+S.emptyJoined+'</p>'))+
      '</section>'+
    '</div>'+
    button(S.refresh,'refresh');
  wireForm('create',async data=>{location.hash='dm/'+await createCampaign(data.get('name'),data.get('ruleset'));});
  wireForm('join',async data=>{location.hash='sala/'+await joinCampaign(data.get('code'));});
  wireAction('refresh',()=>render());
}
function watchCampaignLobby(ticket,campaignId,dm,archived,memberNames) {
  const fs=fb.fs, panel=document.querySelector('#campaign-lobby');
  if(!panel)return;
  const roomRef=fs.doc(db,'campaigns',campaignId,'lobby','current');
  const membersRef=fs.collection(db,'campaigns',campaignId,'lobbyParticipants');
  const currentUid=user.uid;
  let room=null,roster=[],roomLoaded=false,rosterLoaded=false,problem=null,playSession=null;
  const rosterNames=new Map(memberNames),pendingNames=new Set();
  const active=()=>isWaitingLobby(room);
  function paint() {
    if(ticket!==epoch||!panel.isConnected)return;
    let html='<h2>'+S.lobbyTitle+'</h2><p>'+S.lobbyIntro+'</p>';
    if(problem) {
      html+='<p class="query-warning" role="alert">'+esc(readableError(problem))+' '+S.lobbyRulesHelp+'</p>';
    } else if(!roomLoaded||!rosterLoaded) {
      html+='<p role="status">'+S.lobbyLoading+'</p>';
    } else {
      const waiting=active(),listed=waiting?roster.filter(p=>isJoinedParticipant(p,room.roomId)):[];
      const enrolled=listed.some(p=>p.userId===currentUid);
      html+='<p class="lobby-state" role="status">'+(waiting?S.lobbyOpen:S.lobbyClosed)+'</p>';
      if(dm && !archived) {
        html+='<div class="actions">'+(waiting?
          '<button type="button" data-lobby-action="close">'+S.lobbyCloseAction+'</button>':
          '<button type="button" class="primary" data-lobby-action="open">'+S.lobbyOpenAction+'</button>')+'</div>';
      } else if(waiting && !archived) {
        html+='<div class="actions">'+(enrolled?
          '<button type="button" data-lobby-action="leave">'+S.lobbyLeaveAction+'</button>':
          '<button type="button" class="primary" data-lobby-action="join">'+S.lobbyJoinAction+'</button>')+'</div>';
      }
      if(waiting) {
        if(!archived&&(dm||enrolled)&&playSession?.status==='open'&&playSession.roomId===room.roomId){
          html+='<p>'+link(P.join,'#jugar/'+campaignId)+'</p><p>'+P.limitation+'</p>';
        }
        html+='<h3>'+S.lobbyRoster+' ('+listed.length+')</h3>';
        html+='<ul class="lobby-roster">'+(listed.map(p=>
          '<li>'+esc(p.userId===currentUid?ownName():(rosterNames.get(p.userId)||S.unnamed))+'</li>'
        ).join('')||'<li>'+S.lobbyNobody+'</li>')+'</ul>';
      }
      html+='<small class="lobby-disclaimer">'+S.lobbyPresence+'</small>';
    }
    panel.innerHTML=html;
  }
  function resolveNames() {
    for(const entry of roster) {
      const uid=entry.userId;
      if(uid===currentUid||typeof uid!=='string'||rosterNames.has(uid)||pendingNames.has(uid))continue;
      pendingNames.add(uid);
      fs.getDoc(fs.doc(db,'profiles',uid)).then(snapshot=>{
        rosterNames.set(uid,snapshot.exists()?
          visibleDisplayName(snapshot.data().displayName,S.unnamed):S.unnamed);
      },()=>{rosterNames.set(uid,S.unnamed);}).finally(()=>{
        pendingNames.delete(uid);paint();
      });
    }
  }
  panel.addEventListener('click',async event=>{
    const target=event.target.closest('[data-lobby-action]');
    if(!target||!panel.contains(target)||busy||ticket!==epoch||!roomLoaded||problem)return;
    const action=target.dataset.lobbyAction;
    if(!['open','close','join','leave'].includes(action))return;
    if((action==='open'||action==='close')&&!dm)return;
    if(archived)return;
    busy=true;message();target.disabled=true;
    try {
      if(action==='open'){
        const current=await fs.getDoc(roomRef);
        if(current.exists()&&isWaitingLobby(current.data()))throw Error('LOBBY_ALREADY_OPEN');
        await fs.setDoc(roomRef,{
          hostId:currentUid,roomId:makeLobbyId(),status:'waiting',
          openedAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()
        });
      } else if(action==='close'){
        await fs.updateDoc(roomRef,{status:'closed',updatedAt:fs.serverTimestamp()});
      } else {
        if(!active())throw Error('LOBBY_NOT_OPEN');
        await fs.setDoc(fs.doc(membersRef,currentUid),{
          userId:currentUid,roomId:room.roomId,
          state:action==='join'?'joined':'left',updatedAt:fs.serverTimestamp()
        });
      }
    } catch(error) {message(readableError(error),true);}
    finally {busy=false;if(target.isConnected)target.disabled=false;}
  });
  const onError=error=>{problem=error;paint();};
  const unsubscribeRoom=fs.onSnapshot(roomRef,snapshot=>{
    room=snapshot.exists()?snapshot.data():null;roomLoaded=true;paint();
  },onError);
  const unsubscribeRoster=fs.onSnapshot(membersRef,snapshot=>{
    roster=snapshot.docs.map(d=>d.data());rosterLoaded=true;resolveNames();paint();
  },onError);
  const unsubscribePlay=fs.onSnapshot(fs.doc(db,'campaigns',campaignId,'playSession','current'),snapshot=>{
    playSession=snapshot.exists()?snapshot.data():null;paint();
  },error=>{message(readableError(error),true);});
  stopLobbyListeners=()=>{unsubscribeRoom();unsubscribeRoster();unsubscribePlay();};
}

async function campaign(ticket,id,dmRequested) {
  if(!/^[A-Za-z0-9]{20}$/.test(id)){app.textContent=S.noAccess;return;}
  const fs=fb.fs, snap=await fs.getDoc(fs.doc(db,'campaigns',id));
  if(ticket!==epoch)return;
  if(!snap.exists()){app.textContent=S.noAccess;return;}
  const c=snap.data(), dm=c.ownerId===user.uid;
  if(dmRequested&&!dm){app.textContent=S.noAccess;return;}
  let members=[],invites=[];
  const memberNames=new Map();
  if(dm){
    const [m,i]=await Promise.all([
      fs.getDocs(fs.collection(db,'campaigns',id,'members')),
      fs.getDocs(fs.query(fs.collection(db,'invitations'),fs.where('campaignId','==',id)))
    ]);
    members=m.docs.map(d=>({id:d.id,...d.data()}));
    invites=i.docs.map(d=>({id:d.id,...d.data()}));
    // Consultar sólo los perfiles de los miembros de esta campaña.
    const resolved=await Promise.allSettled(members.map(async member=>{
      if(member.userId===user.uid)return ownName();
      const profile=await fs.getDoc(fs.doc(db,'profiles',member.userId));
      return profile.exists()?visibleDisplayName(profile.data().displayName,S.unnamed):S.unnamed;
    }));
    members.forEach((member,index)=>{
      memberNames.set(member.userId,resolved[index].status==='fulfilled'?resolved[index].value:S.unnamed);
    });
  }
  if(ticket!==epoch)return;
  app.innerHTML=link(S.back,'#partidas')+
    '<p class="kicker">'+(dm?S.dm:S.room)+'</p><h1>'+esc(c.name)+'</h1>'+
    '<p>'+esc(names[c.ruleset])+' · '+(c.status==='active'?S.active:S.archived)+'</p>'+
    '<p>'+(dm?S.dmNotice:S.waiting)+'</p>'+
    button(S.refresh,'refresh')+'<small>'+S.refreshNotice+'</small>'+
    (dm&&c.ruleset==='legacy'&&c.status==='active'?'<p>'+link(C.title,'#mapas/'+id)+'</p>':'')+
    (dm?'<div class="grid"><section class="panel"><h2>'+S.members+'</h2><ul class="list">'+
      members.map((m,i)=>'<li><span class="account">'+esc(memberNames.get(m.userId)||S.unnamed)+(m.role==='dm'?' (DM)':'')+
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
    '<section id="campaign-lobby" class="pending lobby-panel" aria-label="'+S.lobbyTitle+'"><p role="status">'+S.lobbyLoading+'</p></section>'+
    '<section class="pending"><h2>'+S.inactive+'</h2><p>'+S.noMulti+'</p>'+
    '<div class="actions">'+button(S.sync,'sync',true)+'</div></section>';
  wireAction('refresh',()=>render());
  watchCampaignLobby(ticket,id,dm,c.status!=='active',memberNames);
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
async function mapLibrary(ticket,id,workspaceId) {
  const uid=user?.uid;
  async function verify(){
    return campaignAccess({uid,campaignId:id,
      currentUid:()=>ticket===epoch&&user?.uid===auth?.currentUser?.uid?user?.uid:null,
      readCampaign:cid=>fb.fs.getDocFromServer(fb.fs.doc(db,'campaigns',cid))});
  }
  try{
    const context=await verify();
    if(ticket!==epoch)return;
    app.innerHTML=link(S.back,'#dm/'+id)+'<section class="map-library"></section>';
    const cleanup=await mountMapLibrary({element:app.querySelector('.map-library'),context,campaignName:context.name,verify,onError:()=>{},workspaceId,
      publish:async(doc,mapId,validate)=>{
        await verify();await gameStore().publish(doc,context,mapId,validate);await verify();
        location.hash='jugar/'+id;
      }});
    if(ticket!==epoch)cleanup();else{
      stopMapLibrary=cleanup;
      if(workspaceId){history.replaceState(null,'','#mapas/'+id);activeMapHash=location.hash;}
    }
  }catch(error){if(ticket===epoch){app.textContent=cartridgeError(error);}}
}
async function gameRoom(ticket,id){
  if(!/^[A-Za-z0-9]{20}$/.test(id)){app.textContent=S.noAccess;return;}
  app.innerHTML=link(P.leave,'#sala/'+id)+'<section class="game-room"></section>';
  stopGameRoom=await mountGameRoom({element:app.querySelector('.game-room'),store:gameStore(),campaignId:id,
    isCurrent:()=>ticket===epoch&&user?.uid===auth?.currentUser?.uid});
}
async function render() {
  if(stopMapLibrary()===false){history.replaceState(null,'',activeMapHash||'#inicio');return;}
  stopMapLibrary=()=>{};activeMapHash=location.hash;
  const ticket=++epoch;
  stopGameRoom();stopGameRoom=()=>{};
  stopLobbyListeners();stopLobbyListeners=()=>{};
  app.setAttribute('aria-busy','true');
  nav.innerHTML=link(S.home,'#inicio')+
    (user?link(S.games,'#partidas')+link(S.profile,'#perfil')+button(S.logout,'logout'):
      link(S.login,'#acceso')+link(S.signup,'#registro'));
  wireAction('logout',async()=>{
    if(!confirmDiscardMapLibraries())return;
    await fb.auth.signOut(auth); user=null;clearMapLibraries();
    location.hash='inicio';message(S.signedOut);await render();
  });
  const [route,id,workspaceId]=location.hash.slice(1).split('/');
  try {
    if(route==='perfil'){
      if(!auth||!user){authForm('acceso');if(auth)message(S.authRequired);return;}
      accountProfile();
    } else if(['partidas','dm','sala','mapas','jugar'].includes(route)){
      app.textContent=S.loading;
      if(!auth||!user){authForm('acceso');if(auth)message(S.authRequired);return;}
      if(route==='jugar')await gameRoom(ticket,id);
      else if(route==='mapas')await mapLibrary(ticket,id,workspaceId);
      else if(route==='partidas')await games(ticket);
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
    authSdk.onAuthStateChanged(auth, next=>{if(user?.uid!==next?.uid)clearMapLibraries();user=next;chosenName=next?.displayName||'';if(!next)profileIssue='';void render();},error=>{
      initError=error;user=null;void render();
    });
  }catch(error){initError=error;await render();message(S.error,true);}
}
void initialize();
