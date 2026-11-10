# -*- coding: utf-8 -*-
"""Receive only media-review choices on loopback; never modify the exercise library."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timezone
import argparse
import json
import os
import threading

ROOT = Path(__file__).resolve().parents[2]
ALLOWED_ORIGINS = {'http://127.0.0.1:8765', 'http://localhost:8765'}
CHOICES = {'pending', 'approve', 'style-only', 'reference', 'revise', 'reject'}
LOCK = threading.Lock()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--output', type=Path, default=ROOT / 'media-review/2026-11-10/user-feedback.json')
    parser.add_argument('--batch-output', type=Path, default=ROOT / 'media-review/2026-11-10-batch-2/user-feedback.json')
    args = parser.parse_args()
    reviews = {'2026-11-10': ('review.json', args.output), '2026-11-10-batch-2': ('review.json', args.batch_output)}

    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, body):
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            if self.headers.get('Origin') in ALLOWED_ORIGINS:
                self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
                self.send_header('Vary', 'Origin')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            self.reply(200 if self.path == '/health' else 404, {'ready': self.path == '/health'})

        def do_OPTIONS(self):
            if self.headers.get('Origin') not in ALLOWED_ORIGINS:
                return self.reply(403, {'error': 'origin_not_allowed'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Vary', 'Origin')
            self.end_headers()

        def do_POST(self):
            if self.headers.get('Origin') not in ALLOWED_ORIGINS:
                return self.reply(403, {'error': 'origin_not_allowed'})
            review_id = self.path.removeprefix('/review/') if self.path.startswith('/review/') else ''
            if review_id not in reviews:
                return self.reply(404, {'error': 'unknown_review'})
            try:
                registry_file, output = reviews[review_id]
                registry=json.loads((ROOT/'media-review'/review_id/registry_file).read_text(encoding='utf-8'))
                samples=registry if isinstance(registry,list) else registry['samples']
                ids={sample['id'] for sample in samples}
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 8192:
                    raise ValueError('invalid_size')
                payload = json.loads(self.rfile.read(length))
                decisions = payload.get('decisions')
                if payload.get('date') != '2026-11-10' or not isinstance(decisions, dict):
                    raise ValueError('invalid_review')
                if not decisions or any(k not in ids or not isinstance(v, str) or v not in CHOICES for k, v in decisions.items()):
                    raise ValueError('invalid_choice')
                if not any(v != 'pending' for v in decisions.values()):
                    raise ValueError('no_decision')
                asset_hashes = payload.get('assetHashes', {})
                if review_id.endswith('batch-2'):
                    expected = {s['id']: s['reviewSha256'] for s in samples}
                    if asset_hashes != expected:
                        raise ValueError('review_files_changed_refresh_required')
                    if payload.get('publishRequested') is True and (set(decisions) != ids or any(v != 'approve' for v in decisions.values())):
                        raise ValueError('all_samples_must_be_approved')
                record = {'date': '2026-11-10', 'reviewId':review_id,'receivedAt': datetime.now(timezone.utc).isoformat(),
                          'source': 'local_review_page', 'decisions': decisions,'assetHashes':asset_hashes,'publishRequested':payload.get('publishRequested') is True,'productionChanged': False}
                output.parent.mkdir(parents=True, exist_ok=True)
                with LOCK:
                    temporary = output.with_suffix('.json.tmp')
                    temporary.write_bytes((json.dumps(record, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
                    os.replace(temporary, output)
                self.reply(200, {'saved': True, 'receivedAt': record['receivedAt']})
            except (ValueError, TypeError, AttributeError) as error:
                self.reply(400, {'error': str(error)})
            except OSError:
                self.reply(500, {'error': 'save_failed'})

    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()

if __name__ == '__main__':
    main()
