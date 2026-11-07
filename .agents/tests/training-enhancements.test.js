const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../../training-core.js'),root=path.resolve(__dirname,'../..');
const library=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/actions.json'),'utf8')).actions;
const complete=(id,reps=12,extra={})=>({id,revision:1,revisionId:'r_'+id,status:'completed',phase:'work',reps,durationSeconds:null,externalLoadKg:null,...extra});
const entry=(id='e1',sets=[complete('s1')],extra={})=>({id,exerciseKey:'standard-pushup',displayNameSnapshot:'俯卧撑',mode:'reps',sets,...extra});
const logs=e=>({'2026-11-07':{date:'2026-11-07',schemaVersion:3,exerciseEntries:[e]}});

test('set validation distinguishes missing values and zero and validates effort',()=>{
 assert.equal(C.validateSet({reps:''}).ok,false);
 assert.equal(C.validateSet({reps:0}).ok,false);
 assert.equal(C.validateSet({reps:2.5}).ok,false);
 assert.equal(C.validateSet({durationSeconds:45},'time').set.durationSeconds,45);
 assert.equal(C.validateSet({reps:12,effort:{scale:'RPE',value:0}}).ok,false);
 assert.equal(C.validateSet({reps:12,effort:{scale:'RIR',value:0}}).ok,true);
 assert.equal(C.validateSet({reps:12,externalLoadKg:-2}).ok,false);
});
test('unilateral and paired dumbbell inputs have explicit totals',()=>{
 const single=C.validateSet({leftReps:10,rightReps:8},'reps','unilateral');assert.equal(single.set.reps,18);assert.equal(single.ok,true);
 assert.equal(C.validateSet({leftReps:10,rightReps:''},'reps','unilateral').ok,false);
 const pair=C.validateSet({reps:10,loadInputKg:10,loadInputMode:'perDumbbell'}).set;assert.equal(pair.externalLoadKg,20);
 const s=C.stats(logs(entry('e',[{...pair,status:'completed'}])),library);assert.equal(s.volume,200);
});
test('stats count saved facts once and exclude warmups pending deleted and conflicts',()=>{
 const e=entry('e',[complete('one'),complete('warm',10,{phase:'warmup'}),complete('pending',50,{status:'pending'}),complete('gone',50,{deletedAt:'now'}),complete('conflict',50,{conflictVersions:[{}]})],{planItemId:'p',replacedLegacyProgress:true});
 const data=logs(e);data['2026-11-07'].planProgressItems=[{itemId:'p',exerciseKey:'standard-pushup',completedAmount:3}];
 const stats=C.stats(data,library);assert.equal(stats.groups,1);assert.equal(stats.reps,12);assert.equal(stats.conflicts,1);assert.equal(stats.muscles.chest.primary,1);assert.equal(stats.muscles.triceps.secondary,1);
});
test('time and recovery metrics never become repetition counts or strength days',()=>{
 const e=entry('e',[complete('hold',null,{durationSeconds:45})],{exerciseKey:'plank',mode:'time'});
 const d=logs(e);d['2026-11-08']={exerciseEntries:[entry('walk',[complete('w',null,{durationSeconds:600})],{exerciseKey:'walk',mode:'time'})]};
 const s=C.stats(d,library);assert.equal(s.seconds,45);assert.equal(s.reps,0);assert.equal(s.trainingDays,1);assert.equal(s.recoveryDays,1);
});
test('legacy check marks never fabricate actual groups repetitions or weight',()=>{
 const old={'2026-11-07':{schemaVersion:2,planProgressItems:[{itemId:'p',exerciseKey:'standard-pushup',completedAmount:3,targetAmount:3,unit:'组',plannedRepsText:'12次'}]}};
 const upgraded=C.migrateLogs(old),s=C.stats(upgraded,library);assert.equal(s.groups,0);assert.equal(s.reps,0);assert.equal(s.volume,0);assert.equal(s.trainingDays,1);assert.equal(old['2026-11-07'].schemaVersion,2);assert.deepEqual(C.migrateLogs(upgraded),upgraded);
});
test('explicit aggregate extra sets count while linked detail replaces the aggregate',()=>{
 const d=logs(entry('e',[complete('s')],{linkedFactIds:['extra1']}));d['2026-11-07'].extraTrainingEvents=[{id:'extra1',exerciseKey:'standard-pushup',amount:1,unit:'组'},{id:'extra2',exerciseKey:'pullup',amount:2,unit:'组'}];
 assert.equal(C.stats(d,library).groups,3);
});
test('user-stated legacy aggregate quantities replace their plan and extra projections',()=>{
 const d={'2026-11-07':{planProgressItems:[{itemId:'p',exerciseKey:'standard-pushup',completedAmount:3,unit:'组'}],aiCaptureRecords:[{id:'capture1',recordType:'training_fact',originalValue:{exercise:'俯卧撑',sets:3,repsPerSet:10},structuredWrite:{itemId:'p'}}],extraTrainingEvents:[{id:'extra1',sourceMessageId:'capture1',exerciseKey:'standard-pushup',amount:1,unit:'组'}]}};
 const s=C.stats(d,library);assert.equal(s.groups,3);assert.equal(s.reps,30);assert.equal(s.legacy,1);
});
test('standalone protocol records provide explicit quantities without multiplying mirrored AI facts',()=>{
 const record={recordId:'protocol1',type:'plan_progress',exerciseKey:'standard-pushup',sets:2,repsPerSet:10};
 const d={'2026-11-07':{records:[record],planProgressItems:[{itemId:'p',exerciseKey:'standard-pushup',completedAmount:2}]}};
 assert.equal(C.stats(d,library).reps,20);assert.equal(C.stats(d,library).groups,2);
 d['2026-11-07'].aiCaptureRecords=[{id:'ai1',recordType:'training_fact',originalValue:{exercise:'俯卧撑',sets:2,repsPerSet:10},structuredWrite:{itemId:'p'}}];assert.equal(C.stats(d,library).reps,20);
});
test('both sides of timed holds are stored explicitly without becoming repetitions',()=>{
 const result=C.validateSet({leftSeconds:30,rightSeconds:25},'time','unilateral');assert.equal(result.ok,true);assert.equal(result.set.durationSeconds,55);assert.equal(result.set.reps,null);
 assert.equal(C.validateSet({leftSeconds:30},'time','unilateral').ok,false);
});
test('same exercise on same day in two real sessions remains distinct',()=>{
 const d=logs(entry('first',[complete('first-set')]));d['2026-11-07'].exerciseEntries.push(entry('second',[complete('second-set',10)]));assert.equal(C.stats(d,library).reps,22);assert.equal(C.stats(d,library).groups,2);
});
test('merge preserves deletion and lower corrections even with a slow editing clock',()=>{
 const old=complete('s',12,{updatedAt:'2026-11-07T12:00:00Z'}),deleted=C.editSet(old,{deletedAt:'2026-11-07T10:00:00Z'},'2026-11-07T10:00:00Z');
 assert.equal(C.mergeSets([old],[deleted])[0].deletedAt,deleted.deletedAt);
 assert.equal(C.mergeSets([deleted],[old])[0].deletedAt,deleted.deletedAt);
 const correction=C.editSet(old,{reps:8},'2026-11-07T09:00:00Z');assert.equal(C.mergeSets([old],[correction])[0].reps,8);
 const secondCorrection=C.editSet(correction,{reps:6},'2026-11-07T08:00:00Z');const merged=C.mergeSets([old],[secondCorrection])[0];assert.equal(merged.reps,6);assert.equal(merged.conflictVersions,undefined);
});
test('concurrent offline edits are retained and excluded until resolved',()=>{
 const base=complete('s'),a=C.editSet(base,{reps:10}),b=C.editSet(base,{reps:8}),merged=C.mergeSets([a],[b])[0];
 assert.equal(merged.conflictVersions.length,2);assert.equal(C.stats(logs(entry('e',[merged])),library).groups,0);
 const resolved=C.editSet(merged,{...a,resolvedRevisionIds:[a.revisionId,b.revisionId],conflictResolvedAt:'now'});delete resolved.conflictVersions;
 const result=C.mergeSets([b],[resolved])[0];assert.equal(result.reps,10);assert.equal(result.conflictVersions,undefined);
});
test('entry merging is idempotent and preserves unrelated new sets',()=>{
 const first=entry('e',[complete('s1')]),second=entry('e',[complete('s1'),complete('s2',9)]);
 const result=C.mergeEntries([first],[second]);assert.equal(result[0].sets.length,2);assert.deepEqual(C.mergeEntries(result,result),result);
});
test('managed plan projection caps target and deletion reduces completion',()=>{
 const p={itemId:'p',unit:'组',targetAmount:3,setRecordManaged:true,setRecordBaseAmount:0},e=entry('e',[complete('1'),complete('2'),complete('3'),complete('4')],{planItemId:'p',reconciliationState:'accepted'}),log={planProgressItems:[p],exerciseEntries:[e]};
 C.rebuildSetProgress(log);assert.equal(p.completedAmount,3);assert.equal(p.setRecordExtraAmount,1);
 e.sets[0].deletedAt='now';e.sets[1].deletedAt='now';C.rebuildSetProgress(log);assert.equal(p.completedAmount,2);assert.equal(p.status,'active');assert.equal(C.stats({'2026-11-07':log},library).groups,2);
});
test('pending dose mismatches do not advance the plan but remain actual training',()=>{
 const p={itemId:'p',unit:'组',targetAmount:3,setRecordManaged:true,setRecordBaseAmount:0},e=entry('e',[complete('1',10)],{planItemId:'p',reconciliationState:'needs_confirmation'}),log={planProgressItems:[p],exerciseEntries:[e]};C.rebuildSetProgress(log);assert.equal(p.completedAmount,0);assert.equal(C.stats({'2026-11-07':log},library).reps,10);
});
test('date ranges use local Monday boundaries and do not cross UTC midnight',()=>{
 const now=new Date(2026,10,7,0,15);assert.deepEqual(C.range('week',now),{from:'2026-11-02',to:'2026-11-07'});assert.deepEqual(C.range('lastWeek',now),{from:'2026-10-26',to:'2026-11-01'});assert.equal(C.dayKey(now),'2026-11-07');
});
test('backup failure is surfaced and a successful backup is not overwritten',()=>{
 const values={old:'original'},storage={getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;}};
 assert.equal(C.persistBackup(storage,['old']),true);values.old='modified';assert.equal(C.persistBackup(storage,['old']),false);assert.equal(JSON.parse(values['gain-training-v3-backup']).values.old,'original');
 assert.throws(()=>C.persistBackup({getItem:()=>null,setItem:()=>{throw new Error('quota');}},['old']),/quota/);
});
test('quota failures roll back all facts and plan check writes together',()=>{
 const values={facts:'old facts',checks:'old checks'},storage={getItem:k=>values[k]??null,setItem:(k,v)=>{if(k==='checks'&&v!=='old checks')throw new Error('quota');values[k]=v;},removeItem:k=>delete values[k]};
 assert.throws(()=>C.persistTransaction(storage,{facts:{new:true},checks:{done:true}}),/quota/);assert.deepEqual(values,{facts:'old facts',checks:'old checks'});
});
test('catalogue has reviewed metadata and exact pinned identities without imported media',()=>{
 const {data}=require('../scripts/audit-exercise-library.js').audit();assert.equal(data.actions.length,110);
 assert.deepEqual(data.actions.slice(0,68).map(a=>a.exerciseKey),JSON.parse(fs.readFileSync(path.join(root,'.agents/fixtures/exercise-library-v1.json'),'utf8')).actions.map(a=>a.exerciseKey));
 assert.equal(data.actions.find(a=>a.exerciseKey==='scapular-pull').aliases.includes('沉肩悬垂'),false);
 assert.equal(data.actions.find(a=>a.exerciseKey==='wide-pushup').muscleGroups.includes('胸大肌外侧'),false);
});

// Reuse the existing VM shell setup without running its tests or changing production behavior.
function shell(){
 let source=fs.readFileSync(path.join(__dirname,'daily-log-v2-action-library.test.js'),'utf8').split('\ntest(')[0];
 source=source.replace('globalThis.__testApi = {','globalThis.__testApi = { mergeCloudDailyLog, mergeCloudAppStateSnapshots, buildDailyLogShell, normalizeExerciseLibraryAction, loadExerciseLibraryFromFiles, injectLibrary:(actions)=>{ externalExerciseLibraryActions=actions;actions.forEach(a=>OFFICIAL_EXERCISE_LIBRARY_KEYS.add(a.exerciseKey));exerciseLibraryCache=null;return getExerciseLibrary();},');
 source=source.replace('const window = {','const window = { TrainingCore:globalThis.injectedCore,');
 const env={require,__dirname,__filename,console,injectedCore:C,setTimeout,clearTimeout,setInterval,clearInterval};vm.runInNewContext(source+'\nglobalThis.run=loadApp;',env);return env.run();
}
test('shell normalization and reload retain new catalogue fields and all 110 stable actions',()=>{
 const {api}=shell(),loaded=api.injectLibrary(library);assert.equal(loaded.length,110);
 const a=api.normalizeExerciseLibraryAction(library.find(a=>a.exerciseKey==='opengym-0025'));assert.equal(a.provenance.upstreamId,'0025');assert.equal(a.instructions.length,4);assert.equal(a.primaryMuscles[0],'chest');
 assert.equal(loaded.find(a=>a.exerciseKey==='scapular-pull').aliases.includes('沉肩悬垂'),false);
});
test('daily shell preserves entries and managed metadata instead of reviving old checks',()=>{
 const {api}=shell(),e=entry(),previous={schemaVersion:3,exerciseEntries:[e],planProgressItems:[]};const result=api.buildDailyLogShell('2026-05-11',previous);assert.equal(result.schemaVersion,3);assert.equal(result.exerciseEntries[0].id,'e1');
});
test('cloud daily merge retains tombstones and recalculates the lower managed progress',()=>{
 const {api}=shell(),p={itemId:'p',unit:'组',targetAmount:3,setRecordManaged:true,setRecordBaseAmount:0},old=complete('s'),gone=C.editSet(old,{deletedAt:'now'});
 const a={date:'2026-05-11',exerciseEntries:[entry('e',[old],{planItemId:'p',reconciliationState:'accepted'})],planProgressItems:[{...p,completedAmount:3,status:'completed'}]};
 const b={date:'2026-05-11',exerciseEntries:[entry('e',[gone],{planItemId:'p',reconciliationState:'accepted'})],planProgressItems:[{...p,completedAmount:0,status:'active'}]};
 const result=api.mergeCloudDailyLog(a,b);assert.equal(result.exerciseEntries[0].sets[0].deletedAt,'now');assert.equal(result.planProgressItems[0].completedAmount,0);assert.equal(result.schemaVersion,3);
});
