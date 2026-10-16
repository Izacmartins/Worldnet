import {resourceSite,resourceFromUrl} from '../shared/resources.js';
import {PORTFOLIO_CATALOG} from './portfolio-catalog.js';
import {BROWSER_PROVIDERS,queryProvider} from './browser-providers.js';
import {findResources,matchesType,placeResource,importedResource,normalize} from './browser-world.js';

export const resourceKey=site=>site.id||site.domain;
const DB='worldnet-portfolio-v1',LIMIT=1500,CACHE_LIMIT=40,TTL=30*60*1000;
const local=new Map(),cache=new Map();let loading,persistent=true;
async function database(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('resources',{keyPath:'id'});req.result.createObjectStore('queries',{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function write(store,items,clear=false){
  let db;
  try{db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),os=tx.objectStore(store);if(clear)os.clear();for(const item of items)os.put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  catch{persistent=false;}finally{db?.close();}
}
async function remember(items){
  const saved=[];
  for(const resource of items){
    if(!resource||(!local.has(resource.id)&&local.size>=LIMIT))continue;
    const item=placeResource(resource,local);local.set(item.id,item);saved.push(item);
  }
  if(saved.length)await write('resources',saved);return saved;
}
export const localResources=()=>[...local.values()].map(resourceSite);
export const findLocalResources=(q,type='all')=>findResources([...local.values()],q,type);
export const worldState=()=>({count:local.size,limit:LIMIT,persistent});
export function loadResources(){return loading||=initialize();}
async function initialize(){
  let db;
  try{
    db=await database();
    const read=store=>new Promise((resolve,reject)=>{const req=db.transaction(store).objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const [items,queries]=await Promise.all([read('resources'),read('queries')]);
    for(const item of items.slice(0,LIMIT))local.set(item.id,item);
    for(const item of queries.slice(-CACHE_LIMIT))cache.set(item.key,item);
  }catch{persistent=false;}finally{db?.close();}
  await remember(PORTFOLIO_CATALOG.filter(x=>!local.has(x.id)));
  return localResources();
}
export async function searchResources(input,{type='all',signal,onSource=()=>{}}={}){
  await loadResources();
  const query=String(input||'').trim().replace(/\s+/g,' ').slice(0,200);
  const sources=[],errors=[];
  const response=()=>({query,results:findLocalResources(query,type),sources,errors,browserOnly:true,...worldState()});
  if(!query)return response();
  if(/^https?:\/\//i.test(query)){
    const item=resourceFromUrl(query);
    if(!item){errors.push({source:'Link',message:'Use um endereço HTTP(S) público válido.'});return {...response(),results:[]};}
    const saved=await remember([local.get(item.id)||{...item,origin:'link'}]);
    if(!saved.length)errors.push({source:'Armazenamento',message:`Limite de ${LIMIT} lugares atingido. Exporte seus dados antes de reiniciar a cidade.`});
    sources.push({name:'Endereço informado',status:'catalog',count:saved.length});
    return {...response(),results:saved.map(resourceSite)};
  }
  const key=normalize(query)+'|'+type,cached=cache.get(key);
  if(cached&&Date.now()-cached.at<TTL){
    const results=cached.ids.map(id=>local.get(id)).filter(Boolean).map(resourceSite),merged=new Map();
    for(const item of [...findLocalResources(query,type),...results])merged.set(item.id,item);
    return {...response(),results:[...merged.values()].slice(0,40),sources:cached.sources.map(s=>s.status==='ok'?{...s,status:'cached'}:s),cached:true};
  }
  // Type filters select sources. A channel query never silently becomes a
  // Wikipedia query; YouTube-name discovery here is the editorial/local index.
  const providers=BROWSER_PROVIDERS.filter(p=>type==='all'||p.types.includes(type));
  const found=new Map();let next=0;
  async function worker(){
    while(next<providers.length&&!signal?.aborted){
      const provider=providers[next++],controller=new AbortController();
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,6500);
      let status;
      try{
        const items=await queryProvider(provider,query,{signal:controller.signal});
        if(signal?.aborted)break;
        const saved=await remember(items);for(const item of saved)if(matchesType(item,type))found.set(item.id,resourceSite(item));
        status={id:provider.id,name:provider.name,status:'ok',count:saved.length};
      }catch(error){
        if(signal?.aborted)break;
        status={id:provider.id,name:provider.name,status:error.status===429||error.status===403?'limited':'unavailable',count:0};
        errors.push({source:provider.name,message:error.name==='AbortError'?'Tempo de consulta esgotado.':error.message});
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
      sources.push(status);onSource(status);
    }
  }
  await Promise.all(Array.from({length:Math.min(3,providers.length)},worker));
  const merged=new Map();for(const item of [...findLocalResources(query,type),...found.values()])merged.set(item.id,item);
  const results=[...merged.values()].slice(0,40);
  if(!signal?.aborted&&sources.some(s=>s.status==='ok')){
    cache.delete(key);cache.set(key,{key,at:Date.now(),ids:[...found.keys()],sources});
    while(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value);
    await write('queries',[...cache.values()],true);
  }
  if(!providers.length)sources.push({name:'Catálogo deste navegador',status:'catalog',count:results.length});
  return {...response(),results,cached:false,cancelled:Boolean(signal?.aborted)};
}
export async function exportWorld(){await loadResources();return JSON.stringify({format:'worldnet-portfolio',version:1,exportedAt:new Date().toISOString(),resources:[...local.values()]},null,2);}
export async function importWorld(text){
  await loadResources();if(text.length>3_000_000)throw new Error('Arquivo maior que 3 MB.');
  const data=JSON.parse(text);
  if(data.format!=='worldnet-portfolio'||data.version!==1||!Array.isArray(data.resources)||data.resources.length>LIMIT)throw new Error('Arquivo Worldnet inválido ou acima do limite de lugares.');
  const valid=data.resources.map(importedResource).filter(Boolean);
  if(valid.length!==data.resources.length)throw new Error('O arquivo contém endereços inválidos. Nada foi importado.');
  const count=await remember(valid);cache.clear();await write('queries',[],true);return count.length;
}
