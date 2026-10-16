import {resourceFromUrl,resourceSite,publicUrl} from '../shared/resources.js';
import {isOpenPlot} from './layout.js';

export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export const matchesType=(item,type='all')=>type==='all'||item.kind===type||(type==='site'&&item.kind==='page');
export function findResources(items,query,type='all',limit=40){
  const tokens=normalize(query).trim().split(/\s+/).filter(Boolean);if(!tokens.length)return [];
  return items.filter(item=>matchesType(item,type)&&tokens.every(t=>normalize([item.title,item.description,item.url,item.tags].join(' ')).includes(t)))
    .map(item=>({item,score:normalize(item.title)===normalize(query)?10:normalize(item.title).startsWith(normalize(query))?5:0}))
    .sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>resourceSite(x.item));
}

// Persistent browser-owned spiral, with parks reserved. Each new address is
// appended; metadata updates never move a place. No network ranking required.
export function* worldCells(){
  let x=0,y=0,dir=0,length=1,steps=0,turns=0;const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
  while(true){x+=dirs[dir][0];y+=dirs[dir][1];if(++steps===length){steps=0;dir=(dir+1)%4;if(++turns%2===0)length++;}if(!isOpenPlot(x,y))yield {x,y};}
}
export function placeResource(resource,items){
  const old=items.get(resource.id);if(old)return {...old,...resource,world:old.world};
  const occupied=new Set([...items.values()].filter(x=>x.world).map(x=>`${x.world.x},${x.world.y}`));
  for(const world of worldCells())if(!occupied.has(`${world.x},${world.y}`))return {...resource,world};
}
export function importedResource(value){
  if(!value||typeof value!=='object')return null;
  const item=resourceFromUrl(value.url,{title:value.title,description:value.description,source:value.source,thumbnail:value.thumbnail});
  if(!item)return null;
  const kind=['site','channel','video','article','page','image','repository','book'].includes(value.kind)?value.kind:item.kind;
  // Imported coordinates and IDs are never trusted; allocation stays collision-free.
  return {...item,kind,metadataStatus:value.metadataStatus==='url-only'?'url-only':item.metadataStatus,
    tags:String(value.tags||'').slice(0,1000),category:String(value.category||'Site').slice(0,40),
    credit:String(value.credit||'').slice(0,240),license:String(value.license||'').slice(0,120),licenseUrl:publicUrl(value.licenseUrl)?.href||null,
    stats:String(value.stats||'').slice(0,180),mediaLabel:String(value.mediaLabel||'').slice(0,180),
    origin:'import',source:'Arquivo importado · '+String(value.source||'sem fonte').replace(/^(Arquivo importado · )+/,'').slice(0,100)};
}
