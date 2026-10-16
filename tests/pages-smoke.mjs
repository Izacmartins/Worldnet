import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

// Test the shipping artifact under a GitHub project path, with NO backend.
// Remote fixtures below test UI/partial failures deterministically; a separate
// live-source run is documented separately and never conflated with this run.
const root=resolve('dist'),prefix='/Worldnet/';
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://pages.local').pathname;
  if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html',file=resolve(root,relative);
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const body=await readFile(file);res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.html':'text/html','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
const page=await context.newPage(),errors=[],backendRequests=[],remoteRequests=[];let sourcesFail=false;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.host===new URL(base).host&&u.pathname.includes('/api/'))backendRequests.push(r.url());});
const fixtureRepo={html_url:'https://github.com/facebook/react',full_name:'facebook/react',description:'The library for web and native user interfaces.',language:'JavaScript',stargazers_count:100,topics:['react'],owner:{avatar_url:'https://avatars.githubusercontent.com/u/69631'}};
const fixtureBook={key:'/works/OL82563W',title:'The Hobbit',author_name:['J. R. R. Tolkien'],first_publish_year:1937,cover_i:10521270};
for(const host of ['api.github.com','openlibrary.org','commons.wikimedia.org','pt.wikipedia.org']){
  await context.route(`https://${host}/**`,async route=>{
    remoteRequests.push({host,url:route.request().url()});
    if(sourcesFail||host==='pt.wikipedia.org'){await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'unavailable'});return;}
    const data=host==='api.github.com'?{items:[fixtureRepo]}:host==='openlibrary.org'?{docs:[fixtureBook]}:{query:{pages:{1:{index:1,title:'File:Moon.jpg',imageinfo:[{descriptionurl:'https://commons.wikimedia.org/wiki/File:Moon.jpg',thumburl:'https://upload.wikimedia.org/worldnet-test.png',mime:'image/png',extmetadata:{Artist:{value:'Test fixture author'},LicenseShortName:{value:'CC BY 4.0'},ImageDescription:{value:'Image fixture for rendering test'}}}]}}}};
    await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  });
}
// Explicitly synthetic 1px image used only in this deterministic renderer test.
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
for(const host of ['avatars.githubusercontent.com','covers.openlibrary.org','upload.wikimedia.org'])await context.route(`https://${host}/**`,r=>r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:pixel}));
const snap=()=>page.evaluate(()=>window.Worldnet.inspect());
const ready=()=>page.waitForFunction(()=>window.Worldnet?.inspect()?.chunks>=25&&!window.Worldnet.inspect().queued);
const frames=n=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);},n);
async function results(query,type='all'){
  await page.locator('#search-open').click();await page.locator(`[data-type-filter="${type}"]`).click();await page.locator('#query3d').fill(query);await page.locator('#search3d').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(()=>!window.Worldnet.inspect().searching);
}
async function visit(query,type='all',selector='.destination'){
  await results(query,type);await page.locator(selector).first().click();await ready();
}
await mkdir('test-results',{recursive:true});
try{
  await page.goto(base);await ready();assert.equal(await page.title(),'Worldnet — explore a internet em 3D');
  assert.equal((await snap()).resources,32);assert.equal((await snap()).colliding,false);assert.ok((await snap()).render.triangles>0);
  await page.screenshot({path:'test-results/portfolio-central.png'});await page.locator('#welcome-close').click();
  await visit('NASA','channel');const nasa=await snap();assert.equal(nasa.current,'youtube:channel:@nasa');assert.deepEqual(nasa.cell,{x:1,z:0});assert.equal(remoteRequests.length,0,'catálogo de canais funciona sem chamadas externas');
  await page.keyboard.press('e');await page.locator('#info-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#original3d').getAttribute('href'),'https://www.youtube.com/@NASA');assert.match(await page.locator('#info-source').textContent(),/Catálogo editorial/);
  await page.keyboard.press('Escape');const before=await snap();await page.keyboard.down('s');await frames(14);await page.keyboard.up('s');const after=await snap();assert.ok(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>.3);assert.equal(after.colliding,false);
  const yaw=after.yaw;await page.locator('#camera-right').click();assert.ok(Math.abs((await snap()).yaw-yaw)>.2);
  await page.mouse.move(650,450);await page.mouse.down({button:'right'});await page.mouse.move(770,450,{steps:5});await page.mouse.up({button:'right'});assert.ok(Math.abs((await snap()).yaw-yaw)>.4);
  await page.locator('#home').click();await ready();
  const beforeMouse=await snap();await page.mouse.move(670,610);await page.mouse.down();await frames(14);await page.mouse.up();const afterMouse=await snap();
  assert.ok(Math.hypot(afterMouse.position.x-beforeMouse.position.x,afterMouse.position.z-beforeMouse.position.z)>.3,'arraste no chão move o personagem');
  await visit('react');assert.ok(await page.locator('#source-status').count());const react=await snap();assert.equal(react.current,'url:https://github.com/facebook/react');
  await page.keyboard.press('e');assert.match(await page.locator('#info-source').textContent(),/GitHub/);await page.keyboard.press('Escape');
  const count=remoteRequests.length;await results('react');assert.equal(remoteRequests.length,count,'cache evita novas consultas');assert.match(await page.locator('#source-status').textContent(),/cache local/);await page.keyboard.press('Escape');
  await visit('hobbit','book');assert.ok((await snap()).current.includes('/works/OL82563W'));await page.keyboard.press('e');assert.match(await page.locator('#info-description').textContent(),/Tolkien/);await page.keyboard.press('Escape');
  await visit('moon','image');await page.keyboard.press('e');assert.match(await page.locator('#info-license').textContent(),/CC BY 4.0/);await page.keyboard.press('Escape');await page.screenshot({path:'test-results/portfolio-content-fixture.png'});
  await visit('https://www.youtube.com/@WorldnetExample');const added=await snap();assert.equal(added.current,'youtube:channel:@worldnetexample');await page.keyboard.press('e');assert.match(await page.locator('#info-source').textContent(),/não confirmados/);await page.keyboard.press('Escape');
  await page.reload();await ready();await visit('WorldnetExample','channel');assert.deepEqual((await snap()).cell,added.cell);
  sourcesFail=true;await results('NASA missingword');assert.equal(await page.locator('.destination').count(),0);assert.match(await page.locator('#search-status').textContent(),/fontes não responderam/);await page.keyboard.press('Escape');
  await visit('NASA','channel');assert.deepEqual((await snap()).cell,nasa.cell);
  await page.locator('#theme').click();await ready();assert.equal((await snap()).theme,'light');await page.screenshot({path:'test-results/portfolio-light.png'});await page.locator('#theme').click();await ready();
  // Export must produce a valid, importable world; import must preserve positions.
  await page.locator('#help-open').click();await page.getByText('Dados e privacidade',{exact:true}).click();
  const download=page.waitForEvent('download');await page.locator('#export-world').click();const exported=await download,world=JSON.parse(await readFile(await exported.path(),'utf8'));assert.equal(world.format,'worldnet-portfolio');assert.ok(world.resources.some(r=>r.id===added.current));
  await page.locator('#import-world').setInputFiles({name:'world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(world))});await page.locator('#data-status').filter({hasText:'importados'}).waitFor();await page.keyboard.press('Escape');await visit('NASA','channel');assert.deepEqual((await snap()).cell,nasa.cell);
  // A new browser context has its own world, independent of the first visitor.
  const isolated=await browser.newPage();await isolated.goto(base);await isolated.waitForFunction(()=>window.Worldnet?.inspect()?.resources===32);assert.equal((await isolated.evaluate(()=>window.Worldnet.inspect())).resources,32);await isolated.close();
  const denied=await browser.newContext();await denied.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('Blocked storage (test)');}});Object.defineProperty(window,'localStorage',{get(){throw new Error('Blocked storage (test)');}});});
  const memoryPage=await denied.newPage();await memoryPage.goto(base);await memoryPage.waitForFunction(()=>window.Worldnet?.inspect()?.resources===32);assert.match(await memoryPage.locator('#world-count').textContent(),/SOMENTE NESTA SESSÃO/);await denied.close();
  // Repeated visits discard chunks and GPU resources instead of growing forever.
  const samples=[];for(let i=0;i<3;i++){await page.locator('#home').click();await ready();await visit('WorldnetExample','channel');samples.push(await snap());}
  assert.ok(samples.every(s=>s.chunks<=49&&s.render.textures<=60&&s.render.geometries<=100));assert.ok(samples.at(-1).render.textures<=samples[0].render.textures+2);
  await page.setViewportSize({width:390,height:844});await frames(5);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/portfolio-mobile.png'});
  await results('NASA','channel');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/portfolio-mobile-search.png'});await page.keyboard.press('Escape');
  // Existing entry remains supported at the project subpath.
  await page.goto(base+'3d.html');await ready();assert.equal((await snap()).resources,world.resources.length);
  const beforeContext=await snap();const supportsContext=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;window.restoreWorldnetContext=()=>ext.restoreContext();ext.loseContext();return true;});
  if(supportsContext){await page.waitForFunction(()=>window.Worldnet.inspect().contextLost);await page.waitForTimeout(200);await page.evaluate(()=>window.restoreWorldnetContext());await page.waitForFunction(()=>!window.Worldnet.inspect().contextLost);await frames(5);assert.deepEqual((await snap()).position,beforeContext.position);}
  assert.deepEqual(backendRequests,[]);assert.deepEqual(errors,[]);
  const result={passed:true,remoteData:'controlled fixtures (not a live-source validation)',prefix,backendRequests,errors,checks:['entrada 3D padrão sem backend','canais por nome no catálogo','fontes por tipo e falha parcial','cache de consultas','teleporte e colisão','teclado e câmera após interfaces','créditos da mídia','links sem inventar metadados','IndexedDB e endereços estáveis','exportação/importação','visitantes isolados','temas','chunks e descarte','viewport móvel','contexto WebGL'],samples,final:await snap()};
  await writeFile('test-results/pages-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page.screenshot({path:'test-results/portfolio-failure.png'});await writeFile('test-results/portfolio-failure.json',JSON.stringify({message:e.message,errors,snapshot:await snap()},null,2));throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
