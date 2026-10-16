import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeWebsite, classifySite, discoverSites, searchDiscoveries, discoveryCount, neutralColor, normalizeQuery
} from '../src/discovery.js';

test('só aceita domínios web públicos, com URL segura normalizada', () => {
 assert.deepEqual(normalizeWebsite('http://www.minecraft.net/example'), {domain:'minecraft.net',url:'https://minecraft.net/'});
 for (const value of ['javascript:alert(1)','http://localhost','file:///etc/passwd','http://127.0.0.1','https://me:pass@test.com/']) {
  assert.equal(normalizeWebsite(value),null,value);
 }
});
test('categoria provisória e termo de busca', () => {
 assert.equal(classifySite({domain:'loja-exemplo.com'}),'Loja');
 assert.equal(classifySite({domain:'blogdomundo.net'}),'Site');
 assert.equal(classifySite({domain:'news-world.com'}),'Notícias');
 assert.equal(typeof neutralColor('Site'),'string');
 assert.equal(normalizeQuery('  Minecraft   Wiki '),'minecraft wiki');
});
test('descoberta independente usa 2 fontes e reusa resultados do navegador', async () => {
 const previous = globalThis.fetch;
 let count = 0;
 globalThis.fetch=async url => {
  count++;
  const parsed=new URL(url), action=parsed.searchParams.get('action');
  assert.equal(parsed.searchParams.get('origin'),'*');
  let result;
  if (action==='wbsearchentities') result={search:[{id:'Q42',label:'Minecraft'}]};
  else if (action==='wbgetentities') result={entities:{Q42:{labels:{pt:{value:'Minecraft'}} , descriptions:{pt:{value:'jogo eletrônico'}},claims:{P856:[{mainsnak:{datavalue:{value:'https://www.minecraft.net/'}}}],P465:[{mainsnak:{datavalue:{value:'00AACC'}}}],P154:[{mainsnak:{datavalue:{value:'Minecraft-logo.svg'}}}]}}}};
  else if (parsed.searchParams.get('list')==='search') result={query:{search:[{pageid:112,title:'Minecraft'}]}};
  else if (parsed.searchParams.get('prop')==='extlinks') result={query:{pages:[{pageid:112,title:'Minecraft',extlinks:[{url:'https://minecraft.net/'},{url:'https://minecraftforum.net/'},{url:'https://doi.org/abc'}]}]}};
  else throw new Error(url);
  return {ok:true,json:async()=>result};
 };
 try {
  const a=await discoverSites('Minecraft');
  assert.equal(a.errors.length,0);
  assert.equal(a.sites.length,2);
  const m=a.sites.find(s=>s.domain==='minecraft.net');
  assert.ok(m.official);assert.equal(m.color,'#00AACC');assert.equal(m.category,'Jogos');
  assert.equal(m.logoVerified,true);assert.ok(m.logoUrl.includes('Minecraft-logo.svg'));
  assert.ok(discoveryCount()>=2);
  assert.equal(searchDiscoveries('Minecraft').length,2);
  assert.equal(count,4);
  const b=await discoverSites('minecraft');
  assert.equal(b.fromCache,true);assert.equal(count,4);
 } finally {globalThis.fetch=previous;}
});
