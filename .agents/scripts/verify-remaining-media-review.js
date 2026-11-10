/* Isolated browser verification: ALL approval requests are mocked. */
const {chromium}=require('../skills/gstack/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[];
 const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage(),submissions=[],requests=[];
  await context.route('**/2026-11-10-batch-2/user-feedback.json',route=>route.fulfill({status:404,body:'{}'}));
  await context.route('http://127.0.0.1:8766/**',async route=>{if(route.request().method()==='POST')submissions.push(JSON.parse(route.request().postData()));await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8765','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'},body:'{"saved":true}'});});
  page.on('request',r=>{if(/remaining-\d+/.test(r.url()))requests.push(r.url());});
  await page.goto('http://127.0.0.1:8765/media-review/2026-11-10-batch-2/');await page.locator('.card').nth(39).waitFor({state:'attached'});
  check('all 40 reviewed candidates have controls',await page.locator('.card').count()===40&&await page.locator('.choice').count()===40);
  check('all muscle filter options use Chinese labels',await page.locator('#muscle option').allTextContents().then(names=>names.every(name=>!/^[a-z-]+$/i.test(name))));
  check('initial page does not download any animation',requests.every(u=>u.includes('-poster.webp')));
  await page.locator('.play').first().click();await page.waitForFunction(()=>document.querySelector('.card img').naturalWidth>0&&!document.querySelector('.card img').src.includes('-poster'));
  check('playing a candidate only downloads its own animation',requests.filter(u=>!u.includes('-poster.webp')).length===1);
  await page.locator('#stop').click();check('pause restores static posters',await page.locator('.card').first().locator('img').getAttribute('src').then(s=>s.endsWith('-poster.webp')));
  await page.locator('#search').fill('弓箭手');check('search selects the matching exercise',await page.locator('.card:visible').count()===1);
  await page.locator('.card:visible .choice').selectOption('revise');await page.waitForFunction(()=>document.querySelector('#sync').className==='saved');
  check('changed choices are synchronized with exact fingerprints',submissions.at(-1).decisions['remaining-3294']==='revise'&&Object.keys(submissions.at(-1).assetHashes).length===40&&!submissions.at(-1).publishRequested);
  await page.reload();await page.locator('.choice').first().waitFor();check('choices survive reload',await page.locator('.card').filter({hasText:'弓箭手俯卧撑'}).locator('.choice').inputValue()==='revise');
  await page.locator('#muscle').selectOption('deltoids');const shown=await page.locator('.card:visible').count();check('muscle filter narrows the gallery',shown>0&&shown<40);
  await page.locator('#muscle').selectOption('');await page.locator('#bulk').click();await page.waitForFunction(()=>document.querySelector('#sync').textContent.includes('已提交发布意愿'));
  check('bulk adopt requires explicit click and submits all 40 choices',Object.keys(submissions.at(-1).decisions).length===40&&Object.values(submissions.at(-1).decisions).every(v=>v==='approve')&&submissions.at(-1).publishRequested===true);
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});check(`${width}px gallery has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/remaining-media-review-mobile.png'});
  await context.close();fs.writeFileSync('docs/remaining-media-review-browser-report.json',JSON.stringify({checks,approvalRequestsMocked:true,productionChanged:false},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,approvalRequestsMocked:true,productionChanged:false}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
