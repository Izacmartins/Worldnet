import test from 'node:test';
import assert from 'node:assert/strict';
import {visualIdentity,inferCategory,billboardContent,architectureType,domainHash,rgbFromHsl} from '../src/identity.js';

test('paletas distintas são estáveis e não fingem ser cores de marca',()=>{
  const a=visualIdentity({domain:'a.example'});
  const b=visualIdentity({domain:'b.example'});
  assert.equal(a.accentCss,visualIdentity({domain:'a.example'}).accentCss);
  assert.notEqual(a.accentCss,b.accentCss);
  assert.equal(a.colorSource,'decorativa');
  assert.equal(visualIdentity({domain:'official.example',color:'#4466AA',colorVerified:true}).accentCss,'#4466aa');
  assert.equal(visualIdentity({domain:'official.example',color:'#4466AA',colorVerified:false}).colorSource,'decorativa');
  assert.equal(rgbFromHsl(0,1,.5),0xff0000);
});
test('motor infere categorias de evidências, não de perguntas do usuário',()=>{
  assert.equal(inferCategory({domain:'tiny-shop.example',description:'loja virtual de roupas'}).category,'Loja');
  assert.equal(inferCategory({domain:'editorial.example',description:'Portal de notícias'}).category,'Notícias');
  assert.equal(inferCategory({domain:'unrelated.example',queryTags:['jogos'],sourceTitle:'Jogos online'}).category,'Site');
  assert.equal(inferCategory({domain:'unknown.example'}).confidence,'desconhecida');
  assert.equal(inferCategory({domain:'blogdomundo.net'}).category,'Blog');
  assert.equal(architectureType('Música',domainHash('music.example')),'concert');
});
test('telões mostram descrição real, sem fabricar campanhas publicitárias',()=>{
  const a=billboardContent({domain:'archive.example',title:'Arquivo',description:'Acervo público de documentos'});
  assert.equal(a.subtitle,'Acervo público de documentos');
  assert.equal(a.descriptionAvailable,true);
  const b=billboardContent({domain:'mystery.example',title:'mystery.example'});
  assert.equal(b.subtitle,'mystery.example');
  assert.equal(b.descriptionAvailable,false);
});
