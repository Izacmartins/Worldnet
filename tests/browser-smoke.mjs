import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.WORLDNET_TEST_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];let phase='boot';page.on('pageerror',error=>errors.push({message:error.message,stack:error.stack,phase}));
const snapshot=()=>page.evaluate(async()=>{const {inspectWorld}=await import([...document.scripts].find(s=>s.src.includes('/src/main.js')).src);return inspectWorld();});
// Hold for rendered frames, rather than assuming a GPU-less CI renders at 60 Hz.
const frames=()=>page.evaluate(async()=>{for(let i=0;i<10;i++)await new Promise(requestAnimationFrame);});
const move=async key=>{await page.keyboard.down(key);await frames();await page.keyboard.up(key);};
const search=async q=>{
  await page.locator('#search-shortcut').click();await page.locator('#query').fill(q);await page.locator('#search-form').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>document.querySelector('#search-modal').classList.contains('hidden'),null,{timeout:12000});
  await page.locator('#result-list .result').first().waitFor();
};
await mkdir('test-results',{recursive:true});
try{
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#game canvas'));
  await page.waitForFunction(async()=>Boolean((await import([...document.scripts].find(s=>s.src.includes('/src/main.js')).src)).inspectWorld()),null,{timeout:15000});
  phase='first-search';await search('https://www.youtube.com/@NASA');
  const first=await snapshot();assert.equal(first.current,'youtube:channel:@nasa');assert.equal(first.colliding,false);
  await page.locator('#close-results').click();
  await move('w');const wall=await snapshot();assert.equal(wall.colliding,false);
  assert.ok(wall.position.y>=first.position.y-4,'a parede impede avançar pelo edifício');
  await move('s');assert.ok((await snapshot()).position.y>wall.position.y+10,'movimento após pesquisa');
  const mouseBefore=await snapshot();
  // Aim at the open walkway, away from interactive kiosks and DOM cards.
  await page.mouse.move(640,440);await page.mouse.down();await frames();await page.mouse.up();
  const mouseAfter=await snapshot();
  assert.ok(Math.hypot(mouseAfter.position.x-mouseBefore.position.x,mouseAfter.position.y-mouseBefore.position.y)>10,'mouse guia após teleporte');
  phase='second-search';await search('https://www.youtube.com/@veritasium');
  const second=await snapshot();assert.equal(second.current,'youtube:channel:@veritasium');assert.notEqual(first.position.x,second.position.x);
  await page.locator('#close-results').click();
  await page.locator('#content-shortcut').click();await page.locator('#content-overlay').waitFor({state:'visible'});
  await page.keyboard.press('Escape');await page.locator('#content-overlay').waitFor({state:'hidden'});
  const before=await snapshot();await move('ArrowDown');assert.ok((await snapshot()).position.y>before.position.y+10,'movimento após fechar conteúdo');
  phase='theme';await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.screenshot({path:'test-results/city-light.png'});
  await page.locator('#theme-toggle').click();
  phase='reload';await page.reload();await page.waitForFunction(async()=>Boolean((await import([...document.scripts].find(s=>s.src.includes('/src/main.js')).src)).inspectWorld()));
  await search('https://www.youtube.com/@NASA');
  const restored=await snapshot();assert.equal(restored.position.x,first.position.x);assert.equal(restored.position.y,first.position.y);
  await page.screenshot({path:'test-results/city-search.png'});
  phase='resize';await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/city-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#game').evaluate(node=>{node.style.display='none';});await frames();
  await page.locator('#game').evaluate(node=>{node.style.display='';});await frames();
  assert.equal((await snapshot()).colliding,false);
  assert.deepEqual(errors,[]);
  const result={passed:true,checks:['dois canais distintos','teleporte','colisão','WASD','mouse após teleporte','setas após fechar conteúdo','temas','posição após recarga','viewport móvel','ocultar e restaurar canvas','sem erros JS'],first,second,restored};
  await writeFile('test-results/browser-smoke.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}catch(error){
  await page.screenshot({path:'test-results/browser-failure.png'});
  await writeFile('test-results/browser-failure.json',JSON.stringify({error:error.message,pageErrors:errors},null,2));
  console.error('Erros da página:',errors.map(e=>({message:e.message,phase:e.phase})));throw error;
}finally{await browser.close();}
