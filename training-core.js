/* Training record semantics. Original implementation for this tracker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TrainingCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS={chest:'胸部',deltoids:'肩部','upper-back':'背阔与上背',trapezius:'斜方肌',serratus:'前锯肌',biceps:'肱二头肌',triceps:'肱三头肌',forearm:'前臂',abs:'腹直肌',obliques:'腹斜肌','lower-back':'下背',gluteal:'臀部',quadriceps:'股四头肌',hamstring:'腘绳肌',adductors:'内收肌','hip-flexors':'髋屈肌',calves:'小腿',tibialis:'胫前肌'};
  const list=v=>Array.isArray(v)?v:[];
  const copy=v=>JSON.parse(JSON.stringify(v));
  const uid=prefix=>prefix+'_'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const dayKey=d=>{const x=d instanceof Date?d:new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  function range(kind='week',now=new Date(),from='',to=''){
    const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()),start=new Date(end);
    if(kind==='week'||kind==='lastWeek'){start.setDate(start.getDate()-((start.getDay()+6)%7));if(kind==='lastWeek'){start.setDate(start.getDate()-7);end.setTime(start.getTime());end.setDate(end.getDate()+6);}}
    else if(kind==='month')start.setDate(1);else if(kind==='30')start.setDate(start.getDate()-29);
    else if(kind==='custom')return {from,to};
    return {from:dayKey(start),to:dayKey(end)};
  }
  function validateSet(input,mode='reps',laterality='bilateral'){
    const s=copy(input||{}),errors=[];
    s.phase=s.phase==='warmup'?'warmup':'work';s.status=s.status==='completed'?'completed':'pending';
    for(const k of ['reps','durationSeconds','externalLoadKg','leftReps','rightReps','leftSeconds','rightSeconds'])s[k]=number(s[k]);
    if(mode==='time'){
      if(laterality==='unilateral'){
        if(s.leftSeconds===null||s.rightSeconds===null||s.leftSeconds<0||s.rightSeconds<0||s.leftSeconds+s.rightSeconds<=0)errors.push('请填写左右两侧保持秒数（未做的一侧填 0）');
        s.durationSeconds=s.leftSeconds===null||s.rightSeconds===null?null:s.leftSeconds+s.rightSeconds;
      }
      if(!(s.durationSeconds>0))errors.push('请输入大于 0 的秒数');
      s.reps=null;
    }else if(laterality==='unilateral'){
      if(!Number.isInteger(s.leftReps)||s.leftReps<0||!Number.isInteger(s.rightReps)||s.rightReps<0||s.leftReps+s.rightReps<=0)errors.push('请填写左右两侧实际次数（未做的一侧填 0）');
      s.reps=s.leftReps===null||s.rightReps===null?null:s.leftReps+s.rightReps;
    }else if(!Number.isInteger(s.reps)||s.reps<=0)errors.push('请输入大于 0 的整数次数');
    if(s.externalLoadKg!==null&&s.externalLoadKg<0)errors.push('外加重量不能为负数');
    s.loadInputMode=s.loadInputMode==='perDumbbell'?'perDumbbell':'total';
    if(laterality==='unilateral'&&s.loadInputMode==='perDumbbell')errors.push('单侧动作请填单侧实际使用的器械重量，不按双哑铃乘二');
    s.loadInputKg=number(s.loadInputKg);
    if(s.loadInputKg!==null){if(s.loadInputKg<0)errors.push('重量不能为负数');s.externalLoadKg=s.loadInputKg*(s.loadInputMode==='perDumbbell'?2:1);}
    if(s.effort&&s.effort.value!==''&&s.effort.value!==null){const n=number(s.effort.value);if(!['RIR','RPE'].includes(s.effort.scale)||n===null||n<0||n>10||(s.effort.scale==='RPE'&&n<1))errors.push('RIR 为 0–10，RPE 为 1–10');else s.effort={scale:s.effort.scale,value:n};}else s.effort=null;
    if(!s.id)s.id=uid('set');
    return {ok:!errors.length,errors,set:s};
  }
  function editSet(original,patch,now=new Date().toISOString()){
    return {...copy(original),...copy(patch),id:original.id,baseRevisionId:original.revisionId||null,ancestorRevisionIds:[...new Set([...list(original.ancestorRevisionIds),original.revisionId].filter(Boolean))],revisionId:uid('rev'),revision:(original.revision||0)+1,updatedAt:now};
  }
  function mergeSets(a,b){
    const map=new Map();
    for(const s of [...list(a),...list(b)]){
      if(!s||!s.id)continue;
      const old=map.get(s.id);if(!old){map.set(s.id,copy(s));continue;}
      const equal=JSON.stringify(old)===JSON.stringify(s);
      if(equal)continue;
      if(list(s.resolvedRevisionIds).includes(old.revisionId)){map.set(s.id,copy(s));continue;}
      if(list(old.resolvedRevisionIds).includes(s.revisionId))continue;
      if(list(s.ancestorRevisionIds).includes(old.revisionId)){map.set(s.id,copy(s));continue;}
      if(list(old.ancestorRevisionIds).includes(s.revisionId))continue;
      // A direct descendant wins even if the editing device clock is behind.
      if(s.baseRevisionId&&s.baseRevisionId===old.revisionId){map.set(s.id,copy(s));continue;}
      if(old.baseRevisionId&&old.baseRevisionId===s.revisionId)continue;
      if(old.revisionId&&old.revisionId===s.revisionId){
        if(s.conflictResolvedAt&&!old.conflictResolvedAt)map.set(s.id,copy(s));
        continue;
      }
      const variants=[...(old.conflictVersions||[]),old,...(s.conflictVersions||[]),s].map(v=>{const x=copy(v);delete x.conflictVersions;return x;});
      const unique=Array.from(new Map(variants.map(v=>[v.revisionId||JSON.stringify(v),v])).values());
      const winner=copy([...unique].sort((x,y)=>(y.revision||0)-(x.revision||0)||String(y.updatedAt||'').localeCompare(String(x.updatedAt||''))||String(y.revisionId||'').localeCompare(String(x.revisionId||'')))[0]);
      winner.conflictVersions=unique;
      // Do not resurrect a deleted row while a concurrent edit awaits resolution.
      if(unique.some(v=>v.deletedAt))winner.deletedAt=unique.find(v=>v.deletedAt).deletedAt;
      map.set(s.id,winner);
    }
    return Array.from(map.values());
  }
  function mergeEntries(a,b){
    const map=new Map();
    for(const e of [...list(a),...list(b)]){
      if(!e||!e.id)continue;const old=map.get(e.id);
      if(!old){map.set(e.id,copy(e));continue;}
      const latest=String(e.updatedAt||'')>String(old.updatedAt||'')?e:old;
      map.set(e.id,{...copy(latest),linkedFactIds:[...new Set([...list(old.linkedFactIds),...list(e.linkedFactIds)])],sets:mergeSets(old.sets,e.sets)});
    }
    return Array.from(map.values());
  }
  function activeSets(e){return list(e.sets).filter(s=>s.status==='completed'&&!s.deletedAt&&!s.conflictVersions);}
  function migrateLogs(logs){
    const out=copy(logs||{});for(const log of Object.values(out)){log.schemaVersion=Math.max(3,Number(log.schemaVersion)||0);log.exerciseEntries=list(log.exerciseEntries);}return out;
  }
  function observations(logs,library){
    const lib=new Map(list(library).map(a=>[a.exerciseKey,a])),out=[];
    for(const [date,log] of Object.entries(logs||{})){
      const linked=new Set(),covered=new Set(),precisePlans=new Set(),preciseRecords=new Set(),aggregateActions=new Set();
      for(const e of list(log.exerciseEntries)){
        for(const id of list(e.linkedFactIds))linked.add(id);
        if(e.planItemId&&e.replacedLegacyProgress)covered.add(e.planItemId);
        const action=lib.get(e.exerciseKey)||{};
        for(const s of activeSets(e))out.push({id:s.id,date,entryId:e.id,exerciseKey:e.exerciseKey,name:e.displayNameSnapshot||action.displayName||e.exerciseKey,phase:s.phase||'work',mode:e.mode||'reps',reps:number(s.reps),seconds:number(s.durationSeconds),load:number(s.externalLoadKg),leftReps:s.leftReps,rightReps:s.rightReps,source:'sets',action,sessionId:e.sessionId||e.id});
      }
      // Only user-stated aggregate values, not the prescribed dose from check marks.
      for(const r of list(log.aiCaptureRecords)){
        if(r.revoked||linked.has(r.id)||r.recordType!=='training_fact')continue;
        const v=r.originalValue||r.currentValue||{},p=list(log.planProgressItems).find(p=>p.itemId===r.structuredWrite?.itemId||p.planCheckKey===r.structuredWrite?.planCheckKey);
        const action=lib.get(r.exerciseKey||p?.exerciseKey)||list(library).find(a=>a.displayName===v.exercise||list(a.aliases).includes(v.exercise));
        if(!action)continue;
        const n=number(v.sets),direct=number(v.reps),per=number(v.repsPerSet),duration=number(v.duration);
        if(!(n>0)&&!(direct>0)&&!(duration>0))continue;
        if(p&&covered.has(p.itemId))continue;
        const reps=n>0&&per>0?n*per:!(n>0)&&direct>0?direct:null;
        const seconds=!(n>0)&&duration>0&&['秒','second','分钟','minute'].includes(v.durationUnit)?duration*(['秒','second'].includes(v.durationUnit)?1:60):null;
        out.push({id:'capture:'+date+':'+r.id,date,exerciseKey:action.exerciseKey,name:action.displayName,phase:'work',mode:action.recordingMode||'reps',groups:n>0?n:null,reps,seconds,source:'legacy-aggregate',action});
        preciseRecords.add(r.id);aggregateActions.add(action.exerciseKey);if(p)precisePlans.add(p.itemId);
      }
      // Protocol v2 also has a standalone records form. Do not add an overlapping
      // AI projection for the same action again when explicit linkage is unavailable.
      for(const r of list(log.records)){
        if(r.revoked||r.deleted||r.deletedAt||!['plan_progress','extra_training','training_fact'].includes(r.type)||linked.has(r.recordId)||linked.has(r.candidateId))continue;
        const action=lib.get(r.exerciseKey)||list(library).find(a=>a.displayName===r.exerciseName||list(a.aliases).includes(r.exerciseName));
        if(!action||aggregateActions.has(action.exerciseKey))continue;
        const p=list(log.planProgressItems).find(p=>p.exerciseKey===action.exerciseKey);
        if(p&&covered.has(p.itemId))continue;
        const n=number(r.sets)||(['组','set'].includes(r.unit)?number(r.amount):null),per=number(r.repsPerSet);
        const reps=n>0&&per>0?n*per:number(r.reps)||(['次','rep'].includes(r.unit)?number(r.amount):null);
        const dur=number(r.duration)||(['秒','second','分钟','minute'].includes(r.unit)?number(r.amount):null),unit=r.durationUnit||r.unit;
        const seconds=!(n>0)&&dur>0&&['秒','second','分钟','minute'].includes(unit)?dur*(['秒','second'].includes(unit)?1:60):null;
        if(!(n>0)&&!(reps>0)&&!(seconds>0))continue;
        out.push({id:'protocol:'+date+':'+r.recordId,date,exerciseKey:action.exerciseKey,name:action.displayName,phase:'work',mode:action.recordingMode||'reps',groups:n>0?n:null,reps:reps>0?reps:null,seconds,source:'legacy-aggregate',action});
        preciseRecords.add(r.recordId);if(r.candidateId)preciseRecords.add(r.candidateId);
        if(p)precisePlans.add(p.itemId);
      }
      // Legacy projections are only used when not replaced by explicitly linked detail.
      for(const p of list(log.planProgressItems)){
        if(covered.has(p.itemId)||precisePlans.has(p.itemId)||!(Number(p.completedAmount)>0))continue;
        const action=lib.get(p.exerciseKey)||{};
        // Old check marks may be derived from a plan, not a user stated actual dose.
        if(p.setRecordManaged&&!(Number(p.setRecordBaseAmount)>0))continue;
        out.push({id:'legacy:'+date+':'+p.itemId,date,exerciseKey:p.exerciseKey,name:p.snapshotDisplayName||action.displayName||p.exerciseKey,phase:'work',mode:action.recordingMode||'reps',groups:null,reps:null,seconds:null,source:'legacy-completion',action});
      }
      for(const e of list(log.extraTrainingEvents)){
        if(e.revoked||linked.has(e.id)||linked.has(e.sourceRecordId)||linked.has(e.sourceMessageId)||preciseRecords.has(e.sourceMessageId))continue;
        const action=lib.get(e.exerciseKey)||{},n=number(e.amount);
        out.push({id:'extra:'+date+':'+e.id,date,exerciseKey:e.exerciseKey,name:e.snapshotDisplayName||action.displayName||e.exerciseKey,phase:'work',mode:action.recordingMode||'reps',groups:e.unit==='组'?n:null,reps:/^(次|个|下)$/.test(e.unit||'')?n:null,seconds:e.unit==='秒'?n:e.unit==='分钟'&&n!==null?n*60:null,source:'legacy-aggregate',action});
      }
    }
    return out;
  }
  function stats(logs,library,period){
    const rows=observations(logs,library).filter(r=>(!period?.from||r.date>=period.from)&&(!period?.to||r.date<=period.to));
    const muscles=Object.fromEntries(Object.keys(REGIONS).map(k=>[k,{primary:0,secondary:0,unknown:0,rows:[]}]));
    const days={},actions={},seen=new Set();let groups=0,reps=0,seconds=0,volume=0,legacy=0,detail=0,unknown=0,conflicts=0;
    for(const log of Object.values(logs||{}))for(const e of list(log.exerciseEntries))for(const s of list(e.sets))if(s.conflictVersions)conflicts++;
    for(const r of rows){
      if(seen.has(r.id))continue;seen.add(r.id);
      const recovery=r.action.category==='recovery'||['stretch','mobility','cardio'].includes(r.action.exerciseType);
      const warmup=r.phase==='warmup',n=r.source==='sets'?1:r.groups;
      const d=days[r.date]||(days[r.date]={strength:false,recovery:false,groups:0,rows:[]});d.rows.push(r);
      if(recovery)d.recovery=true;else if(!warmup)d.strength=true;
      if(r.source==='sets')detail++;else legacy++;
      if(recovery||warmup)continue;
      if(n!==null&&n!==undefined){groups+=n;d.groups+=n;}
      if(r.reps!==null&&r.reps!==undefined)reps+=r.reps;
      if(r.seconds!==null&&r.seconds!==undefined)seconds+=r.seconds;
      if(r.load!==null&&r.load!==undefined&&r.reps!==null&&r.reps!==undefined)volume+=r.load*r.reps;
      const prim=list(r.action.primaryMuscles),sec=list(r.action.secondaryMuscles);
      if(!prim.length)unknown++;
      for(const [keys,role] of [[prim,'primary'],[sec,'secondary']])for(const m of new Set(keys))if(muscles[m]){if(n!==null&&n!==undefined)muscles[m][role]+=n;else muscles[m].unknown++;muscles[m].rows.push({...r,role});}
      const a=actions[r.exerciseKey]||(actions[r.exerciseKey]={key:r.exerciseKey,name:r.name,points:{},bestReps:null,bestSeconds:null,bestLoad:null,records:[]});
      const p=a.points[r.date]||(a.points[r.date]={date:r.date,reps:null,seconds:null,load:null,totalReps:0,volume:0});
      if(r.source==='sets'){
        if(r.reps!==null){p.reps=Math.max(p.reps||0,r.reps);a.bestReps=Math.max(a.bestReps||0,r.reps);}
        if(r.seconds!==null){p.seconds=Math.max(p.seconds||0,r.seconds);a.bestSeconds=Math.max(a.bestSeconds||0,r.seconds);}
        if(r.load!==null){p.load=Math.max(p.load||0,r.load);a.bestLoad=Math.max(a.bestLoad||0,r.load);}
      }
      if(r.reps!==null&&r.reps!==undefined)p.totalReps+=r.reps;
      if(r.load!==null&&r.load!==undefined&&r.reps!==null&&r.reps!==undefined)p.volume+=r.load*r.reps;
    }
    return {rows,days,muscles,actions,groups,reps,seconds,volume,detail,legacy,unknown,conflicts,trainingDays:Object.values(days).filter(d=>d.strength).length,recoveryDays:Object.values(days).filter(d=>d.recovery).length};
  }
  function projection(entry){
    const work=activeSets(entry).filter(s=>s.phase!=='warmup');
    return {groups:work.length,reps:work.reduce((n,s)=>n+(number(s.reps)||0),0),seconds:work.reduce((n,s)=>n+(number(s.durationSeconds)||0),0)};
  }
  function rebuildSetProgress(log){
    for(const p of list(log.planProgressItems)){
      if(!p.setRecordManaged)continue;
      const entries=list(log.exerciseEntries).filter(e=>e.planItemId===p.itemId&&e.reconciliationState==='accepted');
      let amount=Number(p.setRecordBaseAmount)||0;
      for(const e of entries){const x=projection(e);amount+=p.unit==='组'?x.groups:p.unit==='秒'?x.seconds:p.unit==='分钟'?x.seconds/60:x.reps;}
      p.completedAmount=Math.min(Number(p.targetAmount)||0,amount);
      p.status=p.completedAmount>=Number(p.targetAmount)&&Number(p.targetAmount)>0?'completed':'active';
      p.setRecordExtraAmount=Math.max(0,amount-(Number(p.targetAmount)||0));
    }
    return log;
  }
  function persistBackup(storage,keys,backupKey='gain-training-v3-backup'){
    if(storage.getItem(backupKey))return false;
    const data={createdAt:new Date().toISOString(),values:{}};
    for(const k of keys)data.values[k]=storage.getItem(k);
    storage.setItem(backupKey,JSON.stringify(data));
    if(!storage.getItem(backupKey))throw new Error('备份未能保存');return true;
  }
  function persistTransaction(storage,updates){
    const keys=Object.keys(updates),before=Object.fromEntries(keys.map(k=>[k,storage.getItem(k)]));
    try{for(const k of keys)storage.setItem(k,JSON.stringify(updates[k]));}
    catch(error){
      let rollbackFailed=false;
      for(const k of keys.reverse())try{if(before[k]===null)storage.removeItem(k);else storage.setItem(k,before[k]);}catch(_){rollbackFailed=true;}
      if(rollbackFailed)throw new Error('保存失败且部分回滚失败，请使用升级前备份恢复；'+error.message);
      throw error;
    }
  }
  return {REGIONS,list,copy,uid,number,dayKey,range,validateSet,editSet,mergeSets,mergeEntries,activeSets,migrateLogs,observations,stats,projection,rebuildSetProgress,persistBackup,persistTransaction};
});
