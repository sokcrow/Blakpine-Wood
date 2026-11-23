/* Selección/creación de personajes D&D separada del editor y de FHCharacterCore.
 * Datos privados del modo DnD; la ficha sólo se inyecta en la COPIA de la sesión 3D.
 */
(function(root,factory){
 'use strict';
 const sheet=typeof module==='object'&&module.exports
  ?require('../rules/dnd/fh-dnd-sheet.js'):root.FHDndSheet;
 const api=factory(sheet);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndCharacterManager=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(sheet){
 'use strict';
 const KEY='fh_dnd_characters_v1',ACTIVE='fh_dnd_active_character_v1';
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const idValid=id=>typeof id==='string'&&/^dnd_[A-Za-z0-9_-]{8,90}$/.test(id);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const dieByClass=Object.freeze({barbarian:12,bard:8,cleric:8,druid:8,fighter:10,
  monk:8,paladin:10,ranger:10,rogue:8,sorcerer:6,warlock:8,wizard:6});
 function registry(storage){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
   throw Error('DND_STORAGE_UNAVAILABLE');
  function list(){
   let items;try{items=JSON.parse(storage.getItem(KEY)||'[]');}
   catch{items=[];}
   if(!Array.isArray(items))return [];
   return items.filter(c=>c&&idValid(c.id)&&text(c.name)&&sheet.valid(c.sheet)&&
    c.sheet.name===c.name).map(copy);
  }
  function current(){
   let id;try{id=storage.getItem(ACTIVE);}catch{return null;}
   return list().find(p=>p.id===id)||null;
  }
  function makeId(existing){
   let id;do{
    const token=typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():
     Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);
    id='dnd_'+token;
   }while(existing.some(p=>p.id===id));
   return id;
  }
  function upsert({id=null,name,character}={}){
   if(!text(name)||name.length>100||!sheet.valid(character)||
    character.name!==name.trim())throw Error('DND_PROFILE_INVALID');
   const records=list(),key=idValid(id)?id:makeId(records);
   // Nunca permitir que un perfil de otro modo sobrescriba esta tabla.
   if(id!==null&&!records.some(p=>p.id===id))throw Error('DND_PROFILE_UNKNOWN');
   const entry={id:key,name:name.trim(),sheet:copy(character)};
   const next=[...records.filter(p=>p.id!==key),entry];
   storage.setItem(KEY,JSON.stringify(next));
   storage.setItem(ACTIVE,key);
   return copy(entry);
  }
  function select(id){
   const p=list().find(x=>x.id===id);
   if(!p)throw Error('DND_PROFILE_UNKNOWN');
   storage.setItem(ACTIVE,id);return p;
  }
  return Object.freeze({list,current,upsert,select});
 }
 function storageInBrowser(){
  try{return window.localStorage;}catch{return null;}
 }
 function current(){
  try{return registry(storageInBrowser()).current();}catch{return null;}
 }
 function ensureCharacter({document:doc=typeof document!=='undefined'?document:null,
  storage=typeof window!=='undefined'?storageInBrowser():null}={}){
  if(!doc?.body||typeof doc.createElement!=='function')
   return Promise.reject(Error('DND_DOCUMENT_UNAVAILABLE'));
  let library;
  try{library=registry(storage);}
  catch(error){return Promise.reject(error);}
  const T=globalThis.FH_DND_CHARACTER_TEXT||{};
  return new Promise(resolve=>{
   const root=doc.createElement('div');
   root.id='fh-dnd-character-dialog';root.setAttribute('role','dialog');
   root.setAttribute('aria-modal','true');root.setAttribute('aria-label',T.title||'D&D');
   const panel=doc.createElement('section');
   const title=doc.createElement('h2');
   const form=doc.createElement('form');
   form.style.cssText='display:grid;gap:12px';
   const fields=doc.createElement('div');
   fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px';
   const full=doc.createElement('div');full.style.cssText='display:grid;gap:12px';
   function section(textValue){
    const label=doc.createElement('h3');label.textContent=textValue;
    label.style.cssText='font-size:15px;margin:8px 0 0';full.append(label);
   }
   function field(labelText,control,holder=fields){
    const label=doc.createElement('label');
    label.style.cssText='display:grid;gap:4px;font-size:13px;color:#e5e7eb';
    const cap=doc.createElement('span');cap.textContent=labelText;
    control.style.cssText='width:100%;box-sizing:border-box;background:#111827;color:white;border:1px solid #818da1;border-radius:5px;padding:8px;min-height:38px';
    label.append(cap,control);holder.append(label);return control;
   }
   function input(type,value,min,max){
    const el=doc.createElement('input');el.type=type;el.value=String(value);
    if(type==='number'){el.min=String(min);el.max=String(max);el.step='1';}
    return el;
   }
   function select(options){
    const el=doc.createElement('select');
    for(const [value,label] of options){
     const option=doc.createElement('option');option.value=value;option.textContent=label;
     el.append(option);
    }return el;
   }
   function jsonField(labelText,value){
    const el=doc.createElement('textarea');el.value=JSON.stringify(value,null,2);
    el.rows=5;el.spellcheck=false;el.style.cssText='resize:vertical;font:12px monospace';
    field(labelText,el,full);return el;
   }
   const saved=library.list(),selected=library.current();
   const choices=select([['',T.newCharacter||'Nuevo'],...saved.map(p=>[p.id,p.name])]);
   choices.value=selected?.id||'';
   const roster=doc.createElement('div');
   if(saved.length)field(T.choose,choices,roster);
   const name=input('text','');name.required=true;name.maxLength=100;
   const identity=doc.createElement('div');
   field(T.name,name,identity);
   const klass=select([['',T.classPlaceholder||'Selecciona una clase'],
    ...Object.entries(T.classes||{}).map(([id,label])=>[id,label])]);
   klass.required=true;
   const level=input('number',1,1,20);field(T.level||'Nivel',level);
   const background=input('text','custom');field(T.background||'Trasfondo',background);
   const species=input('text','custom');field(T.species||'Especie',species);
   const hp=input('number',1,1,100000),maxHp=input('number',1,1,100000);
   const ac=input('number',10,1,100),speed=input('number',30,0,1000);
   field(T.hitPoints||'PG actuales',hp);field(T.maxHitPoints||'PG máximos',maxHp);
   field(T.armor||'CA',ac);field(T.speed||'Velocidad',speed);
   const die=input('number',8,2,100),diceTotal=input('number',1,1,20),
    diceAvail=input('number',1,0,20);
   field(T.hitDie||'Dado de golpe',die);
   field(T.hitDiceTotal||'Dados totales',diceTotal);
   field(T.hitDiceAvailable||'Dados disponibles',diceAvail);
   section(T.abilities||'Características');
   const abilityGrid=doc.createElement('div');
   abilityGrid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px';
   full.append(abilityGrid);
   const abilities={};
   for(const id of sheet.ABILITIES){
    const score=input('number',10,1,30);field((T.abilityIcons?.[id]||'◆')+' '+(T.abilitiesMap?.[id]||id),score,abilityGrid);
    const tile=abilityGrid.lastElementChild;tile.className='dnd-ability-card';
    const mod=doc.createElement('small');mod.className='dnd-ability-mod';
    score.addEventListener('input',()=>{
     const value=Number(score.value);mod.textContent=Number.isFinite(value)?
      ((Math.floor((value-10)/2)>=0?'+':'')+Math.floor((value-10)/2)):'';
    });
    tile.append(mod);abilities[id]=score;
   }
   function checks(labelText,ids,labels){
    section(labelText);
    const wrap=doc.createElement('div');
    wrap.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:6px';
    full.append(wrap);
    const map={};
    for(const id of ids){
     const label=doc.createElement('label');label.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px';
     const check=doc.createElement('input');check.type='checkbox';check.value=id;
     const span=doc.createElement('span');span.textContent=labels[id]||id;
     label.append(check,span);wrap.append(label);map[id]=check;
    }return map;
   }
   const saves=checks(T.saves||'Salvaciones',sheet.ABILITIES,T.abilitiesMap||{});
   const skills=checks(T.skills||'Habilidades',Object.keys(sheet.SKILLS),T.skillsMap||{});
   section(T.attacks||'Ataques');
   const attackList=doc.createElement('div');attackList.className='dnd-attack-list';full.append(attackList);
   const attackAdd=doc.createElement('button');attackAdd.type='button';
   attackAdd.className='dnd-add-attack';attackAdd.textContent=T.attackAdd;full.append(attackAdd);
   const raw=doc.createElement('details');raw.className='dnd-technical';
   const rawCaption=doc.createElement('summary');rawCaption.textContent=T.technical;
   raw.append(rawCaption);full.append(raw);
   const attacks=jsonField(T.attackJson||'Ataques (JSON)',[]);
   const features=jsonField(T.features||'Rasgos de clase (JSON)',{});
   const spellcasting=jsonField(T.spells||'Conjuros (JSON)',null);
   // Mover los controles JSON a la sección técnica, sin perder campos adicionales.
   for(const label of Array.from(full.children).slice(-3))raw.append(label);
   let attackCounter=0;
   function syncAttacks(){
    const data=Array.from(attackList.children,row=>{
     const a={...row._original};
     for(const key of ['name','ability','damageType'])a[key]=row._fields[key].value;
     for(const key of ['damageCount','damageDie','rangeFt'])a[key]=Number(row._fields[key].value);
     a.proficient=row._fields.proficient.checked;return a;
    });
    attacks.value=JSON.stringify(data,null,2);
   }
   function attackRow(data){
    const row=doc.createElement('fieldset');row.className='dnd-attack-card';
    row._original={...data};row._fields={};
    const line=doc.createElement('div');line.className='dnd-attack-fields';row.append(line);
    function add(key,control){
     const label=doc.createElement('label');label.textContent=T.attackFields?.[key]||key;
     label.append(control);line.append(label);row._fields[key]=control;
     control.addEventListener('input',syncAttacks);
    }
    add('name',input('text',data.name||''));
    add('ability',select(sheet.ABILITIES.map(id=>[id,T.abilitiesMap?.[id]||id])));
    row._fields.ability.value=data.ability||'str';
    for(const key of ['damageCount','damageDie','rangeFt'])
     add(key,input('number',data[key]??(key==='rangeFt'?5:1),key==='rangeFt'?0:1,1000));
    add('damageType',select([
     ['bludgeoning','Contundente'],['piercing','Perforante'],['slashing','Cortante'],
     ['fire','Fuego'],['cold','Frío'],['lightning','Relámpago'],['necrotic','Necrótico'],
     ['radiant','Radiante'],['force','Fuerza'],['psychic','Psíquico'],['poison','Veneno'],
     ['acid','Ácido'],['thunder','Trueno']]));
    row._fields.damageType.value=data.damageType||'bludgeoning';
    const proficient=doc.createElement('input');proficient.type='checkbox';
    proficient.checked=!!data.proficient;add('proficient',proficient);
    const remove=doc.createElement('button');remove.type='button';
    remove.className='dnd-remove-attack';remove.textContent=T.attackRemove;
    remove.addEventListener('click',()=>{
     if(attackList.children.length<=1)return;row.remove();syncAttacks();
    });row.append(remove);attackList.append(row);
   }
   function loadAttacks(list){
    attackList.replaceChildren();for(const attack of list)attackRow(attack);syncAttacks();
   }
   attackAdd.addEventListener('click',()=>{
    let id;do{id='custom_'+(++attackCounter)}while(Array.from(attackList.children).some(row=>row._original.id===id));
    attackRow({id,name:'Ataque',ability:'str',damageCount:1,damageDie:4,
     damageType:'bludgeoning',rangeFt:5,proficient:false});syncAttacks();
   });
   attacks.addEventListener('change',()=>{
    try{const list=JSON.parse(attacks.value);if(Array.isArray(list)&&list.length)loadAttacks(list);}
    catch{/* El error de JSON se informa al guardar. */}
   });
   const error=doc.createElement('p');
   error.style.cssText='color:#fca5a5;min-height:18px;margin:0';error.setAttribute('role','alert');
   const footer=doc.createElement('div');footer.style.cssText='display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap';
   const cancel=doc.createElement('button');cancel.type='button';cancel.textContent=T.cancel||'Cancelar';
   const play=doc.createElement('button');play.type='submit';play.textContent=T.play||'Guardar e iniciar';
   for(const el of [cancel,play])el.style.cssText='min-height:44px;padding:8px 16px;border:1px solid #9ca3af;border-radius:5px;cursor:pointer';
   play.style.background='#23446e';play.style.color='white';
   footer.append(cancel,play);
   const classGrid=doc.createElement('div');classGrid.className='dnd-class-grid';
   const heading=doc.createElement('h3');
   const summary=doc.createElement('output');summary.className='dnd-summary';
   function button(label,action){
    const b=doc.createElement('button');b.type='button';b.textContent=label;
    b.addEventListener('click',action);return b;
   }
   const advanced=doc.createElement('details');
   const caption=doc.createElement('summary');caption.textContent=T.advanced;
   advanced.append(caption,fields,full);
   const change=button(T.changeClass,()=>showClasses());
   function showClasses(){
    heading.textContent=T.chooseClass;classGrid.hidden=false;identity.hidden=true;
    advanced.hidden=true;play.hidden=true;change.hidden=true;summary.hidden=true;
    classGrid.querySelector('button')?.focus();
   }
   function showCharacter(){
    heading.textContent=T.identity;classGrid.hidden=true;identity.hidden=false;
    advanced.hidden=false;play.hidden=false;change.hidden=false;summary.hidden=false;
    summary.textContent=[klass.selectedOptions[0]?.textContent,T.level+' '+level.value,
     'PG '+hp.value+'/'+maxHp.value,'CA '+ac.value].join(' · ');
   }
   for(const [id,label] of Object.entries(T.classes)){
    const card=button(label,()=>{
     klass.value=id;
     if(!choices.value){
      die.value=dieByClass[id];hp.value=maxHp.value=dieByClass[id];
     }
     showCharacter();name.focus();
    });
    const hint=doc.createElement('small');hint.textContent=T.classThemes[id];
    card.append(hint);classGrid.append(card);
   }
   advanced.addEventListener('input',showCharacter);
   play.textContent=T.enter;footer.prepend(change);
   form.append(roster,heading,classGrid,summary,identity,advanced,error,footer);
   title.textContent=T.title;
   panel.append(title,form);root.append(panel);doc.body.append(root);
   const defaultAttack=()=>[{id:'primary',name:'Ataque configurado',ability:'str',
    damageCount:1,damageDie:4,damageType:'bludgeoning',rangeFt:5,proficient:false}];
   function fill(record){
    const s=record?.sheet||null;
    name.value=s?.name||'';klass.value=s?.classId||'';
    if(s?.classId&&!klass.value){
     const option=doc.createElement('option');option.value=s.classId;option.textContent=s.classId;
     klass.append(option);klass.value=s.classId;
    }
    level.value=String(s?.level||1);background.value=s?.backgroundId||'custom';
    species.value=s?.speciesId||'custom';
    hp.value=String(s?.hp||1);maxHp.value=String(s?.maxHp||1);
    ac.value=String(s?.armorClass||10);speed.value=String(s?.speedFt??30);
    die.value=String(s?.hitDice?.sides||8);
    diceTotal.value=String(s?.hitDice?.total||1);
    diceAvail.value=String(s?.hitDice?.available??1);
    for(const id of sheet.ABILITIES){
     abilities[id].value=String(s?.abilities?.[id]??10);
     abilities[id].dispatchEvent(new Event('input'));
    }
    for(const [id,e] of Object.entries(saves))e.checked=!!s?.saveProficiencies?.includes(id);
    for(const [id,e] of Object.entries(skills))e.checked=!!s?.skillProficiencies?.includes(id);
    loadAttacks(s?.attacks||defaultAttack());
    features.value=JSON.stringify(s?.features||{},null,2);
    spellcasting.value=JSON.stringify(s?.spellcasting??null,null,2);
    error.textContent='';
   }
   function close(value){
    doc.removeEventListener('keydown',onKey);root.remove();resolve(value);
   }
   function onKey(event){
    if(event.key==='Escape'){event.preventDefault();close(null);}
   }
   doc.addEventListener('keydown',onKey);
   choices.addEventListener('change',()=>{
    fill(library.list().find(p=>p.id===choices.value));advanced.open=false;
    if(choices.value)showCharacter();else showClasses();
   });
   klass.addEventListener('change',()=>{if(!choices.value&&dieByClass[klass.value])die.value=String(dieByClass[klass.value]);});
   level.addEventListener('change',()=>{if(!choices.value){
    diceTotal.value=level.value;diceAvail.value=level.value;
   }});
   cancel.addEventListener('click',()=>close(null));
   form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
     const n=v=>Number(v.value);
     const previous=library.list().find(p=>p.id===choices.value);
     const attacksData=JSON.parse(attacks.value),featureData=JSON.parse(features.value),
      spellData=JSON.parse(spellcasting.value);
     const character=sheet.createCharacter({
      name:name.value,classId:klass.value,level:n(level),
      backgroundId:background.value.trim()||'custom',speciesId:species.value.trim()||'custom',
      abilities:Object.fromEntries(sheet.ABILITIES.map(id=>[id,n(abilities[id])])),
      hp:n(hp),maxHp:n(maxHp),armorClass:n(ac),speedFt:n(speed),
      hitDice:{sides:n(die),total:n(diceTotal),available:n(diceAvail)},
      saveProficiencies:Object.keys(saves).filter(id=>saves[id].checked),
      skillProficiencies:Object.keys(skills).filter(id=>skills[id].checked),
      expertise:previous?.sheet?.expertise||[],
      attacks:attacksData,activeAttackId:attacksData.some(a=>a.id===previous?.sheet?.activeAttackId)?
       previous.sheet.activeAttackId:attacksData[0]?.id,
      features:featureData,spellcasting:spellData,
      tools:previous?.sheet?.tools||[],languages:previous?.sheet?.languages||[],
      temporaryHp:previous?.sheet?.temporaryHp||0,
      deathSaves:previous?.sheet?.deathSaves||{successes:0,failures:0},
      conditions:previous?.sheet?.conditions||[],exhaustion:previous?.sheet?.exhaustion||0,
      senses:previous?.sheet?.senses||{},heroicInspiration:previous?.sheet?.heroicInspiration||false
     });
     const saved=library.upsert({id:previous?.id||null,name:character.name,character});
     close(saved);
    }catch(err){error.textContent=err?.message?.includes('STORAGE')?T.storageError:
      T.invalid||'Ficha no válida';}
   });
   fill(selected);
   if(selected){showCharacter();play.focus();}else showClasses();
  });
 }
 return Object.freeze({KEY,ACTIVE,registry,current,ensureCharacter});
});
