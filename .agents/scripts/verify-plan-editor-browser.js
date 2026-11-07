// Restricted to the isolated local browser profile; never use against a hosted user app.
return await (async()=>{
 if(location.hostname!=='127.0.0.1'||location.port!=='8765')throw new Error('Local test profile required');
 const results=[],check=(name,ok,details)=>{results.push({name,passed:!!ok});if(!ok)throw new Error(name+': '+JSON.stringify(details));};
 const click=sel=>{const node=document.querySelector(sel);if(!node)throw new Error('Missing '+sel);node.click();};
 const fill=(sel,value,event='input')=>{const el=document.querySelector(sel);el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));};
 const alerts=[];window.alert=text=>alerts.push(text);window.confirm=()=>true;
 localStorage.setItem('supabase-auto-sync-enabled','0');
 window.__planBrowserStorageBackup=Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]));
 syncToCloud=async()=>false;
 localStorage.removeItem(TEMP_DAILY_PLAN_OVERRIDES_KEY);localStorage.removeItem(DAILY_LOGS_KEY);appState.load();
 const files=await (await fetch('/.agents/fixtures/plan-import-files.json')).json();
 for(const name of files){
   const text=await (await fetch('/每周训练json/'+encodeURIComponent(name))).text(),before=alerts.length;
   const input=document.getElementById('planTemplateFile'),dt=new DataTransfer();dt.items.add(new File([text],name,{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   for(let n=0;n<100&&alerts.length===before;n++)await new Promise(r=>setTimeout(r,10));
   check('real file-input import: '+name,alerts.at(-1)==='训练计划模板导入成功',alerts.at(-1));
   const source=JSON.parse(text.replace(/^\uFEFF/,''));check('import preserves first-day order: '+name,JSON.stringify(getPlanTemplate().days[0].items)===JSON.stringify(source.days[0].items));
 }
 const template=getPlanTemplate();template.days[0].items=['俯卧撑 3组 × 12次','深蹲 2组 × 10次'];template.days[0].focus='编辑器验证';setPlanTemplate(template,true);setActivePlanDay(0);switchTab('plan',false);
 if(document.getElementById('planTemplateCollapseBtn').getAttribute('aria-expanded')!=='true')click('#planTemplateCollapseBtn');
 const date=getDateForPlanDayInCurrentWeek(template.days[0].day,0);ensureDailyLogSnapshot(date);
 fill('#pe-muscle','chest','change');check('muscle filter matches primary or secondary regions',Array.from(document.querySelectorAll('[data-add-exercise]')).every(el=>{const a=getExerciseLibrary().find(a=>a.exerciseKey===el.dataset.addExercise);return [...a.primaryMuscles,...a.secondaryMuscles].includes('chest');}));
 fill('#pe-search','杠铃平板卧推');const add=document.querySelector('[data-add-exercise]');check('exercise search finds expected library action',!!add);add.click();
 check('add exercise adds a new editable row',document.querySelectorAll('.pe-row').length===3);
 fill('[data-sets="2"]','5');click('[data-move="2"][data-direction="-1"]');click('[data-remove="0"]');
 fill('#planFocusEdit','胸部测试 + 下肢辅助');click('#savePlanDayBtn');
 let day=getPlanDays()[0];check('saving persists deletion sets and order',day.items.length===2&&day.items[0].includes('5组')&&day.focus==='胸部测试 + 下肢辅助',day);
 check('week-only edits leave reusable template intact',getPlanTemplate().days[0].items[0]==='俯卧撑 3组 × 12次');
 check('daily snapshot follows new order',JSON.stringify(getDailyLogs()[date].allItems)===JSON.stringify(day.items));
 const expected=JSON.stringify(day.items);setActivePlanDay(1);setActivePlanDay(0);check('switching days preserves saved order',JSON.stringify(getPlanDays()[0].items)===expected);
 fill('[data-sets="0"]','6');renderPlan();check('normal rerender preserves unsaved draft',document.querySelector('[data-sets="0"]').value==='6');
 setActivePlanDay(1);setActivePlanDay(0);check('switching days preserves pending editor draft',document.querySelector('[data-sets="0"]').value==='6');click('#savePlanDayBtn');
 const other=getPlanTemplate();other.days[1].focus='修改另一日模板';setPlanTemplate(other,false);renderPlan();check('updating another template day does not wipe daily adjustment',getPlanDays()[0].items[0].includes('6组'));
 let exported;const originalDownload=downloadJson;downloadJson=(name,payload)=>{exported=payload;};exportPlanTemplate();downloadJson=originalDownload;
 check('JSON export contains effective current-week order',JSON.stringify(exported.days[0].items)===JSON.stringify(getPlanDays()[0].items));
 fill('#pe-scope','template','change');fill('[data-sets="0"]','7');click('#savePlanDayBtn');check('explicit future-template scope persists sets',getPlanTemplate().days[0].items[0].includes('7组'));
 const expectedAfter=JSON.stringify(getPlanDays()[0].items);localStorage.setItem('gain-plan-ui-verification',JSON.stringify({expected:expectedAfter,dayIndex:0,results}));
 const overflow=[...document.querySelectorAll('#visualPlanEditor input,#visualPlanEditor textarea,#visualPlanEditor select,#visualPlanEditor button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().right>innerWidth+2);
 check('editor controls fit viewport',overflow.length===0,overflow.map(e=>e.outerHTML));
 document.getElementById('visualPlanEditor').scrollIntoView({block:'start'});
 return JSON.stringify({checks:results.length,results});
})();
