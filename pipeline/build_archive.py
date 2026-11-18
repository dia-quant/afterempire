"""Build site/archive.html (The Archive) from data/curated/archive_sources.json.
Edit the JSON to add or change a source card, then run: python pipeline/build_archive.py"""
import html
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
E = json.loads((ROOT / "data/curated/archive_sources.json").read_text(encoding="utf-8"))
E.sort(key=lambda e: (e["status"] == "further", e["name"].lower()))
xs = ["34%", "46%", "8%", "22%", "40%"]
e = html.escape
out, letter, li = [], None, 0
for n, s in enumerate(E, 1):
    if s["status"] == "further" and letter != "FURTHER":
        letter = "FURTHER"
        cnt = sum(1 for x in E if x["status"] == "further")
        out.append(f'<div class="divider further" style="--x:6%;--i:{len(out)}" role="separator"><span><b>Further reading</b><b>{cnt:03d}</b></span></div>')
        li += 1
    L = s["name"][0].upper()
    if s["status"] != "further" and L != letter:
        letter = L
        cnt = sum(1 for x in E if x["name"][0].upper() == L)
        out.append(f'<div class="divider" style="--x:{["6%", "22%", "14%"][li % 3]};--i:{len(out)}" role="separator"><span><b>{L}</b><b>{cnt:03d}</b></span></div>')
        li += 1
    short = s["name"].split(" (")[0].split(":")[0]
    link = f'<a href="{e(s["link"])}" target="_blank" rel="noopener">{e(s["link"])}</a>' if s["link"] else "To be added once the source is retrieved."
    out.append(f'''<details class="card" style="--x:{xs[n % 5]};--i:{len(out)}" id="src-{n:02d}">
  <summary><div class="tab" aria-hidden="true"><span class="no">{n:03d}</span><span>{e(short)}</span></div><h2>{e(s["name"])}</h2><span class="use-line">{e(s["use"])}</span></summary>
  <div class="body"><dl>
    <dt>Citation</dt><dd class="cite">{e(s["citation"])}</dd>
    <dt>Coverage</dt><dd>{e(s["coverage"])}</dd>
    <dt>Licence</dt><dd>{e(s["licence"])}</dd>
    <dt>Link</dt><dd>{link}</dd>
  </dl></div>
</details>''')
inuse = sum(1 for s in E if s["status"] != "further")
page = (ROOT / "site/archive.html").read_text(encoding="utf-8")
head, rest = page.split('<section class="drawer" aria-label="Source cards">', 1)
tail = rest.split("</section>", 1)[1]
import re
head = re.sub(r'<p class="stamp">.*?</p>', f'<p class="stamp"><mark>{inuse} sources used</mark> · {len(E) - inuse} for further reading · data up to date as of <span data-asof></span></p>', head, flags=re.S)
total = len(out)
out = [o.replace('--i:', f'--n:{total};--i:', 1) for o in out]
front = '<div class="drawer-front" aria-hidden="true"><span class="label">afterempire · sources</span></div>'
page = head + '<section class="drawer" aria-label="Source cards">\n' + "\n".join(out) + "\n" + front + "\n  </section>" + tail
(ROOT / "site/archive.html").write_text(page, encoding="utf-8")
print(len(E), "cards,", inuse, "in use")
