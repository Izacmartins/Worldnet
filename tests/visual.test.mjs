import test from 'node:test';
import assert from 'node:assert/strict';
import {isOpenPlot,terrainVariant} from '../src/layout.js';
import {dominantLogoColor} from '../src/logo-colors.js';

test('primeiro anel alterna edifícios e espaços abertos',()=>{
  for(const [x,y] of [[1,1],[1,-1],[-1,1],[-1,-1]])assert.equal(isOpenPlot(x,y),true);
  for(const [x,y] of [[1,0],[0,1],[-1,0],[0,-1]])assert.equal(isOpenPlot(x,y),false);
  assert.equal(isOpenPlot(0,0),false);
});
test('terreno e espaços livres determinísticos entre sessões',()=>{
  for(let y=-14;y<=14;y++)for(let x=-14;x<=14;x++){
    assert.equal(isOpenPlot(x,y),isOpenPlot(x,y));
    const v=terrainVariant(x,y);
    assert.ok(Number.isInteger(v)&&v>=0&&v<12);
  }
  const holes=[...Array(15)].flatMap((_,y)=>[...Array(15)].map((_,x)=>[x,y]))
    .filter(([x,y])=>isOpenPlot(x,y));
  assert.ok(holes.length>10&&holes.length<180);
});
test('extrai cor predominante e ignora áreas transparentes e branco',()=>{
  const w=10,h=10,rgba=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){
    const c=i<65?[29,165,223,255]:i<80?[250,255,254,255]:[0,0,0,0];
    rgba.set(c,i*4);
  }
  assert.equal(dominantLogoColor(rgba,w,h),'#1DA5DF');
});
test('não inventa cor se pixels são insuficientes',()=>{
  assert.equal(dominantLogoColor(new Uint8ClampedArray(16),2,2),null);
});
