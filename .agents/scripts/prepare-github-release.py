# -*- coding: utf-8 -*-
"""Build an explicit release inventory against a previously fetched remote tree."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[2]
base=json.loads((root/'.scratch/release-base-tree.json').read_text(encoding='utf-8'))
remote={item['path']:item['sha'] for item in base['tree'] if item['type']=='blob'}
files={'index.html','index-liquid-glass-functional.html','training-core.js','training-ui.js','training-enhancements.css','exercise-media.js','exercise-media.css','sw.js','训练动作库/actions.json','训练动作库/media-manifest.json'}
for folder,patterns in {'.agents/scripts':['*.js','*.py'],'.agents/tests':['*.test.js'],'.agents/templates/remaining-media-review':['*.html','*.css','*.js']}.items():
    for pattern in patterns:files.update(p.relative_to(root).as_posix() for p in (root/folder).glob(pattern))
for batch in ('2026-11-10','2026-11-10-batch-2'):
    receipt=root/'media-review'/batch/'approval-receipt.json'
    if receipt.exists():files.add(receipt.relative_to(root).as_posix())
files.add('media-review/2026-11-10/review.json')
files.add('media-review/2026-11-10-batch-2/review.json')
manifest=json.loads((root/'训练动作库/media-manifest.json').read_text(encoding='utf-8'))
for source,asset in manifest['assets'].items():files.update([source,asset['animation'],asset['poster']])
files.update(['CHANGELOG.md','CONTEXT.md','docs/webapp-feature-coverage.json','docs/webapp-function-map.md','docs/exercise-media-review.md','docs/exercise-media-performance.json','docs/remaining-media-regression.json'])
files.update(['docs/all-approved-media-browser-report.json','docs/remaining-media-review-browser-report.json','docs/remaining-media-quick-sets-browser-report.json'])
changed=[]
for name in sorted(files):
    if any(part in name for part in ('node_modules','user-feedback','.scratch','revisions.json','jobs.json')):raise SystemExit('Excluded path '+name)
    source=root/name
    if not source.is_file():raise SystemExit('Missing release file '+name)
    data=source.read_bytes();sha=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    if remote.get(name)==sha:continue
    changed.append({'path':name,'sha':sha,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'existing':name in remote})
inventory={'baseHead':base['head'],'changed':changed,'files':len(changed),'bytes':sum(f['bytes'] for f in changed),'productionDataIncludesPendingMedia':False}
(root/'.scratch/github-release-inventory.json').write_bytes((json.dumps(inventory,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(json.dumps({'files':len(changed),'bytes':inventory['bytes'],'newFiles':sum(not f['existing'] for f in changed),'baseHead':base['head']}))
