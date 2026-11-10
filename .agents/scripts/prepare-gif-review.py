# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image
import json,shutil

root=Path(__file__).resolve().parents[2]
folder=root/'media-review/2026-11-10';folder.mkdir(parents=True,exist_ok=True)
if (folder/'approval-receipt.json').exists():
    raise SystemExit('This review has approved assets; do not overwrite its assets or decisions.')
generated=Path(r'C:\Users\czb\.codex\generated_images\01a1b679-00fa-71e0-94c5-c2fc032f807a\exec-f9b2c5df-9955-475c-b64f-37dfba9418e5.png')
shutil.copy2(generated,folder/'kneeling-pushup-ai-spritesheet.png')
sheet=Image.open(generated).convert('RGB')
frames=[]
# Use the lowering half and its exact reverse: avoids a mismatched AI return pose.
for index in range(8):
    col,row=index%4,index//4
    tile=sheet.crop((round(col*sheet.width/4),round(row*sheet.height/4),round((col+1)*sheet.width/4),round((row+1)*sheet.height/4)))
    tile=tile.resize((360,360),Image.Resampling.LANCZOS)
    frames.append(tile)
sequence=frames+list(reversed(frames[1:-1]))
durations=[160]*len(sequence);durations[0]=400;durations[7]=400
sequence[0].save(folder/'kneeling-pushup-ai-draft.gif',save_all=True,append_images=sequence[1:],duration=durations,loop=0,optimize=True,disposal=2)
sequence[0].save(folder/'kneeling-pushup-ai-draft.webp',save_all=True,append_images=sequence[1:],duration=durations,loop=0,quality=84,method=6)
review=[
 {'id':'ai-knee','exerciseKey':'opengym-3211','name':'跪姿俯卧撑 · AI 样片','gif':'kneeling-pushup-ai-draft.gif','webp':'kneeling-pushup-ai-draft.webp','source':'AI 分帧生成后合成循环，使用下降帧的往返序列','status':'needs_revision','note':'仅供风格审核。帧间手掌、髋部与肩肘位置仍有漂移，不建议直接作为标准教学演示；未接入动作库。'},
 {'id':'existing-knee','exerciseKey':'opengym-3211','name':'跪姿俯卧撑 · 现有素材对照','gif':'kneeling-pushup-existing.gif','source':'项目已有 gifs/3211.gif，未新增外部下载','status':'pending_review','note':'与 AI 样片对照。可用于补齐缺图动作，需你确认后才建立正式关联。'},
 {'id':'existing-bench','exerciseKey':'opengym-0289','name':'哑铃平板卧推 · 现有素材候选','gif':'dumbbell-bench-existing.gif','source':'项目已有 gifs/0289.gif，未新增外部下载','status':'pending_review','note':'现有文件此前没有关联到新增的哑铃平板卧推动作。仅准备候选，不改变现有动作库。'}
]
shutil.copy2(root/'gifs/3211.gif',folder/'kneeling-pushup-existing.gif')
shutil.copy2(root/'gifs/0289.gif',folder/'dumbbell-bench-existing.gif')
for sample in review:
    sample['bytes']=(folder/sample['gif']).stat().st_size
(folder/'review.json').write_text(json.dumps({'date':'2026-11-10','approved':False,'samples':review},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
actions=json.loads((root/'训练动作库/actions.json').read_text(encoding='utf-8'))['actions']
missing=[{'exerciseKey':a['exerciseKey'],'name':a['displayName'],'status':'pending_review' if a['exerciseKey'] in ('opengym-3211','opengym-0289') else 'not_prepared'} for a in actions if not (a.get('media') or {}).get('path')]
(folder/'missing-actions.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'samples':review,'missing':len(missing)},ensure_ascii=False,indent=2))
