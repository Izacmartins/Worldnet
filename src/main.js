import {loadResources, localResources, findLocalResources, searchResources, resourceKey} from './search-client.js';
import {RESOURCE_LABELS} from '../shared/resources.js';
import Phaser from 'phaser';
import './style.css';
import {createContentPanel} from './content-ui.js';
import {createWorldPreviews} from './world-previews.js';
import {drawKiosk,installationPositions,kioskWithin,LABELS} from './city-content-art.js';
import { CHUNK_W, CHUNK_H, THEMES, buildingPlan, infoLevel, hitsSolid, distanceToSolid, drawGround, drawBuilding } from './city-art.js';
import { visualIdentity } from './identity.js';
import { sampleLogoColor } from './logo-colors.js';
import { isOpenPlot, terrainVariant } from './layout.js';
import { getCatalog, searchCatalog } from './catalog.js';
import {
  loadDiscoveries, searchDiscoveries
} from './discovery.js';

// Six by three invisible planning cells per chunk; roads are reserved around each lot.
const app = document.querySelector('#app');
app.innerHTML = `
<main id="world">
  <div id="game" aria-label="Cidade digital Worldnet"></div>
  <div id="favicons" aria-hidden="true"></div>
  <div id="depth-top" class="depth-layer depth-top" aria-hidden="true"></div>
  <div id="depth-bottom" class="depth-layer depth-bottom" aria-hidden="true"></div>
  <header class="topbar">
    <div class="brand"><span class="brand-symbol">W<span class="brand-spark">✦</span></span><div><strong>WORLDNET<span class="brand-point">.</span></strong><small>DIGITAL CITY  /  EXPLORE</small></div></div>
    <div class="top-actions">
      <a class="tool-button world3d-link" href="/3d.html" title="Explorar cidade 3D">3D ↗</a>
      <div class="counter" id="counter">Preparando cidade…</div>
      <button id="depth-toggle" class="tool-button" type="button" aria-label="Alternar efeito de profundidade" title="Alternar efeito de profundidade">◉ <span>FOCO</span></button>
      <button id="theme-toggle" class="tool-button" type="button" aria-label="Alternar tema dark e light" title="Alternar tema dark/light">☾ <span>DARK</span></button>
      <button id="content-shortcut" class="tool-button" type="button" title="Explorar conteúdo multimídia">▣ <span>CONTEÚDOS</span></button>
      <button id="search-shortcut" class="primary">⌕ <span>PESQUISAR</span></button>
    </div>
  </header>
  <aside class="hud" id="hud" aria-live="polite"></aside>
  <aside class="results-panel hidden" id="results-panel" aria-label="Destinos encontrados">
    <div class="results-header"><div><span class="mini-label">LOCALIZADOR / WORLDNET</span><strong id="results-heading">Resultados</strong></div><button id="close-results" class="icon-button" aria-label="Fechar resultados">✕</button></div>
    <div id="result-list" class="result-list"></div>
  </aside>
  <div class="notice"><span class="notice-dot"></span> <kbd>WASD</kbd> / <kbd>↑↓←→</kbd> CAMINHAR <span class="sep">·</span> <kbd>MOUSE</kbd> GUIAR <span class="sep">·</span> <kbd>E</kbd> CENTRAL <span class="sep">·</span> <kbd>/</kbd> BUSCAR <span class="sep">·</span> <kbd>F</kbd> CONTEÚDOS <span class="sep">·</span> <kbd>CLIQUE</kbd> ENTRAR</div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div class="modal hidden" id="search-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <section class="panel">
      <div class="panel-heading"><div><span class="mini-label">WORLDNET  /  CENTRAL DE DESCOBERTA</span><h1 id="modal-title">Para onde vamos<span class="brand-point">?</span></h1></div><button class="icon-button" id="close-search" aria-label="Fechar">✕</button></div>
      <p>Pesquise conteúdos e explore os lugares que eles ocupam na cidade. Sites, canais, vídeos e artigos têm identidades próprias.</p>
      <form id="search-form"><label class="sr-only" for="query">Pesquisar assunto ou nome do site</label><input id="query" type="search" maxlength="200" placeholder="Pesquise um assunto, canal ou cole um link..." required autocomplete="off"/><button id="search-button" type="submit">LOCALIZAR ↗</button></form>
      <div class="message" id="message" aria-live="polite">Índice local + fontes públicas. Sem APIs pagas e sem créditos.</div>
      <div class="explain"><span>✧ Descoberta pública</span><span>✧ Seu catálogo local</span><span>✧ Mundo conectado</span></div>
      <p class="limitation">A descoberta depende de fontes públicas acessíveis. A busca ampla requer um SearXNG próprio. Cole um link para registrar um conteúdo específico. Metadados indisponíveis não são inventados.</p>
    </section>
  </div>
</main>`;

const el = id => document.getElementById(id);
const modal = el('search-modal');
const toast = el('toast');
const counter = el('counter');
const hud = el('hud');
const iconsEl = el('favicons');
const msg = el('message');
const button = el('search-button');
const resultPanel = el('results-panel');
const resultList = el('result-list');
let catalog = null;
let discoveries = [];
let gameScene = null;
// Content appears only on explicit interaction; no media on the rendering loop.
const contentPanel=createContentPanel(el('world'),{onClose:()=>restoreGameFocus()});
const worldPreviews=createWorldPreviews(el('world'),{onOpen:({site,tab})=>contentPanel.open({site,tab})});
let sites = new Map();              // domínio -> dados mais completos disponíveis
let positions = new Map();          // domínio -> posição fixa no mundo
let worldIndex = new Map();         // "chunkX,chunkY" -> domínio
let catalogLabel = 'Catálogo popular: carregando';
let timerId;
let searchFocusTimer;
let searching = false;
// Só carregamos logos de fachadas próximas. Cache de cores extraídas com CORS.
const logoFailures = new Set();
const colorAttempts = new Set();
let colorChecks = 0;
let savedLogoColors = {};
try { savedLogoColors = JSON.parse(localStorage.getItem('worldnet-logo-colors-v09') || '{}'); }
catch { savedLogoColors = {}; }
function officialColorFor(site) {
  if(site.id)return site;
  if (site.colorVerified) return site;
  const color = savedLogoColors[site.domain];
  return /^#[0-9a-f]{6}$/i.test(color || '')
    ? {...site,color,colorVerified:true,colorEvidence:'Cor extraída da imagem da logo pelo navegador'} : site;
}
function tryLogoPalette(site,url) {
  if (site.id || site.colorVerified || colorAttempts.has(site.domain) || colorChecks>=5) return;
  colorAttempts.add(site.domain); colorChecks++;
  void sampleLogoColor(url,2300).then(color=>{
    const current=sites.get(site.domain);
    if (!color || !current || current.colorVerified) return;
    savedLogoColors[site.domain]=color;
    // Limite de armazenamento local evita crescimento ilimitado.
    if (Object.keys(savedLogoColors).length>120) {
      const first=Object.keys(savedLogoColors)[0]; delete savedLogoColors[first];
    }
    try { localStorage.setItem('worldnet-logo-colors-v09',JSON.stringify(savedLogoColors)); }catch{}
    sites.set(site.domain,{...current,color,colorVerified:true,colorEvidence:'Pixels da logo acessível com CORS'});
    gameScene?.redrawSite(site.domain);
  });
}

const getSetting=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const setSetting=(key,val)=>{try{localStorage.setItem(key,val);}catch{/* modo privado */}};
let theme = getSetting('worldnet-city-theme','dark') === 'light' ? 'light' : 'dark';
let depthEnabled = getSetting('worldnet-city-v07-depth','off') === 'on';
function applyAppearance(rebuild=false){
  document.documentElement.dataset.theme=theme;
  el('world').classList.toggle('depth-on',depthEnabled);
  el('theme-toggle').innerHTML=theme==='dark'?'☾ <span>DARK</span>':'☀ <span>LIGHT</span>';
  el('theme-toggle').setAttribute('aria-pressed',String(theme==='light'));
  el('depth-toggle').classList.toggle('tool-muted',!depthEnabled);
  el('depth-toggle').setAttribute('aria-pressed',String(depthEnabled));
  if(rebuild && gameScene){gameScene.cameras.main.setBackgroundColor(THEMES[theme].backdrop);gameScene.reloadChunks();}
}
applyAppearance();

function hash(s) { let n=2166136261; for (const c of s) n=Math.imul(n ^ c.charCodeAt(0),16777619); return n >>> 0; }
function validColor(c) { return /^#[0-9a-f]{6}$/i.test(c || ''); }
function siteColor(site) { return visualIdentity(site).accentCss; }
function safeNumber(n) { return Number(n || 0).toLocaleString('pt-BR'); }
function currentCounter() { counter.textContent=`${catalogLabel} · ${safeNumber(localResources().length)} conteúdos na cidade`; }
function inform(text) { toast.textContent=text; toast.classList.add('visible'); clearTimeout(timerId); timerId=setTimeout(()=>toast.classList.remove('visible'),4200); }
function restoreGameFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const canvas = gameScene?.game?.canvas;
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.focus({preventScroll:true});
  }
  gameScene?.input.keyboard?.resetKeys();
}
function modalOpen() {
  if (!modal.classList.contains('hidden') || contentPanel.isOpen()) return;
  modal.classList.remove('hidden');
  msg.textContent='Pesquise no índice ou nas fontes públicas. Você também pode colar um link.';
  if (gameScene) gameScene.mouseTarget=null;
  clearTimeout(searchFocusTimer);
  searchFocusTimer=setTimeout(()=>{
    if (!modal.classList.contains('hidden')) el('query').focus();
  },0);
}
function closeSearchAndResume() {
  modal.classList.add('hidden');
  clearTimeout(searchFocusTimer);
  restoreGameFocus();
}
function modalClose() {
  if (searching) return;
  closeSearchAndResume();
}

function rebuildWorld() {
  const index = new Map(), coords = new Map(), worldSites = new Map();
  let x = 0, y = 0, direction = 0, length = 1, steps = 0, turns = 0;
  const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
  // Catálogo popular: região central. Os sites continuam no mapa sem pesquisas.
  for (const item of catalog?.sites || []) {
    // Os espaços vagos são determinísticos: o mesmo domínio permanece no mesmo endereço
    // com o mesmo catálogo, mas nem todo chunk precisa conter um edifício.
    do {
      x+=dirs[direction][0]; y+=dirs[direction][1];
      if (++steps === length) { steps=0; direction=(direction+1)%4; if (++turns%2 === 0) length++; }
    } while (isOpenPlot(x,y));
    const key = `${x},${y}`;
    index.set(key, item.domain);
    coords.set(item.domain, { x, y });
    worldSites.set(item.domain, officialColorFor({ domain:item.domain, title:item.domain,
      url:`https://${item.domain}/`, rank:item.rank, category:'Site', official:false }));
  }
  // Descobertas independentes da pesquisa: posições calculadas pelo domínio.
  // Não movem os chunks já existentes e permanecem depois de F5.
  for (const found of [...discoveries].sort((a,b)=>a.domain.localeCompare(b.domain))) {
    if (coords.has(found.domain)) { worldSites.set(found.domain, officialColorFor({ ...worldSites.get(found.domain), ...found })); continue; }
    const h = hash(found.domain), angle = h / 4294967296 * Math.PI * 2;
    const r = 95 + ((hash(found.domain + ':r') % 155));
    let px = Math.round(Math.cos(angle)*r), py = Math.round(Math.sin(angle)*r);
    let key = `${px},${py}`;
    let k = 0;
    while (index.has(key) && k < 400) { k++; px += ((k%2)?1:-1)*k; py += 1; key=`${px},${py}`; }
    if (index.has(key)) continue;
    index.set(key, found.domain);
    coords.set(found.domain, { x:px, y:py });
    worldSites.set(found.domain, officialColorFor(found));
  }
  // Resources have persistent coordinates independent of the domain catalog.
  for(const resource of localResources()) {
    if(!resource.world)continue;
    const key=resourceKey(resource), {x:px,y:py}=resource.world;
    index.set(`${px},${py}`,key);coords.set(key,{x:px,y:py});worldSites.set(key,resource);
  }
  sites = worldSites; worldIndex = index; positions = coords;
  gameScene?.reloadChunks();
  currentCounter();
}
function teleportDomain(domain) {
  const coords = positions.get(domain);
  if (!coords || !gameScene) { inform('Esse site ainda não tem posição no mapa.'); return false; }
  gameScene.teleport(coords);
  restoreGameFocus();
  inform(`Você chegou a ${sites.get(domain)?.displayName || sites.get(domain)?.title || domain}`);
  return true;
}
function showResults(query, found) {
  el('results-heading').textContent=query;
  resultList.replaceChildren();
  if (!found.length) { resultPanel.classList.add('hidden'); return; }
  for (const result of found.slice(0, 20)) {
    const s = sites.get(resourceKey(result)) || result;
    const row=document.createElement('button'); row.className='result'; row.type='button';
    const dot=document.createElement('span');dot.className='result-dot';dot.style.backgroundColor=siteColor(s);
    const inner=document.createElement('span');inner.className='result-info';
    const name=document.createElement('strong');name.textContent=s.displayName || s.title || s.domain;
    const detail=document.createElement('small');detail.textContent=(s.kind ? `${RESOURCE_LABELS[s.kind] || 'Conteúdo'} · ` : '') + s.domain + (s.rank ? ` · ranking #${s.rank}` : s.official ? ' · site oficial identificado' : ' · referência pública') + ` · ${visualIdentity(s).category}`;
    inner.append(name,detail);
    const arrow=document.createElement('span');arrow.textContent='↗';arrow.className='arrow';
    row.append(dot,inner,arrow);
    row.addEventListener('click',()=>teleportDomain(resourceKey(s)));
    resultList.append(row);
  }
  resultPanel.classList.remove('hidden');
}
async function onSearch(event) {
  event.preventDefault();
  if(searching)return;
  const query=el('query').value.trim();if(!query)return;
  searching=true;button.disabled=true;button.textContent='LOCALIZANDO…';
  const local=findLocalResources(query);
  msg.textContent=local.length?`${local.length} conteúdo(s) no cache; consultando fontes…`:'Consultando índice e fontes públicas…';
  try {
    const response=await searchResources(query);
    const ranked=catalog?searchCatalog(catalog,query,12):[];
    const legacy=searchDiscoveries(query,12);
    rebuildWorld();
    const merged=new Map();
    for(const item of [...response.results,...local,...legacy,...ranked]){
      const key=resourceKey(item);
      if(!merged.has(key))merged.set(key,sites.get(key)||item);
    }
    const results=[...merged.values()];
    const failed=response.errors?.length>0;
    if(!results.length){
      msg.textContent=failed?'As fontes não responderam e não há resultados no índice. Tente um link direto ou uma pesquisa já salva.':'Nenhum conteúdo encontrado nas fontes disponíveis. A busca ampla depende de um SearXNG configurado.';
      return;
    }
    closeSearchAndResume();
    showResults(query,results);
    teleportDomain(resourceKey(results[0]));
    if(failed)inform('Resultados parciais: uma fonte não respondeu. Endereços sem metadados aparecem identificados.');
    else if(response.cached)inform('Resultados recuperados do índice e cache do Worldnet.');
  } finally {
    searching=false;button.disabled=false;button.textContent='LOCALIZAR ↗';
  }
}

el('theme-toggle').addEventListener('click',()=>{
  theme=theme==='dark'?'light':'dark';setSetting('worldnet-city-theme',theme);applyAppearance(true);
  if(modal.classList.contains('hidden'))restoreGameFocus();
});
el('depth-toggle').addEventListener('click',()=>{
  depthEnabled=!depthEnabled;setSetting('worldnet-city-v07-depth',depthEnabled?'on':'off');applyAppearance();
  if(modal.classList.contains('hidden'))restoreGameFocus();
});
el('search-form').addEventListener('submit',onSearch);
el('close-search').addEventListener('click',modalClose);
el('search-shortcut').addEventListener('click',modalOpen);
el('content-shortcut').addEventListener('click',()=>{
  const nearest=gameScene?.nearKiosk();
  const s=nearest?.site||gameScene?.currentSite()||null;
  contentPanel.open({site:s,tab:nearest?.kind||'about'});
});
el('close-results').addEventListener('click',()=>resultPanel.classList.add('hidden'));
modal.addEventListener('click',e=>{if (e.target===modal)modalClose();});
window.addEventListener('keydown',e=>{
  if (contentPanel.isOpen()) {if(e.key==='Escape')contentPanel.close();return;}
  if (e.key==='Escape') modalClose();
  if (document.activeElement?.matches('input,textarea')) return;
  if (!modal.classList.contains('hidden'))return;
  if ((e.key==='f'||e.key==='F') && gameScene) {
    e.preventDefault();
    const near=gameScene.nearKiosk();
    contentPanel.open({site:near?.site||gameScene.currentSite()||null,tab:near?.kind||'about'});
  }
  if ((e.key==='e'||e.key==='E') && gameScene?.atHome()) {e.preventDefault();modalOpen();}
  if (e.key==='/' && modal.classList.contains('hidden')) {e.preventDefault();modalOpen();}
});

class World extends Phaser.Scene {
  constructor() {
    super('World');
    this.pos={x:CHUNK_W/2,y:CHUNK_H-17}; // spawn on Central's front sidewalk
    this.chunks=new Map(); this.icons=new Map();
    this.chunkBoundsKey=''; this.iconRects=null; this.iconRectsAt=0;
    this.mouseTarget=null;this.lastKey='';this.walkTime=0;
    this.liteMode=false;this.slowFrameSeconds=0;
  }
  create(){
    gameScene=this;
    this.cameras.main.setBackgroundColor(THEMES[theme].backdrop);
    // Câmera próxima: tamanho do personagem semelhante ao protótipo original.
    this.cameras.main.setZoom(this.scale.width<700?1.35:1.65);
    this.scale.on('resize',()=>{
      this.cameras.main.setZoom(this.scale.width<700?1.35:1.65);
      this.chunkBoundsKey=''; this.iconRects=null; this.refreshChunks();
    });
    this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT',false);
    this.avatar=this.add.container(this.pos.x,this.pos.y).setDepth(this.pos.y+4);
    // Tiny character, approximately half the original avatar's height.
    // The feet mark the actual collision/movement position.
    const a=this.add.graphics();
    a.fillStyle(0x00050f,.35).fillEllipse(0,0,27,8);
    a.fillStyle(0x0c1930).fillRoundedRect(-9,-11,8,13,2);
    a.fillRoundedRect(2,-11,8,13,2);
    a.fillStyle(0x1e3152).fillRoundedRect(-12,-26,24,18,4);
    a.fillStyle(0x47b5cf).fillRoundedRect(-8,-25,16,12,3);
    a.lineStyle(2,0xa6f4ff,.9).lineBetween(-4,-23,4,-23);
    a.fillStyle(0x7b9bbb).fillRoundedRect(-15,-23,5,11,2);
    a.fillRoundedRect(10,-23,5,11,2);
    a.fillStyle(0xe5ac86).fillCircle(0,-34,10);
    a.fillStyle(0x172338).fillRoundedRect(-10,-44,20,9,5);
    a.fillRect(-10,-40,5,4);
    a.fillRect(5,-40,5,4);
    a.fillStyle(0x1d2a40).fillRect(-5,-35,3,2);
    a.fillRect(3,-35,3,2);
    a.fillStyle(0xeafaff).fillRect(-5,-9,8,3);
    a.fillRect(3,-9,8,3);
    this.avatar.add(a);
    this.cameras.main.startFollow(this.avatar,true,1,1);
    this.input.on('pointerdown',p=>{
      if(!modal.classList.contains('hidden')||contentPanel.isOpen()||!p.leftButtonDown())return;
      const kiosk=this.kioskAt(p.worldX,p.worldY);
      if(kiosk){
        this.mouseTarget=null;
        contentPanel.open({site:kiosk.site||null,tab:kiosk.kind});
        return;
      }
      const site=this.currentSite();
      const cx=Math.floor(this.pos.x/CHUNK_W),cy=Math.floor(this.pos.y/CHUNK_H);
      const onBuilding=site&&distanceToSolid(p.worldX,p.worldY,cx*CHUNK_W,cy*CHUNK_H,buildingPlan(site))===0;
      if(onBuilding){
        this.mouseTarget=null;
        const address=site.url||`https://${site.domain}/`;
        window.open(address,'_blank','noopener,noreferrer');
      } else if(this.atHome()&&distanceToSolid(p.worldX,p.worldY,0,0,buildingPlan(null,true))===0){modalOpen();}
      else this.mouseTarget={x:p.worldX,y:p.worldY};
    });
    this.input.on('pointermove',p=>{
      if(p.isDown && modal.classList.contains('hidden') && !contentPanel.isOpen())this.mouseTarget={x:p.worldX,y:p.worldY};
    });
    this.input.on('pointerup',()=>this.mouseTarget=null);
    this.refreshChunks();
  }
  atHome(){return Math.floor(this.pos.x/CHUNK_W)===0 && Math.floor(this.pos.y/CHUNK_H)===0;}
  getSite(cx,cy){return sites.get(worldIndex.get(`${cx},${cy}`));}
  // O terreno é sempre o mesmo padrão. Convertemos seus vetores em apenas
  // duas texturas reutilizáveis: evita dezenas de milhares de comandos gráficos por quadro.
  groundTexture(cx,cy,isVacant){
    const variant=terrainVariant(cx,cy);
    const key=`worldnet-road-${theme}-${variant}-${isVacant?'open':'site'}`;
    if(!this.textures.exists(key)){
      const terrain=drawGround(this,variant,0,theme,isVacant);
      terrain.generateTexture(key,CHUNK_W,CHUNK_H);
      terrain.destroy();
    }
    return key;
  }
  detailAt(cx,cy){
    const playerCx=Math.floor(this.pos.x/CHUNK_W),playerCy=Math.floor(this.pos.y/CHUNK_H);
    const radius=this.liteMode?0:1;
    return Math.max(Math.abs(cx-playerCx),Math.abs(cy-playerCy))<=radius?'full':'lite';
  }
  destroyChunk(key){
    const c=this.chunks.get(key);
    if(!c)return;
    c.ground.destroy();c.building?.destroy();
    for(const k of c.kiosks||[]) k.rendered.destroy();
    this.chunks.delete(key);
    this.icons.get(key)?.img.remove();this.icons.delete(key);
  }
  reloadChunks(){
    worldPreviews.reset();
    for(const key of [...this.chunks.keys()])this.destroyChunk(key);
    this.chunkBoundsKey='';
    this.refreshChunks();
  }
  redrawSite(domain){
    const pos=positions.get(domain);
    if(!pos)return;
    const key=`${pos.x},${pos.y}`;
    if(!this.chunks.has(key))return;
    this.destroyChunk(key);
    this.drawChunk(pos.x,pos.y);
  }
  drawChunk(cx,cy){
    const key=`${cx},${cy}`,x=cx*CHUNK_W,y=cy*CHUNK_H;
    const site=this.getSite(cx,cy),isHome=cx===0&&cy===0;
    const detail=this.detailAt(cx,cy);
    const ground=this.add.image(x,y,this.groundTexture(cx,cy,!site&&!isHome)).setOrigin(0).setDepth(-100000);
    let building=null;
    if(site||isHome){
      const plan=buildingPlan(site,isHome);
      const rendered=drawBuilding(this,site,plan,theme,{lite:detail==='lite'});
      building=rendered.container;
      building.setPosition(x,y).setDepth(y+plan.solid.y+plan.solid.h+4);
      // Ícones grandes são solicitados somente perto do jogador; nunca para todo o ranking.
      if(site && !site.id && rendered.favicon && this.icons.size<7){
        const fromWikidata=site.logoVerified && site.logoUrl;
        const mainUrl=fromWikidata?site.logoUrl:`https://${site.domain}/favicon.ico`;
        const fallbackUrl=`https://${site.domain}/favicon.ico`;
        if(!logoFailures.has(mainUrl)){
          const img=new Image();img.alt='';img.loading='lazy';img.decoding='async';
          img.referrerPolicy='no-referrer';img.style.visibility='hidden';
          img.style.width=`${rendered.favicon.size}px`;
          img.style.height=`${rendered.favicon.size}px`;
          img.onload=()=>{
            if(this.icons.get(key)?.img!==img)return;
            iconsEl.append(img);
            // Amostra cores REAIS quando o arquivo autoriza leitura por CORS.
            tryLogoPalette(site,img.src);
          };
          img.onerror=()=>{
            logoFailures.add(img.src);
            if(fromWikidata && img.src!==fallbackUrl && !logoFailures.has(fallbackUrl)) img.src=fallbackUrl;
            else img.remove();
          };
          this.icons.set(key,{img,worldX:x+rendered.favicon.x,worldY:y+rendered.favicon.y});
          img.src=mainUrl;
        }
      }
    }
    // Real city furnishings are lightweight vector kiosks. Only nearby kiosks
    // exist in memory; no remote images or videos are loaded here.
    const kiosks=[];
    const showMedia=detail==='full' && (site||isHome||terrainVariant(cx,cy)%3===0);
    if(showMedia){
      for(const item of installationPositions(cx,cy,site,isHome,false)){
        const rendered=drawKiosk(this,theme,item.kind,{compact:Boolean(site),wall:Boolean(item.wall)});
        rendered.setPosition(x+item.x,y+item.y).setDepth(y+item.y+3);
        kiosks.push({...item,rendered,wx:x,wy:y});
      }
    }
    this.chunks.set(key,{ground,building,detail,hasBuilding:Boolean(site||isHome),kiosks});
  }
  refreshChunks(){
    const cam=this.cameras.main;
    if(!cam)return;
    // A tela mostra somente ~2,5x2 chunks no zoom atual, não 7x7.
    // Uma margem de meio chunk evita surgimento abrupto nas bordas.
    const marginX=CHUNK_W*.18,marginY=CHUNK_H*.18;
    const halfW=cam.width/(2*cam.zoom),halfH=cam.height/(2*cam.zoom);
    const x0=Math.floor((this.pos.x-halfW-marginX)/CHUNK_W);
    const x1=Math.floor((this.pos.x+halfW+marginX)/CHUNK_W);
    const y0=Math.floor((this.pos.y-halfH-marginY)/CHUNK_H);
    const y1=Math.floor((this.pos.y+halfH+marginY)/CHUNK_H);
    const boundsKey=`${x0}:${x1}:${y0}:${y1}`;
    const playerChunk=`${Math.floor(this.pos.x/CHUNK_W)},${Math.floor(this.pos.y/CHUNK_H)}`;
    if(boundsKey===this.chunkBoundsKey && playerChunk===this.lastPlayerChunk)return;
    this.lastPlayerChunk=playerChunk;
    this.chunkBoundsKey=boundsKey;
    const needed=new Set();
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
      const key=`${cx},${cy}`;needed.add(key);
      const prev=this.chunks.get(key);
      // Prédios distantes usam apenas a silhueta; o detalhamento entra quando o jogador se aproxima.
      if(prev?.hasBuilding && prev.detail!==this.detailAt(cx,cy))this.destroyChunk(key);
      if(!this.chunks.has(key))this.drawChunk(cx,cy);
    }
    for(const key of this.chunks.keys())if(!needed.has(key))this.destroyChunk(key);
  }
  solidAt(x,y){
    const cx=Math.floor(x/CHUNK_W),cy=Math.floor(y/CHUNK_H);
    for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++){
      const site=this.getSite(xx,yy),isHome=xx===0&&yy===0;
      if(!site&&!isHome)continue;
      if(hitsSolid(x,y,xx*CHUNK_W,yy*CHUNK_H,buildingPlan(site,isHome),7))return true;
    }
    return false;
  }
  nearKiosk(){
    const cx=Math.floor(this.pos.x/CHUNK_W),cy=Math.floor(this.pos.y/CHUNK_H);
    let nearest=null,best=Infinity;
    for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++){
      const chunk=this.chunks.get(`${xx},${yy}`);
      for(const kiosk of chunk?.kiosks||[]){
        const dist=Math.hypot(this.pos.x-kiosk.wx-kiosk.x,this.pos.y-kiosk.wy-kiosk.y);
        if(dist<=kiosk.range && dist<best){nearest=kiosk;best=dist;}
      }
    }
    return nearest;
  }
  kioskAt(x,y){
    const cx=Math.floor(x/CHUNK_W),cy=Math.floor(y/CHUNK_H);
    for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++){
      for(const kiosk of this.chunks.get(`${xx},${yy}`)?.kiosks||[]){
        const pointerDistance=Math.hypot(x-kiosk.wx-kiosk.x,y-kiosk.wy-kiosk.y);
        const playerDistance=Math.hypot(this.pos.x-kiosk.wx-kiosk.x,this.pos.y-kiosk.wy-kiosk.y);
        if(pointerDistance<40 && playerDistance<=kiosk.range+32)return kiosk;
      }
    }
    return null;
  }
  currentSite(){
    const cx=Math.floor(this.pos.x/CHUNK_W),cy=Math.floor(this.pos.y/CHUNK_H);
    const site=this.getSite(cx,cy);if(!site)return null;
    // The visitor stands on a walkable road / sidewalk, never inside the building.
    return distanceToSolid(this.pos.x,this.pos.y,cx*CHUNK_W,cy*CHUNK_H,buildingPlan(site))<=58?site:null;
  }
  teleport(chunk){
    // Front sidewalk is safe: no teleport into solid structures.
    this.pos.x=(chunk.x+.5)*CHUNK_W;
    this.pos.y=(chunk.y+1)*CHUNK_H-17;
    this.avatar.setPosition(this.pos.x,this.pos.y).setDepth(this.pos.y+3);
    this.cameras.main.centerOn(this.pos.x,this.pos.y);
    this.mouseTarget=null;this.refreshChunks();
  }
  update(_time,delta){
    const uiActive=!modal.classList.contains('hidden') || contentPanel.isOpen();
    worldPreviews.setActive(!uiActive);
    if(uiActive)return;
    const allKiosks=[];
    for(const chunk of this.chunks.values()) for(const kiosk of chunk.kiosks||[]) allKiosks.push(kiosk);
    worldPreviews.sync({candidates:allKiosks,cam:this.cameras.main,canvas:this.game.canvas,player:this.pos});
    worldPreviews.place(this.cameras.main,this.game.canvas);

    const dt=Math.min(delta,50)/1000,speed=188;
    // Ajuste automático conservador se o aparelho mantiver baixa taxa de quadros.
    // Não desliga gameplay, pesquisa, colisões nem logos do prédio atual.
    if(!this.liteMode && delta>32) this.slowFrameSeconds+=dt;
    else this.slowFrameSeconds=Math.max(0,this.slowFrameSeconds-dt*.7);
    if(this.slowFrameSeconds>2.6){
      this.liteMode=true;this.chunkBoundsKey='';
      if(depthEnabled){depthEnabled=false;applyAppearance();}
      inform('Modo leve automático ativado para melhorar a fluidez.');
    }
    let dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
    let dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
    if(dx||dy)this.mouseTarget=null;
    else if(this.mouseTarget){
      dx=this.mouseTarget.x-this.pos.x;dy=this.mouseTarget.y-this.pos.y;
      if(Math.hypot(dx,dy)<11){dx=0;dy=0;}
    }
    const magnitude=Math.hypot(dx,dy);
    if(magnitude){
      const stepX=(dx/magnitude)*speed*dt,stepY=(dy/magnitude)*speed*dt;
      // Axis-by-axis collision resolution allows sliding alongside facades.
      if(!this.solidAt(this.pos.x+stepX,this.pos.y))this.pos.x+=stepX;
      if(!this.solidAt(this.pos.x,this.pos.y+stepY))this.pos.y+=stepY;
      this.walkTime+=dt;
      this.avatar.setRotation(Math.sin(this.walkTime*13)*.022);
    }else this.avatar.setRotation(0);
    this.avatar.setPosition(this.pos.x,this.pos.y).setDepth(this.pos.y+3);
    this.refreshChunks();
    const site=this.currentSite();
    const chunk=`${Math.floor(this.pos.x/CHUNK_W)}, ${Math.floor(this.pos.y/CHUNK_H)}`;
    const key=site?resourceKey(site):(this.atHome()?'home':'empty');
    if(this.lastKey!==key||hud.dataset.chunk!==chunk){
      hud.replaceChildren();
      const eyebrow=document.createElement('small');eyebrow.className='hud-eyebrow';
      eyebrow.textContent=site?`◈ ${RESOURCE_LABELS[site.kind] || 'LOCAL'} DETECTADO`:this.atHome()?'◈ PONTO INICIAL':'◈ EXPLORANDO';
      const title=document.createElement('strong');title.textContent=site?(site.displayName||site.title):(this.atHome()?'Central Worldnet':'Cidade digital');
      const location=document.createElement('small');location.textContent=`SETOR  ${chunk}`;
      const identity=site?visualIdentity(site):null;
      const info=document.createElement('span');info.textContent=site?
        (site.rank?`POPULARIDADE #${safeNumber(site.rank)} · ${identity.category} · NÍVEL ${infoLevel(site)}/3`:
         `${identity.category} · NÍVEL ${infoLevel(site)}/3 · posição catalogada`):
        (this.atHome()?'Estação de pesquisa neste setor':'Explore as ruas e descubra novos lugares');
      if(site?.source){info.textContent+=` · Fonte: ${site.source}`;}
      if(site?.metadataStatus==='url-only'){info.textContent+=' · apenas endereço, metadados não confirmados';}
      if(site && identity?.colorSource==='decorativa'){info.textContent += ' · cor cenográfica';}
      if(site && identity?.confidence==='estimativa'){info.textContent += ' · tipo estimado';}
      const action=document.createElement('em');
      action.textContent=site?'◉ CLIQUE: ORIGINAL · F: CONTEÚDOS':this.atHome()?'◉ E: PESQUISA · F: CONTEÚDOS':'◉ F: BANCAS / MÍDIA';
      hud.append(eyebrow,title,location,info,action);this.lastKey=key;hud.dataset.chunk=chunk;
    }
    if(this.icons.size)this.updateIcons();
  }
  updateIcons(){
    const cam=this.cameras.main;
    // O layout da página só é consultado no resize, não 60x por segundo.
    const now=performance.now();
    // DOM favicons: 24 Hz cap, never trigger a style/layout update for each 60 Hz frame.
    if(this.lastIconFrame && now-this.lastIconFrame<42)return;
    this.lastIconFrame=now;
    if(!this.iconRects || now-this.iconRectsAt>1500){
      const canvas=this.game.canvas.getBoundingClientRect();
      const parent=el('game').getBoundingClientRect();
      this.iconRects={w:canvas.width,h:canvas.height,x:canvas.left-parent.left,y:canvas.top-parent.top};
      this.iconRectsAt=now;
    }
    const {w,h,x,y}=this.iconRects;
    const rX=w/cam.width,rY=h/cam.height;
    for(const {img,worldX,worldY} of this.icons.values()){
      const sx=(worldX-cam.worldView.x)*cam.zoom*rX+x;
      const sy=(worldY-cam.worldView.y)*cam.zoom*rY+y;
      const hidden=(sx<-48||sy<-45||sx>w+48||sy>h+48);
      img.style.visibility=hidden?'hidden':'visible';
      if(!hidden)img.style.transform=`translate3d(${Math.round(sx)}px,${Math.round(sy)}px,0) translate(-50%,-50%)`;
    }
  }

}

new Phaser.Game({
  type:Phaser.AUTO,parent:'game',width:1280,height:720,backgroundColor:THEMES[theme].backdrop,
  // Parent bounds can be zero during layout/visibility transitions. WebGL
  // cannot allocate 0×0 framebuffer attachments; retain a valid backing store.
  scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,min:{width:1,height:1}},
  render:{antialias:false,roundPixels:true},scene:[World]
});

async function start() {
  // O motor funciona mesmo que a fonte externa do ranking esteja indisponível.
  await loadResources();
  discoveries=await loadDiscoveries();
  rebuildWorld();
  catalogLabel='Catálogo popular: verificando';currentCounter();
  try {
    catalog=await getCatalog(text=>{catalogLabel=text;currentCounter();});
    catalogLabel=`${safeNumber(catalog.sites.length)} domínios populares`;
    rebuildWorld();
  } catch(err) {
    catalogLabel='Ranking indisponível: descubra sites pela pesquisa';
    currentCounter();
    inform('O ranking não carregou. Você ainda pode descobrir sites pela pesquisa.');
  }
}
void start();

// Read-only diagnostics for manual profiling and browser regression checks.
export function inspectWorld(){
  return gameScene?{position:{...gameScene.pos},chunks:gameScene.chunks.size,
    current:gameScene.currentSite()?resourceKey(gameScene.currentSite()):null,
    colliding:gameScene.solidAt(gameScene.pos.x,gameScene.pos.y),
    resources:localResources().length,theme,searching}:null;
}
