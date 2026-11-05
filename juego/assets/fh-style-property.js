/* Forest Horror · acabados y propiedad (forest-horror-map-v1).
 * Geometría de plano en casillas x/y; en el motor x/y se convierten a x/z.
 * Sin dependencia de Three.js, reutilizable por editor y juego. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FHStyleProperty=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TEXEL_PER_FOOT=8, MAX_PATTERNS=24, MAX_PNG_BYTES=12*1024, MAX_COLORS=16;
  const WALL_PRESETS=['ladrillo','concreto','estuco','metal-corrugado','pintura-lisa','tapiz','lambrin','azulejo'];
  const FLOOR_PRESETS=['madera','baldosa','concreto','alfombra','azulejo'];
  const FACES=['A','B'], COLOR=/^#[0-9a-fA-F]{6}$/;
  const xy=p=>({x:Number(p.x),y:Number(p.y??p.z)});
  const signed=(wall,p)=>{const a=xy(wall.a),b=xy(wall.b),v=xy(p);return (b.x-a.x)*(v.y-a.y)-(b.y-a.y)*(v.x-a.x);};
  function sideAt(wall,p){const n=signed(wall,p);return Math.abs(n)<1e-7?null:n>0?'A':'B';}
  function sample(wall,side,t=.5,d=.12){
    const a=xy(wall.a),b=xy(wall.b),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,k=side==='A'?1:-1;
    return {x:a.x+dx*t-dy/len*d*k,y:a.y+dy*t+dx/len*d*k};
  }
  function onEdge(p,a,b){
    const c=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    return Math.abs(c)<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
  }
  function inside(p,poly){
    if(!Array.isArray(poly)||poly.length<3)return false;
    p=xy(p);let yes=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=xy(poly[j]),b=xy(poly[i]);
      if(onEdge(p,a,b))return true;
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
    }
    return yes;
  }
  function polygonCenter(poly){return {x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length};}
  function closedLoops(items,kind,portalField){
    const edges=(items||[]).filter(i=>i.a&&i.b&&(i.type===kind||i[portalField]&&['door','peephole_door','window','opening'].includes(i.type)));
    const key=p=>p.x.toFixed(4)+','+p.y.toFixed(4);
    const joins=new Map();
    edges.forEach((e,i)=>{for(const p of [e.a,e.b]){const k=key(p);if(!joins.has(k))joins.set(k,[]);joins.get(k).push(i);}});
    const used=new Set(),loops=[];
    for(let first=0;first<edges.length;first++){
      if(used.has(first))continue;
      const group=new Set(),stack=[first];
      while(stack.length){const i=stack.pop();if(group.has(i))continue;group.add(i);
        for(const p of [edges[i].a,edges[i].b])for(const other of joins.get(key(p))||[])if(!group.has(other))stack.push(other);
      }
      group.forEach(i=>used.add(i));
      if([...group].some(i=>(joins.get(key(edges[i].a))||[]).length!==2||(joins.get(key(edges[i].b))||[]).length!==2))continue;
      let path=[xy(edges[first].a)],from=key(edges[first].a),at=key(edges[first].b),prev=first,n=0;
      while(at!==from&&n++<=group.size){const next=(joins.get(at)||[]).find(i=>i!==prev&&group.has(i));if(next===undefined)break;
        const e=edges[next],p=key(e.a)===at?e.b:e.a;path.push(xy(key(e.a)===at?e.a:e.b));at=key(p);prev=next;
      }
      if(at===from&&path.length>=3&&Math.abs(polygonArea(path))>.03)loops.push(path);
    }
    return loops;
  }
  function polygonArea(poly){let v=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];v+=a.x*b.y-b.x*a.y;}return v/2;}
  function buildings(map,floorId){
    const floor=(map.floors||[]).find(f=>f.id===floorId);
    const loops=floor?closedLoops(floor.items,'red_wall','roofBoundary'):[];
    return loops.map((polygon,i)=>({id:floorId+'_building_'+(i+1),floorId,polygon,ownerId:map.buildingOwnerId||''}));
  }
  function properties(map,floorId){
    return (map.properties||[]).filter(p=>p.floorId===floorId&&Array.isArray(p.polygon)&&p.polygon.length>=3);
  }
  function propertyAt(map,floorId,p){
    const matches=properties(map,floorId).filter(q=>inside(p,q.polygon));
    if(matches.length>1)return null; // negar permisos ante solapamientos ambiguos
    return matches[0]||null;
  }
  function buildingAt(map,floorId,p){return buildings(map,floorId).find(b=>inside(p,b.polygon))||null;}
  function reconcileProperties(map,floorId){
    const floor=(map.floors||[]).find(f=>f.id===floorId);
    if(!floor)return [];
    const loops=closedLoops(floor.items,'property_wall','propertyBoundary');
    const old=properties(map,floorId),others=(map.properties||[]).filter(p=>p.floorId!==floorId),used=new Set();
    const fresh=loops.map((polygon,i)=>{
      const c=polygonCenter(polygon);
      const match=old.find(p=>!used.has(p.id)&&inside(c,p.polygon))||old.find(p=>!used.has(p.id)&&inside(polygonCenter(p.polygon),polygon));
      if(match)used.add(match.id);
      return {id:match?.id||floorId+'_prop_'+(i+1),floorId,ownerId:match?.ownerId||'',polygon};
    });
    map.properties=others.concat(fresh);
    return fresh;
  }
  function style(st,fallback,kind='wall'){
    const ok=kind==='floor'?FLOOR_PRESETS:WALL_PRESETS;
    const x=st&&typeof st==='object'?st:{};
    return {preset:ok.includes(x.preset)?x.preset:fallback.preset,color:typeof x.color==='string'&&COLOR.test(x.color)?x.color.toUpperCase():fallback.color,
      pattern:typeof x.pattern==='string'&&/^[\w-]{1,48}$/.test(x.pattern)?x.pattern:null};
  }
  function wallStyle(map,floorId,wall,side){
    if(!FACES.includes(side))throw Error('Cara de muro inválida');
    const kind=wall.sideClass?.[side],interior=kind==='interior'||(kind!=='exterior'&&!!buildingAt(map,floorId,sample(wall,side)));
    const fallback=interior?{preset:'pintura-lisa',color:'#A49E91',pattern:null}:{preset:'ladrillo',color:'#96564C',pattern:null};
    if(wall.finish?.[side])return style(wall.finish[side],fallback);
    return wall.material!=null?{preset:'legacy',legacyMaterial:wall.material}:fallback;
  }
  function floorStyle(room){return style(room.surfaceStyle,{preset:'madera',color:'#846B52',pattern:null},'floor');}
  function authority(map,floorId,p){
    const prop=propertyAt(map,floorId,p);
    if(prop)return {id:'property:'+prop.id,ownerId:prop.ownerId};
    const building=buildingAt(map,floorId,p);
    if(building)return {id:'building:'+building.id,ownerId:building.ownerId};
    return {id:'outside:'+floorId,ownerId:map.buildingOwnerId||''};
  }
  function canPaintWall(map,floorId,wall,side,actor,isAdmin=false){
    if(isAdmin)return true;
    if(!actor||!FACES.includes(side))return false;
    const a=[.02,.5,.98].map(t=>authority(map,floorId,sample(wall,side,t)));
    return a.every(k=>k.ownerId===actor&&k.id===a[0].id);
  }
  function roomContains(room,p){
    if(room.spans?.length)return room.spans.some(s=>p.x>=s.x-1e-6&&p.x<=s.x+s.w+1e-6&&p.y>=s.y-1e-6&&p.y<=s.y+s.h+1e-6);
    return room.x<=p.x+1e-6&&room.y<=p.y+1e-6&&p.x<=room.x+room.w+1e-6&&p.y<=room.y+room.h+1e-6;
  }
  function roomInProperty(room,prop){
    const spans=room.spans?.length?room.spans:[room];
    return spans.every(s=>[[s.x+.001,s.y+.001],[s.x+s.w-.001,s.y+.001],[s.x+.001,s.y+s.h-.001],[s.x+s.w-.001,s.y+s.h-.001]].every(([x,y])=>inside({x,y},prop.polygon)));
  }
  function canPaintRoom(map,floorId,room,actor,isAdmin=false){
    if(isAdmin)return true;
    if(!actor)return false;
    const owners=properties(map,floorId).filter(prop=>roomInProperty(room,prop));
    if(owners.length===1)return owners[0].ownerId===actor;
    if(owners.length>1)return false;
    return !!map.buildingOwnerId&&map.buildingOwnerId===actor;
  }
  function paintWall(map,floorId,wall,side,next,actor,isAdmin=false){
    if(!canPaintWall(map,floorId,wall,side,actor,isAdmin))throw Error('No puedes pintar esa cara de muro');
    wall.finish??={};
    wall.finish[side]=style(next,wallStyle(map,floorId,wall,side).preset==='legacy'?
      {preset:'pintura-lisa',color:'#A49E91',pattern:null}:wallStyle(map,floorId,wall,side));
    return wall.finish[side];
  }
  function paintRoomWalls(map,floorId,room,next,actor,isAdmin=false){
    if(!canPaintRoom(map,floorId,room,actor,isAdmin))throw Error('Sin permiso para editar esta habitación');
    const floor=(map.floors||[]).find(f=>f.id===floorId);let count=0;
    for(const w of floor?.items||[]){if(!['wall','red_wall','property_wall','half_wall'].includes(w.type)||!w.a||!w.b)continue;
      for(const side of FACES)if([.02,.5,.98].every(t=>roomContains(room,sample(w,side,t)))&&canPaintWall(map,floorId,w,side,actor,isAdmin)){paintWall(map,floorId,w,side,next,actor,isAdmin);count++;}
    }
    return count;
  }
  function paintFloor(map,floorId,room,next,actor,isAdmin=false){
    if(!canPaintRoom(map,floorId,room,actor,isAdmin))throw Error('Sin permiso para pintar el suelo');
    return room.surfaceStyle=style(next,floorStyle(room),'floor');
  }
  function segmentIntersection(a,b,c,d){
    const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,den=ax*by-ay*bx;
    if(Math.abs(den)<1e-9)return null;const cx=c.x-a.x,cy=c.y-a.y;
    const t=(cx*by-cy*bx)/den,u=(cx*ay-cy*ax)/den;
    return t>1e-5&&t<1-1e-5&&u>=-1e-5&&u<=1+1e-5?t:null;
  }
  function splitAtPropertyLimits(map,floorId,makeId){
    const floor=(map.floors||[]).find(f=>f.id===floorId),polys=properties(map,floorId);
    if(!floor||!polys.length)return 0;let splits=0,updated=[];
    for(const item of floor.items){
      if(!['wall','red_wall','half_wall','property_wall'].includes(item.type)||!item.a||!item.b){updated.push(item);continue;}
      const aa=xy(item.a),bb=xy(item.b),cuts=[0,1];
      for(const prop of polys)for(let i=0;i<prop.polygon.length;i++){
        const t=segmentIntersection(aa,bb,xy(prop.polygon[i]),xy(prop.polygon[(i+1)%prop.polygon.length]));
        if(t!==null&&!cuts.some(x=>Math.abs(x-t)<1e-5))cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);
      if(cuts.length<=2){updated.push(item);continue;}
      for(let k=1;k<cuts.length;k++){
        const s=cuts[k-1],t=cuts[k];if(t-s<1e-5)continue;
        const piece={...item,a:{x:aa.x+(bb.x-aa.x)*s,y:aa.y+(bb.y-aa.y)*s},b:{x:aa.x+(bb.x-aa.x)*t,y:aa.y+(bb.y-aa.y)*t}};
        if(k>1)piece.id=makeId();updated.push(piece);
      }
      splits+=cuts.length-2;
    }
    floor.items=updated;return splits;
  }
  function pngInfo(uri){
    if(typeof uri!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(uri))throw Error('El patrón no es un PNG base64');
    const s=uri.split(',')[1];if(s.length*3/4>MAX_PNG_BYTES+2)throw Error('PNG demasiado grande');
    const bytes=typeof Buffer!=='undefined'?Buffer.from(s,'base64'):Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    if(bytes.length>MAX_PNG_BYTES||bytes.length<24||[137,80,78,71,13,10,26,10].some((n,i)=>bytes[i]!==n))throw Error('PNG no válido');
    const u32=i=>bytes[i]*16777216+bytes[i+1]*65536+bytes[i+2]*256+bytes[i+3];
    const w=u32(16),h=u32(20);if(![16,32].includes(w)||w!==h)throw Error('El mosaico debe ser 16×16 o 32×32');
    return {width:w,height:h,bytes:bytes.length};
  }
  function validatePatterns(patterns){
    if(!Array.isArray(patterns)||patterns.length>MAX_PATTERNS)throw Error('Máximo 24 patrones');
    const ids=new Set();
    for(const p of patterns){if(!p||typeof p.id!=='string'||!/^[\w-]{1,48}$/.test(p.id)||ids.has(p.id))throw Error('ID de patrón inválido o repetido');
      ids.add(p.id);const meta=pngInfo(p.png);if(p.width&&p.width!==meta.width||p.height&&p.height!==meta.height)throw Error('Tamaño de patrón distinto del PNG');
    }
    return true;
  }
  function validateMap(map){if(map?.patterns)validatePatterns(map.patterns);return map;}
  return Object.freeze({TEXEL_PER_FOOT,MAX_PATTERNS,MAX_PNG_BYTES,MAX_COLORS,WALL_PRESETS,FLOOR_PRESETS,
    sideAt,sample,inside,closedLoops,buildings,properties,propertyAt,buildingAt,reconcileProperties,style,wallStyle,floorStyle,
    canPaintWall,canPaintRoom,paintWall,paintRoomWalls,paintFloor,roomContains,roomInProperty,splitAtPropertyLimits,
    pngInfo,validatePatterns,validateMap});
});
