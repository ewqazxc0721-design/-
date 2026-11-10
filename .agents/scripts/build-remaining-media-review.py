# -*- coding: utf-8 -*-
"""Build a review gallery from generated candidates; never approve or bind assets."""
from pathlib import Path
from PIL import Image
import json,hashlib
from media_review_common import review_fingerprint
root=Path(__file__).resolve().parents[2]
folder=root/'media-review/2026-11-10-batch-2'
jobs=json.loads((folder/'jobs.json').read_text(encoding='utf-8'))
samples=[]
for job in jobs:
    result=folder/(job['id']+'-result.json')
    if not result.exists():raise SystemExit('Missing candidate '+job['id'])
    item=json.loads(result.read_text(encoding='utf-8'))
    for key in ('gif','webp','poster'):
        with Image.open(folder/item[key]) as im:
            for i in range(getattr(im,'n_frames',1)):im.seek(i);im.load()
    item['gifSha256']=hashlib.sha256((folder/item['gif']).read_bytes()).hexdigest()
    item['webpSha256']=hashlib.sha256((folder/item['webp']).read_bytes()).hexdigest()
    item['posterSha256']=hashlib.sha256((folder/item['poster']).read_bytes()).hexdigest()
    item['reviewSha256']=review_fingerprint(item)
    item.pop('sourcePath',None)
    samples.append(item)
review={'date':'2026-11-10','reviewId':folder.name,'status':'pending_review','productionChanged':False,'samples':samples}
(folder/'review.json').write_bytes((json.dumps(review,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
for asset in ('index.html','review.js','review.css'):
    (folder/asset).write_bytes((root/'.agents/templates/remaining-media-review'/asset).read_bytes())
print(json.dumps({'samples':len(samples),'gifBytes':sum(s['gifInfo']['bytes'] for s in samples),'webpBytes':sum(s['webpInfo']['bytes'] for s in samples),'status':'pending_review'}))
