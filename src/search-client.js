import {resourceSite,resourceFromUrl} from '../shared/resources.js';
import {staticPreview} from './deployment.js';
export const resourceKey=site=>site.id||site.domain;
const local=new Map();
const DB=staticPreview?'worldnet-preview-resources-v1':'worldnet-resources-v1';
let loading;
async function database(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('resources',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function remember(items){
  for(const item of items)local.set(item.id,item);
  let db;
  try{
    db=await database();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('resources','readwrite');
      for(const item of items)tx.objectStore('resources').put(item);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }catch{/* Memory still works when browser storage is denied. */}finally{db?.close();}
}
export function localResources(){return [...local.values()].map(resourceSite);}
export function findLocalResources(query){
  const tokens=query.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean);
  return localResources().filter(item=>tokens.every(t=>[item.title,item.description,item.url].join(' ').toLocaleLowerCase('pt-BR').includes(t))).slice(0,40);
}
export function loadResources(){return loading||=initializeResources();}
async function initializeResources(){
  let db;
  try{
    db=await database();
    const items=await new Promise((resolve,reject)=>{
      const req=db.transaction('resources').objectStore('resources').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    for(const item of items)local.set(item.id,item);
  }catch{}finally{db?.close();}
  if(staticPreview){
    // A small, explicit address catalog, not simulated web-search results.
    const seeds=[
      resourceFromUrl('https://www.youtube.com/@NASA'),
      resourceFromUrl('https://www.youtube.com/@veritasium'),
      resourceFromUrl('https://pt.wikipedia.org/wiki/Astronomia',{title:'Astronomia',source:'Wikipédia · catálogo inicial da prévia'})
    ];
    const added=[];
    for(const item of seeds)if(!local.has(item.id)){const placed=placePreview(item);local.set(placed.id,placed);added.push(placed);}
    await remember(added);return localResources();
  }
  try{
    const r=await fetch('/api/resources',{signal:AbortSignal.timeout(5000)});
    if(r.ok){const data=await r.json();await remember(data.resources);}
  }catch{/* Offline browser cache remains available. */}
  return localResources();
}
function placePreview(resource){
  const old=local.get(resource.id);if(old)return old;
  const occupied=new Set([...local.values()].map(r=>`${r.world?.x},${r.world?.y}`));
  let n=0;while(occupied.has(`${400+n%64},${Math.floor(n/64)}`))n++;
  return {...resource,world:{x:400+n%64,y:Math.floor(n/64)}};
}
export async function searchResources(query){
  if(staticPreview){
    await loadResources();
    if(/^https?:\/\//i.test(query.trim())){
      const resource=resourceFromUrl(query.trim());
      if(!resource)return {results:[],errors:[{source:'Prévia local',message:'Endereço inválido'}]};
      const placed=placePreview(resource);await remember([placed]);
      return {results:[resourceSite(placed)],errors:[],cached:true,preview:true,sources:[{name:'Endereço informado',status:'ok'}]};
    }
    return {results:findLocalResources(query),errors:[],cached:true,preview:true,sources:[{name:'Catálogo local da prévia',status:'ok'}]};
  }
  try{
    const response=await fetch('/api/search?'+new URLSearchParams({q:query}),{signal:AbortSignal.timeout(7000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Busca indisponível');
    await remember(data.results);
    return {...data,results:data.results.map(resourceSite)};
  }catch(error){return {query,results:findLocalResources(query),cached:true,stale:true,errors:[{source:'Worldnet Search',message:error.message}],sources:[]};}
}
