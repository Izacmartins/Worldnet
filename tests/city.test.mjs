import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildingPlan, infoLevel, normalizeCategory, distanceToSolid,
  hitsSolid, THEMES, CHUNK_H, CHUNK_W, blend
} from '../src/city-art.js';

const generic = {domain:'unknown.example',title:'unknown.example',category:'Site'};
const verified = {domain:'tech.example',title:'Tech Lab',category:'Tecnologia',color:'#0044ff',colorVerified:true};

test('classifica o nível dos dados sem inventar logo ou categoria',()=>{
  assert.equal(infoLevel(generic),1);
  assert.equal(infoLevel({...generic,title:'Loja teste',category:'Loja'}),2);
  assert.equal(infoLevel(verified),3);
  assert.equal(normalizeCategory('Notícias'),'Notícias');
  assert.equal(normalizeCategory('desconhecido'),'Site');
});

test('tamanho determinístico, lotes variados e níveis de informação',()=>{
  const normal=buildingPlan(generic);
  const rich=buildingPlan({...generic,title:'Unknown Blog',category:'Blog',color:'#3399cc',colorVerified:true});
  const popular=buildingPlan({...generic,rank:1});
  const distant=buildingPlan({...generic,rank:30000});
  assert.equal(buildingPlan({...generic,rank:1}).solid.w,popular.solid.w,'mesmo site mantém tamanho após F5');
  assert.ok(popular.widthCells>=distant.widthCells,'sites populares têm maior capacidade de lote');
  assert.ok(rich.widthCells>normal.widthCells,'mais dados permitem uma construção maior no mesmo domínio');
  assert.equal(rich.level,3);
  const sample=[
    {domain:'shop.example.com',rank:1,title:'Loja',category:'Loja',colorVerified:true},
    {domain:'games.example.com',rank:2,title:'Jogos',category:'Jogos',colorVerified:true},
    {domain:'tech.example.com',rank:3,title:'Tech',category:'Tecnologia',colorVerified:true},
    {domain:'blog.example.com',rank:4,title:'Blog',category:'Blog',colorVerified:true},
    {domain:'news.example.com',rank:5,title:'News',category:'Notícias',colorVerified:true}
  ];
  assert.ok(new Set(sample.map(s=>buildingPlan(s).solid.w)).size>=2,'prédios próximos não são clones');
  for(const p of [normal,rich,popular,distant,buildingPlan(null,true)]){
    assert.ok(p.solid.x>=0&&p.solid.x+p.solid.w<CHUNK_W);
    assert.ok(p.solid.y>=0&&p.solid.y+p.solid.h<CHUNK_H);
    assert.ok(!hitsSolid(CHUNK_W/2,CHUNK_H-17,0,0,p,7),'spawn e teleporte na calçada');
  }
});

test('colisão nas fachadas, circulação livre fora do lote',()=>{
  const p=buildingPlan(verified);
  const b=p.solid;
  assert.ok(hitsSolid(b.x+b.w/2,b.y+b.h/2,0,0,p));
  assert.equal(hitsSolid(CHUNK_W/2,CHUNK_H-10,0,0,p),false);
  assert.ok(distanceToSolid(CHUNK_W/2,CHUNK_H-17,0,0,p)<58);
  assert.equal(hitsSolid(CHUNK_W+CHUNK_W/2,CHUNK_H-17,CHUNK_W,0,p),false);
});

test('temas incluem cor de ruas, fachadas e contraste de UI',()=>{
  assert.ok(THEMES.dark.night);
  assert.equal(THEMES.light.night,false);
  assert.notEqual(THEMES.dark.street,THEMES.light.street);
  assert.equal(blend(0x000000,0xffffff,.5),0x808080);
});
