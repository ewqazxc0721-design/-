// Uses an isolated local profile. iOS mode exercises the app's fast day-switch branch.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('../skills/gstack/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[];
 try{for(const ios of [false,true]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  if(ios)await context.addInitScript(()=>{
   Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
   const supports=CSS.supports.bind(CSS);CSS.supports=(...args)=>args[0].includes('-webkit-touch-callout')||supports(...args);
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   syncToCloud=async()=>false;window.alert=()=>{};window.confirm=()=>true;localStorage.setItem('supabase-auto-sync-enabled','0');
   const template=getPlanTemplate();template.days.forEach((d,i)=>{d.focus=`星期测试 ${i}`;d.items=[`引体向上 ${i+2}组 × 10次 | 目标总次数30–33次 | 休息150–180秒`,'热身：肩胛引体2组 × 6–8次 + 弹力绳拉开1组 × 20次'];});
   setPlanTemplate(template,true);switchTab('plan',false);if(document.getElementById('planTemplateBody').classList.contains('collapsed'))document.getElementById('planTemplateCollapseBtn').click();
  });
  for(const index of [0,3,6,1,5,2,4]){
   await page.locator('#planEditDaySelect').selectOption(String(index));
   assert.equal(await page.evaluate(index=>{
    const day=getPlanDays()[index];return activePlanDay===index&&document.getElementById('editorDayLabel').textContent===day.day&&document.getElementById('planDayNameEdit').value===day.day&&document.getElementById('planFocusEdit').value===day.focus&&document.querySelector('[data-text="0"]').value===day.items[0];
   },index),true,`${ios?'iOS':'standard'} immediate weekday ${index}`);
  }
  checks.push({name:`${ios?'iOS fast path':'standard path'}: all seven weekdays update immediately`,passed:true});
  await page.locator('[data-sets="0"]').fill('9');await page.locator('#planEditDaySelect').selectOption('0');await page.locator('#planEditDaySelect').selectOption('4');
  assert.equal(await page.locator('[data-sets="0"]').inputValue(),'9');await page.locator('#savePlanDayBtn').click();
  assert.equal(await page.evaluate(()=>getPlanDays()[4].items[0].includes('9组')&&getPlanDays()[0].items[0].includes('2组')),true);
  await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{syncToCloud=async()=>false;switchTab('plan',false);setActivePlanDay(4);});
  assert.equal(await page.locator('[data-sets="0"]').inputValue(),'9');checks.push({name:`${ios?'iOS':'standard'}: pending draft survives switching and saves only selected day across reload`,passed:true});
  await page.evaluate(()=>setActivePlanDay(1));
  assert.equal(await page.locator('#planEditDaySelect').inputValue(),'1');
  await page.locator('[data-plan-tab="2"]').click();assert.equal(await page.locator('#planEditDaySelect').inputValue(),'2');
  await page.locator('#weeklyScheduleCollapseBtn').click();await page.locator('[data-week-edit="5"]').click();assert.equal(await page.locator('#planEditDaySelect').inputValue(),'5');
  checks.push({name:`${ios?'iOS':'standard'}: day tabs and weekly schedule edit synchronize editor`,passed:true});
  for(const width of [320,375,390,430,768,1280]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>setActivePlanDay(0));
   const metrics=await page.evaluate(()=>[...document.querySelectorAll('.day-panel.active .day-row')].map(row=>{
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,center:r.top+r.height/2};};
    return {row:box(row),text:box(row.querySelector('.day-item')),record:box(row.querySelector('.te-record-open')),check:box(row.querySelector('.check-btn'))};
   }));
   for(const m of metrics){assert.ok(Math.abs(m.record.center-m.check.center)<=1,JSON.stringify(m));assert.ok(m.row.height<=m.text.height+68,JSON.stringify(m));assert.ok(m.record.left>=0&&m.check.right<=width,JSON.stringify(m));}
   checks.push({name:`${ios?'iOS':'standard'} ${width}px: compact cards and aligned controls`,passed:true});
   if(width===390&&!ios){await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('.day-panel.active h2').scrollIntoView({behavior:'instant',block:'start'});});await page.waitForTimeout(200);await page.screenshot({path:'docs/screenshots/compact-plan-mobile.png'});}
  }
  await context.close();
 }
 fs.writeFileSync('docs/compact-plan-browser-report.json',JSON.stringify({isolated:true,iosSimulation:true,checks},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,iosSimulation:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
