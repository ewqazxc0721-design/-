let P;try{P=require('playwright');}catch{P=require('../skills/gstack/node_modules/playwright');}
const fs=require('node:fs'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync('训练动作库/media-manifest.json','utf8'));
(async()=>{
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',browser=await P.chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 const report={checks:[],controlledNetwork:{latencyMs:80,downloadBytesPerSecond:200000},sample:'gifs/custom_bulgarian_split_squat.gif'};
 const check=(name,value)=>{assert.ok(value,name);report.checks.push({name,passed:true});};
 async function fresh(options={}){const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},...options}),page=await ctx.newPage();const requests=[];page.on('request',r=>{if(r.url().includes('/gifs/'))requests.push(r.url());});await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});return {ctx,page,requests};}
 try{
  let s=await fresh();check('opening the exercise library does not download its animation collection',s.requests.length===0);
  let cdp=await s.ctx.newCDPSession(s.page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:200000});
  report.originalAnimationMs=await s.page.evaluate(path=>new Promise((resolve,reject)=>{const start=performance.now(),img=new Image();img.onload=()=>resolve(Math.round(performance.now()-start));img.onerror=reject;document.body.append(img);img.src=path;}),report.sample);await s.ctx.close();
  s=await fresh();cdp=await s.ctx.newCDPSession(s.page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:200000});
  await s.page.evaluate(()=>{window.__mediaStart=performance.now();openExerciseLibraryGuideModal('bulgarian-split-squat');});
  await s.page.waitForFunction(()=>document.querySelector('.exercise-media-poster')?.naturalWidth>0);report.posterMs=await s.page.evaluate(()=>Math.round(performance.now()-window.__mediaStart));
  await s.page.waitForFunction(()=>{const img=document.querySelector('.exercise-media-animation');return img&&!img.hidden&&img.naturalWidth>0;});report.optimizedAnimationMs=await s.page.evaluate(()=>Math.round(performance.now()-window.__mediaStart));
  check('detail view downloads only its poster and optimized animation: '+JSON.stringify(s.requests),s.requests.length===2&&s.requests.every(url=>url.includes('/optimized/')));
  await s.page.locator('.exercise-media-toggle').click();check('pause restores the poster and releases the animated URL',await s.page.locator('.exercise-media-animation').getAttribute('src')===null);
  await s.ctx.close();
  s=await fresh({reducedMotion:'reduce'});await s.page.evaluate(()=>openExerciseLibraryGuideModal('bulgarian-split-squat'));await s.page.waitForFunction(()=>document.querySelector('.exercise-media-poster')?.naturalWidth>0);
  check('reduced-motion mode initially downloads only the poster',s.requests.length===1&&s.requests[0].includes('-poster.webp'));
  await s.page.locator('.exercise-media-toggle').click();await s.page.waitForFunction(()=>!document.querySelector('.exercise-media-animation').hidden);check('manual play works with reduced motion',s.requests.length===2);await s.ctx.close();
  s=await fresh();const asset=manifest.assets[report.sample];await s.page.route('**/'+asset.animation,route=>route.abort());await s.page.evaluate(()=>openExerciseLibraryGuideModal('bulgarian-split-squat'));await s.page.waitForFunction(()=>document.querySelector('.exercise-media-animation')?.src.endsWith('custom_bulgarian_split_squat.gif')&&!document.querySelector('.exercise-media-animation').hidden);
  check('failed optimized animation falls back to the original GIF',true);await s.ctx.close();
  report.originalBytes=manifest.assets[report.sample].sourceBytes;report.optimizedBytes=manifest.assets[report.sample].animationBytes;report.posterBytes=manifest.assets[report.sample].posterBytes;
  fs.writeFileSync('docs/exercise-media-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
