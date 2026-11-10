const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../../training-core.js');
const push={exerciseKey:'push',displayName:'俯卧撑',recordingMode:'reps',primaryMuscles:['chest'],secondaryMuscles:['triceps']};
const squat={exerciseKey:'squat',displayName:'深蹲',recordingMode:'reps',primaryMuscles:['quadriceps'],secondaryMuscles:[]};
const plank={exerciseKey:'plank',displayName:'平板支撑',recordingMode:'time',primaryMuscles:['abs'],laterality:'unilateral'};
const specs=(count=3)=>[{action:push,plannedGroups:3,count}];
const fresh=()=>({date:'2026-11-09',schemaVersion:3,allItems:['俯卧撑 3组 x 12次'],planProgressItems:[{itemId:'p',planCheckKey:'d0_i0',sourcePlanItemIndex:0,exerciseKey:'push',targetAmount:3,unit:'组',snapshotItemText:'俯卧撑 3组 x 12次'}],exerciseEntries:[]});
const stats=log=>C.stats({[log.date]:log},[push,squat,plank]);
const record=(log,count)=>C.recordPlanGroups(log,'p',specs(count));
const check=log=>C.recordPlanGroups(log,'p',specs(),{complete:true,source:'plan_check'});

test('checking a plan immediately records its prescribed work groups in statistics',()=>{
 const input=fresh(),log=check(input),s=stats(log);
 assert.equal(s.groups,3);assert.equal(s.muscles.chest.primary,3);assert.equal(s.muscles.triceps.secondary,3);assert.equal(log.planProgressItems[0].status,'completed');
 assert.equal(s.reps,0);assert.equal(s.seconds,0);assert.equal(s.volume,0);assert.ok(log.exerciseEntries[0].sets.every(s=>s.countOnly&&s.phase==='work'));assert.equal(input.exerciseEntries.length,0);
});
test('repeated completion and saving unchanged counts never duplicate groups',()=>{
 const first=check(fresh()),second=check(first),third=record(second,3);
 assert.equal(stats(third).groups,3);assert.equal(third.exerciseEntries.length,1);assert.deepEqual(third.exerciseEntries[0].sets,first.exerciseEntries[0].sets);
});
test('unchecking retracts groups and rechecking restores the same identities',()=>{
 const log=check(fresh()),ids=log.exerciseEntries[0].sets.map(s=>s.id),cleared=record(log,0),restored=check(cleared);
 assert.equal(stats(cleared).groups,0);assert.equal(cleared.planProgressItems[0].status,'active');assert.equal(cleared.completedItems.length,0);assert.ok(cleared.exerciseEntries[0].sets.every(s=>s.deletedAt));
 assert.equal(stats(restored).groups,3);assert.deepEqual(restored.exerciseEntries[0].sets.map(s=>s.id),ids);
});
test('editing count updates plan progress and completion tops up only missing groups',()=>{
 let log=record(fresh(),2);assert.equal(stats(log).groups,2);assert.equal(log.planProgressItems[0].completedAmount,2);
 log=check(log);assert.equal(stats(log).groups,3);log=record(log,5);assert.equal(log.planProgressItems[0].setRecordExtraAmount,2);assert.equal(stats(check(log)).groups,5);
});
test('compound completion uses each action target instead of summing toward the first action',()=>{
 const spec=[...specs(3),{action:squat,plannedGroups:2,count:0}];
 let log=C.recordPlanGroups(fresh(),'p',spec);assert.equal(stats(log).groups,3);assert.equal(log.planProgressItems[0].status,'active');
 log=C.recordPlanGroups(log,'p',spec,{complete:true});assert.equal(stats(log).groups,5);assert.equal(log.planProgressItems[0].status,'completed');assert.equal(stats(log).muscles.quadriceps.primary,2);
});
test('completion reuses existing detailed sets without changing their recorded quantities',()=>{
 const input=fresh();input.exerciseEntries=[{id:'detail',exerciseKey:'push',planItemId:'p',sets:[{id:'s',revisionId:'r',phase:'work',status:'completed',reps:10,externalLoadKg:5}]}];
 const log=check(input);assert.equal(stats(log).groups,3);assert.equal(stats(log).reps,10);assert.equal(stats(log).volume,50);assert.deepEqual(log.exerciseEntries[0].sets[0],input.exerciseEntries[0].sets[0]);
});
test('timed unilateral group checks do not fabricate duration or side quantities',()=>{
 const log=C.recordPlanGroups(fresh(),'p',[{action:plank,plannedGroups:2,count:2}]);
 assert.equal(stats(log).groups,2);assert.equal(stats(log).seconds,0);
 const validation=C.validateSet(log.exerciseEntries[0].sets[0],'time','unilateral');assert.equal(validation.ok,true);assert.equal(validation.set.leftSeconds,null);
});
test('legacy projections are replaced when the user records the same planned groups',()=>{
 const input=fresh();input.planProgressItems[0].completedAmount=3;input.aiCaptureRecords=[{id:'old',recordType:'training_fact',originalValue:{sets:3,repsPerSet:12},structuredWrite:{itemId:'p'}}];
 assert.equal(stats(check(input)).groups,3);assert.equal(stats(fresh()).groups,0);
});
test('invalid group counts leave all original facts untouched',()=>{
 const input=check(fresh()),original=C.copy(input);
 for(const n of [-1,1.5,201,NaN])assert.throws(()=>record(input,n),/组数/);
 assert.deepEqual(input,original);
});
test('stale cloud copies cannot resurrect cancelled automatic groups',()=>{
 const old=check(fresh()),gone=record(old,0);
 for(const [a,b] of [[old,gone],[gone,old]]){
  const merged={...gone,exerciseEntries:C.mergeEntries(a.exerciseEntries,b.exerciseEntries)};C.rebuildSetProgress(merged);
  assert.equal(stats(merged).groups,0);assert.equal(merged.planProgressItems[0].status,'active');
 }
});
test('two separate plan rows for the same action retain independent group counts',()=>{
 const input=fresh();input.planProgressItems.push({...input.planProgressItems[0],itemId:'p2',planCheckKey:'d0_i1',sourcePlanItemIndex:1});
 const first=check(input),both=C.recordPlanGroups(first,'p2',specs(2));assert.equal(stats(both).groups,5);assert.equal(both.exerciseEntries.length,2);
 assert.equal(stats(record(both,0)).groups,2);
});

test('cloud reconciliation keeps explicit cancelled groups over an older legacy checkbox',()=>{
 let source=fs.readFileSync(path.join(__dirname,'daily-log-v2-action-library.test.js'),'utf8').split('\ntest(')[0];
 source=source.replace('globalThis.__testApi = {','globalThis.__testApi = {mergeCloudDailyLog,');
 source=source.replace('const window = {','const window = { TrainingCore:require("../../training-core.js"),');
 const env={require,__dirname,__filename,console,setTimeout,clearTimeout,setInterval,clearInterval};vm.runInNewContext(source+'\nglobalThis.run=loadApp;',env);
 const {api}=env.run(),legacy=fresh();legacy.planProgressItems[0].completedAmount=3;legacy.planProgressItems[0].status='completed';
 const cancelled=record(check(legacy),0);
 for(const [a,b] of [[legacy,cancelled],[cancelled,legacy]]){
  const merged=api.mergeCloudDailyLog(a,b);assert.equal(merged.planProgressItems[0].status,'active');assert.equal(stats(merged).groups,0);
 }
});
