import * as THREE from 'three';
import {CELL,cellAt,keyOf} from './model.js';
import {Simulation} from './simulation.js';
import {createInput} from './input.js';
import {createAssets,createAvatar,PALETTES} from './objects.js';
import {ChunkView} from './chunks.js';

export function createRuntime(container,registry,{isPaused,onInteract,onSearch,onStatus,onContext}={}){
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Cidade tridimensional Worldnet');container.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,200);
  const assets=createAssets(),simulation=new Simulation(registry),chunks=new ChunkView(scene,assets,registry),avatar=createAvatar(assets);scene.add(avatar);
  const ambient=new THREE.HemisphereLight(0xc4efff,0x23324a,2.2);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe4bb,2.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.near=1;sun.shadow.camera.far=110;sun.shadow.bias=-.001;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
  let yaw=.55,distance=41,theme='dark',accumulator=0,lastTime=0,contextLost=false,disposed=false;
  let frames=0,lastStatus=0,slow=0,economy=false,lastPosition={...simulation.position};
  let shadowKey='';
  const frameTimes=[];let rendererMs=0,maxFrame=0;
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),intersection=new THREE.Vector3();
  const input=createInput(canvas,{getYaw:()=>yaw,isPaused:()=>isPaused()||contextLost,onInteract:()=>onInteract(current()),onSearch,onCamera:amount=>{yaw-=amount;},onPick:point=>{
    const rect=canvas.getBoundingClientRect();pointer.set((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...chunks.active.values()].map(c=>c.group),true)[0];
    if(!hit||!(hit.object.userData.interactive||hit.instanceId>=hit.object.userData.interactiveFrom))return false;
    let group=hit.object;while(group.parent&&group.userData.description===undefined)group=group.parent;
    const p=simulation.position,worldHit={x:hit.point.x+chunks.origin.x,z:hit.point.z+chunks.origin.z};
    if(Math.hypot(worldHit.x-p.x,worldHit.z-p.z)>24)return false;
    const description=group.userData.description;if(!description)return false;
    if(description.home)onSearch();else onInteract(description.site);
    return true;
  }});
  const pickGround=point=>{
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    pointer.set((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    if(!raycaster.ray.intersectPlane(plane,intersection))return null;
    return {x:intersection.x+chunks.origin.x,z:intersection.z+chunks.origin.z};
  };
  const wheel=e=>{if(isPaused())return;e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.025,25,60);};
  canvas.addEventListener('wheel',wheel,{passive:false});
  const resize=()=>{const rect=container.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function setTheme(value){
    theme=value;const p=PALETTES[theme];scene.background=new THREE.Color(p.sky);scene.fog=new THREE.Fog(p.fog,65,120);
    ambient.intensity=theme==='dark'?1.8:2.6;sun.intensity=theme==='dark'?1.8:2.4;renderer.toneMappingExposure=theme==='dark'?1.15:1;
    chunks.setTheme(theme);renderer.shadowMap.needsUpdate=true;
  }
  setTheme(theme);
  const lose=e=>{e.preventDefault();contextLost=true;input.reset();onContext?.(true);};
  const restore=()=>{contextLost=false;lastTime=0;accumulator=0;renderer.shadowMap.needsUpdate=true;onContext?.(false);};
  canvas.addEventListener('webglcontextlost',lose);canvas.addEventListener('webglcontextrestored',restore);
  function current(){
    const c=cellAt(simulation.position),description=simulation.description(c.x,c.z);
    return description?.site||null;
  }
  function snapshot(){
    const sorted=[...frameTimes].sort((a,b)=>a-b),sum=frameTimes.reduce((a,b)=>a+b,0);
    const p=simulation.position;
    return {position:{...p},cell:cellAt(p),current:current()?keyOf(current()):null,colliding:simulation.blocked(p.x,p.z),
      chunks:chunks.active.size,queued:chunks.queue.length,created:chunks.created,disposed:chunks.disposed,
      origin:{...chunks.origin},yaw,theme,economy,contextLost,
      render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},
      performance:{samples:sorted.length,fps:sum?1000/(sum/sorted.length):0,p95:sorted[Math.floor(sorted.length*.95)]||0,maxFrame,renderMs:rendererMs},
      heapBytes:performance.memory?.usedJSHeapSize||null};
  }
  function frame(time){
    if(disposed)return;
    if(contextLost||document.hidden){lastTime=0;return;}
    const raw=lastTime?time-lastTime:16.7;lastTime=time;
    frameTimes.push(raw);if(frameTimes.length>180)frameTimes.shift();maxFrame=Math.max(maxFrame,raw);
    const dt=Math.min(raw/1000,.1);
    slow=raw>35?slow+dt:Math.max(0,slow-dt*.5);
    if(!economy&&slow>2.5){economy=true;renderer.setPixelRatio(.75);renderer.shadowMap.enabled=false;resize();}
    const vector=input.vector(simulation.position,pickGround);
    accumulator+=dt;let steps=0;
    while(accumulator>=1/60&&steps<6){if(!isPaused())simulation.step(vector,1/60);accumulator-=1/60;steps++;}
    if(isPaused()){accumulator=0;input.reset();}
    chunks.update(simulation.position);
    const p=simulation.position,local=new THREE.Vector3(p.x-chunks.origin.x,.12,p.z-chunks.origin.z);
    avatar.position.copy(local);
    const moved=Math.hypot(p.x-lastPosition.x,p.z-lastPosition.z);
    if(moved>.001)avatar.rotation.y=Math.atan2(p.x-lastPosition.x,p.z-lastPosition.z);
    for(let i=0;i<avatar.userData.legs.length;i++)avatar.userData.legs[i].rotation.x=moved>.001?Math.sin(simulation.distance*4+i*Math.PI)*.35:0;
    lastPosition={...p};
    const offset=new THREE.Vector3(Math.sin(yaw)*distance,distance*.87,Math.cos(yaw)*distance);
    camera.position.copy(local).add(offset);camera.lookAt(local.x,1,local.z);camera.updateMatrixWorld();
    sun.position.copy(local).add(new THREE.Vector3(-18,35,16));sun.target.position.copy(local);sun.target.updateMatrixWorld();
    const nextShadowKey=`${chunks.created}:${chunks.disposed}`;
    if(moved>.001||shadowKey!==nextShadowKey){renderer.shadowMap.needsUpdate=true;shadowKey=nextShadowKey;}
    const start=performance.now();renderer.render(scene,camera);rendererMs=performance.now()-start;
    frames++;
    if(time-lastStatus>500){lastStatus=time;onStatus?.({site:current(),...snapshot()});}
  }
  renderer.setAnimationLoop(frame);
  return {
    canvas,snapshot,setTheme,currentSite:current,
    orbit(amount){yaw+=amount;},
    resetInput(){input.reset();},
    focus(reset=true){if(reset)input.reset();canvas.focus({preventScroll:true});},
    teleport(id){const cell=typeof id==='string'?registry.address(id):id;if(!cell||!simulation.teleport(cell))return false;input.reset();accumulator=0;chunks.update(simulation.position);return true;},
    pickGround,
    dispose(){disposed=true;renderer.setAnimationLoop(null);input.dispose();observer.disconnect();canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',lose);canvas.removeEventListener('webglcontextrestored',restore);chunks.dispose();avatar.traverse(o=>{if(o.isMesh)o.material.dispose();});assets.dispose();sun.shadow.map?.dispose();renderer.dispose();canvas.remove();}
  };
}
