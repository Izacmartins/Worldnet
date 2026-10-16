import test from 'node:test';
import assert from 'node:assert/strict';
import {previewKey,sourceQuery,isSourceRelated,previewLabel} from '../src/world-previews.js';
test('cada abinha pertence a um ponto físico e conteúdo específico',()=>{
  assert.equal(previewKey({x:25,y:12,wx:320,wy:480,kind:'news'}),'345:492:news:public');
  assert.equal(previewKey({x:25,y:12,wx:320,wy:480,kind:'images',site:{domain:'site.org'}}),'345:492:images:site.org');
});
test('busca de conteúdo em fontes públicas nunca é atribuída ao site de origem',()=>{
  assert.equal(sourceQuery({site:{domain:'minecraft.net',title:'Minecraft'},kind:'images'}),'Minecraft');
  assert.equal(sourceQuery({kind:'news'}),'internet');
  assert.equal(isSourceRelated('videos'),true);
  assert.equal(isSourceRelated('about'),false);
  assert.equal(previewLabel('news'),'NOTÍCIA PÚBLICA');
});
