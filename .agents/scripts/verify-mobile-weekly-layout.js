let playwright;try{playwright=require('playwright');}catch{playwright=require('../skills/gstack/node_modules/playwright');}
const {chromium}=playwright,fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{window.confirm=()=>true;window.alert=message=>{window.__lastAlert=message;};syncToCloud=async()=>false;localStorage.setItem('supabase-auto-sync-enabled','0');switchTab('plan',false);});
  await page.locator('#weeklyScheduleCollapseBtn').click();await page.locator('#pe-original-modules').click();
  // Wait for the app's existing day-dock scroll animation before testing a gesture.
  await page.waitForTimeout(450);
  const before=await page.evaluate(()=>getPlanDays().map(d=>d.moduleId));
  await page.evaluate(()=>document.getElementById('weeklyScheduleList').scrollIntoView({behavior:'instant',block:'start'}));
  const source=page.locator('[data-week-drag="0"]'),target=page.locator('[data-week-drag="2"]');
  const from=await source.boundingBox(),to=await target.boundingBox(),cdp=await context.newCDPSession(page);
  const point={x:from.x+from.width/2,y:from.y+from.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let step=1;step<=12;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+(to.x+to.width/2-point.x)*step/12,y:point.y+(to.y+to.height/2-point.y)*step/12}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const after=await page.evaluate(()=>getPlanDays().map(d=>d.moduleId));assert.equal(after[2],before[0],JSON.stringify({from,to,before,after}));assert.equal(after[0],before[1]);
  await page.reload({waitUntil:'networkidle'});assert.deepEqual(await page.evaluate(()=>getPlanDays().map(d=>d.moduleId)),after);
  const results=[{name:'native touch drag moves the whole module',passed:true},{name:'module order survives a real reload',passed:true}];
  for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{switchTab('plan',false);if(document.getElementById('weeklyScheduleBody').hidden)document.getElementById('weeklyScheduleCollapseBtn').click();if(document.getElementById('planTemplateBody').classList.contains('collapsed'))document.getElementById('planTemplateCollapseBtn').click();});
   const failures=await page.evaluate(()=>{
    const controls=[...document.querySelectorAll('#weeklyScheduleCard button,#weeklyScheduleCard select,#visualPlanEditor button,#visualPlanEditor input,#visualPlanEditor textarea,#planEditDaySelect,#te-plan-map .te-muscle-list button,#planContainer .day-panel.active .te-record-open')].filter(e=>e.getClientRects().length);
    return controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||(e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2);}).map(e=>({html:e.outerHTML.slice(0,170),width:e.clientWidth,scroll:e.scrollWidth}));
   });
   assert.deepEqual(failures,[],`${width}px layout`);results.push({name:`${width}px controls fit viewport`,passed:true});
   for(const tab of ['record','history','tools']){
    await page.evaluate(tab=>switchTab(tab,false),tab);
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('.section.active button,.section.active input,.section.active select,.section.active textarea')].filter(e=>e.getClientRects().length).filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1).map(e=>e.outerHTML.slice(0,140)));
    assert.deepEqual(overflow,[],`${width}px ${tab} controls`);
   }
  }
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
