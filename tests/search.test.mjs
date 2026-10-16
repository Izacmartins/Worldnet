import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resourceFromUrl,resourceSite} from '../shared/resources.js';
import {ResourceStore} from '../server/store.js';
import {SearchService} from '../server/search.js';
import {createProviders} from '../server/providers.js';
import {createApp} from '../server/index.js';
import {buildingPlan} from '../src/city-art.js';

test('recursos do mesmo domínio não se confundem e aliases de vídeo deduplicam',()=>{
  const a=resourceFromUrl('https://youtu.be/jfKfPfyJRdk?utm_source=x');
  const b=resourceFromUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk&t=10');
  assert.equal(a.id,b.id);assert.equal(a.url,'https://www.youtube.com/watch?v=jfKfPfyJRdk');
  assert.equal(a.kind,'video');
  assert.notEqual(resourceFromUrl('https://youtube.com/@canalum').id,resourceFromUrl('https://youtube.com/@canaldois').id);
  assert.equal(resourceFromUrl('https://youtube.com/@canalum/videos').id,resourceFromUrl('https://youtube.com/@canalum').id);
  assert.notEqual(resourceFromUrl('https://news.example.org/a').id,resourceFromUrl('https://news.example.org/b').id);
  assert.equal(resourceFromUrl('https://pt.wikipedia.org/wiki/Astronomia').kind,'article');
  assert.equal(resourceFromUrl('https://youtube.com/@canalum').metadataStatus,'url-only');
  assert.doesNotThrow(()=>resourceSite(resourceFromUrl('https://youtube.com/@canal%zz')));
  for(const u of ['http://127.0.0.1','http://[::1]/','https://localhost/x','https://user:pass@example.org','https://example.org:8080','javascript:alert(1)'])assert.equal(resourceFromUrl(u),null,u);
});

test('índice textual e endereços sobrevivem ao reinício e enriquecimento',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldnet-search-'));const file=join(dir,'world.sqlite');
  let store=new ResourceStore(file);
  try{
    const article=store.upsert(resourceFromUrl('https://pt.wikipedia.org/wiki/Astronomia',{title:'Astronomia',description:'Estudo de estrelas e planetas',source:'Wikipédia'}));
    store.upsert(resourceFromUrl('https://pt.wikipedia.org/wiki/Sol',{title:'Sol',source:'Wikipédia'}));
    store.close();store=new ResourceStore(file);
    assert.deepEqual(store.get(article.id).world,article.world);
    const updated=store.upsert(resourceFromUrl(article.url,{title:'Astronomia observacional',source:'Wikipédia'}));
    assert.deepEqual(updated.world,article.world);assert.equal(store.count(),2);
    assert.equal(store.search('astrono')[0].id,article.id);
    assert.deepEqual(store.search('" OR DROP TABLE resources; --'),[]);
    assert.equal(store.upsert(resourceFromUrl(article.url)).title,'Astronomia observacional');
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('busca combina fontes, deduplica, persiste e reutiliza consulta sem rede',async()=>{
  const store=new ResourceStore(':memory:');let calls=0;
  const resource=resourceFromUrl('https://www.youtube.com/@astronomia',{title:'Astronomia',source:'Fonte de teste'});
  const service=new SearchService(store,[{name:'A',search:async()=>{calls++;return [resource];}},{name:'B',search:async()=>[resource]}]);
  try{
    const result=await service.search('Astronomia');
    assert.equal(result.results.length,1);assert.equal(result.results[0].kind,'channel');
    assert.ok(store.get('site:youtube.com'));assert.equal(store.count(),2);
    const cached=await service.search('astronomia');assert.equal(cached.cached,true);assert.equal(calls,1);
    assert.deepEqual(cached.results[0].world,result.results[0].world);
    assert.equal(cached.sources.length,2);
  }finally{store.close();}
});

test('falha de fonte preserva busca local e não fabrica resultados',async()=>{
  const store=new ResourceStore(':memory:');
  store.upsert(resourceFromUrl('https://public.example.org/artigo',{title:'Astronomia real',source:'Fonte de teste'}));
  const service=new SearchService(store,[{name:'Offline',search:async()=>{throw new Error('offline');}}]);
  try{
    const result=await service.search('astronomia');
    assert.equal(result.results.length,1);assert.equal(result.errors.length,1);assert.equal(result.sources[0].status,'unavailable');
    assert.equal(store.cached('astronomia'),null);
    assert.equal((await service.search('termo inexistente')).results.length,0);
  }finally{store.close();}
});

test('YouTube oEmbed liga vídeo a canal; falha preserva apenas endereço',async()=>{
  const store=new ResourceStore(':memory:');
  const fetchImpl=async url=>{
    assert.equal(new URL(url).hostname,'www.youtube.com');
    return Response.json({title:'Título confirmado na fonte de teste',author_name:'Autor',author_url:'https://www.youtube.com/@autor',thumbnail_url:'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'});
  };
  try{
    const service=new SearchService(store,[],{fetchImpl});
    const video=(await service.search('https://youtu.be/jfKfPfyJRdk')).results[0];
    assert.equal(video.metadataStatus,'sourced');assert.equal(store.get(video.parentId).kind,'channel');
    const offline=new SearchService(store,[],{fetchImpl:async()=>{throw new Error('offline');}});
    const result=await offline.search('https://youtu.be/jfKfPfyJRdk');
    assert.equal(result.results[0].title,video.title);assert.equal(result.errors.length,1);
    const unknown=(await offline.search('https://youtu.be/abcdefghijk')).results[0];
    assert.equal(unknown.metadataStatus,'url-only');assert.equal(unknown.title,unknown.url);
  }finally{store.close();}
});

test('conector SearXNG usa JSON e conserva recursos distintos',async()=>{
  const providers=createProviders({searxngUrl:'http://127.0.0.1:8888/',fetchImpl:async url=>{
    const u=new URL(url);assert.equal(u.searchParams.get('format'),'json');
    return Response.json({results:[{url:'https://youtube.com/@um',title:'<b>Canal um</b>'},{url:'https://youtube.com/@dois',title:'Canal dois'},{url:'http://127.0.0.1/private',title:'Inválido'}]});
  }});
  const results=await providers.find(p=>p.name==='SearXNG').search('canais',AbortSignal.timeout(1000));
  assert.equal(results.length,2);assert.equal(results[0].title,'Canal um');assert.notEqual(results[0].id,results[1].id);
});

test('API HTTP real atende busca, recursos, validação e falha parcial',async()=>{
  const store=new ResourceStore(':memory:');
  const server=createApp({store,providers:[{name:'Teste controlado',search:async()=>[resourceFromUrl('https://public.example.org/artigo',{title:'Planetas',source:'Fixture de integração'})]}]});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
    assert.equal((await fetch(base+'/api/search?q=')).status,400);
    assert.equal((await fetch(base+'/api/search?q='+encodeURIComponent('http://[::1]/'))).status,400);
    const result=await(await fetch(base+'/api/search?q=planetas')).json();
    assert.equal(result.results[0].title,'Planetas');assert.ok(result.results[0].world);
    const list=await(await fetch(base+'/api/resources')).json();assert.equal(list.total,2);
    assert.equal((await fetch(base+'/api/search',{method:'POST'})).status,405);
  }finally{await new Promise(r=>server.close(r));store.close();}
});

test('lotes dos recursos têm colisão e ponto de teleporte seguro',async()=>{
  const {hitsSolid,CHUNK_W,CHUNK_H}=await import('../src/city-art.js');
  for(const url of ['https://youtube.com/@um','https://youtube.com/@dois','https://pt.wikipedia.org/wiki/Sol']){
    const site=resourceSite(resourceFromUrl(url));const plan=buildingPlan(site),b=plan.solid;
    assert.equal(hitsSolid(b.x+b.w/2,b.y+b.h/2,0,0,plan),true);
    assert.equal(hitsSolid(CHUNK_W/2,CHUNK_H-17,0,0,plan,7),false);
  }
});
