/* Visual plan editor; retains the JSON import/export boundary. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=escapeHtml;
  const drafts=new Map();let current=null,search='',muscle='';
  const fields=['planDayNameEdit','planFocusEdit','planProteinEdit'];
  const signature=day=>JSON.stringify([day.day,day.focus,day.items,day.protein]);
  const library=()=>getExerciseLibrary();
  function capture(){if(!current)return;current.day=$('planDayNameEdit').value;current.focus=$('planFocusEdit').value;current.protein=$('planProteinEdit').value;}
  function dirty(){if(!current)return;capture();current.dirty=true;$('pe-status').textContent='有未保存的修改';}
  function setText(text,n){
    if(!Number.isInteger(n)||n<1||n>100)return text;
    return /\d+\s*组/.test(text)?text.replace(/\d+\s*组/,`${n}组`):`${text.trim()} ${n}组`;
  }
  function groups(text){const m=String(text).match(/(\d+)\s*组/);return m?Number(m[1]):'';}
  function preserveDraft(index){
    if(!current)return false;
    capture();drafts.set(current.index,current);
    return current.index===index&&current.dirty;
  }
  function load(){
    const day=getPlanDays()[activePlanDay];if(!day)return;
    const draft=drafts.get(activePlanDay);
    if(current?.index!==activePlanDay || (!current.dirty&&current.signature!==signature(day))){
      current=draft?.dirty?draft:{index:activePlanDay,signature:signature(day),day:day.day,focus:day.focus,protein:day.protein,scope:'week',dirty:false,rows:day.items.map((text,origin)=>({text,origin}))};
    }
    if(!current)current={index:activePlanDay,signature:signature(day),day:day.day,focus:day.focus,protein:day.protein,scope:'week',dirty:false,rows:day.items.map((text,origin)=>({text,origin}))};
    $('planDayNameEdit').value=current.day||'';$('planFocusEdit').value=current.focus||'';$('planProteinEdit').value=current.protein||'';
    render();
  }
  function render(){
    const host=$('visualPlanEditor');if(!host||!current)return;
    const regions=window.TrainingCore?.REGIONS||{};
    host.innerHTML=`<div class="pe-scope"><label for="pe-scope">保存范围</label><select id="pe-scope"><option value="week">仅本周当天</option><option value="template">本周当天 + 后续周模板</option></select><span>${esc(getDateForPlanDayInCurrentWeek(current.day,current.index))}</span></div>
      <p class="help">用 ↑ ↓ 调整项目顺序；组数单独修改，次数、时长和备注可直接在项目文字中修改。组合项目的组数仅修改第一处。</p>
      <ol id="pe-rows" class="pe-rows">${current.rows.map((row,i)=>`<li class="pe-row" data-row="${i}"><label class="pe-text"><span>项目 ${i+1}</span><textarea rows="2" aria-label="项目 ${i+1} 内容" data-text="${i}">${esc(row.text)}</textarea></label><label class="pe-sets"><span>组数</span><input type="number" min="1" max="100" step="1" aria-label="项目 ${i+1} 组数" data-sets="${i}" value="${groups(row.text)}" placeholder="未设" /></label><div class="pe-actions"><button type="button" class="btn-outline" data-move="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="上移项目 ${i+1}">↑</button><button type="button" class="btn-outline" data-move="${i}" data-direction="1" ${i===current.rows.length-1?'disabled':''} aria-label="下移项目 ${i+1}">↓</button><button type="button" class="btn-outline pe-remove" data-remove="${i}" aria-label="删除项目 ${i+1}">删除</button></div></li>`).join('')}</ol>
      ${current.rows.length?'':'<p class="softbox">当天暂无训练动作。可以作为休息日保存，或从下方动作库添加。</p>'}
      <div class="pe-picker"><h3>从训练动作库添加</h3><div class="pe-filters"><label>肌肉分布<select id="pe-muscle"><option value="">全部肌群</option>${Object.entries(regions).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('')}</select></label><label>搜索动作<input id="pe-search" type="search" placeholder="动作名称、别名或器械" value="${esc(search)}" /></label></div><p id="pe-result-count" class="help" aria-live="polite"></p><div id="pe-results" class="pe-results"></div></div>
      <div class="pe-footer"><button type="button" class="btn-outline" id="pe-restore">恢复当天周模板</button><button type="button" class="btn-outline" id="pe-discard">放弃未保存修改</button><span id="pe-status" role="status">${current.dirty?'有未保存的修改':'已载入当前生效计划'}</span></div>`;
    $('pe-scope').value=current.scope;$('pe-muscle').value=muscle;
    $('pe-scope').onchange=e=>{current.scope=e.target.value;dirty();};
    $('pe-search').oninput=e=>{search=e.target.value;renderLibrary();};
    $('pe-muscle').onchange=e=>{muscle=e.target.value;renderLibrary();};
    host.querySelectorAll('[data-text]').forEach(el=>el.oninput=()=>{const i=Number(el.dataset.text);current.rows[i].text=el.value;const input=host.querySelector(`[data-sets="${i}"]`);input.value=groups(el.value);dirty();});
    host.querySelectorAll('[data-sets]').forEach(el=>el.oninput=()=>{
      const n=Number(el.value),i=Number(el.dataset.sets);el.setCustomValidity(Number.isInteger(n)&&n>=1&&n<=100?'':'组数应为 1–100 的整数');
      if(!el.validity.valid){dirty();return;}
      current.rows[i].text=setText(current.rows[i].text,n);host.querySelector(`[data-text="${i}"]`).value=current.rows[i].text;dirty();
    });
    host.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{capture();current.rows.splice(Number(el.dataset.remove),1);dirty();render();});
    host.querySelectorAll('[data-move]').forEach(el=>el.onclick=()=>{capture();const i=Number(el.dataset.move),j=i+Number(el.dataset.direction);[current.rows[i],current.rows[j]]=[current.rows[j],current.rows[i]];dirty();render();});
    $('pe-restore').onclick=()=>{
      const day=getPlanTemplate().days[current.index];capture();current.rows=day.items.map(text=>({text,origin:getPlanDays()[current.index].items.indexOf(text)}));current.day=day.day;current.focus=day.focus;current.protein=day.protein;current.scope='week';current.dirty=true;
      $('planDayNameEdit').value=current.day;$('planFocusEdit').value=current.focus;$('planProteinEdit').value=current.protein;render();
    };
    $('pe-discard').onclick=()=>{drafts.delete(current.index);current=null;load();};
    renderLibrary();
  }
  function renderLibrary(){
    const regions=window.TrainingCore?.REGIONS||{},q=search.trim().toLowerCase();
    const results=library().filter(a=>(!muscle||[...(a.primaryMuscles||[]),...(a.secondaryMuscles||[])].includes(muscle))&&(!q||JSON.stringify([a.displayName,a.englishName,a.aliases,a.equipment]).toLowerCase().includes(q)));
    $('pe-result-count').textContent=`${results.length} 个动作${muscle?' · 包含主要及辅助参与肌群':''}`;
    $('pe-results').innerHTML=results.map(a=>`<div class="pe-result"><div><b>${esc(a.displayName)}</b><small>主要：${esc((a.primaryMuscles||[]).map(k=>regions[k]||k).join('、')||'未标注')}${muscle&&(a.secondaryMuscles||[]).includes(muscle)?' · 此肌群辅助参与':''}</small></div><button type="button" class="btn-outline" data-add-exercise="${esc(a.exerciseKey)}" aria-label="添加${esc(a.displayName)}">添加</button></div>`).join('')||'<p class="help">没有匹配的动作，请切换肌群或搜索词。</p>';
    $('pe-results').querySelectorAll('[data-add-exercise]').forEach(el=>el.onclick=()=>{
      const action=library().find(a=>a.exerciseKey===el.dataset.addExercise);capture();current.rows.push({text:`${action.displayName} 3组 × ${action.recordingMode==='time'?'30秒':'8–12次'}`,origin:-1});dirty();render();$('pe-status').textContent=`已添加${action.displayName}，保存后生效`;
    });
  }
  function save(){
    if(!current)return;capture();
    const invalid=$('visualPlanEditor').querySelector('input:invalid');if(invalid){invalid.reportValidity();return;}
    const day={day:current.day.trim()||`第${current.index+1}天`,focus:current.focus.trim(),protein:current.protein.trim(),items:current.rows.map(r=>r.text.trim())};
    if(day.items.some(t=>!t)){ $('pe-status').textContent='请补全空项目，或删除该项目后保存';return; }
    try{
      const saved=persistVisualPlanDay(current.index,day,current.scope,current.rows.map(r=>r.origin));
      const scope=current.scope;drafts.delete(current.index);current=null;
      $('planItemsEdit').value=saved.items.join('\n');renderPlan();updateSummary();load();
      $('pe-status').textContent=scope==='template'?'已保存本周当天，并更新后续周模板':'已保存，本周当天的动作和顺序持续生效';
    }catch(error){$('pe-status').textContent=`保存失败，修改仍保留：${error.message}`;}
  }
  window.PlanEditor={preserveDraft,save,refresh:load};
  fields.forEach(id=>$(id)?.addEventListener('input',dirty));
  const originalRender=renderPlan;renderPlan=function(...args){const result=originalRender(...args);load();return result;};
  const originalLibrary=renderExerciseLibrary;renderExerciseLibrary=function(...args){const result=originalLibrary(...args);if(current&&$('pe-results'))renderLibrary();return result;};
  $('savePlanDayBtn').onclick=save;
  window.addEventListener('beforeunload',e=>{if([...drafts.values(),current].some(d=>d?.dirty)){e.preventDefault();e.returnValue='';}});
  load();
})();
