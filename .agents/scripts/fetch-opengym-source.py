"""Download only selected exercise JSON, never exercise pictures or animations."""
import concurrent.futures, json, pathlib, subprocess, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
config = json.loads((ROOT/'.agents/scripts/opengym-selection.json').read_text(encoding='utf-8'))
cache = ROOT/'.scratch/opengym-source/catalogue/exercises'
cache.mkdir(parents=True, exist_ok=True)
def fetch(row):
    ident=row[0]; out=cache/(ident+'.json')
    if out.exists():
        try:
            if json.loads(out.read_text(encoding='utf-8')).get('id')==ident:return ident,'cached'
        except (ValueError,OSError):pass
    url='https://raw.githubusercontent.com/DuarteSantos8/openGym/'+config['commit']+'/catalogue/exercises/'+ident+'.json'
    for attempt in range(2):
        result=subprocess.run(['curl.exe','-fL','--max-time','18','-sS',url,'-o',str(out)],capture_output=True)
        if result.returncode==0:
            try:
                if json.loads(out.read_text(encoding='utf-8')).get('id')==ident:return ident,'downloaded'
            except (ValueError,OSError):pass
    return ident,'FAILED'
old=json.loads((ROOT/'训练动作库/actions.json').read_text(encoding='utf-8-sig'))['actions']
ids=sorted({m.group(1) for a in old if (m:=re.search(r'/([0-9]+)\.gif$',a.get('media',{}).get('path','')))})
rows=config['selected']+[[ident] for ident in ids]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results=list(pool.map(fetch,rows))
for ident,status in results:print(ident,status,flush=True)
if any(status=='FAILED' for _,status in results):raise SystemExit(1)
