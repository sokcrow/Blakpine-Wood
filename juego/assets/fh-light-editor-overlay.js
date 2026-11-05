/* Forest Horror — vista de fusión de luz en el editor; no modifica el mapa. */
(function(root){
 'use strict';
 let cache={key:null,mask:null,canvas:null};
 function obtain(){
  if(!root.FHLightCoverage)return null;
  const items=current().items.filter(it=>['light_fixture','red_wall','wall','door','peephole_door'].includes(it.type));
  const key=JSON.stringify([current().id,project.units.columns,project.units.rows,project.units.feetPerCell,items]);
  if(cache.key===key)return cache;
  const coverage=root.FHLightCoverage.compute(current(),project.units,{presetFor:root.FHLights?.presetFor});
  const image=document.createElement('canvas');image.width=coverage.width;image.height=coverage.height;
  const context=image.getContext('2d'),imageData=context.createImageData(coverage.width,coverage.height);
  const {width,height,mask}=coverage;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x,p=i*4;
   if(mask[i]){
    const boundary=x===0||y===0||x===width-1||y===height-1||
     !mask[i-1]||!mask[i+1]||!mask[i-width]||!mask[i+width];
    imageData.data[p]=boundary?255:240;
    imageData.data[p+1]=boundary?223:199;
    imageData.data[p+2]=boundary?139:90;
    imageData.data[p+3]=boundary?150:55;
   }else{
    imageData.data[p]=14;imageData.data[p+1]=24;imageData.data[p+2]=38;imageData.data[p+3]=101;
   }
  }
  context.putImageData(imageData,0,0);
  cache={key,mask:coverage,canvas:image};
  return cache;
 }
 function draw(c,z){
  const state=obtain();
  if(!state)return;
  const origin=toPixel({x:0,y:0});
  c.save();
  c.imageSmoothingEnabled=false;
  c.drawImage(state.canvas,origin.x,origin.y,project.units.columns*gridX(),project.units.rows*gridY());
  const rooms=current().items.filter(it=>it.type==='room');
  for(const room of rooms){
   const report=state.mask.roomCoverage(room);
   if(report.total<4)continue;
   const center=toPixel(room.spans?.length?roomShapeCenter(room):areaCenter(room));
   const message=report.percent+'% luz';
   c.font='700 '+(10/z)+'px ui-monospace,monospace';c.textAlign='center';c.textBaseline='middle';
   const w=Math.max(46/z,c.measureText(message).width+10/z),h=18/z;
   c.fillStyle='rgba(10,18,29,.83)';
   c.fillRect(center.x-w/2,center.y-h/2,w,h);
   c.fillStyle=report.percent>=90?'#c6f3c3':report.percent>=60?'#ffdf94':'#ff9c91';
   c.fillText(message,center.x,center.y);
  }
  c.restore();
 }
 root.FHLightEditorOverlay=Object.freeze({draw,coverage:()=>obtain()?.mask||null});
})(window);
