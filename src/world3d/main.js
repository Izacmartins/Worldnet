import './style.css';
import {createRuntime} from './runtime.js';
import {WorldRegistry,keyOf} from './model.js';
import {loadResources,localResources,searchResources,findLocalResources,worldState,exportWorld,importWorld} from '../search-client.js';
import {RESOURCE_LABELS,publicUrl} from '../../shared/resources.js';
import {appBase} from '../deployment.js';
import {mediaUrl} from './media.js';

const TYPES=[['all','Tudo'],['channel','Canais'],['repository','Projetos'],['book','Livros'],['image','Imagens'],['article','Artigos'],['site','Sites'],['video','Vídeos']];
const hints={all:'Consulta GitHub, Open Library e Wikimedia, além do seu catálogo. Sem conta ou API paga.',channel:'Canais do catálogo editorial e links que você salvou. Não é uma busca geral no YouTube.',repository:'Projetos públicos do GitHub e lugares salvos. A API gratuita tem limite de consultas.',book:'Livros do catálogo público Open Library. Capas são carregadas perto da construção.',image:'Imagens do Wikimedia Commons. Consulte os créditos e a licença na fonte.',article:'Artigos da Wikipédia em português e artigos salvos neste navegador.',site:'Sites do catálogo editorial e endereços adicionados por você. Não é um índice de toda a web.',video:'Vídeos adicionados por link. Cole um endereço do YouTube; não há busca geral de vídeos.'};
const symbols={site:'↗',channel:'▶',video:'▷',repository:'⌘',book:'▤',image:'▧',article:'≡',page:'↗'};
document.querySelector('#app').innerHTML=`
<main class="city3d">
  <div id="viewport"></div>
  <header><a class="brand3d" href="${appBase}" aria-label="Worldnet, início"><b>W</b><span>WORLDNET<small>A INTERNET, EM OUTRA DIMENSÃO</small></span></a>
    <nav aria-label="Navegação principal"><button id="search-open">⌕ <span>EXPLORAR A WEB</span></button><button id="theme" aria-label="Alternar tema">☀</button><button id="help-open" aria-label="Meu mundo e ajuda">☰</button></nav>
  </header>
  <div class="world-status"><i></i><span id="world-count">Construindo seu mundo…</span><span class="portfolio-label">PORTFÓLIO INTERATIVO</span></div>
  <aside class="location"><span class="eyebrow" id="location-type">PONTO DE PARTIDA</span><strong id="location-title">Central Worldnet</strong><small id="location-detail">Um lugar para cada descoberta.</small><button id="interact">E · EXPLORAR</button></aside>
  <aside id="welcome" class="welcome" aria-label="Boas-vindas"><button id="welcome-close" aria-label="Fechar boas-vindas">✕</button><span class="eyebrow">BEM-VINDO À SUA INTERNET</span><h1>Links viram lugares.</h1><p>Ande entre sites e canais. Busque projetos, livros e imagens de fontes públicas e veja sua cidade crescer.</p><div class="suggestions"><button data-query="NASA" data-type="channel">▶ NASA</button><button data-query="three.js" data-type="repository">⌘ Three.js</button><button data-query="astronomia" data-type="book">▤ Livros</button></div><small>Seu mundo fica salvo neste navegador.</small></aside>
  <div id="message3d" role="status" aria-live="polite"></div>
  <div class="controls3d"><span>WASD / SETAS · CAMINHAR</span><span>ARRASTE · GUIAR</span><span>BOTÃO DIREITO · CÂMERA</span><div class="camera-buttons"><button id="camera-left" aria-label="Girar câmera à esquerda">↶</button><button id="camera-right" aria-label="Girar câmera à direita">↷</button></div><button id="home">⌂ CENTRAL</button></div>
  <dialog id="search-dialog" aria-labelledby="search-title"><form id="search3d"><div class="dialog-heading"><span class="eyebrow">ESTAÇÃO DE DESCOBERTA</span><button type="button" data-close="search-dialog" aria-label="Fechar pesquisa">✕</button></div><h1 id="search-title">O que vamos explorar?</h1><div class="query-row"><input id="query3d" type="search" required maxlength="200" placeholder="Um nome, assunto ou link https://…" aria-label="Pesquisa"><button id="submit3d">BUSCAR ↗</button></div><div class="type-filters" role="group" aria-label="Tipo de conteúdo">${TYPES.map(([id,label])=>`<button type="button" data-type-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><p id="search-hint"></p><div id="source-status" aria-label="Estado das fontes"></div><div id="search-status" role="status" aria-live="polite"></div><div id="results3d"></div></form></dialog>
  <dialog id="info-dialog" aria-labelledby="info-title"><div class="dialog-heading"><span class="eyebrow" id="info-type">CONTEÚDO</span><button data-close="info-dialog" aria-label="Fechar conteúdo">✕</button></div><h2 id="info-title"></h2><img id="info-image" alt="" hidden><p id="info-description"></p><p id="info-stats"></p><p id="info-source"></p><p id="info-license"></p><a id="original3d" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">ABRIR NA FONTE ↗</a></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><span class="eyebrow">SEU MUNDO</span><button data-close="help-dialog" aria-label="Fechar ajuda">✕</button></div><h2 id="help-title">A internet como lugar.</h2><p>Esta experiência de portfólio funciona no navegador, sem login, instalação ou serviços pagos. Cada visitante constrói sua própria cidade.</p><details open><summary>Como explorar</summary><p>WASD ou setas para andar. Segure e arraste no chão para guiar, inclusive no celular. Botão direito ou Shift + arraste para girar a câmera; roda do mouse para aproximar. Os botões ↶ e ↷ também giram a câmera no celular.</p><p>E ou F interage com o lugar atual. / abre a pesquisa. Selecionar um resultado teleporta até a construção. Escape fecha os painéis. A Central também é uma estação física de pesquisa.</p></details><details><summary>De onde vêm os resultados?</summary><p>O catálogo editorial contém endereços reais selecionados previamente, incluindo canais do YouTube. Projetos vêm do GitHub, livros da Open Library, imagens do Wikimedia Commons e artigos da Wikipédia. Cada resultado identifica sua origem.</p><p>Não há busca geral do Google ou YouTube. Canais fora do catálogo e vídeos podem ser adicionados por link, sem inventar título, autoria ou conteúdo. A disponibilidade de cada fonte depende da rede, CORS e limites gratuitos.</p><p>Somente ao pesquisar, o texto é enviado às fontes compatíveis com o filtro escolhido. Imagens próximas às construções são solicitadas aos respectivos provedores. Não há reprodução automática de vídeos ou áudio.</p></details><details><summary>Dados e privacidade</summary><p>Seus lugares e o cache de pesquisas ficam no IndexedDB deste navegador e não são compartilhados com outros visitantes. Limpar os dados do site remove sua cidade. A navegação privada pode impedir a persistência. Até 1.500 lugares são armazenados neste piloto.</p><p>Exporte um arquivo para guardar seu mundo ou importá-lo em outro navegador. Endereços já existentes conservam suas posições; os demais recebem novos lotes livres.</p><div class="data-actions"><button id="export-world">EXPORTAR MUNDO ↓</button><label class="file-button">IMPORTAR MUNDO ↑<input id="import-world" type="file" accept="application/json,.json"></label></div><p id="data-status" role="status"></p></details><details><summary>Sobre a cidade e desempenho</summary><p>Geometria 3D real, construções procedurais por categoria, câmera em terceira pessoa e chunks carregados por proximidade. As cores são decorativas, sem atribuição de identidade oficial. Níveis de informação não representam popularidade.</p><p>Imagens têm limite de tamanho e concorrência. O modo econômico reduz sombras e resolução quando necessário. Em aparelhos sem WebGL2, a <a href="${appBase}legacy.html">versão 2D original</a> continua disponível.</p><pre id="diagnostics"></pre></details></dialog>
</main>`;
const $=id=>document.getElementById(id),registry=new WorldRegistry();
let runtime=null,currentSite=null,theme='dark',searching=false,queryVersion=0,noticeTimer,type='all',searchController;
try{theme=localStorage.getItem('worldnet-3d-theme')==='light'?'light':'dark';if(localStorage.getItem('worldnet-welcomed'))$('welcome').hidden=true;}catch{}
const isPaused=()=>document.querySelector('dialog[open]')!==null;
function notice(text){$('message3d').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('message3d').textContent='',6000);}
function refreshRegistry(){registry.replace(localResources());const s=worldState();$('world-count').textContent=`SEU MUNDO · ${s.count} LUGARES${s.persistent?' · SALVO LOCALMENTE':' · SOMENTE NESTA SESSÃO'}`;}
function dismissWelcome(){$('welcome').hidden=true;try{localStorage.setItem('worldnet-welcomed','1');}catch{}}
$('welcome-close').onclick=dismissWelcome;
function showDialog(id){runtime?.resetInput();if(!$(id).open)$(id).showModal();if(id==='search-dialog'){$('query3d').focus();dismissWelcome();}}
function setType(value){type=value;for(const b of document.querySelectorAll('[data-type-filter]'))b.setAttribute('aria-pressed',b.dataset.typeFilter===type);$('search-hint').textContent=hints[type];}
function openCurrent(site){
  currentSite=site?.url?site:runtime?.currentSite()||null;
  if(!currentSite){showDialog('search-dialog');return;}
  $('info-type').textContent=RESOURCE_LABELS[currentSite.kind]||'SITE';
  $('info-title').textContent=currentSite.displayName||currentSite.title||currentSite.domain;
  $('info-description').textContent=currentSite.description||'Endereço informado pelo visitante. Nenhuma descrição foi confirmada por uma fonte.';
  $('info-stats').textContent=currentSite.stats||'';
  $('info-source').textContent=`Fonte: ${currentSite.source||'Catálogo editorial'}${currentSite.metadataStatus==='url-only'?' · Título e autoria não confirmados.':''}`;
  $('info-license').textContent=[currentSite.credit,currentSite.license].filter(Boolean).join(' · ');
  const thumb=mediaUrl(currentSite.thumbnail),image=$('info-image');image.hidden=!thumb;image.removeAttribute('src');image.alt=currentSite.mediaLabel||`Imagem fornecida pela fonte de ${$('info-title').textContent}`;image.referrerPolicy='no-referrer';image.onerror=()=>{image.hidden=true;};if(thumb)image.src=thumb;
  const url=publicUrl(currentSite.url);$('original3d').hidden=!url;if(url)$('original3d').href=url.href;
  showDialog('info-dialog');
}
for(const dialog of document.querySelectorAll('dialog')){
  // Search inputs consume Escape to clear their text in Chromium. Handle it
  // before the native input action so one Escape always returns to walking.
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();runtime?.focus();}},true);
  dialog.addEventListener('close',()=>{runtime?.focus(false);if(dialog.id==='search-dialog')searchController?.abort();});
  dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();runtime?.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){dialog.close();runtime?.focus();}}});
}
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>{$(b.dataset.close).close();runtime?.focus();};
$('search-open').onclick=()=>{showDialog('search-dialog');if(!$('query3d').value){renderResults(localResources().slice(0,8));$('search-status').textContent='Lugares do catálogo editorial. Pesquise para descobrir mais.';}};
$('help-open').onclick=()=>showDialog('help-dialog');$('interact').onclick=()=>openCurrent();
$('home').onclick=()=>{runtime?.teleport({x:0,z:0});runtime?.focus();};
$('camera-left').onclick=()=>{runtime?.orbit(.35);runtime?.focus();};$('camera-right').onclick=()=>{runtime?.orbit(-.35);runtime?.focus();};
$('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;runtime?.setTheme(theme);$('theme').textContent=theme==='dark'?'☀':'☾';try{localStorage.setItem('worldnet-3d-theme',theme);}catch{}runtime?.focus();};
for(const b of document.querySelectorAll('[data-type-filter]'))b.onclick=()=>{searchController?.abort();setType(b.dataset.typeFilter);renderResults(findLocalResources($('query3d').value,type));$('search-status').textContent='Filtro alterado. Pressione Buscar para consultar as fontes.';};
for(const b of document.querySelectorAll('[data-query]'))b.onclick=()=>{setType(b.dataset.type);showDialog('search-dialog');$('query3d').value=b.dataset.query;$('search3d').requestSubmit();};
function renderResults(results){
  $('results3d').replaceChildren();
  for(const result of results.slice(0,40)){
    const row=document.createElement('button');row.type='button';row.className='destination';row.dataset.resource=keyOf(result);
    const icon=document.createElement('span');icon.className='result-icon';icon.textContent=symbols[result.kind]||'↗';
    const name=document.createElement('strong');name.textContent=result.displayName||result.title||result.domain;
    const detail=document.createElement('small');detail.textContent=`${RESOURCE_LABELS[result.kind]||'Site'} · ${result.source}${result.metadataStatus==='url-only'?' · sem metadados confirmados':''}`;
    const desc=document.createElement('small');desc.className='result-description';desc.textContent=result.description?.slice(0,140)||result.domain;
    const text=document.createElement('span');text.append(name,detail,desc);const arrow=document.createElement('span');arrow.textContent='↗';row.append(icon,text,arrow);
    row.onclick=()=>{if(runtime?.teleport(keyOf(result))){$('search-dialog').close();runtime.focus();notice(`Você chegou a ${name.textContent}. E para explorar.`);}else notice('A cena 3D está indisponível. Você ainda pode abrir o conteúdo.');if(!runtime)openCurrent(result);};
    $('results3d').append(row);
  }
}
function sourceChip(s){const el=document.createElement('span');el.dataset.state=s.status;const labels={ok:`${s.count} resultado(s)`,cached:'cache local',limited:'limite da fonte',unavailable:'indisponível',catalog:'catálogo local'};el.textContent=`${s.name} · ${labels[s.status]||s.status}`;$('source-status').append(el);}
$('search3d').onsubmit=async e=>{
  e.preventDefault();const query=$('query3d').value.trim();if(!query)return;
  searchController?.abort();const controller=new AbortController();searchController=controller;
  const version=++queryVersion,searchType=type;searching=true;$('submit3d').textContent='BUSCANDO…';$('source-status').replaceChildren();
  renderResults(findLocalResources(query,searchType));$('search-status').textContent='Você já pode visitar os resultados locais. Consultando fontes compatíveis…';
  try{
    const response=await searchResources(query,{type:searchType,signal:controller.signal,onSource:s=>{if(version===queryVersion&&!controller.signal.aborted)sourceChip(s);}});
    refreshRegistry();if(version!==queryVersion||controller.signal.aborted)return;
    $('source-status').replaceChildren();for(const s of response.sources)sourceChip(s);renderResults(response.results);
    const n=response.results.length;
    const inputError=response.errors.find(e=>['Link','Armazenamento'].includes(e.source));
    $('search-status').textContent=inputError?inputError.message:`${n} lugar(es) ${response.cached?'do cache e catálogo local':'disponíveis'}. ${n?'Selecione um para caminhar até seu conteúdo.':'Tente outro termo ou cole um endereço https://.'}${response.errors.length?' Algumas fontes não responderam; os lugares salvos continuam disponíveis.':''}${response.count>=response.limit?' Limite local atingido. Exporte seu mundo.':''}`;
  }catch(error){if(version===queryVersion)$('search-status').textContent='Não foi possível concluir. Seus lugares salvos continuam disponíveis.';}
  finally{if(version===queryVersion){searching=false;$('submit3d').textContent='BUSCAR ↗';}}
};
$('export-world').onclick=async()=>{
  const blob=new Blob([await exportWorld()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='worldnet-meu-mundo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('data-status').textContent='Arquivo exportado. Guarde-o para restaurar seus lugares.';
};
$('import-world').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>3_000_000)throw new Error('Escolha um arquivo Worldnet de até 3 MB.');const n=await importWorld(await file.text());refreshRegistry();$('data-status').textContent=`${n} lugar(es) importados. Endereços existentes foram preservados.`;}
  catch(error){$('data-status').textContent=error instanceof SyntaxError?'Este arquivo não é um JSON Worldnet válido.':error.message;}
  e.target.value='';
};
setType('all');document.documentElement.dataset.theme=theme;
try{
  runtime=createRuntime($('viewport'),registry,{
    isPaused,onInteract:openCurrent,onSearch:()=>showDialog('search-dialog'),
    onContext:lost=>notice(lost?'A renderização foi interrompida. Aguardando recuperação do WebGL…':'Renderização recuperada.'),
    onStatus:s=>{
      currentSite=s.site;$('location-type').textContent=currentSite?(RESOURCE_LABELS[currentSite.kind]||'SITE'):`SETOR ${s.cell.x}, ${s.cell.z}`;
      $('location-title').textContent=currentSite?(currentSite.displayName||currentSite.title||currentSite.domain):s.cell.x===0&&s.cell.z===0?'Central Worldnet':'Praças e conexões';
      $('location-detail').textContent=currentSite?currentSite.source:'Explore a pé ou pesquise seu próximo destino.';
      $('interact').textContent=currentSite?'E · VER CONTEÚDO':'/ · DESCOBRIR LUGARES';
      if($('help-dialog').open)$('diagnostics').textContent=JSON.stringify({fps:s.performance.fps.toFixed(1),p95:s.performance.p95.toFixed(1),drawCalls:s.render.calls,triangles:s.render.triangles,chunks:s.chunks,textures:s.render.textures,economy:s.economy},null,2);
    }
  });runtime.setTheme(theme);
}catch(error){$('viewport').innerHTML='<div class="webgl-fallback"><h1>Explore pelo catálogo</h1><p>Este navegador não conseguiu iniciar o WebGL2. A pesquisa e os links continuam disponíveis no botão Explorar a web.</p></div>';notice('Cena 3D indisponível neste navegador.');}
const resourcesReady=loadResources().then(()=>{refreshRegistry();if(!worldState().persistent)notice('Armazenamento bloqueado. Seu mundo funciona nesta sessão; exporte para guardar.');});
window.addEventListener('pagehide',event=>{if(!event.persisted)runtime?.dispose();});
export function inspect3D(){return runtime?{...runtime.snapshot(),resources:localResources().length,addresses:registry.addresses.size,searching,paused:isPaused()}:null;}
// Public read-only diagnostics for measuring the portfolio on real devices.
window.Worldnet=Object.freeze({inspect:inspect3D});
