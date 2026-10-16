import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=process.env.WORLDNET_TEST_URL||'http://127.0.0.1:5173',results=[];
try{
  for(const config of [{name:'desktop-software',width:1280,height:720,rate:1},{name:'desktop-cpu4x',width:1280,height:720,rate:4},{name:'mobile-software',width:390,height:844,rate:1}]){
    const page=await browser.newPage({viewport:{width:config.width,height:config.height}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.rate});
    const started=Date.now();await page.goto(base+'/3d.html');
    await page.waitForFunction(async()=>{const m=await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src);return m.inspect3D()?.chunks>=25;});
    const bootMs=Date.now()-started;
    // Warm-up, then sample while idle. This is a software-rendered baseline,
    // not a claim that physical integrated GPUs have the same performance.
    await page.waitForTimeout(5000);await page.waitForTimeout(6000);
    const snapshot=await page.evaluate(async()=>(await import([...document.scripts].find(s=>s.src.includes('/src/world3d/main.js')).src)).inspect3D());
    const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'undisclosed';});
    results.push({config,bootMs,renderer,errors,snapshot});await page.close();
  }
  await mkdir('test-results',{recursive:true});await writeFile('test-results/perf-3d.json',JSON.stringify({browser:browser.version(),results},null,2));
  console.log(JSON.stringify(results.map(r=>({name:r.config.name,bootMs:r.bootMs,performance:r.snapshot.performance,render:r.snapshot.render,heapBytes:r.snapshot.heapBytes,economy:r.snapshot.economy,errors:r.errors}))));
}finally{await browser.close();}
