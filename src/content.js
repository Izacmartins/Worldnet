/**
 * Worldnet 1.0 / fonte de conteúdo público com carregamento sob demanda.
 * Nenhuma pesquisa usa chave, scraping de páginas com CORS bloqueado ou proxy.
 * Dados editoriais vêm de Wikimedia Commons, Wikipédia e Wikinews, e são
 * identificados como conteúdo RELACIONADO, não conteúdo hospedado no domínio.
 */
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKINEWS = 'https://en.wikinews.org/w/api.php';
const WIKIPEDIA = 'https://pt.wikipedia.org/w/api.php';
const DB_NAME='worldnet-media-v1';
const STORE='entries';
const inMemory=new Map();
const HOUR=60*60*1000;
const VALID_KINDS=new Set(['images','videos','audio','news','articles']);

export function safeExternalUrl(input) {
  try {
    const u=new URL(String(input));
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return null;
    if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(u.hostname) || u.hostname.endsWith('.local')) return null;
    return u.href;
  } catch { return null; }
}
export function topicForSite(site) {
  const tagged=site?.queryTags?.find(t=>typeof t==='string' && t.length>=3 && t.length<=55);
  if(tagged)return tagged;
  const title=String(site?.title||'').trim();
  if(title && title!==site?.domain && title.length<65)return title;
  const domain=String(site?.domain||'').replace(/^www\./,'').split('.')[0].replace(/[._-]+/g,' ');
  return domain.slice(0,55)||'internet';
}
export function sortMediaItems(items,kind){
  const seen=new Set();
  return items.filter(item=>{
    if(!item?.title || !safeExternalUrl(item.link))return false;
    const key=item.link;
    if(seen.has(key))return false;
    seen.add(key);
    return kind==='videos'?item.kind==='video':kind==='audio'?item.kind==='audio':kind==='images'?item.kind==='image':true;
  }).slice(0,8);
}
function wikimediaFileUrl(value) {
  try{
    const u=new URL(value);
    if(u.protocol!=='https:')return null;
    return /(^|\.)(?:wikimedia\.org|wikipedia\.org|wikinews\.org)$/.test(u.hostname)?u.href:null;
  }catch{return null;}
}
async function mediaWikiGet(base,params,signal){
  const url=new URL(base);
  for(const [key,value] of Object.entries({action:'query',format:'json',formatversion:'2',origin:'*',...params}))url.searchParams.set(key,String(value));
  const response=await fetch(url,{signal,credentials:'omit',mode:'cors',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`A fonte respondeu HTTP ${response.status}`);
  const json=await response.json();
  if(json.error)throw new Error(json.error.info||'Consulta recusada pela fonte');
  return json;
}
async function commonsMedia(term,kind,signal){
  const search=String(term||'internet').trim().slice(0,80);
  const restriction=kind==='videos'?'filetype:video':kind==='audio'?'filetype:audio':'filetype:bitmap';
  const data=await mediaWikiGet(COMMONS,{
    generator:'search',gsrsearch:`${search} ${restriction}`,gsrnamespace:'6',gsrlimit:'24',
    prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iiurlwidth:'460'
  },signal);
  const output=[];
  for(const page of data.query?.pages||[]){
    const info=page.imageinfo?.[0]; if(!info)continue;
    const mime=String(info.mime||'');
    const isVideo=mime.startsWith('video/');
    const isAudio=mime.startsWith('audio/');
    if(kind==='videos' && !isVideo)continue;
    if(kind==='audio' && !isAudio)continue;
    if(kind==='images' && (isVideo || isAudio))continue;
    if(kind==='images' && !['image/jpeg','image/png','image/webp','image/gif'].includes(mime))continue;
    const url=wikimediaFileUrl(info.url);
    const thumb=wikimediaFileUrl(info.thumburl||info.url);
    const descriptionUrl=wikimediaFileUrl(info.descriptionurl);
    if(!url||!descriptionUrl)continue;
    const name=String(page.title||'').replace(/^File:/,'').replace(/\.(png|jpe?g|webp|gif|webm|ogv|ogg|mp4)$/i,'').replace(/_/g,' ');
    const author=String(info.extmetadata?.Artist?.value||'').replace(/<[^>]*>/g,'').trim().slice(0,100);
    const license=String(info.extmetadata?.LicenseShortName?.value||'').replace(/<[^>]*>/g,'').trim().slice(0,80);
    output.push({kind:isVideo?'video':isAudio?'audio':'image',title:name.slice(0,130),url,thumbnail:thumb,link:descriptionUrl,
      attribution:author||'Wikimedia Commons',license:license||'Consulte a licença na origem',source:'Wikimedia Commons',mime});
  }
  return sortMediaItems(output,kind);
}
/** Fallback gratuito: miniaturas de artigos públicos da Wikipédia. */
async function wikipediaImages(term,signal){
  const data=await mediaWikiGet(WIKIPEDIA,{
    generator:'search',gsrsearch:String(term||'internet').slice(0,80),gsrlimit:'12',
    prop:'pageimages',piprop:'thumbnail',pithumbsize:'360'
  },signal);
  const items=[];
  for(const page of data.query?.pages||[]){
    const thumb=wikimediaFileUrl(page.thumbnail?.source);
    const title=String(page.title||'').trim();
    if(!thumb||!title)continue;
    const link=`https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`;
    items.push({kind:'image',title,url:thumb,thumbnail:thumb,link,
      source:'Wikipédia',attribution:'Consulte os créditos na página',license:'Consulte a licença na origem'});
  }
  return sortMediaItems(items,'images');
}
async function wikiNews(signal){
  const data=await mediaWikiGet(WIKINEWS,{list:'categorymembers',cmtitle:'Category:Published',cmsort:'timestamp',cmdir:'desc',
    cmnamespace:'0',cmprop:'title|timestamp',cmlimit:'12'},signal);
  const output=[];
  for(const item of data.query?.categorymembers||[]){
    const title=String(item.title||''); if(!title)continue;
    output.push({kind:'news',title:title.slice(0,180),link:`https://en.wikinews.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`,
      timestamp:item.timestamp||null,source:'Wikinews (inglês)',description:'Notícia publicada no Wikinews. Confira a data de publicação na fonte.'});
  }
  return sortMediaItems(output,'news');
}
async function wikipediaArticles(term,signal){
  const data=await mediaWikiGet(WIKIPEDIA,{list:'search',srsearch:String(term||'internet').slice(0,80),srlimit:'7',srnamespace:'0'},signal);
  const output=[];
  for(const item of data.query?.search||[]){
    const title=String(item.title||''); if(!title)continue;
    output.push({kind:'article',title:title.slice(0,170),link:`https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`,
      source:'Wikipédia',description:'Artigo enciclopédico relacionado ao tema.'});
  }
  return sortMediaItems(output,'articles');
}
function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function readCache(key){
  if(inMemory.has(key))return inMemory.get(key);
  if(typeof indexedDB==='undefined')return null;
  try{
    const db=await openDB();
    return await new Promise(resolve=>{
      const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);
      req.onsuccess=()=>{db.close();resolve(req.result||null);};
      req.onerror=()=>{db.close();resolve(null);};
    });
  }catch{return null;}
}
async function saveCache(entry){
  inMemory.set(entry.key,entry);
  if(typeof indexedDB==='undefined')return;
  try{
    const db=await openDB();
    await new Promise(resolve=>{
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(entry);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();resolve();};
    });
  }catch{/* storage is optional */}
}
export async function fetchPublicContent(kind,query,{signal,force=false}={}){
  if(!VALID_KINDS.has(kind))throw new Error('Tipo de conteúdo não reconhecido');
  const term=String(query||'internet').trim().slice(0,80)||'internet';
  const key=`${kind}:${kind==='news'?'global':term.toLocaleLowerCase('pt-BR')}`;
  const maxAge=kind==='news'?HOUR:24*HOUR;
  const old=await readCache(key);
  if(!force && old && Date.now()-old.savedAt<maxAge) return {items:old.items,source:'cache',savedAt:old.savedAt,stale:false};
  try{
    let items=[];
    if(kind==='images'){
      try{items=await commonsMedia(term,kind,signal);}catch(error){if(error?.name==='AbortError')throw error;}
      if(!items.length)items=await wikipediaImages(term,signal);
    }
    else if(kind==='videos'||kind==='audio')items=await commonsMedia(term,kind,signal);
    else if(kind==='news')items=await wikiNews(signal);
    else items=await wikipediaArticles(term,signal);
    const entry={key,items,savedAt:Date.now()};
    await saveCache(entry);
    return {items,source:'internet',savedAt:entry.savedAt,stale:false};
  }catch(error){
    if(error?.name==='AbortError')throw error;
    if(old)return {items:old.items,source:'cache',savedAt:old.savedAt,stale:true};
    throw error;
  }
}
