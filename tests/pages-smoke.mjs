import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

// Serve the compiled files below a project prefix, with no API or Vite proxy.
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
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],apiRequests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.includes('/api/'))apiRequests.push(r.url());});
async function search(query){
  await page.locator('#search-open').click();await page.locator('#query3d').fill(query);await page.locator('#search3d').evaluate(f=>f.requestSubmit());
  await page.locator('#search-status').filter({hasText:'Esta prévia não pesquisa a web'}).waitFor();
  await page.locator('.destination').first().click();
}
await mkdir('test-results',{recursive:true});
try{
  await page.goto(base+'3d.html');await page.locator('#viewport canvas').waitFor();
  assert.ok((await page.locator('.preview3d').textContent()).includes('PRÉVIA LOCAL'));
  await search('Astronomia');await page.locator('#location-title').filter({hasText:'Astronomia'}).waitFor();
  await page.keyboard.press('e');await page.locator('#info-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#original3d').getAttribute('href'),'https://pt.wikipedia.org/wiki/Astronomia');
  await page.keyboard.press('Escape');
  await search('https://www.youtube.com/@Google');await page.locator('#location-title').filter({hasText:'Canal @Google'}).waitFor();
  await page.reload();await search('Google');await page.locator('#location-title').filter({hasText:'Canal @Google'}).waitFor();
  await page.screenshot({path:'test-results/pages-preview.png'});
  await page.locator('#help-open').click();await page.locator('#help-dialog a').click();await page.locator('#game canvas').waitFor();
  assert.ok(page.url().endsWith('/Worldnet/'));
  await page.locator('.world3d-link').click();await page.locator('#viewport canvas').waitFor();
  assert.ok(page.url().endsWith('/Worldnet/3d.html'));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/pages-mobile.png'});
  assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);
  const result={passed:true,prefix,apiRequests,errors,checks:['build estático sem servidor de busca','catálogo local sinalizado','pesquisa e teleporte','cadastro por URL','IndexedDB após recarga','navegação 2D/3D sob subpasta','viewport móvel']};
  await writeFile('test-results/pages-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page.screenshot({path:'test-results/pages-failure.png'});throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
