/* Local exercise images. Only reviewed AI imagery is assigned to production actions. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document){root.ExerciseMedia=api;api.mount(root);}
})(typeof window==='object'?window:null,function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=path=>String(path||'').replace(/^\.\//,'');
  function assetFor(path,manifest){return manifest?.assets?.[key(path)]||null;}
  function shouldAutoPlay({saveData=false,reducedMotion=false}={}){return !saveData&&!reducedMotion;}
  function renderSingle(media,options={}){
    const path=media?.path||(media?.gif?'gifs/'+media.gif:'');if(!path)return '';
    const label=media.label||options.fallbackLabel||'动作演示';
    return `<figure class="exercise-media-card" data-exercise-media="${escape(path)}"><div class="exercise-media-stage"><img class="exercise-media-poster" alt="${escape(label)} 起始姿势" decoding="async" loading="lazy"/><img class="exercise-media-animation" alt="${escape(label)} 动作演示" decoding="async" hidden/><div class="exercise-media-placeholder" role="status">正在准备动作图…</div></div><figcaption><div class="exercise-media-caption"><strong>${escape(label)}</strong><button type="button" class="exercise-media-toggle" aria-pressed="false" disabled>加载中</button></div><p>${escape(media.note||options.defaultNote||'本地动作轨迹演示。')}</p>${media.sourceUrl?`<a href="${escape(media.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(media.sourceLabel||'素材来源')}</a>`:''}</figcaption></figure>`;
  }
  function render(media,options={}){
    const variants=Array.isArray(media?.variants)?media.variants.filter(v=>v?.path&&v.approvalStatus==='approved'):[];
    if(!variants.length)return renderSingle(media,options);
    const choices=[media,...variants];
    return `<section class="exercise-media-versions"><div class="exercise-media-choices" role="group" aria-label="图解版本">${choices.map((v,i)=>`<button type="button" data-exercise-media-choice="${escape(v.path)}" data-label="${escape(v.label||options.fallbackLabel||'动作演示')}" data-note="${escape(v.note||'')}" data-source-url="${escape(v.sourceUrl||'')}" data-source-label="${escape(v.sourceLabel||'')}" aria-pressed="${i===0}">${escape(v.variantLabel||v.label||'动作图解')}</button>`).join('')}</div><div class="exercise-media-slot">${renderSingle(media,options)}</div></section>`;
  }
  function mount(win){
    const doc=win.document,states=new WeakMap();let assets={},ready=false;
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    function pause(box){const s=states.get(box);if(!s)return;s.playing=false;s.generation++;s.animation.removeAttribute('src');s.animation.hidden=true;s.poster.hidden=false;s.button.textContent=s.still?'静态图解':'播放动图';s.button.setAttribute('aria-pressed','false');}
    function play(box){
      const s=states.get(box);if(!s||s.playing||doc.hidden)return;s.playing=true;s.fallbackTried=false;const generation=++s.generation;
      s.button.textContent='载入动图';s.button.setAttribute('aria-pressed','true');
      const show=()=>{if(generation!==s.generation)return;s.animation.hidden=false;s.poster.hidden=true;s.placeholder.hidden=true;s.button.textContent='暂停动图';};
      s.animation.onload=show;
      s.animation.onerror=()=>{
        if(generation!==s.generation)return;
        if(!s.fallbackTried&&s.asset.animation!==s.asset.fallback){s.fallbackTried=true;s.animation.src=s.asset.fallback;return;}
        pause(box);s.placeholder.hidden=true;s.button.textContent='重试动图';s.poster.hidden=false;
      };
      s.animation.src=s.asset.animation;
    }
    const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>entries.forEach(entry=>{
      const s=states.get(entry.target);if(s)s.inView=entry.isIntersecting;
      if(entry.isIntersecting){if(s?.auto)play(entry.target);}
      else pause(entry.target);
    }),{rootMargin:'0px',threshold:.05}):null;
    function hydrate(){
      if(!ready)return;
      doc.querySelectorAll('[data-exercise-media]').forEach(box=>{
        if(states.has(box))return;
        const path=key(box.dataset.exerciseMedia),asset=assetFor(path,{assets})||{animation:path,poster:path,fallback:path,width:360,height:360};
        const poster=box.querySelector('.exercise-media-poster'),animation=box.querySelector('.exercise-media-animation'),button=box.querySelector('.exercise-media-toggle'),placeholder=box.querySelector('.exercise-media-placeholder');
        if(!poster||!animation||!button)return;
        const still=Number(asset.frames)===1||/\.(?:png|jpe?g|svg)(?:[?#]|$)/i.test(path);
        const auto=!still&&shouldAutoPlay({saveData:!!win.navigator.connection?.saveData,reducedMotion:!!reduced?.matches});
        const s={asset,poster,animation,button,placeholder,auto,still,inView:false,playing:false,generation:0,fallbackTried:false};states.set(box,s);
        box.querySelector('.exercise-media-stage').style.aspectRatio=`${asset.width||360} / ${asset.height||360}`;
        for(const image of [poster,animation]){image.width=asset.width||360;image.height=asset.height||360;}
        poster.onload=()=>{placeholder.hidden=true;};poster.onerror=()=>{placeholder.textContent='预览暂不可用，可点击播放动图';};
        poster.src=asset.poster;button.disabled=still;button.textContent=still?'静态图解':'播放动图';button.onclick=event=>{event.preventDefault();event.stopPropagation();s.auto=!s.playing;s.playing?pause(box):play(box);};
        if(observer)observer.observe(box);else if(auto&&inViewport(box))play(box);
      });
      // Removed dialogs must release their animation URL and observer registration.
    }
    const tracked=new Set();
    function refresh(){
      for(const box of tracked)if(!box.isConnected){pause(box);observer?.unobserve(box);tracked.delete(box);}
      hydrate();doc.querySelectorAll('[data-exercise-media]').forEach(box=>tracked.add(box));
    }
    const start=()=>{
      new win.MutationObserver(refresh).observe(doc.body,{childList:true,subtree:true});
      doc.addEventListener('click',event=>{
        const choice=event.target.closest('[data-exercise-media-choice]');if(!choice)return;
        event.preventDefault();event.stopPropagation();if(choice.getAttribute('aria-pressed')==='true')return;
        const root=choice.closest('.exercise-media-versions'),slot=root?.querySelector('.exercise-media-slot');if(!slot)return;
        slot.querySelectorAll('[data-exercise-media]').forEach(box=>{pause(box);observer?.unobserve(box);tracked.delete(box);});
        root.querySelectorAll('[data-exercise-media-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button===choice)));
        slot.innerHTML=renderSingle({path:choice.dataset.exerciseMediaChoice,label:choice.dataset.label,note:choice.dataset.note,sourceUrl:choice.dataset.sourceUrl,sourceLabel:choice.dataset.sourceLabel});
        refresh();
      });
      win.fetch('./训练动作库/media-manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error('manifest'))).then(data=>{assets=data.assets||{};}).catch(()=>{assets={};}).finally(()=>{ready=true;refresh();});
      doc.addEventListener('visibilitychange',()=>{if(doc.hidden){for(const box of tracked)pause(box);}else{for(const box of tracked){const s=states.get(box);if(s?.auto&&(observer?s.inView:inViewport(box)))play(box);}}});
    };
    function inViewport(box){const rect=box.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<win.innerHeight&&rect.left<win.innerWidth;}
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
  return {assetFor,shouldAutoPlay,render,mount};
});
