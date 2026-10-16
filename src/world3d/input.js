// UI owns focus; simulation receives only action vectors in world coordinates.
export function createInput(canvas,{getYaw,isPaused,onInteract,onSearch,onCamera,onPick}={}){
  const keys=new Set();let target=null,drag=false,orbit=false,lastX=0;
  const handlers=[];
  const listen=(node,type,fn,opts)=>{node.addEventListener(type,fn,opts);handlers.push(()=>node.removeEventListener(type,fn,opts));};
  const reset=()=>{keys.clear();target=null;drag=false;orbit=false;};
  listen(window,'blur',reset);
  listen(document,'visibilitychange',()=>{if(document.hidden)reset();});
  listen(window,'keydown',e=>{
    if(e.target.closest?.('input,textarea,select')||isPaused())return;
    const key=e.key.toLowerCase();
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();keys.add(key);target=null;}
    if(key==='e'||key==='f'){e.preventDefault();onInteract();}
    if(key==='/'){e.preventDefault();onSearch();}
  });
  listen(window,'keyup',e=>keys.delete(e.key.toLowerCase()));
  listen(canvas,'contextmenu',e=>e.preventDefault());
  listen(canvas,'pointerdown',e=>{
    if(isPaused())return;canvas.focus();
    if(e.button===0&&!e.shiftKey&&onPick?.({x:e.clientX,y:e.clientY})){target=null;return;}
    orbit=e.button===2||e.shiftKey;drag=e.button===0&&!orbit;lastX=e.clientX;
    canvas.setPointerCapture(e.pointerId);
    if(drag)target={x:e.clientX,y:e.clientY};
  });
  listen(canvas,'pointermove',e=>{
    if(orbit){onCamera((e.clientX-lastX)*.006);lastX=e.clientX;}
    else if(drag)target={x:e.clientX,y:e.clientY};
  });
  listen(canvas,'pointerup',()=>{drag=false;orbit=false;target=null;});
  listen(canvas,'pointercancel',reset);
  return {
    reset,
    vector(player,pickGround){
      if(isPaused())return {x:0,z:0};
      const right=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
      if(right||forward){const a=getYaw();return {x:right*Math.cos(a)-forward*Math.sin(a),z:-right*Math.sin(a)-forward*Math.cos(a)};}
      const p=target?pickGround(target):null;
      if(p){const x=p.x-player.x,z=p.z-player.z,length=Math.hypot(x,z);if(length>.3)return {x:x/length,z:z/length};}
      return {x:0,z:0};
    },
    dispose(){reset();for(const remove of handlers)remove();}
  };
}
