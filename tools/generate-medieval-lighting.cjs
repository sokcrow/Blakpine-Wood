/* Generador sin dependencias: Node.js / geometría en metros, dimensiones fuente en pies. */
const buildMedievalLights=function buildMedievalLights(){
 const defs=[
 ["antorcha_pared_medieval","Antorcha de pared","Iluminación","AP",1.1,1.0,2.3,"Antorcha de pared con soporte forjado.",["antorcha","pared"]],
 ["antorcha_mano_medieval","Antorcha de mano","Iluminación","AM",.7,.7,3.3,"Antorcha portátil de madera y tela.",["portatil","antorcha"]],
 ["vela_medieval","Vela","Iluminación","VE",.55,.55,1.0,"Vela sencilla con plato metálico.",["vela","cera"]],
 ["candelabro_medieval","Candelabro","Iluminación","CD",2.2,1.4,4,"Candelabro de hierro con tres portavelas.",["candelabro","hierro"]],
 ["farol_aceite_medieval","Farol de aceite","Iluminación","FA",1.2,1.2,1.9,"Farol de aceite con marco y cristal.",["farol","aceite"]],
 ["brasero_medieval","Brasero","Iluminación","BR",2.5,2.5,2.4,"Brasero de hierro con carbón.",["brasero","carbon"]],
 ["fogata_medieval","Fogata","Iluminación","FO",4,4,1.2,"Fogata con troncos y círculo de piedras.",["fogata","leña"]],
 ["chimenea_medieval","Chimenea","Iluminación","CH",4.2,2.1,5,"Hogar de piedra y tiro de chimenea.",["chimenea","piedra"]],
 ["cristal_magico_medieval","Cristal mágico","Iluminación","CM",2.1,2.1,3.1,"Cristal facetado sobre pedestal antiguo.",["magia","cristal"]]
 ].map(([id,name,category,shortCode,widthFt,depthFt,heightFt,description,extra])=>({
  id,name,category,shortCode,widthFt,depthFt,heightFt,description,
  tags:["medieval","fantasia",...extra],environment:"interior",blocksMovement:!["antorcha_pared_medieval","antorcha_mano_medieval","vela_medieval","candelabro_medieval","farol_aceite_medieval"].includes(id),
  pack:"medieval_lighting_01",ambientations:["medieval"],glb:"modelos_glb/"+id+".glb",thumbnail:"miniaturas/"+id+".png"
 }));
 const pal=[[104,68,45],[69,48,34],[141,99,59],[165,123,75],[61,62,60],[194,147,64],[158,150,124],[111,94,72],[119,74,49],[106,77,43],[91,95,94],[57,40,29],[155,125,81],[146,71,40],[61,173,192],[40,44,46]];
 const enc=s=>{const out=[];for(const c of s){let n=c.codePointAt(0);if(n<128)out.push(n);else if(n<2048)out.push(192|(n>>6),128|(n&63));else if(n<65536)out.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else out.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return Uint8Array.from(out);};
 const cat=parts=>{let n=0;for(const p of parts)n+=p.length;const b=new Uint8Array(n);let j=0;for(const p of parts){b.set(p,j);j+=p.length;}return b;};
 const be=n=>Uint8Array.of(n>>>24&255,n>>>16&255,n>>>8&255,n&255);
 const le=n=>Uint8Array.of(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
 const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const ck=(n,d)=>{const c=enc(n);return cat([be(d.length),c,d,be(crc(cat([c,d])))]);};
 const png=(w,h,p)=>{
  const b=new Uint8Array(h*(w*4+1));for(let y=0;y<h;y++)b.set(p.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);
  const blocks=[Uint8Array.of(120,1)];for(let at=0;at<b.length;){const n=Math.min(65535,b.length-at);blocks.push(Uint8Array.of(at+n===b.length?1:0,n&255,n>>8&255,~n&255,~n>>8&255),b.subarray(at,at+n));at+=n;}
  let a=1,z=0;for(const v of b){a=(a+v)%65521;z=(z+a)%65521;}blocks.push(be(((z<<16)|a)>>>0));
  return cat([Uint8Array.of(137,80,78,71,13,10,26,10),ck("IHDR",cat([be(w),be(h),Uint8Array.of(8,6,0,0,0)])),ck("IDAT",cat(blocks)),ck("IEND",new Uint8Array())]);
 };
 const tex=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const t=(x>>4)+4*(y>>4),xx=x%16,yy=y%16,n=((x*17+y*31+(x*y%17)*13+t*7)%17)-8;let grain=0;
   if([0,1,2,3,8,9,11].includes(t))grain=(xx%5===0?-18:0)+(yy%7===0?-7:0)+(xx%5===1?5:0);
   else if(t===5)grain=((xx+yy)%3===0?21:-7)+(xx%4===0?8:0);
   else if(t===4||t===15)grain=yy%6===0?10:-2;
   else if(t===6||t===13||t===14)grain=(xx+yy)%4===0?9:-2;
   else if(t===12)grain=xx%3===0?15:-5;
   else grain=(xx+yy*2)%5===0?10:-4;
   const j=(y*64+x)*4;for(let k=0;k<3;k++)tex[j+k]=Math.max(0,Math.min(255,pal[t][k]+n+grain));tex[j+3]=255;
 }
 const texture=png(64,64,tex);
 function mesh(){
  const P=[],N=[],U=[],I=[],ft=.3048;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const len=Math.hypot(...a)||1;return a.map(x=>x/len);};
  function vertex(p,n,t,j){P.push(p[0]*ft,p[1]*ft,p[2]*ft);N.push(...n);const col=t%4,row=t>>2,uu=[.65,15.35,15.35,.65],vv=[15.35,15.35,.65,.65];U.push((col*16+uu[j])/64,(row*16+vv[j])/64);}
  function quad(a,b,c,d,t){const n=unit(cross(sub(b,a),sub(d,a))),v=P.length/3;vertex(a,n,t,0);vertex(b,n,t,1);vertex(c,n,t,2);vertex(d,n,t,3);I.push(v,v+1,v+2,v,v+2,v+3);}
  function tri(a,b,c,t){const n=unit(cross(sub(b,a),sub(c,a))),v=P.length/3;vertex(a,n,t,0);vertex(b,n,t,1);vertex(c,n,t,2);I.push(v,v+1,v+2);}
  function box(x,y,z,w,h,d,t=0,top=t){const l=x-w/2,r=x+w/2,b=y,T=y+h,f=z+d/2,k=z-d/2;quad([l,b,f],[r,b,f],[r,T,f],[l,T,f],t);quad([r,b,k],[l,b,k],[l,T,k],[r,T,k],t);quad([r,b,f],[r,b,k],[r,T,k],[r,T,f],t);quad([l,b,k],[l,b,f],[l,T,f],[l,T,k],t);quad([l,T,f],[r,T,f],[r,T,k],[l,T,k],top);quad([l,b,k],[r,b,k],[r,b,f],[l,b,f],t);}
  function beam(a,b,w,t){const axis=unit(sub(b,a));let side=unit(cross(axis,[0,0,1]));if(Math.hypot(...side)<.01)side=[1,0,0];const up=unit(cross(axis,side));const v=(p,s,u)=>p.map((x,i)=>x+s*side[i]*w/2+u*up[i]*w/2);
    const A=v(a,1,1),B=v(a,-1,1),C=v(a,-1,-1),D=v(a,1,-1),E=v(b,1,1),F=v(b,-1,1),G=v(b,-1,-1),H=v(b,1,-1);
    quad(A,E,F,B,t);quad(D,C,G,H,t);quad(A,D,H,E,t);quad(B,F,G,C,t);quad(E,H,G,F,t);quad(A,B,C,D,t);
  }
  const cp=(x,y,z,axis,p,r,a)=>axis==="y"?[x+r*Math.cos(a),p,z+r*Math.sin(a)]:[p,y+r*Math.cos(a),z+r*Math.sin(a)];
  function cask(x,y,z,axis,len,r){
    const n=16,st=[0,.13,.42,.58,.87,1],rs=[.83,.93,1.04,1.04,.93,.83],low=(axis==="y"?y:x)-len/2;
    for(let j=0;j<5;j++)for(let i=0;i<n;i++){
     const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,p=cp(x,y,z,axis,low+st[j]*len,r*rs[j],a),q=cp(x,y,z,axis,low+st[j]*len,r*rs[j],b),s=cp(x,y,z,axis,low+st[j+1]*len,r*rs[j+1],b),t=cp(x,y,z,axis,low+st[j+1]*len,r*rs[j+1],a);
     axis==="y"?quad(q,p,t,s,i%3?0:8):quad(p,q,s,t,i%3?2:8);
    }
    for(const flip of [false,true]){
     const v=low+(flip?len:0),center=axis==="y"?[x,v,z]:[v,y,z];
     for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,p=cp(x,y,z,axis,v,r*.84,a),q=cp(x,y,z,axis,v,r*.84,b);flip?tri(center,q,p,3):tri(center,p,q,3);}
    }
    for(const [f,rr] of [[.12,.92],[.48,1.043],[.88,.92]])for(let i=0;i<n;i++){
     const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,v=low+f*len,R=r*(rr+.019);
     const p=cp(x,y,z,axis,v-len*.026,R,a),q=cp(x,y,z,axis,v-len*.026,R,b),s=cp(x,y,z,axis,v+len*.026,R,b),t=cp(x,y,z,axis,v+len*.026,R,a);
     axis==="y"?quad(q,p,t,s,4):quad(p,q,s,t,4);
    }
  }
  function jar(x,y,z,r,h){for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5;quad([x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(b),y,z+r*Math.sin(b)],[x+r*.68*Math.cos(b),y+h,z+r*.68*Math.sin(b)],[x+r*.68*Math.cos(a),y+h,z+r*.68*Math.sin(a)],7);}}
  return {P,N,U,I,box,beam,quad,tri,cask,jar};
 }
 function sculpt(m,d){
 const {id}=d,B=m.box,T=m.beam;
 if(id==="antorcha_pared_medieval"){
  B(0,.25,-.20,.22,.34,.25,4);B(0,.62,-.17,.17,.09,.75,4);
  T([0,.64,.06],[0,1.94,.18],.15,8);
  B(0,1.90,.18,.31,.34,.27,9);B(0,2.25,.18,.44,.06,.40,4);
  for(const x of [-.14,.14])T([x,1.9,.12],[x,2.19,.1],.065,4);
 }
 if(id==="antorcha_mano_medieval"){
  T([0,.03,0],[0,3.16,0],.18,0);
  for(const y of [2.37,2.62,2.87])B(0,y,0,.32,.22,.32,12);
  B(0,3.1,0,.35,.08,.35,4);
 }
 if(id==="vela_medieval"){
  B(0,0,0,.53,.10,.53,4);B(0,.1,0,.39,.75,.39,6);
  B(0,.84,0,.33,.08,.33,10);B(0,.93,0,.065,.065,.065,11);
 }
 if(id==="candelabro_medieval"){
  B(0,0,0,1.0,.18,.95,4);B(0,.18,0,.26,3.12,.25,4);
  for(const x of [-.8,0,.8]){
   if(x!==0)T([0,3.03,0],[x,3.17,0],.15,4);
   B(x,3.16,0,.36,.1,.32,4);B(x,3.26,0,.23,.6,.23,6);
   B(x,3.86,0,.07,.1,.06,11);
  }
 }
 if(id==="farol_aceite_medieval"){
  B(0,0,0,.83,.2,.84,4);B(0,.19,0,.75,.95,.78,7);
  for(const x of [-.43,.43])for(const z of [-.43,.43])B(x,.16,z,.09,1.16,.09,4);
  B(0,1.28,0,1.02,.15,1.0,4);B(0,1.44,0,.62,.3,.58,4);
  T([-.24,1.82,0],[.24,1.82,0],.09,4);
  B(0,.36,0,.5,.19,.5,5);
 }
 if(id==="brasero_medieval"){
  for(const x of [-.86,.86])for(const z of [-.86,.86])B(x,0,z,.22,1.4,.21,4);
  B(0,1.36,0,2.42,.26,2.42,4);
  B(0,1.62,0,2.05,.52,2.05,11);
  for(let i=0;i<4;i++)T([-1+i*.55,2.16,-.70],[.75-i*.44,2.19,.62],.24,2);
  B(0,2.28,0,1.30,.09,1.30,13);
 }
 if(id==="fogata_medieval"){
  for(let i=0;i<10;i++){
   const a=i*2*Math.PI/10;
   B(Math.cos(a)*1.64,0,Math.sin(a)*1.64,.53,.35,.47,10);
  }
  T([-1.21,.21,-.95],[1.21,.43,.95],.42,0);
  T([1.13,.19,-1.01],[-1.02,.52,1.09],.42,2);
  T([-1.32,.24,.14],[1.40,.36,-.22],.35,8);
  B(0,.23,0,1.21,.15,1.12,13);
 }
 if(id==="chimenea_medieval"){
  B(0,0,-.82,4.15,.26,.47,10);
  for(const x of [-1.76,1.76])B(x,.25,0,.66,4.35,2.0,10);
  B(0,4.47,0,4.15,.53,2.12,10);
  B(0,4.74,-.79,4.20,.25,.51,4);
  B(0,.24,.23,2.88,.28,1.20,11);
  B(0,.55,-.50,2.82,2.68,.32,11);
  for(let i=0;i<5;i++)T([-1.16+i*.36,.59,-.22],[.50+i*.10,.75,.51],.20,8);
  for(const x of [-1.46,1.46])B(x,1.25,.78,.18,.74,.16,4);
 }
 if(id==="cristal_magico_medieval"){
  B(0,0,0,1.53,.36,1.48,4);B(0,.36,0,1.14,.52,1.14,11);
  B(0,.88,0,.78,.19,.79,4);
  const mid=[0,2.02,0],top=[0,3.09,0],low=[0,1.03,0],radius=.76;
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
   const p=[Math.cos(a)*radius,1.74,Math.sin(a)*radius],q=[Math.cos(b)*radius,1.74,Math.sin(b)*radius];
   m.tri(low,q,p,i%2?14:6);m.tri(p,q,top,i%2?14:6);
  }
 }
 }

 function glb(m,id){
  const F=a=>new Float32Array(a),p=F(m.P),n=F(m.N),u=F(m.U),ix=new Uint16Array(m.I);
  const bytes=[],views=[];let len=0;
  const add=(a,target)=>{const pad=(4-len%4)%4;if(pad){bytes.push(new Uint8Array(pad));len+=pad;}const i=views.length;views.push({buffer:0,byteOffset:len,byteLength:a.byteLength,...(target?{target}:{})});bytes.push(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));len+=a.byteLength;return i;};
  const vi=add(new Uint8Array(ix.buffer),34963),vp=add(new Uint8Array(p.buffer),34962),vn=add(new Uint8Array(n.buffer),34962),vu=add(new Uint8Array(u.buffer),34962),vt=add(texture);
  const pad=(4-len%4)%4;if(pad){bytes.push(new Uint8Array(pad));len+=pad;}
  const bin=cat(bytes),mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[i+k]);mx[k]=Math.max(mx[k],p[i+k]);}
  const doc={asset:{version:"2.0",generator:"Blakpine Wood medieval lighting pack v1"},scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0}],meshes:[{name:id,primitives:[{attributes:{POSITION:1,NORMAL:2,TEXCOORD_0:3},indices:0,material:0,mode:4}]}],materials:[{name:"pixel_medieval",doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1}}],samplers:[{magFilter:9728,minFilter:9728,wrapS:33071,wrapT:33071}],textures:[{sampler:0,source:0}],images:[{mimeType:"image/png",bufferView:vt}],buffers:[{byteLength:bin.length}],bufferViews:views,accessors:[{bufferView:vi,componentType:5123,count:ix.length,type:"SCALAR"},{bufferView:vp,componentType:5126,count:p.length/3,type:"VEC3",min:mn,max:mx},{bufferView:vn,componentType:5126,count:n.length/3,type:"VEC3"},{bufferView:vu,componentType:5126,count:u.length/2,type:"VEC2"}]};
  const j=enc(JSON.stringify(doc)),jp=cat([j,new Uint8Array((4-j.length%4)%4).fill(32)]);
  return {data:cat([le(0x46546c67),le(2),le(28+jp.length+bin.length),le(jp.length),le(0x4e4f534a),jp,le(bin.length),le(0x004e4942),bin]),stats:{verts:p.length/3,tris:ix.length/3,min:mn,max:mx}};
 }
 function thumbnail(m){
  const w=64,h=64,px=new Uint8Array(w*h*4),depth=new Float32Array(w*h).fill(-Infinity),p=m.P,u=m.U,n=m.N,indices=m.I,proj=[],box=[Infinity,Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2],a=(x-z)*.7071,b=(x+z)*.37-y*.85;proj.push([a,b,x*.5+y*.7+z*.5]);box[0]=Math.min(box[0],a);box[1]=Math.min(box[1],b);box[2]=Math.max(box[2],a);box[3]=Math.max(box[3],b);}
  const scale=Math.min(55/(box[2]-box[0]),53/(box[3]-box[1])),ox=w/2-(box[0]+box[2])*scale/2,oy=h/2-(box[1]+box[3])*scale/2;
  for(let j=0;j<indices.length;j+=3){const ids=indices.slice(j,j+3),A=proj[ids[0]],B=proj[ids[1]],C=proj[ids[2]],x0=A[0]*scale+ox,y0=A[1]*scale+oy,x1=B[0]*scale+ox,y1=B[1]*scale+oy,x2=C[0]*scale+ox,y2=C[1]*scale+oy,area=(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0);if(Math.abs(area)<.00001)continue;
   const light=.71+.27*Math.max(0,n[ids[0]*3]*.55+n[ids[0]*3+1]*.75+n[ids[0]*3+2]*.4);
   for(let y=Math.max(0,Math.floor(Math.min(y0,y1,y2)));y<=Math.min(h-1,Math.ceil(Math.max(y0,y1,y2)));y++)for(let x=Math.max(0,Math.floor(Math.min(x0,x1,x2)));x<=Math.min(w-1,Math.ceil(Math.max(x0,x1,x2)));x++){
    const a=((x+.5-x0)*(y2-y0)-(y+.5-y0)*(x2-x0))/area,b=((x1-x0)*(y+.5-y0)-(y1-y0)*(x+.5-x0))/area;if(a<0||b<0||a+b>1)continue;
    const c=1-a-b,z=A[2]*c+B[2]*a+C[2]*b,k=y*w+x;if(z<=depth[k])continue;depth[k]=z;
    const tu=u[ids[0]*2]*c+u[ids[1]*2]*a+u[ids[2]*2]*b,tv=u[ids[0]*2+1]*c+u[ids[1]*2+1]*a+u[ids[2]*2+1]*b,src=(Math.max(0,Math.min(63,Math.floor(tv*64)))*64+Math.max(0,Math.min(63,Math.floor(tu*64))))*4;for(let i=0;i<3;i++)px[k*4+i]=Math.round(tex[src+i]*light);px[k*4+3]=255;
   }
  }
  return png(w,h,px);
 }
 const files=[],stats=[];
 for(const d of defs){const m=mesh();sculpt(m,d);const g=glb(m,d.id),th=thumbnail(m);files.push({path:"forest-horror/biblioteca/"+d.glb,bytes:g.data});files.push({path:"forest-horror/biblioteca/"+d.thumbnail,bytes:th});stats.push({id:d.id,glbBytes:g.data.length,thumbBytes:th.length,...g.stats});}
 return {defs,files,stats};
};
if(typeof require==='function' && typeof module==='object' && require.main===module){
 const fs=require('node:fs'),path=require('node:path');
 for(const file of buildMedievalLights().files){fs.mkdirSync(path.dirname(file.path),{recursive:true});fs.writeFileSync(file.path,file.bytes);console.log(file.path);}
}
