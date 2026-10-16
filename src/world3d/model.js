import {domainHash,visualIdentity} from '../identity.js';
import {infoLevel} from '../city-art.js';
import {isOpenPlot} from '../layout.js';

export const CELL={x:32,z:24};
export const keyOf=site=>site.id||site.domain;
export const cellKey=(x,z)=>`${x},${z}`;
export const cellAt=p=>({x:Math.floor(p.x/CELL.x),z:Math.floor(p.z/CELL.z)});
export const spawnAt=cell=>({x:(cell.x+.5)*CELL.x,y:0,z:(cell.z+1)*CELL.z-2});

export function describeBuilding(site,home=false){
  const id=home?{seed:42,accent:0x66e9e0,secondary:0x9792ff,archetype:'central'}:visualIdentity(site);
  const seed=id.seed,rank=Number(site?.rank)||Infinity;
  const level=home?3:infoLevel(site);
  const kind=site?.kind;
  let archetype=home?'central':kind==='video'?'screen':kind==='channel'?'studio':kind==='book'?'archive':kind==='repository'?'tech':kind==='image'?'gallery':id.archetype;
  const w=home?15:10+(seed%5),d=home?10:7+((seed>>>4)%4);
  const h=home?7:5+((seed>>>8)%6)+(rank<=100?4:0)+(level===3?2:0);
  const bodies=[];
  const box=(x,z,width,depth,height,bottom=0)=>bodies.push({x,z,w:width,d:depth,h:height,y:bottom});
  switch(archetype){
    case 'market':box(16,12,w+3,d,5);box(16,12,w+1,d-1,1,5);break;
    case 'library':case 'archive':box(13,12,w*.65,d,h);box(20,12,w*.45,d+2,h*.65);break;
    case 'commons':case 'campus':box(11,11,5,d,h*.7);box(21,11,5,d,h*.7);box(16,8,5,3,h*.45);break;
    case 'studio':case 'broadcast':box(13,12,w*.7,d,h);box(21,12,5,d-1,h*.65);box(13,12,w*.46,d*.7,2,h);break;
    case 'screen':box(16,11,w,d-2,5);box(16,12,w*.65,d*.6,3,5);break;
    case 'gallery':box(16,11,w+2,d,4);box(11,10,4,d-2,3,4);break;
    case 'tech':case 'spire':box(16,12,w*.8,d,h+2);box(16,12,w*.45,d*.65,3,h+2);box(22,12,4,d-1,4);break;
    case 'concert':case 'arcade':box(16,12,w+2,d+1,5);box(16,10,w*.65,d*.6,3,5);break;
    case 'finance':case 'tower':box(16,12,w*.7,d,h+4);box(16,12,w,d+1,2);break;
    case 'terrace':case 'loft':box(16,12,w,d,4);box(14,11,w*.75,d*.8,3,4);box(12,10,w*.5,d*.6,2,7);break;
    case 'pod':case 'kiosk':box(16,12,w,d,4);box(16,12,w+2,d+2,1,4);break;
    default:box(16,12,w,d,h);box(16+(seed%2?1:-1),12,w*.65,d*.7,2,h);
  }
  // Collision proxies derive from the very same solid masses as the meshes.
  const colliders=bodies.filter(b=>b.y<1.7).map(b=>({minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2}));
  if(home||site?.id)colliders.push({minX:21.2,maxX:26.8,minZ:18.9,maxZ:19.3});
  return {seed,archetype,bodies,colliders,accent:id.accent,secondary:id.secondary,level,
    height:Math.max(...bodies.map(b=>b.y+b.h)),title:home?'WORLDNET':site.displayName||site.title||site.domain,
    home,kind,site};
}

// The browser assigns addresses once; the renderer never reallocates them.
export class WorldRegistry {
  constructor(){this.cells=new Map();this.addresses=new Map();this.version=0;}
  replace(resources=[],catalog=[]){
    const cells=new Map(),addresses=new Map();
    let x=0,z=0,direction=0,length=1,steps=0,turns=0;
    const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
    for(const item of catalog){
      do{x+=dirs[direction][0];z+=dirs[direction][1];if(++steps===length){steps=0;direction=(direction+1)%4;if(++turns%2===0)length++;}}while(isOpenPlot(x,z));
      const site={...item,title:item.domain,url:`https://${item.domain}/`,category:'Site'};
      cells.set(cellKey(x,z),site);addresses.set(keyOf(site),{x,z});
    }
    for(const site of resources){
      if(!Number.isSafeInteger(site.world?.x)||!Number.isSafeInteger(site.world?.y))continue;
      const cell={x:site.world.x,z:site.world.y};
      if(cell.x===0&&cell.z===0)continue;
      cells.set(cellKey(cell.x,cell.z),site);addresses.set(keyOf(site),cell);
    }
    const signature=JSON.stringify([...cells].map(([cell,site])=>{
      const {updatedAt,firstSeenAt,...visual}=site;return [cell,visual];
    }));
    this.cells=cells;this.addresses=addresses;
    if(signature!==this.signature){this.signature=signature;this.version++;}
  }
  describe(x,z){
    const site=this.cells.get(cellKey(x,z));
    if(x===0&&z===0)return describeBuilding(null,true);
    return site?describeBuilding(site):null;
  }
  address(id){return this.addresses.get(id);}
}

export function terrainSeed(x,z){return domainHash(`worldnet:3d:${x},${z}`);}
