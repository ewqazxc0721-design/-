const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function shell(){
 let source=fs.readFileSync(path.join(__dirname,'daily-log-v2-action-library.test.js'),'utf8').split('\ntest(')[0];
 source=source.replace('globalThis.__testApi = {','globalThis.__testApi = {normalizePlanTemplate,getPlanTemplate,getPlanDays,setPlanTemplate,getWeeklyTrainingModules,applyWeeklyDayOrder,changeScheduledTrainingModule,persistVisualPlanDay,');
 source=source.replace('const window = {','const window = { TrainingCore:require("../../training-core.js"),');
 const env={require,__dirname,__filename,console,setTimeout,clearTimeout,setInterval,clearInterval};vm.runInNewContext(source+'\nglobalThis.run=loadApp;',env);return env.run();
}
test('module-based plans retain the module library and the chosen weekly order',()=>{
 const {api}=shell();const input={version:4,modules:[{id:'push',name:'胸部',focus:'胸',items:['俯卧撑 3组']},{id:'pull',name:'背部',focus:'背',items:['引体向上 4组']}],schedule:{weekStart:api.getPlanTemplate().meta.weekStart,moduleOrder:['pull','push','pull','push','pull','push','pull']}};
 const result=api.normalizePlanTemplate(input);assert.equal(result.modules.length,2);assert.equal(result.days[0].moduleId,'pull');assert.equal(result.days[0].items[0],'引体向上 4组');
});
test('whole-day moves preserve edited content while performed facts stay at their real date',()=>{
 const {api,localStorage}=shell();const template=api.getPlanTemplate();template.days[0].items=['俯卧撑 3组'];template.days[1].items=['深蹲 4组'];api.setPlanTemplate(template);
 api.persistVisualPlanDay(0,{...api.getPlanDays()[0],items:['俯卧撑 5组']},'week',[0]);
 localStorage.setItem('gain-daily-logs',JSON.stringify({'2026-11-02':{date:'2026-11-02',exerciseEntries:[{id:'actual',sets:[{id:'set',reps:12}]}]}}));
 api.applyWeeklyDayOrder([1,0,2,3,4,5,6]);assert.equal(api.getPlanDays()[0].items[0],'深蹲 4组');assert.equal(api.getPlanDays()[1].items[0],'俯卧撑 5组');assert.equal(api.getDailyLogs()['2026-11-02'].exerciseEntries[0].id,'actual');
});
test('choosing a body-part module changes only the selected weekday',()=>{
 const {api}=shell(),before=Array.from(api.getPlanDays(),d=>JSON.stringify(d.items));api.changeScheduledTrainingModule(3,'shoulder_focus');
 assert.equal(api.getPlanDays()[3].moduleId,'shoulder_focus');assert.match(api.getPlanDays()[3].focus,/肩/);
 api.getPlanDays().forEach((d,i)=>{if(i!==3)assert.equal(JSON.stringify(d.items),before[i]);});
});
test('invalid weekly orders do not overwrite plans',()=>{
 const {api,localStorage}=shell(),before=JSON.stringify(localStorage._store);assert.throws(()=>api.applyWeeklyDayOrder([0,0,1,2,3,4,5]));assert.equal(JSON.stringify(localStorage._store),before);
});
