import './style.css';
import {createRuntime} from './runtime.js';
import {WorldRegistry,keyOf} from './model.js';
import {loadResources,localResources,searchResources,findLocalResources} from '../search-client.js';
import {getCatalog,searchCatalog} from '../catalog.js';
import {RESOURCE_LABELS,publicUrl} from '../../shared/resources.js';

document.querySelector('#app').innerHTML=`
<main class="city3d">
  <div id="viewport"></div>
  <header><a class="brand3d" href="/3d.html" aria-label="Worldnet 3D">W<span>WORLDNET<small>A INTERNET, EM OUTRA DIMENSÃO</small></span></a>
    <nav><button id="search-open">⌕ <span>LOCALIZAR</span></button><button id="theme" aria-label="Alternar tema">☀</button><button id="help-open" aria-label="Ajuda">?</button></nav>
  </header>
  <aside class="location"><span class="eyebrow" id="location-type">PONTO DE PARTIDA</span><strong id="location-title">Central Worldnet</strong><small id="location-detail">Explore a cidade ou encontre um conteúdo.</small><button id="interact">E · EXPLORAR</button></aside>
  <div id="message3d" role="status" aria-live="polite"></div>
  <div class="controls3d"><span>WASD / SETAS · CAMINHAR</span><span>ARRASTE · GUIAR</span><span>BOTÃO DIREITO · CÂMERA</span><button id="home">⌂ CENTRAL</button></div>
  <dialog id="search-dialog"><form id="search3d"><div class="dialog-heading"><span class="eyebrow">ESTAÇÃO DE LOCALIZAÇÃO</span><button type="button" data-close="search-dialog" aria-label="Fechar pesquisa">✕</button></div><h1>Encontre seu próximo lugar.</h1><p>Sites, canais, vídeos e artigos ocupam lugares próprios no mesmo mundo.</p><div class="query-row"><input id="query3d" type="search" required maxlength="200" placeholder="Um assunto, canal ou link…" aria-label="Pesquisa"><button id="submit3d">BUSCAR ↗</button></div><div id="search-status" role="status"></div><div id="results3d"></div></form></dialog>
  <dialog id="info-dialog"><div class="dialog-heading"><span class="eyebrow" id="info-type">CONTEÚDO</span><button data-close="info-dialog" aria-label="Fechar conteúdo">✕</button></div><h2 id="info-title"></h2><p id="info-description"></p><p id="info-source"></p><a id="original3d" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">ABRIR ORIGINAL ↗</a></dialog>
  <dialog id="help-dialog"><div class="dialog-heading"><span class="eyebrow">COMO EXPLORAR</span><button data-close="help-dialog" aria-label="Fechar ajuda">✕</button></div><h2>Uma cidade de descobertas.</h2><p>WASD ou setas movem o personagem em relação à câmera. Segure o botão esquerdo no chão para guiar. Arraste com o botão direito ou Shift para girar a câmera; use a roda para aproximar.</p><p>E ou F interage com o lugar atual. / abre a pesquisa. Selecionar um resultado leva ao seu endereço permanente. As placas fazem parte da cena tridimensional.</p><p>Dados indisponíveis não são inventados. A descoberta ampla depende das fontes de busca configuradas.</p><a href="/">ABRIR VERSÃO 2D ↗</a><details><summary>Diagnóstico de desempenho</summary><pre id="diagnostics"></pre></details></dialog>
</main>`;
const $=id=>document.getElementById(id),registry=new WorldRegistry();
let runtime=null,catalog=null,currentSite=null,theme='dark',searching=false,queryVersion=0,noticeTimer;
try{theme=localStorage.getItem('worldnet-3d-theme')==='light'?'light':'dark';}catch{}
const isPaused=()=>document.querySelector('dialog[open]')!==null;
function notice(text){$('message3d').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('message3d').textContent='',4200);}
function showDialog(id){runtime?.resetInput();$(id).showModal();if(id==='search-dialog')$('query3d').focus();}
function refreshRegistry(){registry.replace(localResources(),catalog?.sites||[]);}
function openCurrent(site){
  currentSite=site?.url?site:runtime?.currentSite()||null;
  if(!currentSite){showDialog('search-dialog');return;}
  $('info-type').textContent=RESOURCE_LABELS[currentSite.kind]||'SITE';
  $('info-title').textContent=currentSite.displayName||currentSite.title||currentSite.domain;
  $('info-description').textContent=currentSite.description||'Nenhuma descrição disponível nesta fonte.';
  $('info-source').textContent=`Fonte: ${currentSite.source||'Catálogo de domínios'}${currentSite.metadataStatus==='url-only'?' · Endereço informado; título e autoria não confirmados.':''}`;
  const url=publicUrl(currentSite.url);$('original3d').hidden=!url;if(url)$('original3d').href=url.href;
  showDialog('info-dialog');
}
for(const dialog of document.querySelectorAll('dialog')){
  // Native close events are queued. Do not clear a movement key pressed after
  // the dialog has already closed while that queued event is still pending.
  dialog.addEventListener('close',()=>runtime?.focus(false));
  dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();runtime?.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){dialog.close();runtime?.focus();}}});
}
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>{$(button.dataset.close).close();runtime?.focus();});
$('search-open').onclick=()=>showDialog('search-dialog');$('help-open').onclick=()=>showDialog('help-dialog');$('interact').onclick=openCurrent;
$('home').onclick=()=>{runtime?.teleport({x:0,z:0});runtime?.focus();};
$('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;runtime?.setTheme(theme);try{localStorage.setItem('worldnet-3d-theme',theme);}catch{}runtime?.focus();};

function renderResults(results){
  $('results3d').replaceChildren();
  for(const result of results.slice(0,30)){
    const row=document.createElement('button');row.type='button';row.className='destination';row.dataset.resource=keyOf(result);
    const name=document.createElement('strong');name.textContent=result.displayName||result.title||result.domain;
    const detail=document.createElement('small');detail.textContent=`${RESOURCE_LABELS[result.kind]||'Site'} · ${result.domain}${result.metadataStatus==='url-only'?' · endereço informado':''}`;
    const text=document.createElement('span');text.append(name,detail);const arrow=document.createElement('span');arrow.textContent='↗';row.append(text,arrow);
    row.onclick=()=>{
      if(runtime?.teleport(keyOf(result))){$('search-dialog').close();runtime.focus();notice(`Você chegou a ${name.textContent}`);}else notice('Endereço ainda não disponível na cidade.');
    };
    $('results3d').append(row);
  }
}
$('search3d').onsubmit=async e=>{
  e.preventDefault();if(searching)return;
  const query=$('query3d').value.trim();if(!query)return;
  const version=++queryVersion;searching=true;$('submit3d').disabled=true;
  const local=findLocalResources(query);renderResults(local);
  $('search-status').textContent=local.length?`${local.length} resultado(s) local(is). Consultando fontes…`:'Consultando índice e fontes públicas…';
  try{
    const response=await searchResources(query);if(version!==queryVersion)return;
    refreshRegistry();
    const merged=new Map();for(const item of [...response.results,...local,...(catalog?searchCatalog(catalog,query,8):[])])if(!merged.has(keyOf(item)))merged.set(keyOf(item),item);
    const results=[...merged.values()];renderResults(results);
    $('search-status').textContent=response.errors?.length?`${results.length} resultado(s). Fontes parcialmente indisponíveis; você pode colar um link.`:results.length?`${results.length} destino(s). Escolha um para explorar.`:'Nenhum resultado nas fontes disponíveis.';
  }finally{searching=false;$('submit3d').disabled=false;}
};

document.documentElement.dataset.theme=theme;
try{
  runtime=createRuntime($('viewport'),registry,{
    isPaused,onInteract:openCurrent,onSearch:()=>showDialog('search-dialog'),
    onContext:lost=>notice(lost?'A renderização foi interrompida. Aguardando recuperação do WebGL…':'Renderização recuperada.'),
    onStatus:s=>{
      currentSite=s.site;
      $('location-type').textContent=currentSite?(RESOURCE_LABELS[currentSite.kind]||'SITE'):`SETOR ${s.cell.x}, ${s.cell.z}`;
      $('location-title').textContent=currentSite?(currentSite.displayName||currentSite.title||currentSite.domain):s.cell.x===0&&s.cell.z===0?'Central Worldnet':'Praças e conexões';
      $('location-detail').textContent=currentSite?currentSite.metadataStatus==='url-only'?'Endereço informado · identidade não confirmada':currentSite.source||currentSite.domain:'Encontre um conteúdo para visitar seu lugar.';
      if($('help-dialog').open)$('diagnostics').textContent=JSON.stringify({fps:s.performance.fps.toFixed(1),p95:s.performance.p95.toFixed(1),drawCalls:s.render.calls,triangles:s.render.triangles,chunks:s.chunks,queued:s.queued,textures:s.render.textures,economy:s.economy},null,2);
    }
  });
  runtime.setTheme(theme);
}catch(error){$('viewport').textContent='Não foi possível iniciar o WebGL. Use um navegador com suporte a WebGL2 ou abra a versão 2D.';notice('Renderizador 3D indisponível. A versão 2D continua acessível na ajuda.');}

// Start is playable immediately; network operations never gate movement.
const resourcesReady=loadResources().then(()=>refreshRegistry());
const catalogReady=getCatalog().then(value=>{catalog=value;refreshRegistry();}).catch(()=>{});
window.addEventListener('pagehide',event=>{if(!event.persisted)runtime?.dispose();});
export function inspect3D(){return runtime?{...runtime.snapshot(),resources:localResources().length,addresses:registry.addresses.size,searching,paused:isPaused()}:null;}
