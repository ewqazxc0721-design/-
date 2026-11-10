# -*- coding: utf-8 -*-
"""Integrate only the media choices received from the local user review page."""
from pathlib import Path
import hashlib,json,shutil

root=Path(__file__).resolve().parents[2]
folder=root/'media-review/2026-11-10'
feedback=json.loads((folder/'user-feedback.json').read_text(encoding='utf-8'))
decisions=feedback['decisions']
if feedback.get('source')!='local_review_page' or feedback.get('date')!='2026-11-10':
    raise SystemExit('A synchronized user review is required')
if decisions.get('ai-knee')=='approve':
    raise SystemExit('A1 still has known motion problems and must be revised before use')
paths={'ai-knee-v2':'gifs/ai_kneeling_pushup_20261110_v2.gif','existing-knee':'gifs/3211.gif','existing-bench':'gifs/0289.gif'}
review=json.loads((folder/'review.json').read_text(encoding='utf-8'))
approved=[s for s in review['samples'] if decisions.get(s['id'])=='approve' and s['id'] in paths]
if not approved:raise SystemExit('No supported approved samples')
receipt={'date':'2026-11-10','source':'local_review_page','receivedAt':feedback['receivedAt'],'decisions':decisions,'samples':[],'published':False}
for sample in approved:
    source=folder/sample['gif'];target=root/paths[sample['id']]
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=digest:
        raise SystemExit('Refusing to replace a different existing asset: '+str(target))
    if not target.exists():shutil.copy2(source,target)
    receipt['samples'].append({'sampleId':sample['id'],'exerciseKey':sample['exerciseKey'],'path':paths[sample['id']],'sourceSha256':digest,'decision':'approve','kind':'ai-generated' if sample.get('ai') else 'existing-local'})

def media(sample_id,label,note):
    return {'path':paths[sample_id],'label':label,'note':note,'sourceLabel':'用户审核通过的 AI 样片' if sample_id=='ai-knee-v2' else '用户审核通过的项目已有素材','reviewSampleId':sample_id,'approvalStatus':'approved','approvalReceipt':'media-review/2026-11-10/approval-receipt.json'}

catalogue_path=root/'训练动作库/actions.json'
catalogue=json.loads(catalogue_path.read_text(encoding='utf-8'))
by_key={a['exerciseKey']:a for a in catalogue['actions']}
if decisions.get('ai-knee-v2')=='approve':
    knee=media('ai-knee-v2','跪姿俯卧撑 · AI 肌群高亮','AI 生成动作示意。深红突出胸肌，浅红标示肱三头肌与肩前束；颜色仅表示肌群，不表示发力强度。动作要点以文字说明为准。')
    knee['variantLabel']='AI 肌群高亮'
    if decisions.get('existing-knee')=='approve':
        alternate=media('existing-knee','跪姿俯卧撑 · 原素材','项目已有跪姿俯卧撑动作图解，已由用户审核通过。')
        alternate['variantLabel']='原素材';knee['variants']=[alternate]
    by_key['opengym-3211']['media']=knee;by_key['opengym-3211']['mediaMatch']='exact'
elif decisions.get('existing-knee')=='approve':
    by_key['opengym-3211']['media']=media('existing-knee','跪姿俯卧撑','项目已有跪姿俯卧撑动作图解，已由用户审核通过。');by_key['opengym-3211']['mediaMatch']='exact'
if decisions.get('existing-bench')=='approve':
    by_key['opengym-0289']['media']=media('existing-bench','哑铃平板卧推','项目已有哑铃平板卧推动作图解，已由用户审核通过。');by_key['opengym-0289']['mediaMatch']='exact'
catalogue['mediaRevision']='2026-11-10-approved-batch-1'
catalogue_path.write_bytes((json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
(folder/'approval-receipt.json').write_bytes((json.dumps(receipt,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
review['approved']=True;review['approvalState']='approved_with_rejections';review['decisionReceivedAt']=feedback['receivedAt']
review['approvedSampleIds']=[s['id'] for s in approved]
review['rejectedSampleIds']=[key for key,value in decisions.items() if value=='reject']
review['userDirection']['decision']='use_approved_samples_only';review['userDirection']['productionImportApproved']=True
for sample in review['samples']:
    decision=decisions.get(sample['id']);sample['reviewDecision']=decision or 'pending'
    if decision=='approve':
        sample['source']=sample['source'].replace('；未入库、未发布。','；已通过审核并接入本地。')
        sample['status']='approved';sample['note']='已审核通过并接入本地动作库，尚未发布线上。'+('肌群高亮版与原素材版可在动作详情中切换。' if sample['exerciseKey']=='opengym-3211' else '')
    elif decision=='reject':sample['status']='rejected';sample['note']='用户选择不采用，保留审核记录，未接入动作库。'
(folder/'review.json').write_bytes((json.dumps(review,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
missing=[{'exerciseKey':a['exerciseKey'],'name':a['displayName'],'status':'not_prepared'} for a in catalogue['actions'] if not (a.get('media') or {}).get('path')]
(folder/'missing-actions.json').write_bytes((json.dumps(missing,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(json.dumps({'approved':review['approvedSampleIds'],'rejected':review['rejectedSampleIds'],'actionsWithMediaAdded':2,'remainingMissing':len(missing),'published':False},ensure_ascii=False))
