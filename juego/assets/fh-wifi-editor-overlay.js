/* Blakpine-Wood: cobertura Wi-Fi visible solo al seleccionar un router en Redes. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHWifiEditorOverlay=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_SAMPLES_PER_AXIS=80;
 const COLORS=Object.freeze({1:'#e66b68',2:'#f2c35c',3:'#3bc48d'});
 let cache={key:null,coverage:null,image:null,legendKey:null};

 function signature(project,floorIndex,routerId){
  // No incluir imágenes Base64, historial ni estado del juego en la clave.
  return JSON.stringify([floorIndex,routerId,project.units?.feetPerCell,
   project.units?.columns,project.units?.rows,
   (project.floors||[]).map(f=>[f.id,f.elevationFt,f.items||[]])]);
 }
 function computeCoverage(project,floorIndex,routerId,services=root.FHServices){
  const floor=project?.floors?.[floorIndex];
  const router=floor?.items?.find(it=>it.type==='router'&&String(it.id)===String(routerId));
  if(!router||!services?.createRuntime)return null;
  const runtime=services.createRuntime(project,{});
  const powered=runtime.statusFor(floorIndex,router).power.powered===true;
  const ft=Math.max(.1,Number(project.units?.feetPerCell)||5);
  const columns=Math.max(1,Math.min(500,Math.floor(Number(project.units?.columns)||1)));
  const rows=Math.max(1,Math.min(500,Math.floor(Number(project.units?.rows)||1)));
  const radius=Math.max(1,Number(router.wifiRadiusFt??120))/ft;
  const rx=Number(router.x)||0,ry=Number(router.y)||0;
  const x0=Math.max(0,Math.floor(rx-radius)),y0=Math.max(0,Math.floor(ry-radius));
  const x1=Math.min(columns,Math.ceil(rx+radius)),y1=Math.min(rows,Math.ceil(ry+radius));
  const extent=Math.max(0,x1-x0,y1-y0);
  const step=Math.max(1,Math.ceil(extent/MAX_SAMPLES_PER_AXIS));
  const width=Math.max(0,Math.ceil((x1-x0)/step));
  const height=Math.max(0,Math.ceil((y1-y0)/step));
  const bars=new Uint8Array(width*height);
  let covered=0;
  if(powered&&width&&height){
   const sample=runtime.wifiSampler(routerId);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const atX=Math.min(x1-1e-6,x0+(x+.5)*step);
    const atY=Math.min(y1-1e-6,y0+(y+.5)*step);
    const strength=sample(floorIndex,atX,atY)?.bars||0;
    bars[y*width+x]=strength;
    if(strength)covered++;
   }
  }
  return {routerId:String(routerId),powered,covered,bars,x0,y0,width,height,step};
 }
 function createImage(doc,coverage){
  if(!coverage?.covered||!doc?.createElement)return null;
  const canvas=doc.createElement('canvas');
  canvas.width=coverage.width;canvas.height=coverage.height;
  const c=canvas.getContext('2d');
  if(!c)return null;
  const image=c.createImageData(canvas.width,canvas.height);
  const rgb={1:[230,107,104],2:[242,195,92],3:[59,196,141]};
  for(let i=0;i<coverage.bars.length;i++){
   const color=rgb[coverage.bars[i]];
   if(!color)continue;
   const offset=i*4;
   image.data[offset]=color[0];image.data[offset+1]=color[1];
   image.data[offset+2]=color[2];image.data[offset+3]=180;
  }
  c.putImageData(image,0,0);
  return canvas;
 }
 function hide(){
  const node=root.document?.getElementById('wifiCoverageLegend');
  if(node)node.hidden=true;
 }
 function syncLegend(router,coverage){
  const node=root.document?.getElementById('wifiCoverageLegend');
  if(!node)return;
  const words=root.FH_SERVICES_TEXT?.wifiCoverage||{};
  const key=JSON.stringify([router.id,router.label,coverage.powered,coverage.covered]);
  node.hidden=false;
  if(cache.legendKey===key)return;
  cache.legendKey=key;
  node.replaceChildren();
  const title=root.document.createElement('strong');
  title.textContent=(words.title||'Cobertura Wi-Fi')+' · '+(router.label||router.id);
  node.append(title);
  if(!coverage.powered||!coverage.covered){
   const note=root.document.createElement('span');
   note.textContent=!coverage.powered?(words.noPower||'Router sin electricidad.'):(words.none||'Sin señal en esta zona.');
   node.append(note);
   return;
  }
  const marks=root.document.createElement('div');
  marks.className='wifi-coverage-bands';
  for(const level of [3,2,1]){
   const part=root.document.createElement('span'),color=root.document.createElement('i');
   color.style.background=COLORS[level];
   color.setAttribute('aria-hidden','true');
   part.append(color,root.document.createTextNode(words['bars'+level]||level+' barras'));
   marks.append(part);
  }
  node.append(marks);
 }
 function draw(c,options){
  const {project,floorIndex,router,toPixel,gridX,gridY}=options||{};
  if(!router||router.type!=='router'){hide();return null;}
  const key=signature(project,floorIndex,router.id);
  if(cache.key!==key){
   cache.key=key;cache.coverage=computeCoverage(project,floorIndex,router.id);
   cache.image=createImage(root.document,cache.coverage);
   cache.legendKey=null;
  }
  const coverage=cache.coverage;
  if(!coverage){hide();return null;}
  if(cache.image){
   const start=toPixel({x:coverage.x0,y:coverage.y0});
   c.save();c.imageSmoothingEnabled=false;c.globalAlpha=.52;
   c.drawImage(cache.image,start.x,start.y,
    coverage.width*coverage.step*gridX,coverage.height*coverage.step*gridY);
   c.restore();
  }
  syncLegend(router,coverage);
  return coverage;
 }
 return Object.freeze({COLORS,computeCoverage,draw,hide});
});
