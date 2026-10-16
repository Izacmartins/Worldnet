import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.WORLDNET_TEST_URL||'http://127.0.0.1:5173';
const snapshot=()=>page.evaluate(async()=>(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D());
const frames=n=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);},n);
const ready=()=>page.waitForFunction(async()=>{const s=(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D();return s&&s.chunks>=25&&s.queued===0;},null,{timeout:30000});
const move=async(key,n=12)=>{await page.keyboard.down(key);await frames(n);await page.keyboard.up(key);};
async function search(url){
  await page.waitForFunction(async()=>!(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D().searching);
  await page.locator('#search-open').click();await page.locator('#query3d').fill(url);await page.locator('#search3d').evaluate(f=>f.requestSubmit());
  await page.waitForFunction(async()=>!(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D().searching);
  await page.locator('.destination').first().click();await ready();await frames(2);await ready();
}
await mkdir('test-results',{recursive:true});
try{
  await page.goto(base+'/3d.html');await ready();
  await page.screenshot({path:'test-results/3d-central.png'});
  const initial=await snapshot();assert.equal(initial.colliding,false);assert.ok(initial.render.triangles>0);
  await search('https://www.youtube.com/@NASA');const first=await snapshot();
  assert.equal(first.current,'youtube:channel:@nasa');assert.ok(first.origin.x>10_000);assert.equal(first.colliding,false);
  await move('w',20);assert.equal((await snapshot()).colliding,false);
  const before=await snapshot();await move('s');const after=await snapshot();
  assert.ok(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>.3,'WASD após teleporte');
  await search('https://www.youtube.com/@NASA');
  await page.keyboard.press('e');await page.locator('#info-dialog').waitFor({state:'visible'});
  assert.ok((await page.locator('#original3d').getAttribute('href')).includes('youtube.com'));
  await page.keyboard.press('Escape');assert.equal((await snapshot()).paused,false);
  const beforeArrow=await snapshot();await move('ArrowDown');assert.ok(Math.hypot((await snapshot()).position.x-beforeArrow.position.x,(await snapshot()).position.z-beforeArrow.position.z)>.3,'setas após fechar interface');
  await page.mouse.move(640,520);const beforeMouse=await snapshot();await page.mouse.down();await frames(15);await page.mouse.up();
  const afterMouse=await snapshot();assert.ok(Math.hypot(afterMouse.position.x-beforeMouse.position.x,afterMouse.position.z-beforeMouse.position.z)>.3,'guia pelo mouse');
  const yaw=(await snapshot()).yaw;
  await page.mouse.move(700,400);await page.mouse.down({button:'right'});await page.mouse.move(820,400,{steps:6});await page.mouse.up({button:'right'});await frames(2);
  assert.ok(Math.abs((await snapshot()).yaw-yaw)>.2,'órbita de câmera');
  await search('https://www.youtube.com/@veritasium');const second=await snapshot();assert.notDeepEqual(second.cell,first.cell);
  await page.locator('#theme').click();await ready();await page.screenshot({path:'test-results/3d-light.png'});assert.equal((await snapshot()).theme,'light');
  await page.locator('#theme').click();await ready();
  // Repeated distant teleports must unload GPU resources rather than accumulate.
  const samples=[];
  for(let i=0;i<3;i++){
    await page.locator('#home').click();await ready();
    await search('https://www.youtube.com/@NASA');samples.push(await snapshot());
  }
  assert.ok(samples.every(s=>s.chunks<=49&&s.render.geometries<=40&&s.render.textures<=25));
  assert.ok(samples.at(-1).disposed>samples[0].disposed);
  assert.ok(samples.at(-1).render.textures<=samples[0].render.textures+2,'texturas estabilizam após aquecimento');
  await page.reload();await ready();await search('https://www.youtube.com/@NASA');const restored=await snapshot();
  assert.deepEqual(restored.cell,first.cell);assert.equal(restored.position.x,first.position.x);assert.equal(restored.position.z,first.position.z);
  await page.screenshot({path:'test-results/3d-search.png'});
  await page.setViewportSize({width:390,height:844});await frames(10);await page.screenshot({path:'test-results/3d-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1280,height:720});await frames(3);
  // Real WebGL lifecycle test: the renderer must recover without losing state.
  const beforeContext=await snapshot();
  const supported=await page.evaluate(()=>{const c=document.querySelector('#viewport canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;window.restoreWorldnetContext=()=>ext.restoreContext();ext.loseContext();return true;});
  if(supported){await page.waitForFunction(async()=>(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D().contextLost);await page.waitForTimeout(200);await page.evaluate(()=>window.restoreWorldnetContext());await page.waitForFunction(async()=>!(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D().contextLost);await frames(10);assert.deepEqual((await snapshot()).position,beforeContext.position);}
  await page.locator('#viewport').evaluate(n=>n.style.display='none');await frames(3);await page.locator('#viewport').evaluate(n=>n.style.display='');await frames(5);
  assert.deepEqual(errors,[]);
  const result={passed:true,checks:['geometria 3D','busca e lugares distintos','teleporte','WASD/setas/mouse','órbita','interação e foco','temas','streaming/descarte','persistência','viewport móvel','contexto WebGL','canvas oculto'],initial,first,second,restored,samples,contextTest:supported,final:await snapshot()};
  await writeFile('test-results/browser-3d.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await page.screenshot({path:'test-results/3d-failure.png'});await writeFile('test-results/3d-failure.json',JSON.stringify({error:error.message,errors,snapshot:await snapshot()},null,2));throw error;}
finally{await browser.close();}
