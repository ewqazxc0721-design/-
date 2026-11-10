# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image
import hashlib,json

root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'训练动作库/media-manifest.json').read_text(encoding='utf-8'))
errors=[]
def animation_info(path):
    im=Image.open(path);durations=[]
    for index in range(im.n_frames):
        im.seek(index);im.load();durations.append(im.info.get('duration',0))
    return im.size,im.n_frames,sum(durations),int(im.info.get('loop',0))
for source,asset in manifest['assets'].items():
    before=animation_info(root/source);after=animation_info(root/asset['animation'])
    if before[0]!=after[0] or before[2:]!=after[2:]:errors.append({'source':source,'before':before,'after':after})
    if before[1]>1 and after[1]<=1:errors.append({'source':source,'error':'animation lost'})
    if hashlib.sha256((root/source).read_bytes()).hexdigest()!=asset['sourceSha256']:errors.append({'source':source,'error':'original changed'})
assets=list(manifest['assets'].values());original=sum(a['sourceBytes'] for a in assets);optimized=sum(a['animationBytes'] for a in assets)
receipt_path=root/'media-review/2026-11-10/approval-receipt.json'
approved=json.loads(receipt_path.read_text(encoding='utf-8'))['samples'] if receipt_path.exists() else []
report={'date':'2026-11-10','files':len(assets),'animatedFiles':sum(a['frames']>1 for a in assets),'stillImages':sum(a['frames']==1 for a in assets),'originalBytes':original,'optimizedBytes':optimized,'posterBytes':sum(a['posterBytes'] for a in assets),'reductionPercent':round((1-optimized/original)*100,1),'dimensionsTimingAndLoopErrors':errors,'newExerciseAssociationsChanged':bool(approved),'aiCandidatesApproved':any(s['kind']=='ai-generated' for s in approved)}
(root/'docs/exercise-media-performance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if errors:raise SystemExit(1)
