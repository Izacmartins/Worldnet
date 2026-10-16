import {fetchPublicContent, safeExternalUrl, topicForSite} from './content.js';
import {RESOURCE_LABELS} from '../shared/resources.js';
const TABS=[
  ['about','◈','Site'],['images','▣','Galeria'],['videos','▸','Vídeos'],['news','▤','Notícias'],
  ['articles','▥','Leituras'],['audio','♫','Áudio'],['shop','◇','Vitrine'],['social','◎','Comunidade']
];
function tag(name,className='',text='') {const n=document.createElement(name); if(className)n.className=className; if(text)n.textContent=text; return n;}
function trustedLink(url,title='Abrir fonte ↗') {
  const safe=safeExternalUrl(url);if(!safe)return null;
  const a=tag('a','content-link',title);a.href=safe;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a;
}
function addLink(parent,url,title){const a=trustedLink(url,title);if(a)parent.append(a);}
function addStatus(parent,text){parent.append(tag('p','content-status',text));}
function displayDate(timestamp) {try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(timestamp));}catch{return '';}}
function clearNode(node){
  for(const media of node.querySelectorAll('video,audio')){try{media.pause();media.removeAttribute('src');for(const source of media.querySelectorAll('source'))source.removeAttribute('src');media.load();}catch{}}
  node.replaceChildren();
}
function textCard(title,body){const a=tag('article','content-card');a.append(tag('h3','',title));if(body)a.append(tag('p','',body));return a;}
export function createContentPanel(parent,{onClose=()=>{}}={}) {
  const overlay=tag('div','content-overlay hidden');overlay.id='content-overlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Explorador de conteúdos');
  const panel=tag('section','content-shell');
  const header=tag('header','content-header');
  const intro=tag('div','content-intro');
  const eyebrow=tag('span','mini-label','WORLDNET / EXPLORADOR DE CONTEÚDO');
  const title=tag('h2','','Explorar conteúdo');
  const subtitle=tag('p','','Dados públicos, acessados somente quando você solicita');
  intro.append(eyebrow,title,subtitle);
  const close=tag('button','icon-button','✕');close.type='button';close.setAttribute('aria-label','Fechar conteúdo');
  header.append(intro,close);
  const tabs=tag('nav','content-tabs');tabs.setAttribute('aria-label','Tipos de conteúdo');
  const body=tag('div','content-body');body.setAttribute('aria-live','polite');
  const footer=tag('footer','content-footer');footer.textContent='Conteúdo de fontes externas identificado pela origem. Nada é reproduzido automaticamente.';
  panel.append(header,tabs,body,footer);overlay.append(panel);parent.append(overlay);
  let activeSite=null,activeTab='about',controller=null,renderToken=0,lastFocus=null;
  const tabButtons=new Map();
  for(const [id,icon,label] of TABS){
    const b=tag('button','content-tab',`${icon}  ${label}`);b.type='button';b.dataset.tab=id;
    b.addEventListener('click',()=>{if(id!==activeTab){activeTab=id;void render();}});
    tabs.append(b);tabButtons.set(id,b);
  }
  function stampSite() {
    const s=activeSite;
    title.textContent=s?(s.displayName||s.title||s.domain):'Praça de conteúdos';
    subtitle.textContent=s?`${s.domain} · ${s.category||'Site'}`:'Conteúdo público disponível na internet';
  }
  function isOpen(){return !overlay.classList.contains('hidden');}
  function closePanel(){
    if(!isOpen())return;
    renderToken++;controller?.abort();controller=null;overlay.classList.add('hidden');
    clearNode(body);
    onClose();
    // onClose owns game focus; a previous toolbar button must not steal it back.
  }
  function openPanel({site=null,tab='about'}={}) {
    lastFocus=document.activeElement;
    activeSite=site;activeTab=tabButtons.has(tab)?tab:'about';stampSite();
    overlay.classList.remove('hidden');close.focus({preventScroll:true});void render();
  }
  close.addEventListener('click',closePanel);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel();});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closePanel();} });
  function dataBadge(text){return tag('span','content-badge',text);}
  function explainProvenance(parent){
    parent.append(tag('p','content-disclaimer','As mídias abaixo são referências públicas relacionadas ao termo pesquisado; não são necessariamente publicações do site ou anúncios oficiais.'));
  }
  function drawAbout(){
    const s=activeSite;
    const top=tag('section','content-feature');
    top.append(tag('div','content-symbol',s?.domain?.slice(0,2).toUpperCase()||'W'));
    const meta=tag('div','');meta.append(tag('h3','',s?.displayName||s?.title||'Worldnet'));
    meta.append(tag('p','',s?.description||'Use as bancas e telas da cidade para descobrir conteúdo público.'));meta.append(dataBadge(s?.category||'Central digital'));
    if(s?.rank)meta.append(dataBadge(`Ranking: ${s.rank}`));
    if(s?.official)meta.append(dataBadge('Site oficial indicado por fonte pública'));
    else if(s)meta.append(dataBadge('Identificação parcial'));
    if(s?.kind)meta.append(dataBadge(RESOURCE_LABELS[s.kind]||'Conteúdo'));
    if(s?.source)meta.append(tag('p','',`Fonte: ${s.source}`));
    if(s?.metadataStatus==='url-only')meta.append(tag('p','','Endereço registrado. Título, autoria e existência do conteúdo ainda não foram confirmados pela fonte.'));
    if(s?.kind==='channel'&&s?.identityStatus==='url')meta.append(tag('p','','Identificado pelo endereço do canal; handles podem mudar.'));
    if(s?.thumbnail){
      const image=tag('img','content-photo');image.src=s.thumbnail;image.alt=s.title;image.loading='lazy';image.referrerPolicy='no-referrer';
      image.addEventListener('error',()=>image.remove(),{once:true});meta.append(image);
    }
    top.append(meta);body.append(top);
    const links=tag('div','content-actions');
    if(s){addLink(links,s.url||`https://${s.domain}/`,'Abrir conteúdo original ↗');}
    else links.append(tag('span','content-small','Use Galeria, Vídeos ou Notícias para explorar as fontes abertas.'));
    body.append(links);
    const hints=tag('div','content-sections');
    for(const [id,,label] of TABS.slice(1)){
      const button=tag('button','content-mini-card',label+' ↗');button.type='button';
      button.addEventListener('click',()=>{activeTab=id;void render();});hints.append(button);
    }
    body.append(hints);
  }
  function drawUnavailable(kind){
    const names={images:'imagens',videos:'vídeos',audio:'áudios',news:'notícias',articles:'artigos'};
    const part=tag('div','content-empty');part.append(tag('strong','',`Nenhum conteúdo de ${names[kind]} disponível nesta consulta.`));
    part.append(tag('p','','O catálogo de mídias depende das fontes públicas. O Worldnet não cria resultados fictícios.'));
    body.append(part);
  }
  function renderMedia(items,kind){
    explainProvenance(body);
    const grid=tag('div',kind==='images'?'content-media-grid':'content-list');
    for(const item of items){
      const card=tag('article',kind==='images'?'content-media-card':'content-entry');
      if(kind==='images' && item.thumbnail){
        const img=tag('img','content-photo');img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
        img.alt=`Imagem: ${item.title}`;img.src=item.thumbnail;card.append(img);
      }
      if(kind==='videos'){
        const vid=tag('video','content-video');vid.controls=true;vid.preload='none';vid.playsInline=true;
        if(item.thumbnail)vid.poster=item.thumbnail;
        const source=tag('source');source.src=item.url;source.type=item.mime;
        vid.append(source);card.append(vid);
      }
      if(kind==='audio'){
        const player=tag('audio','content-audio');player.controls=true;player.preload='none';
        const source=tag('source');source.src=item.url;source.type=item.mime;player.append(source);card.append(player);
      }
      const content=tag('div','content-entry-body');content.append(tag('strong','',item.title));
      const source=tag('small','',item.source||'Wikimedia Commons');
      if(item.timestamp)source.textContent+=` · ${displayDate(item.timestamp)}`;
      content.append(source);
      if(item.description)content.append(tag('p','',item.description));
      if(item.license)content.append(tag('small','',`Licença: ${item.license} · ${item.attribution||'Consulte o autor na fonte'}`));
      addLink(content,item.link,'Origem e créditos ↗');
      card.append(content);grid.append(card);
    }
    body.append(grid);
  }
  function drawShop(){
    const s=activeSite;
    body.append(textCard('Vitrine digital',s?.description||'Um espaço físico para representar lojas. O Worldnet ainda não tem permissão para acessar automaticamente inventários e preços de qualquer comércio.'));
    if(s){
      const actions=tag('div','content-actions');addLink(actions,s.url||`https://${s.domain}/`,'Ver produtos no site original ↗');body.append(actions);
    }else addStatus(body,'Aproxime-se de um estabelecimento para abrir a vitrine dele.');
    addStatus(body,'Nenhum preço ou produto é fabricado pelo Worldnet. Catálogos só serão exibidos se a loja disponibilizar uma fonte pública compatível.');
  }
  function drawSocial(){
    const s=activeSite;
    body.append(textCard('Comunidade e fóruns',s?.description||'Ponto de encontro para encontrar comunidades e fóruns associados aos sites da cidade.'));
    if(s){const actions=tag('div','content-actions');addLink(actions,s.url||`https://${s.domain}/`,'Acessar a comunidade no site original ↗');body.append(actions);}
    else addStatus(body,'Os grupos e as mensagens pertencem aos seus respectivos sites. Não são copiados para o Worldnet.');
  }
  async function render(){
    const token=++renderToken;
    controller?.abort();controller=new AbortController();
    for(const [name,b] of tabButtons){b.classList.toggle('selected',name===activeTab);b.setAttribute('aria-selected',String(name===activeTab));}
    clearNode(body);
    if(activeTab==='about'){drawAbout();return;}
    if(activeTab==='shop'){drawShop();return;}
    if(activeTab==='social'){drawSocial();return;}
    const kind=activeTab;
    const term=topicForSite(activeSite);
    body.append(tag('div','content-loading',`Consultando ${kind==='news'?'noticiário público':kind==='articles'?'enciclopédia':kind==='audio'?'áudios abertos':'mídias abertas'}…`));
    try{
      const result=await fetchPublicContent(kind,term,{signal:controller.signal});
      if(token!==renderToken||!isOpen())return;
      clearNode(body);
      const status=tag('div','content-source-note',`${result.source==='cache'?'Cache do navegador':'Fonte pública'} · ${displayDate(result.savedAt)}${result.stale?' · dados antigos (fonte indisponível)':''}`);
      body.append(status);
      if(kind==='news')body.append(tag('p','content-disclaimer','Notícias publicadas no Wikinews. São de interesse geral e podem não estar relacionadas ao edifício selecionado. Veja a data e a fonte de cada notícia.'));
      if(result.items.length)renderMedia(result.items,kind);else drawUnavailable(kind);
    }catch(error){
      if(token!==renderToken||error?.name==='AbortError')return;
      clearNode(body);
      const msg=tag('div','content-empty');msg.append(tag('strong','','Fonte pública indisponível no momento.'));
      msg.append(tag('p','','A fonte pode estar bloqueada, offline ou limitando consultas. O Worldnet não exibe dados inventados.'));
      body.append(msg);
    }
  }
  return {open:openPanel,close:closePanel,isOpen};
}
