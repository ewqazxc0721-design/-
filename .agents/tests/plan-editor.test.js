const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function shell(){
 let source=fs.readFileSync(path.join(__dirname,'daily-log-v2-action-library.test.js'),'utf8').split('\ntest(')[0];
 source=source.replace('globalThis.__testApi = {','globalThis.__testApi = { getPlanTemplate,setPlanTemplate,getPlanDays,setTempDailyPlanOverrides,getTempDailyPlanOverrides,normalizePlanTemplate,mergeCloudAppStateSnapshots,mergeCloudDailyLog,parseTrainingPlanImport,persistVisualPlanDay,getPlanChecks,getCurrentWeekRange,getDateForPlanDayInCurrentWeek,');
 source=source.replace('const window = {','const window = { TrainingCore:require("../../training-core.js"),');
 const env={require,__dirname,__filename,console,setTimeout,clearTimeout,setInterval,clearInterval};vm.runInNewContext(source+'\nglobalThis.run=loadApp;',env);return env.run();
}
test('editing a weekly template preserves independently adjusted daily order',()=>{
 const {api}=shell();api.setTempDailyPlanOverrides({'0':{items:['深蹲 3组','俯卧撑 2组']}});
 api.setPlanTemplate(api.getPlanTemplate(),false);
 assert.deepEqual(Array.from(api.getPlanDays()[0].items),['深蹲 3组','俯卧撑 2组']);
});
test('all real weekly JSON templates including BOM import without losing action order',()=>{
 const {api}=shell();const dir=path.resolve(__dirname,'../../每周训练json');
 const files=fs.readdirSync(dir).filter(n=>n.endsWith('.json'));assert.ok(files.length>=9);
 for(const name of files){const raw=fs.readFileSync(path.join(dir,name),'utf8'),parsed=JSON.parse(raw.replace(/^\uFEFF/,'')),plan=api.parseTrainingPlanImport(raw);api.setPlanTemplate(plan,true);assert.deepEqual(JSON.parse(JSON.stringify(api.getPlanTemplate().days.map(d=>d.items))),parsed.days.map(d=>d.items),name);}
});
test('invalid imports fail before mutating the saved plan',()=>{
 const {api,localStorage}=shell();const before=JSON.stringify(localStorage._store);
 for(const text of ['{}','{"days":[]}','{"days":[{"items":"wrong"}]}','{"days":[{"items":[{}]}]}'])assert.throws(()=>api.parseTrainingPlanImport(text));
 assert.equal(JSON.stringify(localStorage._store),before);
});
test('a failed template import rolls back the template checks and dated snapshots together',()=>{
 const {api,localStorage}=shell();const original=api.getPlanTemplate();api.setPlanTemplate(original);
 const keys=['gain-plan-template','gain-temp-daily-plan-overrides','gain-plan-checks','gain-plan-check-meta','gain-daily-logs'];
 const before=keys.map(k=>localStorage.getItem(k)),write=localStorage.setItem.bind(localStorage);let failed=false;
 localStorage.setItem=(key,value)=>{if(key==='gain-daily-logs'&&!failed){failed=true;throw new Error('quota');}write(key,value);};
 const next=api.getPlanTemplate();next.days[0].items=['俯卧撑 5组 x 10次'];assert.throws(()=>api.setPlanTemplate(next,true),/quota/);
 assert.deepEqual(keys.map(k=>localStorage.getItem(k)),before);
});
function fixture(){
 const env=shell(),{api,localStorage}=env;const p=api.getPlanTemplate();p.days[0].items=['俯卧撑 3组 x 12次','深蹲 2组 x 10次'];api.setPlanTemplate(p,true);
 const date=api.getDateForPlanDayInCurrentWeek(p.days[0].day,0);api.ensureDailyLogSnapshot(date);let logs=api.getDailyLogs(),log=logs[date];
 log.planProgressItems[0].completedAmount=3;log.planProgressItems[0].status='completed';
 log.planProgressItems[0].setRecordManaged=true;log.planProgressItems[0].setRecordBaseAmount=0;
 log.exerciseEntries=[{id:'fact',exerciseKey:log.planProgressItems[0].exerciseKey,planItemId:log.planProgressItems[0].itemId,reconciliationState:'accepted',sets:[1,2,3].map(n=>({id:'set'+n,status:'completed',phase:'work',reps:12}))}];
 localStorage.setItem('gain-daily-logs',JSON.stringify(logs));localStorage.setItem('gain-plan-checks',JSON.stringify({d0_i0:true,d1_i0:true}));
 return {...env,date,day:api.getPlanDays()[0],log};
}
test('visual reorder moves checks and fact links and updates the daily snapshot',()=>{
 const {api,date,day}=fixture();api.persistVisualPlanDay(0,{...day,items:day.items.slice().reverse()},'week',[1,0]);
 const log=api.getDailyLogs()[date];assert.equal(log.allItems[0],'深蹲 2组 x 10次');assert.equal(log.exerciseEntries[0].planItemId,log.planProgressItems[1].itemId);
 assert.equal(api.getPlanChecks().d0_i1,true);assert.equal(api.getPlanChecks().d0_i0,undefined);assert.equal(api.getPlanChecks().d1_i0,true);assert.equal(log.planRevisions.length,1);
 assert.equal(api.getPlanTemplate().days[0].items[0],'俯卧撑 3组 x 12次');
});
test('removing a planned action retains performed sets without assigning them to another action',()=>{
 const {api,date,day}=fixture();api.persistVisualPlanDay(0,{...day,items:[day.items[1]]},'week',[1]);
 const log=api.getDailyLogs()[date];assert.equal(log.exerciseEntries[0].sets.length,3);assert.equal(log.exerciseEntries[0].planItemId,null);assert.equal(log.planProgressItems[0].completedAmount,0);
});
test('changed dose waits for reconciliation and does not check off old quantities',()=>{
 const {api,date,day}=fixture();api.persistVisualPlanDay(0,{...day,items:['俯卧撑 4组 x 10次',day.items[1]]},'week',[0,1]);
 const log=api.getDailyLogs()[date];assert.equal(log.exerciseEntries[0].reconciliationState,'needs_confirmation');assert.notEqual(log.planProgressItems[0].status,'completed');assert.equal(api.getPlanChecks().d0_i0,undefined);
});
test('weekly template scope changes future template while week-only edits do not',()=>{
 const {api,day}=fixture();api.persistVisualPlanDay(0,{...day,items:['深蹲 5组 x 8次']},'template',[1]);assert.equal(api.getPlanTemplate().days[0].items[0],'深蹲 5组 x 8次');
});
test('removing all actions saves an empty recovery day without restoring old rows',()=>{
 const {api,date,day}=fixture();api.persistVisualPlanDay(0,{...day,items:[]},'week',[]);assert.equal(api.getPlanDays()[0].items.length,0);assert.equal(api.getDailyLogs()[date].allItems.length,0);assert.equal(api.getDailyLogs()[date].exerciseEntries[0].sets.length,3);
});
test('AI daily adjustments update existing snapshots in the same order',()=>{
 const {api,date,day}=fixture();api.setTempDailyPlanOverrides({'0':{...day,items:day.items.slice().reverse(),createdAt:new Date().toISOString()}});
 assert.deepEqual(Array.from(api.getDailyLogs()[date].allItems),Array.from(day.items).reverse());assert.equal(api.getDailyLogs()[date].exerciseEntries[0].sets.length,3);
});
test('daily adjustments are scoped to their calendar week and removal tombstones survive sync',()=>{
 const {api}=shell();api.setTempDailyPlanOverrides({'0':{items:['old'],weekStart:'2000-01-03'}});assert.notEqual(api.getPlanDays()[0].items[0],'old');
 const now=new Date().toISOString(),weekStart=api.getCurrentWeekRange().start;
 const a={tempDailyPlanOverrides:{'0':{items:['old'],weekStart,createdAt:'2000-01-03T00:00:00Z'}}},b={tempDailyPlanOverrides:{'0':{items:[],weekStart,updatedAt:now,deletedAt:now}}};
 assert.equal(api.mergeCloudAppStateSnapshots(a,b).tempDailyPlanOverrides['0'].deletedAt,now);
});
test('a stale cloud plan snapshot cannot undo the new order or reattach deleted actions',()=>{
 const {api,date,day,log:old}=fixture();api.persistVisualPlanDay(0,{...day,items:[day.items[1]]},'week',[1]);const next=api.getDailyLogs()[date];
 for(const result of [api.mergeCloudDailyLog(old,next),api.mergeCloudDailyLog(next,old)]){assert.equal(result.allItems[0],day.items[1]);assert.equal(result.planProgressItems.length,1);assert.equal(result.exerciseEntries[0].planItemId,null);assert.equal(result.exerciseEntries[0].sets.length,3);}
});
test('object exercise imports produce meaningful names and dose',()=>{
 const {api}=shell();const p=api.normalizePlanTemplate({days:[{day:'周一',items:[{name:'俯卧撑',sets:3,reps:12}]}]});
 assert.match(p.days[0].items[0],/俯卧撑.*3组.*12次/);
});
test('cloud merges preserve changes on different days rather than replacing the entire map',()=>{
 const {api}=shell();const a={updatedAt:'2026-11-08T10:00:00Z',tempDailyPlanOverrides:{'0':{items:['A','B'],createdAt:'2026-11-08T09:00:00Z'}}};
 const b={updatedAt:'2026-11-08T11:00:00Z',tempDailyPlanOverrides:{'1':{items:['C','D'],createdAt:'2026-11-08T10:00:00Z'}}};
 const result=api.mergeCloudAppStateSnapshots(a,b);assert.ok(result.tempDailyPlanOverrides['0']);assert.ok(result.tempDailyPlanOverrides['1']);
});
