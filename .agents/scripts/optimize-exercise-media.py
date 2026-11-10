# -*- coding: utf-8 -*-
"""Create lighter animations without changing or assigning exercise imagery."""
from pathlib import Path
from PIL import Image, ImageSequence
import hashlib,json

root=Path(__file__).resolve().parents[2]
out=root/'gifs/optimized';out.mkdir(exist_ok=True)
assets={}
for source in sorted((root/'gifs').iterdir()):
    if source.suffix.lower() not in ('.gif','.webp') or not source.is_file():continue
    raw=source.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    name=f'{source.stem}-{digest[:12]}-q82'
    animation=out/f'{name}.webp';poster=out/f'{name}-poster.webp'
    image=Image.open(source)
    frames=[frame.convert('RGBA').copy() for frame in ImageSequence.Iterator(image)]
    image.seek(0)
    durations=[]
    for index in range(len(frames)):
        image.seek(index);image.load();durations.append(int(image.info.get('duration',100)))
    loop=int(image.info.get('loop',0))
    existing_duration=-1
    if animation.exists():
        existing=Image.open(animation);existing_duration=0
        for index in range(existing.n_frames):
            existing.seek(index);existing.load();existing_duration+=int(existing.info.get('duration',100))
    if not animation.exists() or existing_duration!=sum(durations):
        frames[0].save(animation,format='WEBP',save_all=True,append_images=frames[1:],duration=durations,loop=loop,quality=82,method=6,allow_mixed=True)
    frames[0].save(poster,format='WEBP',quality=84,method=6)
    # Keep an existing WebP when recompressing it would increase transfer size.
    use_optimized=animation.stat().st_size<len(raw)
    selected=animation if use_optimized else source
    key=source.relative_to(root).as_posix()
    assets[key]={'animation':selected.relative_to(root).as_posix(),'poster':poster.relative_to(root).as_posix(),'fallback':key,'width':image.width,'height':image.height,'frames':len(frames),'durationMs':sum(durations),'loop':loop,'sourceBytes':len(raw),'animationBytes':selected.stat().st_size,'posterBytes':poster.stat().st_size,'sourceSha256':digest}
    print(f'{source.name}: {len(raw)} -> {selected.stat().st_size}',flush=True)
report={'schemaVersion':1,'generatedOn':'2026-11-10','pipeline':'pillow-webp-q82-v1','assets':assets}
(root/'训练动作库/media-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
before=sum(x['sourceBytes'] for x in assets.values());after=sum(x['animationBytes'] for x in assets.values())
print(json.dumps({'files':len(assets),'beforeBytes':before,'afterBytes':after,'reductionPercent':round((1-after/before)*100,1)},ensure_ascii=False))
