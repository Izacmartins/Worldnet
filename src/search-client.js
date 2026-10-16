import {resourceSite} from '../shared/resources.js';
export const resourceKey=site=>site.id||site.domain;
const local=new Map();
const DB='worldnet-resources-v1';
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
export async function loadResources(){
  let db;
  try{
    db=await database();
    const items=await new Promise((resolve,reject)=>{
      const req=db.transaction('resources').objectStore('resources').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    for(const item of items)local.set(item.id,item);
  }catch{}finally{db?.close();}
  try{
    const r=await fetch('/api/resources',{signal:AbortSignal.timeout(5000)});
    if(r.ok){const data=await r.json();await remember(data.resources);}
  }catch{/* Offline browser cache remains available. */}
  return localResources();
}
export async function searchResources(query){
  try{
    const response=await fetch('/api/search?'+new URLSearchParams({q:query}),{signal:AbortSignal.timeout(7000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Busca indisponível');
    await remember(data.results);
    return {...data,results:data.results.map(resourceSite)};
  }catch(error){return {query,results:findLocalResources(query),cached:true,stale:true,errors:[{source:'Worldnet Search',message:error.message}],sources:[]};}
}
