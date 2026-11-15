"""Make a preview copy of site/ for publishing as a claude.ai Artifact.

The Artifact host wraps the main page in its own <html>/<head>/<body>, so index.html
is reduced to its head tags + body content. Other files are copied unchanged.
Usage: python pipeline/make_preview.py OUT_DIR
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1])
if out.exists():
    shutil.rmtree(out)
shutil.copytree(ROOT / "site", out, ignore=shutil.ignore_patterns(".gitkeep", "land.json"))
src = (ROOT / "site" / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
head = re.sub(r'\s*<meta charset="utf-8">|\s*<meta name="viewport"[^>]*>', "", head)
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
(out / "index.html").write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
print("preview written to", out)
