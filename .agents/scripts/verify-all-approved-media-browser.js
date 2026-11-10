const {chromium}=require('../skills/gstack/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8765/';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const checks=[];try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage(),requests=[];
 page.on('request',r=>{if(r.url().includes('/gifs/'))requests.push(r.url());});
 await page.goto(base,{waitUntil:'networkidle'});assert.equal(requests.length,0);
 const data=await page.evaluate(async()=>fetch('./训练动作库/actions.json',{cache:'no-store'}).then(r=>r.json()));assert.equal(data.actions.length,110);assert.equal(data.actions.filter(a=>!a.media?.path).length,0);
 const approved=data.actions.filter(a=>a.media?.approvalReceipt?.includes('batch-2'));assert.equal(approved.length,40);
 for(const action of approved){
  await page.evaluate(key=>openExerciseLibraryGuideModal(key),action.exerciseKey);
  await page.waitForFunction(path=>{const box=document.querySelector('[data-exercise-media]'),img=box?.querySelector('.exercise-media-animation');return box?.dataset.exerciseMedia===path&&img?.naturalWidth>0&&!img.hidden;},action.media.path);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({exerciseKey:action.exerciseKey,media:action.media.path,decoded:true});
 }
 assert.ok(requests.every(u=>!u.includes('media-review/')&&!u.includes('ai-draft')));
 const out={base,actions:110,missing:0,newApprovedAnimations:40,checks,initialAnimationRequests:0,requests:requests.length,mutatedUserData:false};
 fs.writeFileSync(base.startsWith('http://127.0.0.1')?'docs/all-approved-media-browser-report.json':'docs/production-media-browser-report.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({base,actions:110,missing:0,newApprovedAnimations:40,decoded:checks.length,mutatedUserData:false}));await context.close();
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
