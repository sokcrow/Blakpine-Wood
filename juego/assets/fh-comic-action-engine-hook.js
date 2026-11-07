/* Texto cómic para acciones confirmadas del motor 3D (adaptador, sin cambiar el JSON). */
(function (global) {
  'use strict';

  function patch(doc) {
    const helpers = [
      "function fhComicWorld(id,x,z,floor=currentFloor,key='',self=true){",
      " window.FHLiveText?.actionAt({id,x,z,y:floorElev[floor]+1.2,floor,self,key:key||('world:'+floor+':'+Math.round(x*10)+':'+Math.round(z*10))});",
      "}",
      "function fhComicOnItem(id,item,floor=currentFloor){",
      " if(!item)return;",
      " const at=interactionAnchor(item);",
      " fhComicWorld(id,at.x*CELL,at.y*CELL,floor,'item:'+floor+':'+item.id,floor===currentFloor);",
      "}",
      "function fhComicOnActor(id){",
      " fhComicWorld(id,user.x,user.z,currentFloor,'player',true);",
      "}"
    ].join('\n');

    const changes = [
      [
        "GameEvents.on('interaction:used',saveProgress);",
        helpers + "\nGameEvents.on('interaction:used',({item,verb})=>{\n" +
        " saveProgress();\n" +
        " if(!item||verb==='sit'||verb==='lie')return;\n" +
        " const alreadyShown=(item.interact?.effects||[]).some(e=>e.type==='playSound'&&window.FH_LIVE_TEXT_STRINGS?.soundWords?.[e.id]);\n" +
        " if(!alreadyShown)fhComicOnItem(verb==='hide'&&!GameState.hidden?'unhide':verb,item);\n" +
        "});"
      ],
      [
        "function toggleFlashlight(){const out=lighting.toggleFlashlight();",
        "function toggleFlashlight(){const out=lighting.toggleFlashlight();\n if(out.ok)fhComicOnActor(out.enabled?'flashlight_on':'flashlight_off');"
      ],
      [
        " if(d.stairBlockFlag&&GameState.flags[d.stairBlockFlag])return notice('Esta puerta de escaleras está atrancada.');",
        " if(d.stairBlockFlag&&GameState.flags[d.stairBlockFlag]){fhComicWorld('door_locked',d.cx,d.cz,d.f,'door:'+d.f+':'+d.id);return notice('Esta puerta de escaleras está atrancada.');}"
      ],
      [
        "  if(!result.ok){notice(result.reason==='wrongKey'?PROGRESSION_TEXT.wrongKey:PROGRESSION_TEXT.noKey,2600);return;}",
        "  if(!result.ok){fhComicWorld('door_locked',d.cx,d.cz,d.f,'door:'+d.f+':'+d.id);notice(result.reason==='wrongKey'?PROGRESSION_TEXT.wrongKey:PROGRESSION_TEXT.noKey,2600);return;}"
      ],
      [
        "window.FHLiveText?.playSfxAt({id:d.open?'door_open':'door_close',x:d.cx,z:d.cz,y:floorElev[d.f]+1.1,floor:d.f});",
        "window.FHLiveText?.playSfxAt({id:d.open?'door_open':'door_close',x:d.cx,z:d.cz,y:floorElev[d.f]+1.1,floor:d.f,self:true,key:'door:'+d.f+':'+d.id});"
      ],
      [
        "window.FHLiveText?.playSfxAt({id:'lamp_click',x:item.x*CELL,z:item.y*CELL,y:floorElev[currentFloor]+1.2,floor:currentFloor});",
        "window.FHLiveText?.playSfxAt({id:'lamp_click',x:item.x*CELL,z:item.y*CELL,y:floorElev[currentFloor]+1.2,floor:currentFloor,self:true,key:'item:'+currentFloor+':'+item.id});"
      ],
      [
        "onOpen:(item,floor)=>window.FHDeliveryRuntime?.onComputerOpen(item,floor),",
        "onOpen:(item,floor)=>{window.FHDeliveryRuntime?.onComputerOpen(item,floor);fhComicOnItem('computer_use',item,floor);},"
      ],
      [
        " if(!playerPose.begin(item.id,verb,origin,{x:target.x,z:target.z}))return {ok:false,reason:'busy'};",
        " if(!playerPose.begin(item.id,verb,origin,{x:target.x,z:target.z}))return {ok:false,reason:'busy'};\n fhComicOnItem(verb,item);"
      ],
      [
        " const ok=playerPose.exit(from,exit);if(ok){watchingTvId=null;user.vx=user.vz=0;visibilityDirty=true;}",
        " const ok=playerPose.exit(from,exit);if(ok){watchingTvId=null;user.vx=user.vz=0;visibilityDirty=true;fhComicOnActor('stand');}"
      ],
      [
        " user.vx=user.vz=0;notice(isAscending?",
        " fhComicOnItem('stairs_step',stairs.item);\n user.vx=user.vz=0;notice(isAscending?"
      ],
      [
        "  user.x=stop.x;user.z=stop.z;user.vx=user.vz=0;showElevatorPanel(s);saveProgress();return true;",
        "  user.x=stop.x;user.z=stop.z;user.vx=user.vz=0;fhComicWorld('elevator_board',stop.x,stop.z,currentFloor,'elevator:'+stop.shaftId);showElevatorPanel(s);saveProgress();return true;"
      ],
      [
        " const res=elevatorSystem.call(s.id,currentFloor);\n if(!res.ok){notice(elevatorMessage(res));return false;}",
        " const res=elevatorSystem.call(s.id,currentFloor);\n if(!res.ok){notice(elevatorMessage(res));return false;}\n fhComicWorld('elevator_call',stop.x,stop.z,currentFloor,'elevator:'+stop.shaftId);"
      ],
      [
        "   const result=lighting.setBreakerPower(circuit.floorIndex??breakerPanelFloor,circuit,!!event.detail.power);",
        "   const result=lighting.setBreakerPower(circuit.floorIndex??breakerPanelFloor,circuit,!!event.detail.power);\n   if(result?.ok)fhComicOnItem('breaker_toggle',breakerPanelItem,breakerPanelFloor);"
      ],
      [
        " catch(error){console.error(error);closeBreakerHUD();notice(LIGHTING_TEXT.breakerPanelError)}\n $('fhBreakerClose').focus({preventScroll:true});",
        " catch(error){console.error(error);closeBreakerHUD();notice(LIGHTING_TEXT.breakerPanelError)}\n if(breakerPanelItem)fhComicOnItem('panel_open',item);\n $('fhBreakerClose').focus({preventScroll:true});"
      ]
    ];
    for (const [before, after] of changes) {
      const count = doc.split(before).length - 1;
      if (count !== 1) throw Error('Hook cómic incompatible: ' + before.slice(0, 76) + ' (' + count + ')');
      doc = doc.replace(before, after);
    }
    return doc;
  }

  global.FHComicActionEngine = Object.freeze({patch});
})(typeof window !== 'undefined' ? window : globalThis);
