/* Hooks acotados: conserva motor Base64, colisión, FOW y corte de cámara. */
(function(root){
 'use strict';
 function patch(doc){
  const one=(before,after)=>{
   const count=doc.split(before).length-1;
   if(count!==1)throw Error('Hook azoteas incompatible ('+count+'): '+before.slice(0,70));
   doc=doc.replace(before,()=>after);
  };
  one('const DATA=window.ForestHorrorLoadedMap;',
   'const DATA=window.ForestHorrorLoadedMap;\nconst fhRoofSaveKey=ForestShared.gameSaveKey(DATA);\nwindow.FHRoof.prepareRuntime(DATA,window.FH_ROOF_TEXT.cap);');
  one('const SAVE_KEY=ForestShared.gameSaveKey(DATA);','const SAVE_KEY=fhRoofSaveKey;');
  one('const isBuilt=DATA.floors.map(',
   'const FH_ROOF_PLANS=window.FHRoof.plans(DATA,SLABS);\nconst fhRoofObjects=DATA.floors.map(()=>[]);\nconst isBuilt=DATA.floors.map(');
  one('function areaSurfaceGrid(f,x,y,w,h,m,ypos){',String.raw`function areaSurfaceGrid(f,x,y,w,h,m,ypos){
 const roof=FH_ROOF_PLANS[f];
 if(roof){
  // Los rellenos de habitaciones y suelos no cambian una azotea a interior.
  for(const sp of window.FHRoof.difference([{x,y,w,h}],roof.spans))
   for(const r of surfaceRectsMinusVoids(f,sp.x,sp.y,sp.w,sp.h))surfaceGrid(f,r.x,r.y,r.w,r.h,m,ypos);
  return;
 }
`);
  const surface='if(f>0&&SLABS[f].enabled)for(const sp of SLABS[f].spans)for(const r of surfaceRectsMinusVoids(f,sp.x,sp.y,sp.w,sp.h))surfaceGrid(f,r.x,r.y,r.w,r.h,ART_FLOOR_MAT,.018);';
  one(surface,String.raw`
 const roof=FH_ROOF_PLANS[f];
 if(f>0&&SLABS[f].enabled){
  const interiorSpans=roof?roof.interiorSpans:SLABS[f].spans;
  for(const sp of interiorSpans)for(const r of surfaceRectsMinusVoids(f,sp.x,sp.y,sp.w,sp.h))surfaceGrid(f,r.x,r.y,r.w,r.h,ART_FLOOR_MAT,.018);
 }
 if(roof&&roof.spans.length){
  const roofMat=window.FHStyleRuntime.roomMaterial(THREE,{type:'concrete',surfaceStyle:roof.floor},DATA);
  for(const sp of roof.spans)for(const r of surfaceRectsMinusVoids(f,sp.x,sp.y,sp.w,sp.h)){
   const mesh=surfaceGrid(f,r.x,r.y,r.w,r.h,roofMat,.021);
   mesh.userData.fhRoofSurface=true;mesh.userData.fhStructuralSlab=true;registerCutaway(f,mesh);
   fhRoofObjects[f].push({source:mesh,item:{...r,type:'roof_surface'}});
  }
  const height=roof.parapetHeightTiles*CELL;
  if(height>0){
   const mat=new THREE.MeshLambertMaterial({color:roof.wall.color});
   for(const edge of roof.edges){
    const item={...edge,type:'roof_parapet',finish:{A:roof.wall,B:roof.wall}};
    const mesh=wallModel(f,edge.a,edge.b,{height,y:.021,mat,it:item,opaque:height>=1.75});
    if(mesh){mesh.userData.fhRoofParapet=true;fhRoofObjects[f].push({source:mesh,item});}
   }
  }
 }
`);
  one('// Perfil del borde de la losa:',String.raw`
for(let f=0;f<fhRoofObjects.length;f++)for(const {source,item} of fhRoofObjects[f]){
 const clone=source.clone(true);clone.position.y+=floorElev[f];exteriorLayers[f].add(clone);
 exteriorProxies.push({source,clone,f,item});
 clone.userData.fhOcclusionRoot=true;exteriorCutawayRoots.push({root:clone,f});
}
// Perfil del borde de la losa:`);
  const tags=['fh-roof-strings.js','fh-roof.js'].map(file=>
   '<script src="'+new URL('./juego/assets/'+file+'?v=20261110-roof2',root.document.baseURI).href+'"></'+'script>').join('');
  if(!doc.includes('</head>'))throw Error('Falta cabecera del motor para azoteas');
  doc=doc.replace('</head>',()=>tags+'</head>');
  return doc;
 }
 root.FHRoofEngine=Object.freeze({patch});
})(typeof window!=='undefined'?window:globalThis);
