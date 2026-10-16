import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {BROWSER_PROVIDERS,queryProvider} from '../src/browser-providers.js';

// Optional live diagnostics, with no invented results. In cloud networks whose
// CA is not in Chromium's store, --system-trust forwards TEST requests through
// Node's verified TLS client. It preserves actual status/body/CORS headers and
// is never part of the app or a production proxy. Do not disable TLS checks.
const bridge=process.argv.includes('--system-trust'),sources=[];
for(const provider of BROWSER_PROVIDERS){
  try{const items=await queryProvider(provider,'astronomy',{signal:AbortSignal.timeout(15000)});sources.push({name:provider.name,status:'ok',count:items.length,example:items[0]?.title});}
  catch(e){sources.push({name:provider.name,status:'unavailable',error:e.message});}
}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],requests=[];
if(bridge)for(const host of ['api.github.com','openlibrary.org','commons.wikimedia.org','pt.wikipedia.org','avatars.githubusercontent.com','covers.openlibrary.org','upload.wikimedia.org','thumb.wikimedia.org']){
  await context.route(`https://${host}/**`,async route=>{
    try{
      const headers={Accept:route.request().headers().accept||'*/*'};const origin=route.request().headers().origin;if(origin)headers.Origin=origin;
      const response=await fetch(route.request().url(),{headers,signal:AbortSignal.timeout(12000)}),out=Object.fromEntries(response.headers);
      delete out['content-encoding'];delete out['content-length'];delete out['transfer-encoding'];
      requests.push({host,status:response.status,cors:out['access-control-allow-origin']||null});
      await route.fulfill({status:response.status,headers:out,body:Buffer.from(await response.arrayBuffer())});
    }catch(e){requests.push({host,error:e.message});await route.abort();}
  });
}
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.WORLDNET_TEST_URL||'http://127.0.0.1:5173/');await page.waitForFunction(()=>window.Worldnet?.inspect()?.resources===32);await page.locator('#welcome-close').click();
  const visits=[];
  for(const [type,query] of [['repository','astronomy'],['book','astronomy'],['image','Milky Way'],['article','astronomia']]){
    await page.locator('#search-open').click();await page.locator(`[data-type-filter="${type}"]`).click();await page.locator('#query3d').fill(query);await page.locator('#search3d').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>!window.Worldnet.inspect().searching);
    const status=await page.locator('#source-status').textContent(),count=await page.locator('.destination').count();
    visits.push({type,query,status,count});
    if(count){
      visits.at(-1).first=await page.locator('.destination strong').first().textContent();await page.locator('.destination').first().click();await page.waitForFunction(()=>!window.Worldnet.inspect().queued);await page.waitForTimeout(1200);
      await page.screenshot({path:`test-results/live-${type}.png`});
      await page.keyboard.press('e');await page.locator('#info-dialog').waitFor({state:'visible'});visits.at(-1).url=await page.locator('#original3d').getAttribute('href');await page.keyboard.press('Escape');
    }else await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);const report={testedAt:new Date().toISOString(),transport:bridge?'Node trusted TLS test bridge; actual CORS headers preserved':'direct browser HTTPS',sources,visits,requests,errors};
  await mkdir('test-results',{recursive:true});await writeFile('test-results/live-sources.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.ok(visits.every(v=>v.count>0),'Alguma fonte não retornou resultados reais. Consulte o relatório.');
}finally{await browser.close();}
