'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');

// En srcdoc el script activo cambia durante el arranque del motor y GLTFLoader.
global.document={
 currentScript:{src:'https://sokcrow.github.io/Blakpine-Wood/juego/assets/fh-internet-visuals.js'},
 baseURI:'https://sokcrow.github.io/Blakpine-Wood/'
};
global.FHInternetCatalog={models:[{
 id:'router_wifi',type:'router',mount:'floor',glb:'modelos_glb/router_wifi.glb'
}]};
const visuals=require('../juego/assets/fh-internet-visuals.js');

class MockGroup {
 constructor(){this.userData={};this.parent=null;this.children=[];this.position={set(){}};this.rotation={y:0};}
 add(node){this.children.push(node);node.parent=this;}
 remove(node){this.children=this.children.filter(v=>v!==node);node.parent=null;}
 clone(){return new MockGroup();}
 traverse(){}
}

test('Internet busca el GLB en la biblioteca aunque currentScript cambie',async()=>{
 let requested='';
 class MockLoader{load(url,resolve){requested=url;resolve({scene:new MockGroup()});}}
 // Simula la ejecución del cargador u otro módulo cuando se pide un modelo.
 document.currentScript={src:'https://sokcrow.github.io/Blakpine-Wood/juego/assets/vendor/GLTFLoader.js'};
 await visuals.load(global.FHInternetCatalog.models[0],{GLTFLoader:MockLoader});
 assert.equal(requested,'https://sokcrow.github.io/Blakpine-Wood/forest-horror/biblioteca/internet/modelos_glb/router_wifi.glb');
});

test('Router existente obtiene skin por defecto sin migrar el mapa',()=>{
 assert.equal(visuals.choose({id:'legacy-router',type:'router'}).id,'router_wifi');
});

test('Internet sustituye placeholder de un router heredado',async()=>{
 const original=new MockGroup(),story=new MockGroup();story.add(original);
 const it={id:'legacy-router',type:'router',x:2,y:3};
 const map=new Map([[it.id,[{root:original}]]]);
 const THREE={Group:MockGroup,GLTFLoader:class{load(_,onload){onload({scene:new MockGroup()})}}};
 visuals.install({THREE,DATA:{floors:[{items:[it]}]},CELL:1,stories:[story],
   renderedByItem:[map],ForestShared:{},applyFOW:()=>{}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(original.parent,null);
 assert.equal(map.get(it.id)[0].root.userData.fhModelState,'ready');
});
