# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image
import argparse,hashlib,json,shutil,os
root=Path(__file__).resolve().parents[2]
folder=root/'media-review/2026-11-10-batch-2'
parser=argparse.ArgumentParser();parser.add_argument('job_id');parser.add_argument('source',type=Path);parser.add_argument('--revision',type=int,default=1);parser.add_argument('--cycle-mode',choices=['half','full','hold'],default='half');parser.add_argument('--frames',default='0,1,2,3,4,5,6,7');args=parser.parse_args()
job=next(j for j in json.loads((folder/'jobs.json').read_text(encoding='utf-8')) if j['id']==args.job_id)
sheet=Image.open(args.source).convert('RGB')
if abs(sheet.width/sheet.height-2)>.04:raise SystemExit('Unexpected grid aspect ratio; inspect before cropping: '+str(sheet.size))
stem=job['id']+(f'-v{args.revision}' if args.revision>1 else '');sheet_target=folder/(stem+'-sheet.png')
if args.source.resolve()!=sheet_target.resolve():shutil.copy2(args.source,sheet_target)
frames=[]
for i in range(8):
    col,row=i%4,i//4
    tile=sheet.crop((round(col*sheet.width/4),round(row*sheet.height/2),round((col+1)*sheet.width/4),round((row+1)*sheet.height/2)))
    frames.append(tile.resize((360,360),Image.Resampling.LANCZOS))
indices=[int(v) for v in args.frames.split(',')]
if not indices or any(v<0 or v>7 for v in indices):raise SystemExit('Invalid frame selection')
frames=[frames[i] for i in indices]
sequence=frames if args.cycle_mode in ('full','hold') else frames+list(reversed(frames[1:-1]));durations=[400 if args.cycle_mode=='hold' else 220]*len(sequence);durations[0]=durations[len(frames)-1]=500
sequence[0].save(folder/(stem+'.gif'),save_all=True,append_images=sequence[1:],duration=durations,loop=0,optimize=True,disposal=2)
sequence[0].save(folder/(stem+'.webp'),save_all=True,append_images=sequence[1:],duration=durations,loop=0,quality=82,method=6)
sequence[0].save(folder/(stem+'-poster.webp'),quality=84,method=6)
def info(path):
    im=Image.open(path);duration=0
    for i in range(im.n_frames):im.seek(i);im.load();duration+=im.info.get('duration',0)
    return {'width':im.width,'height':im.height,'frames':im.n_frames,'durationMs':duration,'bytes':path.stat().st_size}
gif=info(folder/(stem+'.gif'));webp=info(folder/(stem+'.webp'))
if (gif['width'],gif['height'],gif['durationMs'])!=(webp['width'],webp['height'],webp['durationMs']):raise SystemExit('Animation timing changed')
result={**{k:v for k,v in job.items() if k!='prompt'},'status':'pending_review','revision':args.revision,'cycleMode':args.cycle_mode,'frameIndices':indices,'ai':True,'gif':stem+'.gif','webp':stem+'.webp','poster':stem+'-poster.webp','sheet':stem+'-sheet.png','promptFile':stem+'-prompt.txt','sourcePath':str(args.source),'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'gifInfo':gif,'webpInfo':webp,'note':'AI 生成动作示意；深红为主要肌群，浅红为辅助肌群。单侧动作展示一侧；保持类动画仅提示稳定与呼吸，动图不代表训练速度。尚未入库。'}
target=folder/(job['id']+'-result.json');temporary=target.with_suffix('.tmp');temporary.write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf-8'));os.replace(temporary,target)
print(json.dumps({'id':stem,'name':job['name'],'gif':gif,'webp':webp,'status':'pending_review'},ensure_ascii=False))
