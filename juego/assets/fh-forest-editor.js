/* El editor sólo escribe configuración/exclusiones; no escribe estados de tala. */
(function(root){
 'use strict';
 function install({project,record,modal,closeModal,toast}={}){
  const bar=root.document?.getElementById('subbar');if(!bar||root.document.getElementById('fhForestSettings'))return;
  const T=root.FH_FOREST_TEXT,button=root.document.createElement('button');button.id='fhForestSettings';button.textContent=T.button;bar.append(button);
  button.onclick=()=>{
   const p=project(),cfg=root.FHTerrain.config(p.environment),input=(id,label,type='text',extra='')=>'<label>'+label+'<input id="'+id+'" type="'+type+'" '+extra+'></label>';
   modal('<h2>'+T.title+'</h2><p>'+T.explanation+'</p>'+input('fhForestEnabled',T.enabled,'checkbox')+
    input('fhTerrainSeed',T.terrainSeed,'text','maxlength="120"')+input('fhForestSeed',T.forestSeed,'text','maxlength="120"')+
    input('fhTerrainAmplitude',T.amplitude,'number','min="0" max="6" step=".1"')+input('fhTerrainWave',T.wavelength,'number','min="20" max="300"')+
    input('fhForestDensity',T.density,'number','min="0" max="1" step=".05"')+input('fhForestSpacing',T.spacing,'number','min="2.5" max="20" step=".5"')+
    input('fhForestSnow',T.snow,'checkbox')+'<label>'+T.exclusions+'<textarea id="fhForestExclusions" rows="3"></textarea></label>'+
    '<button id="fhForestPreview">'+T.preview+'</button><p>'+T.previewHelp+'</p><canvas id="fhForestCanvas" width="600" height="400" style="width:100%;max-width:600px;touch-action:manipulation"></canvas>'+
    '<p id="fhForestSummary" aria-live="polite"></p>'+input('fhForestSelected',T.selected,'text','readonly')+
    '<button id="fhForestExclude" disabled>'+T.exclude+'</button><div class="actions"><button id="fhForestSave" class="primary">'+T.save+'</button><button id="fhForestCancel">'+T.cancel+'</button></div>',()=>{
    const get=id=>root.document.getElementById(id);
    get('fhForestEnabled').checked=cfg.enabled;get('fhForestSnow').checked=cfg.forest.snow;
    for(const [id,value] of Object.entries({fhTerrainSeed:cfg.terrain.seed,fhForestSeed:cfg.forest.seed,fhTerrainAmplitude:cfg.terrain.amplitudeM,fhTerrainWave:cfg.terrain.wavelengthM,fhForestDensity:cfg.forest.density,fhForestSpacing:cfg.forest.spacingM,fhForestExclusions:cfg.forest.exclusions.join('\n')}))get(id).value=value;
    function read(){return root.FHTerrain.config({...cfg,enabled:get('fhForestEnabled').checked,
     terrain:{...cfg.terrain,seed:get('fhTerrainSeed').value,amplitudeM:Number(get('fhTerrainAmplitude').value),wavelengthM:Number(get('fhTerrainWave').value)},
     forest:{...cfg.forest,seed:get('fhForestSeed').value,density:Number(get('fhForestDensity').value),spacingM:Number(get('fhForestSpacing').value),snow:get('fhForestSnow').checked,exclusions:get('fhForestExclusions').value.split(/\s+/).filter(Boolean)}});}
    let preview=null,scale=1,offsetX=0,offsetZ=0;
    function draw(){
     try{
      preview=root.FHForest.createRuntime({...p,environment:read()},{});
      const c=get('fhForestCanvas'),ctx=c.getContext('2d'),t=preview.terrain;
      scale=Math.min(c.width/t.width,c.height/t.depth);offsetX=(c.width-t.width*scale)/2;offsetZ=(c.height-t.depth*scale)/2;
      ctx.fillStyle='#0c100d';ctx.fillRect(0,0,c.width,c.height);
      for(let z=0;z<c.height;z+=4)for(let x=0;x<c.width;x+=4){
       const px=(x-offsetX)/scale,pz=(z-offsetZ)/scale;
       if(px<0||pz<0||px>t.width||pz>t.depth)continue;
       const h=t.heightAt(px,pz),light=Math.max(15,Math.min(55,32+h*8));
       ctx.fillStyle=t.reservedAt(px,pz)?'#5b5b52':'hsl(90,18%,'+light+'%)';ctx.fillRect(x,z,4,4);
      }
      ctx.fillStyle='#b5d394';for(const tree of preview.trees){ctx.beginPath();ctx.arc(offsetX+tree.x*scale,offsetZ+tree.z*scale,Math.max(1.4,tree.radius*scale),0,Math.PI*2);ctx.fill();}
      get('fhForestSummary').textContent=T.summary(preview.trees.length);get('fhForestSelected').value='';get('fhForestExclude').disabled=true;
     }catch(error){toast?.(error.message||T.invalid);}
    }
    get('fhForestCanvas').onclick=event=>{
     if(!preview)return;const c=get('fhForestCanvas'),r=c.getBoundingClientRect(),x=((event.clientX-r.left)*c.width/r.width-offsetX)/scale,z=((event.clientY-r.top)*c.height/r.height-offsetZ)/scale;
     const tree=preview.nearby(x,z,8/scale).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
     get('fhForestSelected').value=tree?.id||'';get('fhForestExclude').disabled=!tree;
    };
    get('fhForestExclude').onclick=()=>{const id=get('fhForestSelected').value;if(id){get('fhForestExclusions').value+='\n'+id;draw();}};
    get('fhForestPreview').onclick=draw;get('fhForestCancel').onclick=closeModal;
    get('fhForestSave').onclick=()=>{try{const environment=read();root.FHForest.createRuntime({...p,environment},{});p.environment=environment;record();closeModal();toast?.(T.saved);}catch(error){toast?.(error.message||T.invalid);}};
    draw();
   });
  };
 }
 root.FHForestEditor=Object.freeze({install});
})(typeof globalThis!=='undefined'?globalThis:this);
