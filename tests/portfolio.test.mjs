import test from 'node:test';
import assert from 'node:assert/strict';
import {PORTFOLIO_CATALOG} from '../src/portfolio-catalog.js';
import {findResources,placeResource,importedResource,worldCells} from '../src/browser-world.js';
import {BROWSER_PROVIDERS,queryProvider} from '../src/browser-providers.js';
import {resourceFromUrl} from '../shared/resources.js';
import {isOpenPlot} from '../src/layout.js';
import {mediaUrl} from '../src/world3d/media.js';

const provider=id=>BROWSER_PROVIDERS.find(p=>p.id===id);
test('catálogo editorial tem canais e tipos reais, com origem explícita; busca ignora acentos',()=>{
  assert.ok(PORTFOLIO_CATALOG.length>=30);assert.equal(new Set(PORTFOLIO_CATALOG.map(x=>x.id)).size,PORTFOLIO_CATALOG.length);
  assert.ok(PORTFOLIO_CATALOG.every(x=>x.origin==='catalog'&&x.source==='Catálogo editorial Worldnet'));
  assert.ok(findResources(PORTFOLIO_CATALOG,'NASA','channel').some(x=>x.url==='https://www.youtube.com/@NASA'));
  assert.ok(findResources(PORTFOLIO_CATALOG,'programacao','repository').length>0);
  assert.equal(findResources(PORTFOLIO_CATALOG,'NASA','book').length,0);
  assert.ok(findResources(PORTFOLIO_CATALOG,'MDN','site').length>0,'páginas de sites também aparecem no filtro Sites');
});
test('endereço local fica perto da Central e não muda ao enriquecer ou adicionar recursos',()=>{
  const items=new Map();
  for(const item of PORTFOLIO_CATALOG){const placed=placeResource(item,items);items.set(placed.id,placed);}
  const first=items.values().next().value;
  assert.deepEqual(first.world,{x:1,y:0});
  const changed=placeResource({...first,title:'Novo metadado'},items);assert.deepEqual(changed.world,first.world);
  assert.ok([...items.values()].every(x=>!isOpenPlot(x.world.x,x.world.y)));
  const next=placeResource(resourceFromUrl('https://example.com/'),items);assert.ok(![...items.values()].some(x=>x.world.x===next.world.x&&x.world.y===next.world.y));
  const cells=[...Array(500)].map((_,i)=>i);const it=worldCells();assert.equal(new Set(cells.map(()=>JSON.stringify(it.next().value))).size,500);
});
test('importação valida URLs, recalcula IDs e não aceita coordenadas do arquivo',()=>{
  assert.equal(importedResource({url:'javascript:alert(1)'}),null);
  assert.equal(importedResource({url:'http://localhost/'}),null);
  const r=importedResource({url:'https://youtube.com/@NASA',id:'injetado',world:{x:0,y:0},title:'NASA',kind:'channel'});
  assert.equal(r.id,'youtube:channel:@nasa');assert.equal(r.world,undefined);assert.equal(r.origin,'import');
  const unknown=importedResource({...resourceFromUrl('https://youtube.com/@unknown'),world:{x:1,y:0}});
  assert.equal(unknown.metadataStatus,'url-only','importar não confirma metadados ausentes');
});
test('provedores gratuitos usam HTTPS público, sem chave, com separação por tipo',()=>{
  for(const p of BROWSER_PROVIDERS){const url=p.url('um assunto');assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.ok(!url.searchParams.has('key'));}
  assert.deepEqual(BROWSER_PROVIDERS.filter(p=>p.types.includes('channel')),[]);
  assert.equal(provider('commons').url('lua').searchParams.get('origin'),'*');
});
test('GitHub e Open Library preservam título, descrição, tipo e imagem da fonte',()=>{
  const [repo]=provider('github').parse({items:[{html_url:'https://github.com/mrdoob/three.js',full_name:'mrdoob/three.js',description:'<b>JavaScript</b> 3D library',stargazers_count:100,owner:{avatar_url:'https://avatars.githubusercontent.com/u/97088'}}]});
  assert.equal(repo.kind,'repository');assert.equal(repo.title,'mrdoob/three.js');assert.equal(repo.description,'JavaScript 3D library');assert.equal(repo.origin,'remote');
  const [book]=provider('books').parse({docs:[{key:'/works/OL82563W',title:'The Hobbit',author_name:['J. R. R. Tolkien'],cover_i:123,first_publish_year:1937}]});
  assert.equal(book.kind,'book');assert.equal(book.thumbnail,'https://covers.openlibrary.org/b/id/123-M.jpg');assert.ok(book.description.includes('Tolkien'));
});
test('Commons conserva créditos e licença e rejeita vídeos; não inventa conteúdo',()=>{
  const page={title:'File:Moon.jpg',imageinfo:[{descriptionurl:'https://commons.wikimedia.org/wiki/File:Moon.jpg',thumburl:'https://upload.wikimedia.org/test.jpg',mime:'image/jpeg',extmetadata:{Artist:{value:'<a>Autor</a>'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'},ImageDescription:{value:'Lua'}}}]};
  const [image]=provider('commons').parse({query:{pages:{1:page}}});assert.equal(image.kind,'image');assert.equal(image.credit,'Autor');assert.equal(image.license,'CC BY 4.0');
  assert.equal(provider('commons').parse({query:{pages:{1:{...page,imageinfo:[{...page.imageinfo[0],mime:'video/webm'}]}}}}).length,0);
  assert.equal(provider('wiki').parse({query:{search:[]}}).length,0);
});
test('requisição omite credenciais e comunica limites; nenhum proxy é usado',async()=>{
  let call;
  const items=await queryProvider(provider('github'),'react',{fetchImpl:async(url,opts)=>{call={url,opts};return new Response(JSON.stringify({items:[]}));}});
  assert.deepEqual(items,[]);assert.equal(call.opts.credentials,'omit');assert.equal(call.url.hostname,'api.github.com');
  await assert.rejects(queryProvider(provider('github'),'react',{fetchImpl:async()=>new Response('',{status:429})}),/Limite/);
});
test('texturas aceitam hosts das fontes, incluindo o host real de thumbnails Commons',()=>{
  assert.ok(mediaUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/a.jpg'));
  assert.equal(mediaUrl('https://arbitrary.example/image.jpg'),null);
  assert.equal(mediaUrl('http://covers.openlibrary.org/image.jpg'),null);
});
