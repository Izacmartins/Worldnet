import {CELL,cellKey,cellAt} from './model.js';
import {buildChunk,disposeChunk} from './objects.js';

// Keep simulation/index independent of the scene; cap view creation per frame.
export class ChunkView {
  constructor(scene,assets,registry){this.scene=scene;this.assets=assets;this.registry=registry;this.active=new Map();this.queue=[];this.origin={x:0,z:0};this.theme='dark';this.lastKey='';this.version=-1;this.created=0;this.disposed=0;}
  update(position){
    const cell=cellAt(position),key=`${cell.x},${cell.z}:${this.theme}:${this.registry.version}`;
    if(this.lastKey!==key){
      this.lastKey=key;this.origin={x:cell.x*CELL.x,z:cell.z*CELL.z};
      if(this.version!==this.registry.version){this.clear();this.version=this.registry.version;}
      // Hysteresis: add at radius 2, keep existing chunks until radius 3.
      for(const [id,item] of this.active){
        const distance=Math.max(Math.abs(item.x-cell.x),Math.abs(item.z-cell.z));
        if(distance>3){disposeChunk(item.group);this.active.delete(id);this.disposed++;}
      }
      const wanted=[];
      for(let z=cell.z-2;z<=cell.z+2;z++)for(let x=cell.x-2;x<=cell.x+2;x++){
        const distance=Math.max(Math.abs(x-cell.x),Math.abs(z-cell.z));
        const detail=distance<=1?'full':'lite',id=cellKey(x,z),old=this.active.get(id);
        if(old&&old.detail!==detail){disposeChunk(old.group);this.active.delete(id);this.disposed++;}
        if(!this.active.has(id))wanted.push({id,x,z,detail,distance});
      }
      this.queue=wanted.sort((a,b)=>a.distance-b.distance);
      for(const item of this.active.values())this.place(item);
    }
    const start=performance.now();let count=0;
    while(this.queue.length&&count<2&&performance.now()-start<4){
      const item=this.queue.shift();
      item.group=buildChunk(this.assets,{...item,description:this.registry.describe(item.x,item.z),theme:this.theme});
      this.place(item);this.scene.add(item.group);this.active.set(item.id,item);this.created++;count++;
    }
  }
  place(item){item.group.position.set(item.x*CELL.x-this.origin.x,0,item.z*CELL.z-this.origin.z);}
  clear(){for(const item of this.active.values()){disposeChunk(item.group);this.disposed++;}this.active.clear();this.queue=[];}
  setTheme(theme){if(this.theme===theme)return;this.theme=theme;this.clear();this.lastKey='';}
  dispose(){this.clear();}
}
