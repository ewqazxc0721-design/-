# -*- coding: utf-8 -*-
"""Validate the user's exact batch approval before importing candidate animations."""
from pathlib import Path
import argparse,hashlib,json,shutil
from media_review_common import review_fingerprint

ROOT=Path(__file__).resolve().parents[2]
BATCH='2026-11-10-batch-2'

def validate(root=ROOT):
    folder=root/'media-review'/BATCH
    feedback=json.loads((folder/'user-feedback.json').read_text(encoding='utf-8'))
    review=json.loads((folder/'review.json').read_text(encoding='utf-8'))
    catalogue=json.loads((root/'训练动作库/actions.json').read_text(encoding='utf-8'))
    samples=review['samples'];ids={s['id'] for s in samples}
    if len(samples)!=40 or len(ids)!=40:raise ValueError('Expected 40 unique reviewed actions')
    if feedback.get('source') not in ('local_review_page','user_chat') or feedback.get('reviewId')!=BATCH or feedback.get('date')!='2026-11-10':raise ValueError('Explicit user review required')
    if set(feedback.get('decisions',{}))!=ids or any(v!='approve' for v in feedback['decisions'].values()):raise ValueError('All 40 samples need user approval before importing this batch')
    if feedback.get('assetHashes')!={s['id']:review_fingerprint(s) for s in samples}:raise ValueError('Approval refers to different animation files; review again')
    by_key={a['exerciseKey']:a for a in catalogue['actions']}
    for s in samples:
        if s['exerciseKey'] not in by_key:raise ValueError('Unknown exercise')
        for name,hash_key in [('gif','gifSha256'),('webp','webpSha256'),('poster','posterSha256')]:
            source=(folder/s[name]).resolve()
            if source.parent!=folder.resolve() or hashlib.sha256(source.read_bytes()).hexdigest()!=s[hash_key]:raise ValueError('Candidate changed after review: '+s['id'])
        target=root/'gifs'/('ai_'+s['exerciseKey'].removeprefix('opengym-')+'_20261110_v'+str(s['revision'])+'.gif')
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=s['gifSha256']:raise ValueError('Existing media differs: '+s['id'])
        existing=(by_key[s['exerciseKey']].get('media') or {}).get('path')
        if existing and existing!=target.relative_to(root).as_posix():raise ValueError('Refusing to replace another existing exercise media association')
    return folder,feedback,catalogue,samples,by_key

def apply(root=ROOT,check_only=False):
    folder,feedback,catalogue,samples,by_key=validate(root)
    if check_only:return {'approved':len(samples),'imported':False}
    receipt={'date':'2026-11-10','source':feedback['source'],'reviewId':BATCH,'receivedAt':feedback['receivedAt'],'decisions':feedback['decisions'],'samples':[],'published':False}
    for s in samples:
        target=root/'gifs'/('ai_'+s['exerciseKey'].removeprefix('opengym-')+'_20261110_v'+str(s['revision'])+'.gif')
        if not target.exists():shutil.copy2(folder/s['gif'],target)
        media_path=target.relative_to(root).as_posix()
        receipt['samples'].append({'sampleId':s['id'],'exerciseKey':s['exerciseKey'],'path':media_path,'sourceSha256':s['gifSha256'],'reviewSha256':review_fingerprint(s),'decision':'approve','kind':'ai-generated'})
        action=by_key[s['exerciseKey']]
        action['media']={'path':media_path,'label':s['name']+' · 肌群高亮','note':'AI 生成动作示意。深红为主要肌群，浅红为辅助肌群；颜色不表示发力强度，播放速度不代表训练节奏。动作要点以文字说明为准。','sourceLabel':'用户审核通过的 AI 动图','reviewSampleId':s['id'],'approvalStatus':'approved','approvalReceipt':'media-review/'+BATCH+'/approval-receipt.json'}
        action['mediaMatch']='exact'
    def write_json(file,value):
        tmp=file.with_suffix('.json.tmp');tmp.write_bytes((json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8'));tmp.replace(file)
    write_json(folder/'approval-receipt.json',receipt)
    catalogue['mediaRevision']='2026-11-10-approved-batch-2'
    write_json(root/'训练动作库/actions.json',catalogue)
    return {'approved':len(samples),'missing':sum(not (a.get('media') or {}).get('path') for a in catalogue['actions']),'imported':True,'published':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check-only',action='store_true');args=parser.parse_args()
    try:print(json.dumps(apply(check_only=args.check_only)))
    except (ValueError,OSError,KeyError) as error:raise SystemExit(str(error))
