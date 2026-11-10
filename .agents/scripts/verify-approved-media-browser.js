let P;try{P=require('playwright');}catch{P=require('../skills/gstack/node_modules/playwright');}
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await P.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),report={checks:[],published:false};
 const check=(name,ok)=>{assert.ok(ok,name);report.checks.push({name,passed:true});};
 async function fresh(options={}){const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},...options}),page=await ctx.newPage(),requests=[];page.on('request',r=>{if(r.url().includes('/gifs/'))requests.push(r.url());});await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});return {ctx,page,requests};}
 const playing=page=>page.waitForFunction(()=>{const image=document.querySelector('.exercise-media-animation');return image?.naturalWidth>0&&!image.hidden;});
 try{
  let s=await fresh();check('opening the app does not preload approved or rejected animations',s.requests.length===0);
  await s.page.evaluate(()=>openExerciseLibraryGuideModal('opengym-3211'));await playing(s.page);
  check('the reviewed knee exercise offers the two approved versions',await s.page.locator('.exercise-media-choices button').count()===2);
  check('the initial detail downloads only the approved AI poster and animation',s.requests.length===2&&s.requests.every(u=>u.includes('ai_kneeling_pushup_20261110_v2')));
  await s.page.evaluate(()=>{window.__oldMedia=document.querySelector('.exercise-media-animation');});
  await s.page.locator('[data-exercise-media-choice="gifs/3211.gif"]').click();await playing(s.page);
  check('switching to the original uses its own animation and releases the AI image',await s.page.evaluate(()=>document.querySelector('[data-exercise-media]').dataset.exerciseMedia==='gifs/3211.gif'&&!window.__oldMedia.isConnected&&!window.__oldMedia.getAttribute('src')));
  check('version controls fit a 390px phone viewport',await s.page.locator('.exercise-media-choices button').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().right<=innerWidth&&n.scrollWidth<=n.clientWidth+1)));
  await s.page.locator('[data-exercise-media-choice="gifs/ai_kneeling_pushup_20261110_v2.gif"]').click();await playing(s.page);
  await s.page.waitForTimeout(700);
  await s.page.screenshot({path:'docs/screenshots/approved-knee-media-mobile.png'});
  await s.page.evaluate(()=>openExerciseLibraryGuideModal('opengym-0289'));await playing(s.page);
  check('approved dumbbell bench press loads the corresponding existing animation',await s.page.locator('[data-exercise-media]').getAttribute('data-exercise-media')==='gifs/0289.gif');
  check('rejected A1 is never requested by exercise details',s.requests.every(u=>!u.includes('ai-draft')&&!u.includes('ai-spritesheet')));await s.ctx.close();
  s=await fresh({reducedMotion:'reduce'});await s.page.evaluate(()=>openExerciseLibraryGuideModal('opengym-3211'));await s.page.waitForFunction(()=>document.querySelector('.exercise-media-poster')?.naturalWidth>0);
  check('approved AI version respects reduced-motion poster-only loading',s.requests.length===1&&s.requests[0].includes('-poster.webp'));
  await s.page.locator('[data-exercise-media-choice="gifs/3211.gif"]').click();await s.page.waitForFunction(()=>document.querySelector('.exercise-media-poster')?.naturalWidth>0);
  check('switching versions preserves reduced-motion behavior',s.requests.length===2&&s.requests.every(u=>u.includes('-poster.webp')));await s.ctx.close();
  fs.writeFileSync('docs/approved-media-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
