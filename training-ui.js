/* Progressive enhancement of the existing tracker. No external runtime dependencies. */
(function(){
  'use strict';
  const C=window.TrainingCore;if(!C)return;
  const $=id=>document.getElementById(id),esc=escapeHtml;
  let selectedMuscle='chest',back=false,planActual=false,rangeKind='week',customFrom='',customTo='',trendKey='',trendMetric='reps',editor=null,previousFocus=null;
  const equipmentNames={bodyweight:'徒手',dumbbell:'哑铃',barbell:'杠铃',band:'弹力带',bench:'训练凳',support:'稳固支撑','pull-up-bar':'单杠','parallel-bars':'双杠','parallel-pull-up-bar':'对握单杠',cable:'拉力器',machine:'器械',other:'其他'};
  let muscleFilter='',equipmentFilter='',typeFilter='',pickerContext=null,blockContext=null;
  const lib=()=>getExerciseLibrary();
  const actionFor=key=>lib().find(a=>a.exerciseKey===key);
  const notify=message=>{if($('te-status'))$('te-status').textContent=message;else alert(message);};
  function backup(){C.persistBackup(localStorage,Object.keys(localStorage));}
  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function persist(logs){
    backup();
    // Do not clear the draft until all facts and their legacy projections persist.
    const checks=getPlanChecks(),meta=getPlanCheckMeta();
    const weekDates=getPlanDays().map((d,i)=>getDateForPlanDayInCurrentWeek(d.day,i));
    for(const log of Object.values(logs))for(const p of C.list(log.planProgressItems))if(p.setRecordManaged&&weekDates.includes(log.date)){
      if(p.status==='completed'){checks[p.planCheckKey]=true;meta[p.planCheckKey]={source:'set_records',updatedAt:new Date().toISOString()};}
      else{delete checks[p.planCheckKey];delete meta[p.planCheckKey];}
    }
    C.persistTransaction(localStorage,{[DAILY_LOGS_KEY]:logs,[PLAN_CHECKS_KEY]:checks,[PLAN_CHECK_META_KEY]:meta});
    appState.load();
    queueAutoSync('逐组记录更新');renderHistory();renderPlan();refresh();
  }
  function refresh(){renderPlanMap();renderStats();renderSessionCard();renderSavedEntries();}
  function selectMuscle(key){
    selectedMuscle=key;
    document.querySelectorAll('.te-muscle-list button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.muscle===key)));
    const root=$('te-plan-map');
    if(root?._teMap){const old=root.querySelector('.te-trace');if(old)old.outerHTML=traceHTML(root._teMap.data,root._teMap.planned);}
    const stats=$('te-statistics');if(stats&&!stats.hidden)renderStats();
  }
  const colors=['#e7eaee','#cee8dc','#8bc7ad','#137b62'];
  function color(n){return colors[n>=8?3:n>=4?2:n>0?1:0];}
  function bodySVG(muscles,planned=false){
    const shapes=[];const put=(key,d)=>shapes.push(`<path data-muscle="${key}" tabindex="0" role="button" aria-label="${esc(C.REGIONS[key])}" fill="${color(muscles[key]?.primary||0)}" d="${d}"><title>${esc(C.REGIONS[key])}</title></path>`);
    const pair=(key,left)=>{put(key,left);shapes.push(`<g transform="translate(220 0) scale(-1 1)">${shapes.pop()}</g>`);put(key,left);};
    // Original simplified region illustration, drawn for this application.
    pair('deltoids','M72 70 Q60 68 53 87 L48 109 64 114 79 89Z');
    pair(back?'triceps':'biceps','M48 111 L63 116 57 150 42 150Z');
    pair('forearm','M42 154 L56 153 50 190 38 203 31 200Z');
    if(back){
      pair('trapezius','M95 61 L109 61 109 99 79 83Z');
      pair('upper-back','M78 86 L107 103 107 158 82 143Z');
      pair('lower-back','M84 147 L107 163 107 188 86 187Z');
      pair('gluteal','M85 192 L108 192 108 223 78 224Z');
      pair('hamstring','M77 229 L105 229 101 276 78 280 72 251Z');
      pair('calves','M79 288 L98 285 98 311 89 337 79 334Z');
    }else{
      pair('chest','M78 78 L107 79 107 109 75 108 69 95Z');
      pair('serratus','M72 113 L84 116 80 143 73 140Z');
      pair('abs','M88 114 L107 114 107 178 88 172Z');
      pair('obliques','M74 146 L85 148 85 174 104 189 88 190Z');
      pair('hip-flexors','M87 191 L107 194 103 216 84 207Z');
      pair('quadriceps','M76 215 L96 220 96 275 77 278 70 250Z');
      pair('adductors','M100 218 L108 219 107 265 99 277Z');
      pair('tibialis','M79 289 L89 289 88 334 80 333Z');
      pair('calves','M92 289 L99 287 99 314 93 333 91 332Z');
    }
    return `<svg class="te-body" viewBox="0 0 220 360" role="group" aria-label="${back?'背面':'正面'}${planned?'计划涉及':'实际训练'}肌肉图"><g fill="var(--soft,#edf0f2)" stroke="var(--line,#ddd)"><ellipse cx="110" cy="33" rx="19" ry="25"/><path d="M99 54L121 54 125 65 148 70 163 94 174 149 187 202 176 207 158 169 147 131 141 183 151 232 144 283 140 335 149 346 126 348 115 286 110 237 105 286 94 348 71 346 80 335 76 283 69 232 79 183 73 131 62 169 44 207 33 202 46 149 57 94 72 70 95 65Z"/></g>${shapes.join('')}<text x="110" y="359" text-anchor="middle">${back?'背面':'正面'} · 点击肌群查看</text></svg>`;
  }
  function mapHTML(data,planned=false){
    const ordered=Object.entries(C.REGIONS).sort((a,b)=>(data.muscles[b[0]]?.primary||0)-(data.muscles[a[0]]?.primary||0));
    return `<div class="te-toolbar"><button class="btn-outline" data-te="flip">查看${back?'正面':'背面'}</button><span class="te-note">${planned?'计划预览，不代表已经完成':'仅统计有依据的正式组数'}</span></div><div class="te-map-layout">${bodySVG(data.muscles,planned)}<div class="te-muscle-list">${ordered.map(([k,n])=>{const x=data.muscles[k]||{};return `<button type="button" data-muscle="${k}" aria-pressed="${selectedMuscle===k}"><span>${n}</span><span>${planned?(x.primary||x.secondary?'涉及':'—'):`${x.primary||0}主 / ${x.secondary||0}辅${x.unknown?' · 未详':''}`}</span></button>`;}).join('')}</div></div><div class="te-legend">${colors.map(x=>`<i class="te-swatch" style="background:${x}"></i>`).join('')}${planned?'未涉及 → 涉及':'主练组数：0 / 1–3 / 4–7 / 8+'}</div><div class="te-note">辅助组单独展示，不折算“有效组”；无记录不代表没有训练。</div>${traceHTML(data,planned)}`;
  }
  function traceHTML(data,planned){
    const rows=data.muscles[selectedMuscle]?.rows||[],unique=Array.from(new Map(rows.map(r=>[r.date+':'+r.exerciseKey+':'+r.role,r])).values());
    return `<div class="te-trace"><b>${esc(C.REGIONS[selectedMuscle])}</b><div class="te-note">${planned?'涉及该部位的计划动作':'点击查看记录或动作详情'}</div>${unique.map(r=>`<button data-te="trace" data-date="${r.date||''}" data-key="${esc(r.exerciseKey)}">${esc(r.date||'计划')} · ${esc(r.name)} · ${r.role==='primary'?'主练':'辅助'}</button>`).join('')||'<div class="te-note">当前范围没有可分类记录。</div>'}</div>`;
  }
  function renderPlanMap(){
    const root=$('te-plan-map');if(!root)return;
    const day=getPlanDays()[activePlanDay],date=day?getDateForPlanDayInCurrentWeek(day.day,activePlanDay):C.dayKey(new Date());
    let data;
    if(planActual)data=C.stats(getDailyLogs(),lib(),{from:date,to:date});
    else{
      const entries=C.list(day?.items).map((text,i)=>{const a=getExerciseActionForPlanItem(text);return {id:'planned_'+i,exerciseKey:a.exerciseKey,displayNameSnapshot:a.displayName,sets:[{id:'planned_set_'+i,status:'completed',phase:'work'}]};});
      data=C.stats({[date]:{exerciseEntries:entries}},lib(),null);
    }
    root._teMap={data,planned:!planActual};
    root.innerHTML=`<div class="te-kicker">TRAINING BALANCE</div><div class="te-head"><h2>肌肉分布</h2><span class="te-note">${esc(date)}</span></div><div class="te-toolbar te-segment"><button data-te="plan-mode" data-value="plan" aria-pressed="${!planActual}">计划涉及</button><button data-te="plan-mode" data-value="actual" aria-pressed="${planActual}">实际完成</button></div>${mapHTML(data,!planActual)}`;
    document.querySelectorAll('#planContainer .day-row').forEach(row=>{
      if(row.querySelector('.te-record-open'))return;
      const b=document.createElement('button');b.type='button';b.className='te-record-open';b.textContent='记录组数';b.dataset.te='open-plan';b.dataset.day=row.dataset.guideOpen;b.dataset.text=row.dataset.guideItem;
      row.insertBefore(b,row.querySelector('.check-btn'));
    });
  }
  function renderStats(){
    const root=$('te-statistics');if(!root)return;
    const period=C.range(rangeKind,new Date(),customFrom,customTo),data=C.stats(getDailyLogs(),lib(),period);
    const opts=[['week','本周'],['lastWeek','上周'],['month','本月'],['30','近30天'],['custom','自定义']];
    root.innerHTML=`<div class="te-kicker">YOUR TRAINING, IN NUMBERS</div><div class="te-head"><h2>训练统计</h2><button class="btn-outline" data-te="export-data">导出训练备份</button></div><div class="te-toolbar"><label>范围 <select id="te-range">${opts.map(([v,n])=>`<option value="${v}" ${rangeKind===v?'selected':''}>${n}</option>`).join('')}</select></label>${rangeKind==='custom'?`<label>起始 <input id="te-from" type="date" value="${esc(customFrom)}"></label><label>截止 <input id="te-to" type="date" value="${esc(customTo)}"></label>`:''}</div>${period.from&&period.to&&period.from>period.to?'<div class="te-warning">起始日期不能晚于截止日期。</div>':''}<div class="te-note">${esc(period.from||'请选择起始日期')} — ${esc(period.to||'请选择截止日期')}</div><div class="te-metrics">${[[data.trainingDays,'力量训练天'],[data.groups,'正式组'],[data.reps,'实际总次数'],[data.seconds,'计时动作秒数']].map(([n,t])=>`<div class="te-metric"><strong>${n}</strong><span>${t}</span></div>`).join('')}</div><div class="te-note">逐组明细 ${data.detail} 条 · 旧记录 ${data.legacy} 条 · 恢复活动 ${data.recoveryDays} 天。旧完成勾选不推算组数和次数。${data.unknown?` ${data.unknown} 条记录待分类。`:''}</div>${data.conflicts?`<div class="te-warning">有 ${data.conflicts} 组存在同步冲突，已暂时排除统计。请在下方已保存记录中选择保留的版本。</div>`:''}<h3 style="margin-top:22px">训练日历</h3>${calendarHTML(data,period)}<div class="te-note">绿色：力量训练；蓝色边框：恢复活动；灰色：无记录。</div><h3 style="margin-top:24px">肌肉分布</h3>${mapHTML(data)}<h3 style="margin-top:24px">动作进步</h3>${trendHTML(data)}<div class="te-note">所有统计读取已保存事实；正在进行的会话仅在记录面板预览。</div>${localStorage.getItem('gain-training-v3-backup')?'<button class="btn-outline full" style="margin-top:12px" data-te="export-before">导出首次升级前备份</button>':''}`;
  }
  function calendarHTML(data,period){
    if(!period.from||!period.to||period.from>period.to)return '<div class="te-empty">请选择有效日期范围。</div>';
    const first=new Date(period.from+'T12:00:00'),last=new Date(period.to+'T12:00:00');
    if(!Number.isFinite(first.getTime())||!Number.isFinite(last.getTime()))return '';
    const count=Math.min(370,Math.round((last-first)/86400000)+1),offset=(first.getDay()+6)%7;
    let html=Array.from({length:7},(_,i)=>`<div class="te-weekday">${'一二三四五六日'[i]}</div>`).join('')+'<span></span>'.repeat(offset);
    for(let i=0;i<count;i++){const d=new Date(first);d.setDate(first.getDate()+i);const key=C.dayKey(d),x=data.days[key];html+=`<button data-te="day" data-date="${key}" data-level="${x?.strength?(x.groups>=8?3:x.groups>=4?2:1):0}" data-recovery="${!!x?.recovery}" aria-label="${key} ${x?.strength?'力量训练':x?.recovery?'恢复活动':'无记录'}">${d.getDate()===1?`${d.getMonth()+1}/1`:d.getDate()}</button>`;}
    return `<div class="te-calendar">${html}</div>${count>=370?'<div class="te-note">日历最多展示370天；汇总仍按完整范围计算。</div>':''}`;
  }
  function trendHTML(data){
    const actions=Object.values(data.actions);if(!actions.length)return '<div class="te-empty">开始记录训练后，这里会出现动作趋势。</div>';
    if(!data.actions[trendKey])trendKey=actions[0].key;
    const a=data.actions[trendKey],metrics={reps:'单组总次数',seconds:'单组保持秒数',load:'外加总重量 kg',totalReps:'当天总次数',volume:'当天外加重量训练量 kg·次'};
    const points=Object.values(a.points).sort((x,y)=>x.date.localeCompare(y.date)).filter(p=>p[trendMetric]!==null&&p[trendMetric]!==undefined);
    const max=Math.max(1,...points.map(p=>p[trendMetric])),min=Math.min(0,...points.map(p=>p[trendMetric]));
    const xy=points.map((p,i)=>[36+(i/Math.max(1,points.length-1))*325,130-((p[trendMetric]-min)/(max-min||1))*110]);
    const chart=points.length?`<svg class="te-chart" viewBox="0 0 400 165" role="img" aria-label="${esc(a.name)} ${metrics[trendMetric]}趋势"><path d="M35 15V132H365" fill="none" stroke="var(--line)"/><polyline points="${xy.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#137b62" stroke-width="2.5"/>${xy.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="4" fill="#137b62"><title>${points[i].date}：${points[i][trendMetric]}</title></circle>`).join('')}<text x="5" y="20">${max}</text><text x="35" y="155">${points[0].date.slice(5)}</text><text x="320" y="155">${points[points.length-1].date.slice(5)}</text></svg>`:'<div class="te-empty">该指标暂无明确记录，不从旧计划推算。</div>';
    return `<div class="te-toolbar"><label>动作 <select id="te-trend-key">${actions.map(x=>`<option value="${esc(x.key)}" ${trendKey===x.key?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>指标 <select id="te-trend-metric">${Object.entries(metrics).map(([k,n])=>`<option value="${k}" ${trendMetric===k?'selected':''}>${n}</option>`).join('')}</select></label></div>${chart}<details><summary class="te-note">查看曲线数据</summary><table class="te-trend-table"><thead><tr><th>日期</th><th>${metrics[trendMetric]}</th></tr></thead><tbody>${points.map(p=>`<tr><td>${p.date}</td><td>${p[trendMetric]}</td></tr>`).join('')}</tbody></table></details><div class="te-records">${[[a.bestReps,'最高单组总次数','次'],[a.bestSeconds,'最长保持','秒'],[a.bestLoad,'最高外加总重量','kg']].filter(([n])=>n!==null).map(([n,label,unit])=>`<div class="te-record-row"><span>${label}</span><b>${n} ${unit}</b></div>`).join('')}</div><div class="te-note">以上纪录限当前日期范围；第一条逐组数据是首次记录，不能据此声称打破历史纪录。单侧动作次数为左右总和。</div>`;
  }
  function ensureSession(dayIndex,date){
    let session=getTrainingSession();
    if(session&&session.date!==date)throw new Error(`还有 ${session.date} 的会话草稿，请先保存或放弃。`);
    if(!session){const day=getPlanDays()[dayIndex]||{},isPlanned=date===getDateForPlanDayInCurrentWeek(day.day,dayIndex);session={id:C.uid('session'),status:'active',dayIndex,date,dayName:isPlanned?(day.day||'训练'):'自由训练 / 补记',focus:isPlanned?(day.focus||''):'',items:isPlanned?C.list(day.items):[],events:[],startedAt:new Date().toISOString()};}
    session.setEntries=C.list(session.setEntries);return session;
  }
  function openPlan(dayIndex,text){
    const segments=String(text).split(/[+＋]|或|\/(?!\d)/).filter(Boolean),actions=[];
    for(const segment of segments){
      const matches=lib().filter(a=>a.exerciseType!=='choice').flatMap(a=>[a.displayName,...C.list(a.aliases)].filter(Boolean).map(name=>({a,name}))).filter(x=>segment.includes(x.name)).sort((a,b)=>b.name.length-a.name.length);
      const resolved=matches[0]?.a || getExerciseActionForPlanItem(segment);
      if(!actions.some(a=>a.exerciseKey===resolved.exerciseKey))actions.push(resolved);
    }
    if(!actions.length)actions.push(getExerciseActionForPlanItem(text));
    blockContext={dayIndex,text,actions};openBoundPlanAction(actions[0]);
  }
  function openBoundPlanAction(action){
    const {dayIndex,text}=blockContext,day=getPlanDays()[dayIndex],date=getDateForPlanDayInCurrentWeek(day.day,dayIndex);
    try{
      backup();
      const session=ensureSession(dayIndex,date),log=ensureDailyLogSnapshot(date),p=C.list(log?.planProgressItems).find(x=>x.snapshotItemText===text);
      let entry=session.setEntries.find(e=>e.planText===text&&e.exerciseKey===action.exerciseKey);
      if(!entry){entry=makeEntry(action,date);entry.planItemId=/[+＋]/.test(text)?null:p?.itemId||null;entry.planCheckKey=p?.planCheckKey||null;entry.planText=text;entry.planBlockDayIndex=dayIndex;entry.defaultPhase=/热身/.test(text)?'warmup':'work';entry.legacyChoice=(p?.completedAmount>0)?'pending':'additional';session.setEntries.push(entry);}
      setTrainingSession(session);openEditor(entry,date,false);
    }catch(e){alert(e.message);}
  }
  function makeEntry(a,date){return {id:C.uid('entry'),exerciseKey:a.exerciseKey,displayNameSnapshot:a.displayName,exerciseRevision:'2026-11-07',date,mode:a.recordingMode||'reps',laterality:a.laterality||'bilateral',source:'manual',linkedFactIds:[],sets:[],reconciliationState:'pending',createdAt:new Date().toISOString()};}
  function openPicker(date=C.dayKey(new Date()),dayIndex=activePlanDay,context=null){
    blockContext=null;
    pickerContext=context;
    openSheet(`<h2>添加训练动作</h2>`,`<label class="te-field">训练日期<input type="date" id="te-picker-date" value="${esc(date)}"></label><label class="te-field" style="margin-top:12px">搜索动作<input id="te-picker-search" placeholder="中文或英文名称"></label><label class="te-field" style="margin-top:12px">选择动作<select id="te-picker-action">${pickerOptions('')}</select></label><p class="te-note">添加到当前训练会话；可以记录计划外训练。保存前仍是草稿。</p><div id="te-status" class="te-status" role="status"></div>`,`<button class="btn-outline" data-te="close">返回</button><button class="btn" data-te="picker-add" data-day="${dayIndex}">开始逐组记录</button>`);
  }
  function pickerOptions(q){return '<option value="">请选择实际完成的动作</option>'+lib().filter(a=>a.exerciseType!=='choice'&&`${a.displayName} ${a.englishName||''}`.toLowerCase().includes(q.toLowerCase())).map(a=>`<option value="${esc(a.exerciseKey)}">${esc(a.displayName)}</option>`).join('');}
  function openEditor(entry,date,saved){editor={entry:C.copy(entry),original:JSON.stringify(entry),date,saved};previousFocus=document.activeElement;renderEditor();}
  function renderEditor(){
    if(!editor)return;const e=editor.entry,a=actionFor(e.exerciseKey)||{},x=C.projection(e);
    const active=C.activeSets(e),all=C.list(e.sets),conflicts=all.filter(s=>s.conflictVersions);
    const planned=getDailyLogs()[editor.date]?.planProgressItems?.find(p=>p.itemId===e.planItemId);
    openSheet(`<div class="te-head"><h2>${esc(e.displayNameSnapshot)}</h2><button class="te-close" data-te="close" aria-label="关闭">×</button></div><div class="te-note">${esc(editor.date)} · ${editor.saved?'已保存记录，修改后需保存':'会话草稿，结束保存后进入统计'}</div>`,
      `${e.planText?`<div class="te-note">计划：${esc(e.planText)}</div>`:''}${blockContext?.text===e.planText&&blockContext.actions.length>1?`<div class="te-block-actions"><span class="te-note">本框内的动作</span>${blockContext.actions.map(a=>`<button class="btn-outline" data-te="bound-action" data-key="${esc(a.exerciseKey)}" aria-pressed="${a.exerciseKey===e.exerciseKey}">${esc(a.displayName)}</button>`).join('')}</div><p class="te-note">逐个记录本框动作；组合项目记录保留原框关联，不把一个动作当作整框完成。</p>`:''}${planned&&e.legacyChoice==='pending'?'<div class="te-warning">当天已有该计划的完成记录。本次是补齐已有记录，还是另外新做的训练？<br><button class="btn-outline" data-te="legacy-choice" data-value="replace">补齐已有记录</button><button class="btn-outline" data-te="legacy-choice" data-value="additional">另外新做的训练</button></div>':''}<div class="te-toolbar"><button class="btn-outline" data-te="toggle-load">${e.showLoad?'隐藏':'填写'}外加重量</button><button class="btn-outline" data-te="guide" data-key="${esc(e.exerciseKey)}">动作说明</button></div>${all.filter(s=>!s.deletedAt&&!s.conflictVersions).map((s,i)=>setHTML(s,i,e)).join('')||'<div class="te-empty">还没有组记录。添加一组，填写实际完成量。</div>'}${all.some(s=>s.deletedAt&&!s.conflictVersions)?'<button class="btn-outline" data-te="undo-delete">撤销最近一次删除</button>':''}${conflicts.map(s=>`<div class="te-warning">这组有不同设备的修改，选择要保留的版本：${s.conflictVersions.map((v,i)=>`<button class="btn-outline" data-te="resolve" data-id="${esc(s.id)}" data-version="${i}">${v.deletedAt?'删除此组':`${v.reps??v.durationSeconds??'—'}${e.mode==='time'?'秒':'次'} · ${v.externalLoadKg??'未填'}kg`}<br>${esc(v.updatedAt||'')}</button>`).join('')}</div>`).join('')}<button class="btn-outline full" data-te="add-set">＋ 添加一组</button><div class="te-toolbar"><label class="te-note"><input type="checkbox" id="te-rest-auto" ${localStorage.getItem('gain-set-rest-auto')==='1'?'checked':''}> 完成一组后启动现有休息计时器</label></div><div class="softbox">本次预览：正式 ${x.groups} 组 · ${x.reps} 次 · ${x.seconds} 秒${active.some(s=>s.phase==='warmup')?'；热身另计':''}</div>${e.planItemId?'<div class="te-note">剂量不符时保留真实训练，计划待核对，不自动修改周模板。</div>':''}<div id="te-status" class="te-status" role="status"></div>`,
      `<button class="btn-outline" data-te="close">返回训练</button><button class="btn" data-te="${editor.saved?'save-edit':'finish'}">${editor.saved?'保存修改':'保存本次训练'}</button>`);
  }
  function setHTML(s,i,e){
    const input=(field,label,type='number',extra='')=>`<label>${label}<input data-field="${field}" type="${type}" inputmode="decimal" min="0" value="${s[field]??''}" ${extra}></label>`;
    const fields=e.mode==='time'?(e.laterality==='unilateral'?input('leftSeconds','左侧保持（秒）')+input('rightSeconds','右侧保持（秒）'):input('durationSeconds','实际保持（秒）')):(e.laterality==='unilateral'?input('leftReps','左侧次数','number','step="1"')+input('rightReps','右侧次数','number','step="1"'):input('reps','实际次数','number','step="1"'));
    const load=e.showLoad?`${input('loadInputKg',e.laterality==='unilateral'?'单侧使用重量（kg）':'外加重量（kg）','number','step="0.1"')}<label>重量口径<select data-field="loadInputMode"><option value="total" ${s.loadInputMode!=='perDumbbell'?'selected':''}>合计 / 单侧所用器械重量</option>${e.laterality!=='unilateral'?`<option value="perDumbbell" ${s.loadInputMode==='perDumbbell'?'selected':''}>双哑铃，每只重量</option>`:''}</select></label>`:'';
    return `<div class="te-set" data-set-id="${esc(s.id)}" data-completed="${s.status==='completed'}"><div class="te-set-head"><strong>第 ${i+1} 组 · ${s.status==='completed'?'已完成':'待记录'}</strong><div><button class="te-inline-button" data-te="copy-set" data-id="${s.id}">复制</button> <button class="te-inline-button" data-te="delete-set" data-id="${s.id}">删除</button></div></div><div class="te-set-fields">${fields}${load}<label>组别<select data-field="phase"><option value="work" ${s.phase!=='warmup'?'selected':''}>正式组</option><option value="warmup" ${s.phase==='warmup'?'selected':''}>热身组</option></select></label><label>用力程度（选填）<input data-field="effortValue" type="number" min="0" max="10" step="0.5" placeholder="不填也可保存" value="${s.effort?.value??''}"></label><label>量表<select data-field="effortScale"><option ${s.effort?.scale!=='RPE'?'selected':''}>RIR</option><option ${s.effort?.scale==='RPE'?'selected':''}>RPE</option></select></label></div><button class="btn-outline full" style="margin-top:9px" data-te="complete-set" data-id="${s.id}">${s.status==='completed'?'已完成 · 可修改后重记':'完成该组'}</button></div>`;
  }
  function storeEditorDraft(){
    if(!editor||editor.saved)return;
    const session=getTrainingSession();if(!session)throw new Error('训练会话已变化，请重新打开');
    const i=C.list(session.setEntries).findIndex(e=>e.id===editor.entry.id);if(i<0)throw new Error('找不到草稿');
    editor.entry.updatedAt=new Date().toISOString();session.setEntries[i]=C.copy(editor.entry);session.updatedAt=new Date().toISOString();setTrainingSession(session);
  }
  function updateRow(el){
    const node=el.closest('[data-set-id]');if(!node||!editor)return;
    const s=editor.entry.sets.find(x=>x.id===node.dataset.setId),patch={status:'pending'};
    node.querySelectorAll('[data-field]').forEach(input=>{patch[input.dataset.field]=input.value;});
    patch.effort=patch.effortValue===''?null:{scale:patch.effortScale,value:patch.effortValue};delete patch.effortValue;delete patch.effortScale;
    Object.assign(s,C.editSet(s,patch));
    storeEditorDraft();
    node.dataset.completed='false';node.querySelector('strong').textContent=node.querySelector('strong').textContent.replace('已完成','待记录');
    const b=node.querySelector('[data-te="complete-set"]');if(b)b.textContent='完成该组';
  }
  function prepareEntry(log,entry){
    const e=C.copy(entry),p=C.list(log.planProgressItems).find(p=>p.itemId===e.planItemId);e.updatedAt=new Date().toISOString();
    if(p){
      if(e.legacyChoice==='pending')throw new Error('请先选择补齐已有记录或另外新做的训练。');
      if(!p.setRecordManaged){p.setRecordBaseAmount=e.legacyChoice==='replace'?0:Number(p.completedAmount)||0;p.setRecordManaged=true;}
      const dose=getPlanProgressItemDose(p),sets=C.activeSets(e).filter(s=>s.phase!=='warmup');
      const repRange=String(dose.plannedRepsText||'').match(/(\d+)\s*[-–—~～至]\s*(\d+)/),pyramid=String(p.snapshotItemText||'').match(/目标\s*(\d+(?:\s*\/\s*\d+)+)/),targets=pyramid?pyramid[1].split('/').map(Number):null;
      const plannedSets=p.unit==='组'?sets.slice(0,Number(p.targetAmount)||sets.length):sets;
      let mismatched=plannedSets.some((s,i)=>{
        const reps=e.laterality==='unilateral'?(Number(s.leftReps)+Number(s.rightReps))/2:Number(s.reps);
        const unit=dose.durationUnit==='分钟'?60:1,seconds=e.laterality==='unilateral'?Number(s.durationSeconds)/2:Number(s.durationSeconds);
        return (dose.repsPerSet&&reps!==dose.repsPerSet)||(repRange&&(reps<Number(repRange[1])||reps>Number(repRange[2])))||(targets&&i<targets.length&&reps!==targets[i])||(dose.duration&&seconds&&(seconds/unit<Number(dose.durationMin||dose.duration)||seconds/unit>Number(dose.durationMax||dose.duration)));
      });
      if(p.plannedSetDetails?.length)mismatched=sets.some(s=>{
        const old=e.acceptedSetDoses?.[s.id];
        return !old||old.reps!==s.reps||old.durationSeconds!==s.durationSeconds||old.leftReps!==s.leftReps||old.rightReps!==s.rightReps;
      });
      if(mismatched&&!e.acceptActualDose){e.reconciliationState='needs_confirmation';}
      else e.reconciliationState='accepted';
      if(e.acceptActualDose){
        p.plannedSetDetails=sets.map(s=>({reps:s.reps,seconds:s.durationSeconds,leftReps:s.leftReps,rightReps:s.rightReps}));
        p.snapshotItemText=`${p.snapshotDisplayName} ${p.targetAmount}组（各组剂量按已确认实际记录）`;
        p.plannedRepsText='';p.plannedDurationText='';p.doseRevisionSource=e.id;
        if(Number.isInteger(p.sourcePlanItemIndex)&&C.list(log.allItems).length)log.allItems[p.sourcePlanItemIndex]=p.snapshotItemText;
        log.snapshotVersion=(Number(log.snapshotVersion)||1)+1;
        e.acceptedSetDoses=Object.fromEntries(sets.map(s=>[s.id,{reps:s.reps,durationSeconds:s.durationSeconds,leftReps:s.leftReps,rightReps:s.rightReps}]));
      }
      delete e.acceptActualDose;
      if(e.legacyChoice==='replace'){
        e.replacedLegacyProgress=true;
        for(const record of C.list(log.aiCaptureRecords))if(!record.revoked&&record.structuredWrite?.itemId===p.itemId)e.linkedFactIds.push(record.id);
        for(const event of C.list(log.extraTrainingEvents))if(C.list(e.linkedFactIds).includes(event.sourceMessageId))e.linkedFactIds.push(event.id);
      }
    }
    return e;
  }
  function saveEntries(entries,date){
    backup();const logs=getDailyLogs();let log=logs[date];
    if(!log)log={schemaVersion:3,date,dayType:'training',planProgressItems:[],extraTrainingEvents:[],aiCaptureRecords:[]};
    log=C.copy(log);log.schemaVersion=3;
    const prepared=entries.map(e=>prepareEntry(log,e));
    log.exerciseEntries=C.mergeEntries(C.list(log.exerciseEntries),prepared);
    C.rebuildSetProgress(log);
    if(log.allItems){const previous=C.list(log.completedItems);log.completedItems=log.allItems.filter((text,i)=>{const p=C.list(log.planProgressItems).find(p=>p.sourcePlanItemIndex===i);return p?.setRecordManaged?p.status==='completed':previous.includes(text);});log.completedCount=log.completedItems.length;}
    log.updatedAtIso=new Date().toISOString();logs[date]=log;
    persist(logs);return prepared;
  }
  function finishWithSets(options={}){
    const session=getTrainingSession();if(!session?.setEntries?.length)return originalFinish(options);
    if(options.save===false){setTrainingSession(null);closeSheet();refresh();return {status:'discarded'};}
    try{
      if(editor&&!editor.saved)storeEditorDraft();
      const current=getTrainingSession(),entries=current.setEntries.filter(e=>C.activeSets(e).length);
      if(!entries.length)throw new Error('尚无完成组。可继续记录，或放弃本次会话。');
      const prepared=saveEntries(entries.map(e=>({...e,sessionId:current.id})),current.date);
      setTrainingSession(null);editor=null;closeSheet();refresh();
      const pending=prepared.filter(e=>e.reconciliationState==='needs_confirmation');
      if(pending.length)showPending(pending,current.date);
      return {status:'finished',entries:prepared};
    }catch(e){notify('未完成保存：'+e.message+'。草稿已保留，可导出备份后重试。');return {status:'error',error:e.message};}
  }
  function showPending(entries,date){
    openSheet('<h2>训练已保存，计划待核对</h2>',`<p class="te-note">实际组数和次数已进入训练统计。以下动作与当天计划剂量不同；周计划模板不会自动变化。</p>${entries.map(e=>`<div class="te-warning"><b>${esc(e.displayNameSnapshot)}</b><p>保留实际记录，计划暂不增加完成量。也可以明确确认：以这些实际组的剂量修订当天计划。</p><button class="btn-outline" data-te="accept-dose" data-id="${e.id}" data-date="${date}">按本次实际修订当天计划剂量</button></div>`).join('')}<div id="te-status" class="te-status" role="status"></div>`,`<button class="btn" data-te="close">保留实际记录，暂不修订计划</button>`);
  }
  function renderSessionCard(){
    const root=$('te-session-card');if(!root)return;const s=getTrainingSession();
    root.innerHTML=`<div class="te-head"><h2>${s?'继续本次训练':'逐组记录'}</h2><button class="btn-outline" data-te="add-exercise">添加动作</button></div>${s?`<p class="te-note">${esc(s.date||'')} · ${esc(s.dayName||'训练')} · 会话草稿</p><div class="te-session-items">${C.list(s.setEntries).map(e=>`<button class="btn-outline" data-te="draft-entry" data-id="${e.id}">${esc(e.displayNameSnapshot)} · ${C.projection(e).groups}组</button>`).join('')}</div><div class="te-toolbar"><button class="btn" data-te="finish">结束并保存</button><button class="btn-outline" data-te="discard">放弃会话草稿</button><button class="btn-outline" data-te="export-data">导出备份</button></div>`:'<p class="te-note">记录实际次数、重量和时长；也可从当天计划的动作旁开始。</p>'}`;
  }
  function renderSavedEntries(){
    const root=$('te-saved-entries');if(!root)return;const logs=getDailyLogs(),dates=Object.keys(logs).filter(d=>C.list(logs[d].exerciseEntries).length).sort().reverse();
    root.innerHTML='<h2>已保存的逐组记录</h2>'+ (dates.length?dates.map(date=>`<details><summary>${date} · ${C.list(logs[date].exerciseEntries).length}个动作</summary>${C.list(logs[date].exerciseEntries).map(e=>`<button class="btn-outline" data-te="edit-entry" data-date="${date}" data-id="${e.id}">${esc(e.displayNameSnapshot)} · ${C.projection(e).groups}正式组${e.reconciliationState==='needs_confirmation'?' · 计划待核对':''}${e.sets.some(s=>s.conflictVersions)?' · 同步冲突':''}</button>`).join('')}</details>`).join(''):'<div class="te-note">还没有保存逐组记录，旧训练日志继续显示在原来的日历中。</div>');
  }
  function showDay(date){
    const log=getDailyLogs()[date],data=C.stats({[date]:log||{}},lib(),{from:date,to:date});
    openSheet(`<h2>${date} 训练记录</h2>`,`${data.rows.map(r=>`<div class="te-record-row"><span>${esc(r.name)}${r.phase==='warmup'?' · 热身':''}</span><b>${r.reps??r.seconds??'量未详'}${r.reps!==null&&r.reps!==undefined?'次':r.seconds!==null&&r.seconds!==undefined?'秒':''}</b></div>`).join('')||'<div class="te-empty">当天没有已保存训练记录。</div>'}${C.list(log?.exerciseEntries).map(e=>`<button class="btn-outline full" data-te="edit-entry" data-date="${date}" data-id="${e.id}">编辑 ${esc(e.displayNameSnapshot)}</button>`).join('')}`,`<button class="btn-outline" data-te="close">关闭</button><button class="btn" data-te="day-add" data-date="${date}">补记动作</button>`);
  }
  function openSheet(head,body,foot){
    const overlay=$('te-overlay');if(!overlay)return;
    const wasOpen=!overlay.hidden;
    if(!wasOpen){previousFocus=document.activeElement;document.body.dataset.teOldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
    overlay.hidden=false;overlay.querySelector('.te-sheet-head').innerHTML=head;overlay.querySelector('.te-sheet-body').innerHTML=body;overlay.querySelector('.te-sheet-foot').innerHTML=foot;
    if(!wasOpen)requestAnimationFrame(()=>overlay.querySelector('button,input,select')?.focus());
  }
  function closeSheet(){
    const overlay=$('te-overlay');if(!overlay||overlay.hidden)return;
    if(editor?.saved&&editor.original!==JSON.stringify(editor.entry)&&!confirm('放弃尚未保存的逐组修改？'))return;
    if(editor&&!editor.saved){try{storeEditorDraft();}catch(e){notify(e.message);return;}}
    overlay.hidden=true;document.body.style.overflow=document.body.dataset.teOldOverflow||'';editor=null;previousFocus?.focus?.();
  }
  function showGuide(a){
    const box=$('planGuideModalContent');if(!box)return;
    const names=keys=>C.list(keys).map(k=>C.REGIONS[k]||k).join('、')||'待分类';
    box.innerHTML=`<div class="te"><div class="te-kicker">EXERCISE LIBRARY</div><h2>${esc(a.displayName)}</h2><p class="te-note">${esc(a.englishName||'')}</p><div>${C.list(a.equipment).map(k=>`<span class="te-badge">${esc(equipmentNames[k]||k)}</span>`).join('')}<span class="te-badge">${a.recordingMode==='time'?'计时动作':'次数动作'}${a.laterality==='unilateral'?' · 分左右侧':''}</span></div>${a.media?.path?renderGuideMediaCard(a.media,{fallbackLabel:a.displayName}):'<div class="te-empty">暂无精确配图，请按下方文字步骤操作。</div>'}${a.media?.path&&a.mediaMatch!=='exact'?'<p class="te-note">现有媒体为轨迹参考，具体变式以下方文字为准。</p>':''}<p>${esc(a.description||'')}</p><div class="softbox">主练：${esc(names(a.primaryMuscles))}<br>辅助：${esc(names(a.secondaryMuscles))}</div>${a.instructions?.length?`<ol class="te-guide-steps">${a.instructions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:`<div class="guide-diagram">${esc(a.guide?.diagram||'')}</div>`}<h3>动作提示与注意事项</h3><ul class="te-guide-steps">${C.list(a.guide?.cautions).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="te-note">别名：${esc(C.list(a.aliases).join('、'))}</p>${a.provenance?`<details class="te-source"><summary>来源与修订</summary><p>${esc(a.provenance.note||'本地中文审校')} · ${esc(a.provenance.checkedAt||'')}</p>${a.provenance.url?`<a href="${esc(a.provenance.url)}" target="_blank" rel="noopener noreferrer">查看动作来源</a>`:''}<p>${esc(a.provenance.commit||'')}<br>${esc(a.provenance.license||'')}</p></details>`:''}</div>`;
    $('planGuideModal').style.zIndex='10020';$('planGuideModal').style.display='flex';
  }
  function filterLibrary(actions){return actions.filter(a=>(!muscleFilter||C.list(a.primaryMuscles).includes(muscleFilter)||C.list(a.secondaryMuscles).includes(muscleFilter))&&(!equipmentFilter||C.list(a.equipment).includes(equipmentFilter))&&(!typeFilter||a.recordingMode===typeFilter||(typeFilter==='recovery'&&a.category==='recovery')));}
  function guardIntent(intent){
    if(!intent||intent.action!=='write'||intent.recordType!=='training_fact'||intent.sourceType==='set_records')return null;
    if(/另外|又做|再做|加做|新增|额外/.test(intent.originalText||intent.currentValue?.text||''))return null;
    const a=actionFor(intent.currentValue?.exerciseKey)||readExerciseLibraryAction(intent.currentValue?.exercise),date=intent.date||C.dayKey(new Date());if(!a)return null;
    const entries=C.list(getDailyLogs()[date]?.exerciseEntries).filter(e=>e.exerciseKey===a.exerciseKey&&C.activeSets(e).length);
    if(!entries.length)return null;
    const totals=entries.reduce((x,e)=>{const p=C.projection(e);x.groups+=p.groups;x.reps+=p.reps;return x;},{groups:0,reps:0});
    const v=intent.currentValue||{},same=(v.sets&&Number(v.sets)===totals.groups)||(!v.sets&&v.reps&&Number(v.reps)===totals.reps)||(!v.sets&&!v.reps&&intent.completedExplicit);
    const prompt=`${date} 的${a.displayName}已有 ${totals.groups} 组。这是在补充已有记录，还是另外新做的训练？修改旧组请打开“历史 → 已保存的逐组记录”；新增训练请明确说“额外”并给出数量。`;
    pushTrainingCaptureCard({kind:'warn',title:'已有逐组记录，未重复累计',message:prompt,canUndo:false,canModify:false});
    return {status:same?'duplicate':'pending_confirmation',reason:'existing_set_details',prompt,entryIds:entries.map(e=>e.id)};
  }
  function mount(){
    const plan=document.querySelector('#plan>.card');if(!plan)return;
    const map=document.createElement('div');map.id='te-plan-map';map.className='card te';plan.after(map);
    const record=document.createElement('div');record.id='te-session-card';record.className='card te';$('record').prepend(record);
    const history=$('history'),controls=document.createElement('div');controls.className='card te';controls.innerHTML='<div class="te-segment"><button data-te="history-mode" data-value="logs" aria-pressed="true">训练日志</button><button data-te="history-mode" data-value="stats" aria-pressed="false">训练统计</button></div>';history.prepend(controls);
    const stats=document.createElement('div');stats.id='te-statistics';stats.className='card te';stats.hidden=true;controls.after(stats);
    const saved=document.createElement('div');saved.id='te-saved-entries';saved.className='card te te-history-details';history.append(saved);
    const toolbar=document.createElement('div');toolbar.className='te te-toolbar';toolbar.innerHTML=`<label>肌群 <select id="te-library-muscle"><option value="">全部</option>${Object.entries(C.REGIONS).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label><label>器材 <select id="te-library-equipment"><option value="">全部</option>${Object.entries(equipmentNames).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label><label>类型 <select id="te-library-type"><option value="">全部</option><option value="reps">次数</option><option value="time">计时</option><option value="recovery">恢复活动</option></select></label>`;$('exerciseLibrarySearch').parentElement.after(toolbar);
    const overlay=document.createElement('div');overlay.id='te-overlay';overlay.className='te te-overlay';overlay.hidden=true;overlay.innerHTML='<div class="te-sheet" role="dialog" aria-modal="true" aria-label="训练记录"><div class="te-sheet-head"></div><div class="te-sheet-body"></div><div class="te-sheet-foot"></div></div>';document.body.append(overlay);
    renderPlanMap();refresh();
  }
  const originalRenderPlan=renderPlan;renderPlan=function(...args){const result=originalRenderPlan(...args);renderPlanMap();return result;};
  const originalRenderHistory=renderHistory;renderHistory=function(...args){const result=originalRenderHistory(...args);renderStats();renderSavedEntries();return result;};
  const originalSetSession=setTrainingSession;setTrainingSession=function(...args){const result=originalSetSession(...args);appState.load();renderSessionCard();return result;};
  const originalFinish=finishTrainingSession;finishTrainingSession=finishWithSets;
  const originalLibrary=renderExerciseLibrary;renderExerciseLibrary=function(...args){const result=originalLibrary(...args);refresh();return result;};
  window.TrainingEnhancements={refresh,filterLibrary,showGuide,guardIntent,openEditor,openPlan};
  document.addEventListener('input',event=>{
    try{if(event.target.matches('#te-overlay [data-field]'))updateRow(event.target);if(event.target.id==='te-picker-search')$('te-picker-action').innerHTML=pickerOptions(event.target.value);}catch(e){notify('草稿保存失败：'+e.message);}
  });
  document.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='te-range'){rangeKind=t.value;renderStats();}if(t.id==='te-from'){customFrom=t.value;renderStats();}if(t.id==='te-to'){customTo=t.value;renderStats();}
    if(t.id==='te-trend-key'){trendKey=t.value;renderStats();}if(t.id==='te-trend-metric'){trendMetric=t.value;renderStats();}
    if(t.id==='te-library-muscle')muscleFilter=t.value;if(t.id==='te-library-equipment')equipmentFilter=t.value;if(t.id==='te-library-type')typeFilter=t.value;if(t.id.startsWith('te-library-'))renderExerciseLibrary();
    if(t.id==='te-rest-auto')localStorage.setItem('gain-set-rest-auto',t.checked?'1':'0');
  });
  document.addEventListener('keydown',event=>{
    if($('te-overlay')?.hidden||$('planGuideModal')?.style.display==='flex')return;if(event.key==='Escape'){event.preventDefault();closeSheet();}
    if(event.key==='Tab'){const nodes=Array.from($('te-overlay').querySelectorAll('button,input,select,summary,a')).filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}}
  });
  document.addEventListener('click',event=>{
    const muscle=event.target.closest('[data-muscle]');if(muscle){event.preventDefault();selectMuscle(muscle.dataset.muscle);return;}
    const b=event.target.closest('[data-te]');if(!b)return;event.preventDefault();event.stopPropagation();
    try{
      const cmd=b.dataset.te;
      if(cmd==='flip'){back=!back;refresh();}if(cmd==='plan-mode'){planActual=b.dataset.value==='actual';renderPlanMap();}
      if(cmd==='history-mode'){const on=b.dataset.value==='stats';$('te-statistics').hidden=!on;const parent=b.closest('.te-segment');parent.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));for(const child of $('history').children)if(child!==parent.closest('.card')&&child.id!=='te-statistics'&&child.id!=='te-saved-entries')child.hidden=on;}
      if(cmd==='open-plan')openPlan(Number(b.dataset.day),b.dataset.text);
      if(cmd==='bound-action'){storeEditorDraft();const action=blockContext?.actions.find(a=>a.exerciseKey===b.dataset.key);if(action)openBoundPlanAction(action);}
      if(cmd==='add-exercise')openPicker(getTrainingSession()?.date||C.dayKey(new Date()));
      if(cmd==='day-add')openPicker(b.dataset.date);
      if(cmd==='picker-add'){
        const date=$('te-picker-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('请选择有效日期');
        const a=actionFor($('te-picker-action').value);if(!a)throw new Error('请选择动作');
        const session=ensureSession(Number(b.dataset.day),date),entry=makeEntry(a,date);if(pickerContext?.date===date)Object.assign(entry,pickerContext);session.setEntries.push(entry);setTrainingSession(session);openEditor(entry,date,false);
      }
      if(cmd==='draft-entry'){const s=getTrainingSession(),e=s.setEntries.find(e=>e.id===b.dataset.id);openEditor(e,s.date,false);}
      if(cmd==='edit-entry'){const e=getDailyLogs()[b.dataset.date]?.exerciseEntries.find(e=>e.id===b.dataset.id);if(e)openEditor(e,b.dataset.date,true);}
      if(cmd==='add-set'){editor.entry.sets.push({id:C.uid('set'),revisionId:C.uid('rev'),revision:1,status:'pending',phase:editor.entry.defaultPhase||'work',updatedAt:new Date().toISOString()});storeEditorDraft();renderEditor();}
      if(cmd==='complete-set'){
        const s=editor.entry.sets.find(s=>s.id===b.dataset.id);if(s.status==='completed')return;
        const result=C.validateSet(s,editor.entry.mode,editor.entry.laterality);if(!result.ok)throw new Error(result.errors.join('；'));
        Object.assign(s,C.editSet(s,{...result.set,status:'completed'}));storeEditorDraft();
        if(localStorage.getItem('gain-set-rest-auto')==='1'){const btn=$('timerStartBtn')||$('portableTimerStartBtn');if(btn)btn.click();}
        renderEditor();
      }
      if(cmd==='delete-set'){const s=editor.entry.sets.find(s=>s.id===b.dataset.id);Object.assign(s,C.editSet(s,{deletedAt:new Date().toISOString()}));storeEditorDraft();renderEditor();}
      if(cmd==='undo-delete'){const s=[...editor.entry.sets].reverse().find(s=>s.deletedAt&&!s.conflictVersions);if(s)Object.assign(s,C.editSet(s,{deletedAt:null}));storeEditorDraft();renderEditor();}
      if(cmd==='copy-set'){const s=editor.entry.sets.find(s=>s.id===b.dataset.id);editor.entry.sets.push({...C.copy(s),id:C.uid('set'),revisionId:C.uid('rev'),revision:1,baseRevisionId:null,status:'pending',deletedAt:null});storeEditorDraft();renderEditor();}
      if(cmd==='toggle-load'){editor.entry.showLoad=!editor.entry.showLoad;storeEditorDraft();renderEditor();}
      if(cmd==='legacy-choice'){editor.entry.legacyChoice=b.dataset.value;storeEditorDraft();renderEditor();}
      if(cmd==='finish')finishWithSets();
      if(cmd==='save-edit'){const pending=saveEntries([editor.entry],editor.date),date=editor.date;editor=null;closeSheet();if(pending.some(e=>e.reconciliationState==='needs_confirmation'))showPending(pending,date);}
      if(cmd==='accept-dose'){const e=C.copy(getDailyLogs()[b.dataset.date].exerciseEntries.find(e=>e.id===b.dataset.id));e.acceptActualDose=true;saveEntries([e],b.dataset.date);closeSheet();}
      if(cmd==='resolve'){
        const s=editor.entry.sets.find(s=>s.id===b.dataset.id),chosen=C.copy(s.conflictVersions[Number(b.dataset.version)]),ids=s.conflictVersions.map(v=>v.revisionId);
        Object.assign(s,C.editSet(s,chosen),{id:s.id,revisionId:C.uid('rev'),resolvedRevisionIds:ids,conflictResolvedAt:new Date().toISOString()});delete s.conflictVersions;renderEditor();
      }
      if(cmd==='discard'){if(confirm('放弃未保存的逐组草稿？以前已保存的训练不会删除。'))finishWithSets({save:false});}
      if(cmd==='close')closeSheet();
      if(cmd==='guide')openExerciseLibraryGuideModal(b.dataset.key);
      if(cmd==='trace'){if(b.dataset.date&&getDailyLogs()[b.dataset.date])showDay(b.dataset.date);else openExerciseLibraryGuideModal(b.dataset.key);}
      if(cmd==='day')showDay(b.dataset.date);
      if(cmd==='export-data')download('training-backup-'+C.dayKey(new Date())+'.json',getLocalSnapshot());
      if(cmd==='export-before'){
        const backup=JSON.parse(localStorage.getItem('gain-training-v3-backup')||'null');if(!backup?.values)throw new Error('没有可用的升级前备份');
        const values={...backup.values},storage={getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>delete values[k]};
        download('training-before-upgrade.json',createAppState({storage}).exportSnapshot());
      }
    }catch(e){notify(e.message);}
  },true);
  document.addEventListener('keydown',event=>{const m=event.target.closest('[data-muscle]');if(m&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectMuscle(m.dataset.muscle);}});
  mount();
})();
