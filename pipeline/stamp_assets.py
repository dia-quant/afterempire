"""Add a content fingerprint to every local stylesheet and script link (css/x.css -> css/x.css?v=1a2b3c4d),
so browsers fetch new versions after each deploy instead of reusing a cached copy.
Run by the deploy workflow on the copy being published: python pipeline/stamp_assets.py site"""
import hashlib
import re
import sys
from pathlib import Path

site = Path(sys.argv[1] if len(sys.argv) > 1 else "site")
pat = re.compile(r'((?:href|src)=")((?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')


def stamp(m):
    f = site / m.group(2)
    if not f.exists():
        return m.group(0)
    h = hashlib.sha1(f.read_bytes()).hexdigest()[:8]
    return f"{m.group(1)}{m.group(2)}?v={h}{m.group(3)}"


n = 0
for page in site.glob("*.html"):
    t = page.read_text(encoding="utf-8")
    new, k = pat.subn(stamp, t)
    if new != t:
        page.write_text(new, encoding="utf-8")
    n += k
print(f"stamped {n} asset links")
