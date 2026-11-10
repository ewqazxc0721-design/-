"""Read-only production checks; no account state or training records are changed."""
from pathlib import Path
import concurrent.futures,hashlib,json,sys,urllib.request,urllib.parse
ROOT=Path(__file__).resolve().parents[2]
BASE='https://ewqazxc0721-design.github.io/-/'
checks=[]
def request(name,head=False):
    uri=BASE+urllib.parse.quote(name,safe='/')+'?release=20261110-media2'
    req=urllib.request.Request(uri,method='HEAD' if head else 'GET',headers={'Cache-Control':'no-cache','User-Agent':'Codex-release-check'})
    with urllib.request.urlopen(req,timeout=35) as response:
        if response.status!=200:raise RuntimeError(name+': HTTP '+str(response.status))
        if not head and hashlib.sha256(response.read()).hexdigest()!=hashlib.sha256((ROOT/name).read_bytes()).hexdigest():raise RuntimeError('Live content differs: '+name)
        if head and response.headers.get('Content-Length') and int(response.headers['Content-Length'])!=(ROOT/name).stat().st_size:raise RuntimeError('Wrong content length: '+name)
    return {'path':name,'status':200,'check':'content-length' if head else 'sha256'}
runtime=['index.html','training-core.js','training-ui.js','training-enhancements.css','exercise-media.js','exercise-media.css','sw.js','训练动作库/actions.json','训练动作库/media-manifest.json']
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:checks.extend(pool.map(request,runtime))
receipt=json.loads((ROOT/'media-review/2026-11-10-batch-2/approval-receipt.json').read_text(encoding='utf-8'))
manifest=json.loads((ROOT/'训练动作库/media-manifest.json').read_text(encoding='utf-8'))
files=[]
for sample in receipt['samples']:
    asset=manifest['assets'][sample['path']];files.extend([sample['path'],asset['animation'],asset['poster']])
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:checks.extend(pool.map(lambda name:request(name,True),files))
report={'base':BASE,'published':True,'version':'v2026.11.10-exercise-media-library','runtimeHashes':len(runtime),'newMediaResources':len(files),'checks':checks,'mutatedUserData':False}
(ROOT/'docs/live-media-release-verification.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(json.dumps({'published':True,'runtimeHashes':len(runtime),'newMediaResources':len(files),'allChecksPassed':True}))
