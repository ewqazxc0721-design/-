const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function audit(){
 const data=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/actions.json'),'utf8'));
 const regions=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/muscle-regions.json'),'utf8')).regions;
 const raw=JSON.parse(fs.readFileSync(path.join(root,'训练动作库/upstream-opengym.json'),'utf8'));
 const keys=new Set(),errors=[],aliases=new Map();
 for(const a of data.actions){
  if(keys.has(a.exerciseKey))errors.push('重复键 '+a.exerciseKey);keys.add(a.exerciseKey);
  if(!a.displayName||!a.instructions?.length||!a.guide?.diagram)errors.push('缺少说明 '+a.exerciseKey);
  if(!['reps','time'].includes(a.recordingMode))errors.push('未知计量 '+a.exerciseKey);
  for(const k of [...a.primaryMuscles,...a.secondaryMuscles])if(!regions[k])errors.push('未知肌群 '+a.exerciseKey+':'+k);
  if(a.media?.path&&!fs.existsSync(path.join(root,a.media.path)))errors.push('缺少媒体 '+a.exerciseKey);
  if(a.exerciseKey.startsWith('opengym-')){
   const id=a.provenance.upstreamId,source=raw.exercises[id];
   if(!source||source.name!==a.englishName||a.provenance.commit!==raw.commit)errors.push('上游身份不匹配 '+a.exerciseKey);
   if(a.media)errors.push('不应导入上游媒体 '+a.exerciseKey);
  }
  for(const alias of a.aliases||[]){const l=aliases.get(alias)||[];l.push(a.exerciseKey);aliases.set(alias,l);}
  if(JSON.stringify(a).includes('\uFFFD'))errors.push('无效编码 '+a.exerciseKey);
 }
 if(errors.length)throw new Error(errors.join('\n'));
 const ambiguities=Array.from(aliases).filter(([,keys])=>new Set(keys).size>1);
 console.log(`动作库检查通过：${keys.size} 条；${data.actions.filter(a=>a.exerciseKey.startsWith('opengym-')).length} 条上游新增；${ambiguities.length} 个精确别名需保留歧义处理。`);
 return {data,ambiguities};
}
if(require.main===module){try{audit();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={audit};
