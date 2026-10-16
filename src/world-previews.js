/**
 * Mini-janelas no próprio mapa com dados REAIS de fontes públicas.
 * Não exibe resultados simulados, não reproduz vídeo automaticamente e evita
 * consultas por quadro. Os conteúdos Wikimedia são relacionados ao tema; não
 * são atribuídos falsamente ao site do edifício.
 */
import {fetchPublicContent,topicForSite} from './content.js';
import {RESOURCE_LABELS} from '../shared/resources.js';

const AVAILABLE = new Set(['images','videos','news','articles','audio']);
const NAMES={images:'IMAGEM RELACIONADA',videos:'VÍDEO RELACIONADO',news:'NOTÍCIA PÚBLICA',articles:'ARTIGO RELACIONADO',audio:'ÁUDIO RELACIONADO',about:'INFORMAÇÕES DO SITE',shop:'VITRINE',social:'COMUNIDADE'};
const COLORS={images:'#bd97ff',videos:'#67d3ff',news:'#ff9f69',articles:'#7ee8bd',audio:'#ff83b5',about:'#8ad1e0',shop:'#ffcf6e',social:'#9eafff'};
const UPDATE_MS=450;
const MAX_ITEMS=4,MAX_REQUESTS=2;

export function previewKey(kiosk){return `${kiosk.wx+kiosk.x}:${kiosk.wy+kiosk.y}:${kiosk.kind}:${kiosk.site?.id||kiosk.site?.domain||'public'}`;}
export function sourceQuery(kiosk){return kiosk.site?topicForSite(kiosk.site):'internet';}
export function isSourceRelated(kind){return AVAILABLE.has(kind);}
export function previewLabel(kind){return NAMES[kind]||'CONTEÚDO';}
function elem(type,cls,text){const node=document.createElement(type);if(cls)node.className=cls;if(text)node.textContent=text;return node;}
function shorten(s,length=82){const value=String(s||'').trim();return value.length>length?value.slice(0,length-1)+'…':value;}
function newsDate(ts){if(!ts)return '';const d=new Date(ts);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR'):'';}
function entryKey(kiosk){return `${kiosk.kind}:${sourceQuery(kiosk).toLocaleLowerCase('pt-BR')}`;}

export function createWorldPreviews(root,{onOpen=()=>{}}={}){
  const layer=elem('div','world-previews');layer.id='world-previews';layer.setAttribute('aria-label','Conteúdos reais exibidos na cidade');
  root.append(layer);
  const shown=new Map();
  const dataCache=new Map();
  const pending=new Map();
  const queued=[];
  let running=0;
  let lastSync=0,lastPlace=0,enabled=true,viewport=null,viewportAt=0;

  function cacheData(key,data){
    dataCache.delete(key);dataCache.set(key,data);
    if(dataCache.size>45)dataCache.delete(dataCache.keys().next().value);
  }
  function fromCache(key){return dataCache.get(key);}

  function request(item){
    const key=entryKey(item);
    if(pending.has(key)||dataCache.has(key)||queued.some(q=>q.key===key))return;
    queued.push({key,kind:item.kind,term:sourceQuery(item)});
    pump();
  }
  function pump(){
    while(running<MAX_REQUESTS && queued.length){
      const job=queued.shift();
      if(![...shown.values()].some(entry=>entry.dataKey===job.key))continue;
      running++;
      const task=fetchPublicContent(job.kind,job.term).then(result=>{
        cacheData(job.key,{state:'ready',items:result.items||[],stale:result.stale,source:result.source});
      }).catch(()=>{
        cacheData(job.key,{state:'unavailable',items:[]});
      }).finally(()=>{
        running--;pending.delete(job.key);
        updateData();pump();
      });
      pending.set(job.key,task);
    }
  }
  function updateData(){for(const entry of shown.values())renderEntry(entry);}

  function renderEntry(entry){
    const {item,card,body,source}=entry;
    const data=item.kind==='about'||item.kind==='shop'||item.kind==='social'?null:fromCache(entry.dataKey);
    if(entry.rendered===data && entry.renderedKind===item.kind)return;
    entry.rendered=data;entry.renderedKind=item.kind;
    body.replaceChildren();
    source.textContent='';
    const s=item.site;
    if(item.kind==='about'||item.kind==='shop'||item.kind==='social'){
      const headline=elem('strong','world-tab-title',shorten(s?.displayName||s?.title||s?.domain||(item.kind==='social'?'Comunidades':'Worldnet'),55));
      body.append(headline);
      if(s?.thumbnail){const img=elem('img','world-tab-image');img.src=s.thumbnail;img.alt=s.displayName||s.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();body.prepend(img);}
      if(s?.description)body.append(elem('span','world-tab-text',shorten(s.description,72)));
      else if(s?.domain)body.append(elem('span','world-tab-text',s.domain));
      else body.append(elem('span','world-tab-text','Acesse informações públicas da cidade.'));
      source.textContent=s?.metadataStatus==='url-only'?'Endereço · metadados não confirmados':s?.source||s?.domain||'Worldnet';
      return;
    }
    if(!data){body.append(elem('span','world-tab-wait','Buscando conteúdo público…'));source.textContent='Consulta gratuita';return;}
    if(data.state==='unavailable'){body.append(elem('span','world-tab-empty','Fonte indisponível. Clique para tentar no explorador.'));source.textContent='Sem dados confirmados';return;}
    const found=data.items?.[0];
    if(!found){body.append(elem('span','world-tab-empty','Nenhum conteúdo disponível nesta fonte.'));source.textContent='Sem resultados';return;}
    if((item.kind==='images'||item.kind==='videos')&&found.thumbnail){
      const image=elem('img','world-tab-image');image.loading='lazy';image.decoding='async';image.alt=shorten(found.title,100);image.referrerPolicy='no-referrer';
      image.addEventListener('error',()=>{image.remove();body.prepend(elem('span','world-tab-empty','Miniatura indisponível'));},{once:true});
      image.src=found.thumbnail;
      body.append(image);
    }
    if(item.kind==='videos')body.append(elem('span','world-tab-play','▶'));
    body.append(elem('strong','world-tab-title',shorten(found.title,75)));
    if(found.timestamp && item.kind==='news')source.textContent=`${found.source||'Wikinews'} · ${newsDate(found.timestamp)}`;
    else source.textContent=found.source||'Fonte pública';
    if(data.stale)source.textContent+=' · cache';
  }

  function add(item){
    const card=elem('button','world-tab');card.type='button';
    card.style.setProperty('--world-tab-color',COLORS[item.kind]||'#94b8c9');
    const heading=item.site?.kind?`${RESOURCE_LABELS[item.site.kind]||'CONTEÚDO'} · ORIGEM`:previewLabel(item.kind);
    const top=elem('div','world-tab-top');top.append(elem('span','world-tab-dot','●'),elem('span','world-tab-heading',heading),elem('span','world-tab-action','↗'));
    const body=elem('div','world-tab-body');const source=elem('div','world-tab-source');
    card.append(top,body,source);
    const entry={item,card,body,source,dataKey:entryKey(item),rendered:null,renderedKind:null};
    card.addEventListener('pointerdown',e=>e.stopPropagation());
    card.addEventListener('click',e=>{e.stopPropagation();onOpen({site:item.site||null,tab:item.kind});});
    layer.append(card);shown.set(previewKey(item),entry);
    renderEntry(entry);
    if(AVAILABLE.has(item.kind))request(item);
  }
  function remove(key){const entry=shown.get(key);if(!entry)return;entry.card.remove();shown.delete(key);}
  function computeScreen(item,cam,rect){
    return {x:rect.x+(item.wx+item.x-cam.worldView.x)*cam.zoom*rect.scaleX,
      y:rect.y+(item.wy+item.y-cam.worldView.y)*cam.zoom*rect.scaleY-(item.site?.id?100:0)};
  }
  function rectFor(cam,canvas,now){
    if(!viewport||now-viewportAt>1500){
      const c=canvas.getBoundingClientRect();const p=root.getBoundingClientRect();
      viewport={x:c.left-p.left,y:c.top-p.top,w:c.width,h:c.height,scaleX:c.width/cam.width,scaleY:c.height/cam.height};
      viewportAt=now;
    }return viewport;
  }
  function pick(candidates,cam,rect,player){
    const budget=rect.w<750?2:MAX_ITEMS;
    const ranked=[];
    for(const item of candidates){
      const s=computeScreen(item,cam,rect);
      if(s.x<100||s.y<106||s.x>rect.w-95||s.y>rect.h-72)continue;
      const dist=Math.hypot(item.wx+item.x-player.x,item.wy+item.y-player.y);
      if(dist>390)continue;
      const priority=item.kind==='news'?25:item.kind==='images'?20:item.kind==='videos'?18:item.kind==='articles'?12:0;
      ranked.push({item,s,score:dist-priority});
    }
    ranked.sort((a,b)=>a.score-b.score);
    const selected=[];
    // Primeira passagem: conteúdo variado. Segunda: completar com outros pontos.
    for(const uniqueKind of [true,false]){
      for(const current of ranked){
        if(selected.length>=budget)break;
        if(selected.some(other=>other.item===current.item))continue;
        if(uniqueKind&&selected.some(other=>other.item.kind===current.item.kind))continue;
        if(selected.some(other=>Math.abs(current.s.x-other.s.x)<148&&Math.abs(current.s.y-other.s.y)<105))continue;
        selected.push(current);
      }
    }
    return selected.map(x=>x.item);
  }
  function setActive(value){const next=Boolean(value);if(enabled===next)return;enabled=next;layer.classList.toggle('world-previews-hidden',!enabled);}
  function sync({candidates,cam,canvas,player},now=performance.now()){
    if(!enabled||now-lastSync<UPDATE_MS)return;
    lastSync=now;
    const rect=rectFor(cam,canvas,now);
    const list=pick(candidates,cam,rect,player);
    const wanted=new Set(list.map(previewKey));
    for(const key of shown.keys())if(!wanted.has(key))remove(key);
    for(const item of list)if(!shown.has(previewKey(item)))add(item);
    pump();
    place(cam,canvas,now,true);
  }
  function place(cam,canvas,now=performance.now(),force=false){
    if(!enabled||(!force&&now-lastPlace<43)||!shown.size)return;
    lastPlace=now;
    const rect=rectFor(cam,canvas,now);
    for(const entry of shown.values()){
      const xy=computeScreen(entry.item,cam,rect);
      entry.card.style.transform=`translate3d(${Math.round(xy.x)}px,${Math.round(xy.y)}px,0) translate(-50%,-50%)`;
      entry.card.style.visibility=xy.x<0||xy.x>rect.w||xy.y<0||xy.y>rect.h?'hidden':'visible';
    }
  }
  function reset(){for(const key of shown.keys())remove(key);lastSync=0;viewport=null;}
  return {sync,place,setActive,reset,inspect:()=>({active:shown.size,requests:running,cache:dataCache.size})};
}
