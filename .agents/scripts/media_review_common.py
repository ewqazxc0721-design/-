"""A review version binds the exercise identity and all three displayed files."""
import hashlib,json

def review_fingerprint(sample):
    value={key:sample[key] for key in ('exerciseKey','revision','gifSha256','webpSha256','posterSha256')}
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()
