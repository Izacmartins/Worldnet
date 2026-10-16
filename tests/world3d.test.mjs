import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRegistry,describeBuilding,spawnAt,cellAt} from '../src/world3d/model.js';
import {Simulation} from '../src/world3d/simulation.js';
import {resourceFromUrl,resourceSite} from '../shared/resources.js';

const resource=(url,x=400,y=0)=>({...resourceSite(resourceFromUrl(url)),world:{x,y}});

test('registro 3D preserva endereços de recursos separados do mesmo domínio',()=>{
  const registry=new WorldRegistry(),a=resource('https://youtube.com/@um'),b=resource('https://youtube.com/@dois',401);
  registry.replace([a,b]);assert.notDeepEqual(registry.address(a.id),registry.address(b.id));
  const address=registry.address(a.id);
  registry.replace([{...a,title:'Metadados atualizados'},b],[{domain:'popular.org',rank:1}]);
  assert.deepEqual(registry.address(a.id),address);assert.equal(registry.describe(0,0).home,true);
  assert.equal(registry.describe(400,0).site.id,a.id);
  const version=registry.version;
  registry.replace([{...a,title:'Metadados atualizados',updatedAt:Date.now()},b],[{domain:'popular.org',rank:1}]);
  assert.equal(registry.version,version,'atualização de datas não recria a cidade');
});

test('arquitetura 3D varia massas e mantém colisores dentro de ruas livres',()=>{
  const examples=['Loja','Blog','Comunidade','Notícias','Tecnologia','Site'].map((category,i)=>describeBuilding({domain:`site${i}.org`,title:'Um título real',category}));
  assert.ok(new Set(examples.map(p=>p.archetype)).size>=5);
  assert.ok(new Set(examples.map(p=>JSON.stringify(p.bodies))).size>=4);
  for(const p of examples){
    assert.ok(p.bodies.every(b=>b.h>0&&b.w>0&&b.d>0));
    assert.ok(p.colliders.every(b=>b.minX>2&&b.maxX<30&&b.minZ>2&&b.maxZ<21));
  }
  const minimal=describeBuilding(resource('https://youtube.com/@um'));assert.equal(minimal.level,1);
  const verified=describeBuilding({domain:'news.org',title:'Portal',category:'Notícias',color:'#123456',colorVerified:true});assert.equal(verified.level,3);assert.equal(verified.accent,0x123456);
});

test('colisão impede atravessar volumes e permite deslizar pela fachada',()=>{
  const registry=new WorldRegistry(),sim=new Simulation(registry);registry.replace([]);
  for(let i=0;i<240;i++)sim.step({x:0,z:-1},1/60);
  assert.equal(sim.blocked(sim.position.x,sim.position.z),false);
  assert.ok(sim.position.z>=17.4,'não atravessa a Central');
  const x=sim.position.x;
  for(let i=0;i<20;i++)sim.step({x:1,z:-1},1/60);
  assert.ok(sim.position.x>x+1,'desliza lateralmente');
  assert.equal(sim.blocked(sim.position.x,sim.position.z),false);
});

test('teleporte valida calçada, coordenadas negativas e grandes distâncias',()=>{
  const registry=new WorldRegistry(),sim=new Simulation(registry);
  const item=resource('https://youtube.com/@um',-401,-2);registry.replace([item]);
  const address=registry.address(item.id);assert.equal(sim.teleport(address),true);
  assert.deepEqual(cellAt(sim.position),address);assert.deepEqual(sim.position,spawnAt(address));
  assert.equal(sim.blocked(sim.position.x,sim.position.z),false);
});

test('velocidade diagonal não ultrapassa velocidade axial e passo longo é limitado',()=>{
  const registry=new WorldRegistry();registry.replace([]);
  const a=new Simulation(registry),b=new Simulation(registry);
  a.position={x:0,y:0,z:0};b.position={x:0,y:0,z:0};
  a.step({x:1,z:0},1/60);b.step({x:1,z:1},1/60);
  assert.ok(Math.abs(Math.hypot(a.position.x,a.position.z)-Math.hypot(b.position.x,b.position.z))<1e-6);
  const before={...a.position};a.step({x:1,z:0},10);assert.ok(a.position.x-before.x<=.301);
});
