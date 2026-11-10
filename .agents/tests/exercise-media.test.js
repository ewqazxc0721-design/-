const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../../exercise-media.js'),root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/media-manifest.json'),'utf8'));
const batchReceiptPath=path.join(root,'media-review/2026-11-10-batch-2/approval-receipt.json');
const batchApproved=fs.existsSync(batchReceiptPath)?JSON.parse(fs.readFileSync(batchReceiptPath,'utf8')).samples:[];
test('media rendering stages the poster without eagerly fetching animations',()=>{
 const html=M.render({path:'gifs/a.gif',label:'<img onerror=bad>'});
 assert.match(html,/data-exercise-media="gifs\/a.gif"/);assert.doesNotMatch(html,/src="gifs\/a.gif"/);assert.doesNotMatch(html,/<img onerror/);assert.match(html,/&lt;img/);
});
test('reduced motion and data saving require deliberate animation playback',()=>{
 assert.equal(M.shouldAutoPlay({saveData:true}),false);assert.equal(M.shouldAutoPlay({reducedMotion:true}),false);assert.equal(M.shouldAutoPlay({}),true);
});
test('optimized manifest preserves originals and only selects smaller animated files',()=>{
 assert.ok([0,40].includes(batchApproved.length));assert.equal(Object.keys(manifest.assets).length,57+batchApproved.length);let before=0,after=0;
 for(const [key,a] of Object.entries(manifest.assets)){
  assert.equal(a.fallback,key);assert.ok(fs.existsSync(path.join(root,a.poster)));assert.equal(fs.statSync(path.join(root,a.animation)).size,a.animationBytes);assert.ok(a.animationBytes<=a.sourceBytes);assert.ok(a.frames>=1&&a.durationMs>=0);assert.ok(a.sourceSha256.length===64);before+=a.sourceBytes;after+=a.animationBytes;
 }
 assert.ok(after<before*.6,'media payload decreases materially');assert.equal(M.assetFor('./gifs/0662.gif',manifest),manifest.assets['gifs/0662.gif']);
});
test('unapproved candidates remain separate from production exercise associations',()=>{
 const catalogue=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/actions.json'),'utf8')).actions;
 assert.equal(catalogue.filter(a=>!a.media?.path).length,40-batchApproved.length);
 assert.ok(catalogue.every(a=>!String(a.media?.path||'').includes('media-review')));
 const review=JSON.parse(fs.readFileSync(path.join(root,'media-review/2026-11-10/review.json'),'utf8'));assert.equal(review.approved,true);assert.equal(review.samples.find(s=>s.id==='ai-knee').status,'rejected');
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'media-review/2026-11-10/approval-receipt.json'),'utf8'));
 assert.deepEqual(receipt.samples.map(s=>s.sampleId).sort(),['ai-knee-v2','existing-bench','existing-knee']);
 for(const a of catalogue.filter(a=>a.media?.reviewSampleId))for(const media of [a.media,...(a.media.variants||[])]){
  const approval=[...receipt.samples,...batchApproved].find(s=>s.sampleId===media.reviewSampleId&&s.exerciseKey===a.exerciseKey&&s.path===media.path);assert.ok(approval);assert.equal(approval.decision,'approve');assert.equal(media.approvalStatus,'approved');
 }
 assert.ok(catalogue.every(a=>!JSON.stringify(a.media||{}).includes('ai-draft')));
});
test('approved alternative images are selected without eagerly loading both animations',()=>{
 const catalogue=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/actions.json'),'utf8')).actions,knee=catalogue.find(a=>a.exerciseKey==='opengym-3211');
 const html=M.render(knee.media);assert.match(html,/AI 肌群高亮/);assert.match(html,/原素材/);assert.equal((html.match(/data-exercise-media="/g)||[]).length,1);assert.equal((html.match(/data-exercise-media-choice=/g)||[]).length,2);assert.doesNotMatch(html,/src="gifs\//);
 const blocked=M.render({...knee.media,variants:[{path:'gifs/unreviewed.gif',approvalStatus:'pending'}]});assert.doesNotMatch(blocked,/unreviewed/);
});
function worker(initial={},failWrites=false,{offline=false}={}){
 const stores=new Map(Object.entries(initial).map(([name,map])=>[name,new Map(Object.entries(map))])),handlers={},counts={network:0,claimed:0};
 const k=request=>typeof request==='string'?request:request.url;
 const caches={keys:async()=>Array.from(stores.keys()),delete:async name=>stores.delete(name),match:async request=>{for(const map of stores.values()){const response=map.get(k(request));if(response)return response.clone();}},open:async name=>{if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {keys:async()=>Array.from(map.keys()).map(url=>({url})),match:async request=>map.get(k(request)),put:async(request,response)=>{if(failWrites)throw new Error('quota');map.set(k(request),response);},addAll:async()=>{}};}};
 const self={location:{origin:'https://fitness.test'},clients:{claim:async()=>{counts.claimed++;}},addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self,caches,URL,Response,fetch:async()=>{counts.network++;if(offline)throw new Error('offline');return new Response('new animation',{status:200});}});
 return {handlers,stores,counts};
}
test('cached animations are reused without a background network request',async()=>{
 const url='https://fitness.test/-/gifs/optimized/test.webp',w=worker({'gain-exercise-media-v1':{[url]:new Response('cached animation')}});let result;
 w.handlers.fetch({request:{url,method:'GET',destination:'image'},respondWith:value=>{result=value;}});
 assert.equal(await (await result).text(),'cached animation');assert.equal(w.counts.network,0);
});
test('core cache upgrades migrate and retain previously downloaded exercise media',async()=>{
 const url='https://fitness.test/-/gifs/0662.gif',w=worker({'old-app-cache':{[url]:new Response('existing media')}});let done;
 w.handlers.activate({waitUntil:value=>{done=value;}});await done;
 assert.equal(w.stores.has('old-app-cache'),false);assert.equal(await w.stores.get('gain-exercise-media-v1').get(url).text(),'existing media');
});
test('cache quota failure still displays the successfully downloaded animation',async()=>{
 const url='https://fitness.test/-/gifs/optimized/new.webp',w=worker({},true);let result;
 w.handlers.fetch({request:{url,method:'GET',destination:'image'},respondWith:value=>{result=value;}});
 assert.equal(await (await result).text(),'new animation');assert.equal(w.counts.network,1);
});

test('cache quota during upgrade retains original media and still activates',async()=>{
 const url='https://fitness.test/-/gifs/existing.gif',w=worker({'old-app-cache':{[url]:new Response('original')}},true);let done;
 w.handlers.activate({waitUntil:value=>{done=value;}});await done;
 assert.equal(w.counts.claimed,1);assert.equal(w.stores.has('old-app-cache'),true);assert.equal(await w.stores.get('old-app-cache').get(url).text(),'original');
});

test('media retained after a failed cache migration remains available offline',async()=>{
 const url='https://fitness.test/-/gifs/existing.gif',w=worker({'old-app-cache':{[url]:new Response('original')}},true,{offline:true});let done,result;
 w.handlers.activate({waitUntil:value=>{done=value;}});await done;
 w.handlers.fetch({request:{url,method:'GET',destination:'image'},respondWith:value=>{result=value;}});
 assert.equal(await (await result).text(),'original');assert.equal(w.counts.network,0);assert.equal(w.counts.claimed,1);
});

test('tab resume only restarts visible animations and hidden observer events cannot play',async()=>{
 let intersect;const listeners={},boxes=[0,1].map(i=>{
  const element=()=>({hidden:false,style:{},setAttribute(){},removeAttribute(name){delete this[name];}});
  const children={'.exercise-media-poster':element(),'.exercise-media-animation':element(),'.exercise-media-toggle':element(),'.exercise-media-placeholder':element(),'.exercise-media-stage':element()};
  return {dataset:{exerciseMedia:`gifs/${i}.gif`},isConnected:true,querySelector:selector=>children[selector],getClientRects:()=>[{}],getBoundingClientRect:()=>({width:360,height:360,top:i?2000:0,bottom:i?2360:360,left:0,right:360})};
 });
 const doc={readyState:'complete',hidden:false,body:{},querySelectorAll:()=>boxes,addEventListener:(name,callback)=>{listeners[name]=callback;}};
 const win={document:doc,navigator:{},innerWidth:500,innerHeight:800,matchMedia:()=>({matches:false}),fetch:async()=>({ok:true,json:async()=>({assets:{}})}),MutationObserver:class{observe(){}},IntersectionObserver:class{constructor(callback){intersect=callback;}observe(){}unobserve(){}}};
 M.mount(win);await new Promise(resolve=>setImmediate(resolve));
 intersect([{target:boxes[0],isIntersecting:true},{target:boxes[1],isIntersecting:false}]);
 assert.equal(boxes[0].querySelector('.exercise-media-animation').src,'gifs/0.gif');
 doc.hidden=true;listeners.visibilitychange();assert.equal(boxes[0].querySelector('.exercise-media-animation').src,undefined);
 intersect([{target:boxes[0],isIntersecting:true}]);assert.equal(boxes[0].querySelector('.exercise-media-animation').src,undefined);
 doc.hidden=false;listeners.visibilitychange();assert.equal(boxes[0].querySelector('.exercise-media-animation').src,'gifs/0.gif');assert.equal(boxes[1].querySelector('.exercise-media-animation').src,undefined);
});
