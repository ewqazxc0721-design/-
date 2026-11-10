# -*- coding: utf-8 -*-
"""Approval-boundary checks with temporary fixtures, never real review opinions."""
from pathlib import Path
import hashlib,importlib.util,json,sys,tempfile,unittest,subprocess,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('media_import',ROOT/'.agents/scripts/apply-remaining-exercise-media.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ImportBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='media-approval-test-',dir=ROOT/'.scratch');self.root=Path(self.tmp.name);self.folder=self.root/'media-review'/module.BATCH;self.folder.mkdir(parents=True);(self.root/'训练动作库').mkdir();(self.root/'gifs').mkdir()
        self.samples=[]
        for i in range(40):
            data=('isolated-test-'+str(i)).encode();gif=f'{i}.gif';webp=f'{i}.webp';poster=f'{i}-poster.webp';(self.folder/gif).write_bytes(data);(self.folder/webp).write_bytes(data);(self.folder/poster).write_bytes(data)
            self.samples.append({'id':f'test-{i}','exerciseKey':f'opengym-{i}','name':'test','revision':1,'gif':gif,'webp':webp,'poster':poster,'gifSha256':hashlib.sha256(data).hexdigest(),'webpSha256':hashlib.sha256(data).hexdigest(),'posterSha256':hashlib.sha256(data).hexdigest()})
        self.feedback={'source':'local_review_page','reviewId':module.BATCH,'date':'2026-11-10','receivedAt':'test-fixture','decisions':{s['id']:'approve' for s in self.samples},'assetHashes':{s['id']:module.review_fingerprint(s) for s in self.samples}}
        self.write(self.folder/'review.json',{'samples':self.samples});self.write(self.root/'训练动作库/actions.json',{'actions':[{'exerciseKey':s['exerciseKey'],'media':None} for s in self.samples]});self.save_feedback()
    def tearDown(self):self.tmp.cleanup()
    def write(self,path,value):path.write_text(json.dumps(value),encoding='utf-8')
    def save_feedback(self):self.write(self.folder/'user-feedback.json',self.feedback)
    def test_partial_approval_cannot_import(self):
        self.feedback['decisions']['test-0']='revise';self.save_feedback()
        with self.assertRaises(ValueError):module.apply(self.root)
        self.assertFalse(list((self.root/'gifs').iterdir()))
    def test_stale_approval_cannot_import(self):
        self.feedback['assetHashes']['test-0']='old';self.save_feedback()
        with self.assertRaises(ValueError):module.apply(self.root)
    def test_changed_gif_or_webp_cannot_import(self):
        for name in ('gif','webp','poster'):
            path=self.folder/self.samples[0][name];old=path.read_bytes();path.write_bytes(b'changed')
            with self.assertRaises(ValueError):module.apply(self.root)
            path.write_bytes(old)
    def test_valid_fixture_import_is_idempotent(self):
        self.assertEqual(module.apply(self.root)['missing'],0);self.assertEqual(module.apply(self.root)['missing'],0)
        self.assertEqual(len(list((self.root/'gifs').iterdir())),40)
    def test_missing_feedback_never_imports(self):
        (self.folder/'user-feedback.json').unlink()
        with self.assertRaises(FileNotFoundError):module.apply(self.root)

class ReceiverBoundary(unittest.TestCase):
    def test_batch_version_and_bulk_choice_guards(self):
        with tempfile.TemporaryDirectory(prefix='media-receiver-test-',dir=ROOT/'.scratch') as tmp:
            output=Path(tmp)/'batch-feedback.json'
            process=subprocess.Popen([sys.executable,str(ROOT/'.agents/scripts/serve-media-review-feedback.py'),'--port','8767','--output',str(Path(tmp)/'first.json'),'--batch-output',str(output)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            def send(payload):
                req=urllib.request.Request('http://127.0.0.1:8767/review/'+module.BATCH,json.dumps(payload).encode(),{'Origin':'http://127.0.0.1:8765','Content-Type':'application/json'})
                try:
                    with urllib.request.urlopen(req) as r:return r.status
                except urllib.error.HTTPError as e:return e.code
            try:
                for _ in range(30):
                    try:urllib.request.urlopen('http://127.0.0.1:8767/health').close();break
                    except OSError:time.sleep(.1)
                samples=json.loads((ROOT/'media-review'/module.BATCH/'review.json').read_text(encoding='utf-8'))['samples'];hashes={s['id']:s['reviewSha256'] for s in samples};decisions={s['id']:'approve' for s in samples}
                self.assertEqual(send({'date':'2026-11-10','decisions':decisions,'assetHashes':{}}),400)
                partial={**decisions,samples[0]['id']:'revise'}
                self.assertEqual(send({'date':'2026-11-10','decisions':partial,'assetHashes':hashes,'publishRequested':True}),400);self.assertFalse(output.exists())
                self.assertEqual(send({'date':'2026-11-10','decisions':decisions,'assetHashes':hashes,'publishRequested':True}),200)
                self.assertTrue(json.loads(output.read_text(encoding='utf-8'))['publishRequested'])
            finally:process.terminate();process.wait(timeout=5)

if __name__=='__main__':unittest.main()
