import {CELL,cellAt,spawnAt} from './model.js';

export function intersectsCircle(x,z,box,radius=.45){
  const dx=x-Math.max(box.minX,Math.min(x,box.maxX));
  const dz=z-Math.max(box.minZ,Math.min(z,box.maxZ));
  return dx*dx+dz*dz<radius*radius;
}

export class Simulation {
  constructor(registry){this.registry=registry;this.position=spawnAt({x:0,z:0});this.radius=.45;this.speed=6;this.cache=new Map();this.version=-1;this.distance=0;}
  description(x,z){
    if(this.version!==this.registry.version){this.cache.clear();this.version=this.registry.version;}
    const key=`${x},${z}`;
    if(!this.cache.has(key)){
      if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key,this.registry.describe(x,z));
    }
    return this.cache.get(key);
  }
  solids(x,z){
    const c=cellAt({x,z}),out=[];
    for(let zz=c.z-1;zz<=c.z+1;zz++)for(let xx=c.x-1;xx<=c.x+1;xx++){
      for(const b of this.description(xx,zz)?.colliders||[])out.push({minX:b.minX+xx*CELL.x,maxX:b.maxX+xx*CELL.x,minZ:b.minZ+zz*CELL.z,maxZ:b.maxZ+zz*CELL.z});
    }
    return out;
  }
  blocked(x,z){return this.solids(x,z).some(b=>intersectsCircle(x,z,b,this.radius));}
  step(input,dt){
    const length=Math.hypot(input.x,input.z);if(!length)return;
    const amount=this.speed*Math.min(dt,.05)/Math.max(1,length);
    const p=this.position,before={...p};
    if(!this.blocked(p.x+input.x*amount,p.z))p.x+=input.x*amount;
    if(!this.blocked(p.x,p.z+input.z*amount))p.z+=input.z*amount;
    this.distance+=Math.hypot(p.x-before.x,p.z-before.z);
  }
  teleport(cell){
    const desired=spawnAt(cell);
    // Explicitly validate the landing position rather than assuming all future
    // procedural footprints leave the same sidewalk free.
    for(const [dx,dz] of [[0,0],[3,0],[-3,0],[0,2],[6,0],[-6,0]]){
      const p={x:desired.x+dx,y:0,z:desired.z+dz};
      if(!this.blocked(p.x,p.z)){this.position=p;return true;}
    }
    return false;
  }
}
