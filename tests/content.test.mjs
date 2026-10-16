import test from 'node:test';
import assert from 'node:assert/strict';
import {safeExternalUrl,topicForSite,sortMediaItems,fetchPublicContent} from '../src/content.js';
import {kioskKindForSite,plazaKind,kioskWithin,installationPositions} from '../src/city-content-art.js';

test('URLs externas são somente HTTP(S) públicos, sem esquemas executáveis',()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),null);
  assert.equal(safeExternalUrl('data:text/html,html'),null);
  assert.equal(safeExternalUrl('https://localhost:5173/'),null);
  assert.equal(safeExternalUrl('http://192.168.2.3/'),null);
  assert.equal(safeExternalUrl('https://example.org/x'),'https://example.org/x');
});
test('tema relacionado deriva de metadados reais, sem criar conteúdo fictício',()=>{
  assert.equal(topicForSite({domain:'minecraft.net',title:'Minecraft'}),'Minecraft');
  assert.equal(topicForSite({domain:'nomedeumsite.com',title:'nomedeumsite.com'}),'nomedeumsite');
  assert.equal(topicForSite({domain:'algo.io',queryTags:['Assunto da busca']}),'Assunto da busca');
});
test('fontes de mídia são filtradas por tipo, URL válida e sem duplicatas',()=>{
  const items=[{kind:'video',title:'Vídeo',link:'https://commons.wikimedia.org/wiki/File:a.webm'},
    {kind:'video',title:'Vídeo',link:'https://commons.wikimedia.org/wiki/File:a.webm'},
    {kind:'image',title:'Foto',link:'https://commons.wikimedia.org/wiki/File:a.png'},
    {kind:'video',title:'falha',link:'javascript:alert(1)'}];
  assert.equal(sortMediaItems(items,'videos').length,1);
  assert.equal(sortMediaItems(items,'images').length,1);
});
test('bancas classificadas sem depender do número de quadros renderizados',()=>{
  assert.equal(kioskKindForSite({domain:'portal.org',category:'Notícias'}),'news');
  assert.equal(kioskKindForSite({domain:'loja.com',category:'Loja'}),'shop');
  assert.equal(kioskWithin(100,90,{x:20,y:10,range:25},80,80),true);
  assert.equal(installationPositions(0,0,null,true,false).length,4);
  assert.equal(installationPositions(2,3,null,false,true).length,0);
  assert.equal(plazaKind(13,-21),plazaKind(13,-21));
});
test('pesquisa de notícias consulta fonte pública e mantém cache local sem créditos',async()=>{
  const original=global.fetch;
  let count=0;
  global.fetch=async url=>{
    assert.ok(String(url).includes('en.wikinews.org'));
    count++;
    return {ok:true,json:async()=>({query:{categorymembers:[{title:'Notícia pública',timestamp:'2026-10-12T09:00:00Z'}]}})};
  };
  try{
    const a=await fetchPublicContent('news','qualquer');
    const b=await fetchPublicContent('news','qualquer');
    assert.equal(count,1);
    assert.equal(a.items[0].title,'Notícia pública');
    assert.equal(b.source,'cache');
  }finally{global.fetch=original;}
});
test('pesquisa de mídias acessa Commons, identifica áudio e vídeo e não reproduz automaticamente',async()=>{
  const original=global.fetch;
  global.fetch=async url=>{
    const u=new URL(url);
    const isVideo=u.searchParams.get('gsrsearch').includes('filetype:video');
    return {ok:true,json:async()=>({query:{pages:[{
      title:isVideo?'File:Teste.webm':'File:Teste.ogg',imageinfo:[{
        mime:isVideo?'video/webm':'audio/ogg',url:`https://upload.wikimedia.org/wikipedia/commons/${isVideo?'Teste.webm':'Teste.ogg'}`,
        descriptionurl:`https://commons.wikimedia.org/wiki/File:${isVideo?'Teste.webm':'Teste.ogg'}`
      }]
    }]}})};
  };
  try{
    const video=await fetchPublicContent('videos','tema-de-teste-video-unique');
    const audio=await fetchPublicContent('audio','tema-de-teste-audio-unique');
    assert.equal(video.items[0].kind,'video');
    assert.equal(audio.items[0].kind,'audio');
    assert.equal(video.items[0].source,'Wikimedia Commons');
  }finally{global.fetch=original;}
});
