/* El mapa define la cuadrícula; la imagen es una referencia opcional e independiente. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHMapGrid=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
 const dimension=value=>Math.max(1,Math.min(500,Math.round(number(value,40)||40)));
 const cellSize=units=>Math.max(8,Math.min(300,number(units?.gridPx,70)||70));
 function bounds(units){
  const cell=cellSize(units);
  return {x:number(units?.originPx?.x,0),y:number(units?.originPx?.y,0),width:dimension(units?.columns)*cell,height:dimension(units?.rows)*cell};
 }
 function referenceRect(units,reference={}){
  const area=bounds(units),cell=cellSize(units),ratio=Math.max(1,number(reference.width,1))/Math.max(1,number(reference.height,1));
  const autoWidth=Math.min(area.width,area.height*ratio)/cell;
  const width=Math.max(.01,number(reference.widthCells,autoWidth))*cell;
  return {x:area.x+number(reference.xCells,0)*cell,y:area.y+number(reference.yCells,0)*cell,width,height:width/ratio};
 }
 function normalize(project){
  const units=project.units??={};
  units.columns=dimension(units.columns);units.rows=dimension(units.rows);
  units.gridPx=cellSize(units);units.fitGridToImage=false;
  units.originPx={x:number(units.originPx?.x,0),y:number(units.originPx?.y,0)};
  for(const floor of project.floors||[]){
   floor.reference??={name:'',data:'',width:1,height:1,opacity:.73};
   const ref=floor.reference;
   if(!(number(ref.widthCells,0)>0))ref.widthCells=referenceRect(units,ref).width/units.gridPx;
  }
  return project;
 }
 return {cellSize,bounds,referenceRect,normalize};
});
