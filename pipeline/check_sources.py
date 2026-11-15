"""Check whether any upstream source has published a newer version than the one the site was built from.

Run monthly by .github/workflows/check-sources.yml. Prints a Markdown report and exits 1 if anything
is newer, so the workflow can open an issue. Rebuilding needs the raw downloads (not kept in the repo),
so the refresh itself stays a deliberate step: run the pipeline locally or ask Claude.
"""
import json
import re
import sys
import urllib.request

BUILT = {  # versions the current site uses
    "CEPII Gravity": "V202211",
    "TRADHIST": "v4",
    "Penn World Table": "11.0",
    "UN voting (Dataverse LEJUQZ)": None,  # compared by file list below
}
UA = {"User-Agent": "afterempire-source-check/1.0 (academic project)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


findings = []
try:
    html = get("https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8")
    vers = sorted(set(re.findall(r"Gravity_csv_(V\d{6})\.zip", html)))
    latest = vers[-1] if vers else None
    findings.append(("CEPII Gravity", BUILT["CEPII Gravity"], latest, latest and latest > BUILT["CEPII Gravity"]))
except Exception as e:  # network or layout change
    findings.append(("CEPII Gravity", BUILT["CEPII Gravity"], f"check failed: {e}", False))
try:
    html = get("https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=32")
    vers = sorted(set(re.findall(r"TRADHIST_(v\d+)\.dta", html)))
    latest = vers[-1] if vers else None
    findings.append(("TRADHIST", BUILT["TRADHIST"], latest, bool(latest) and latest != BUILT["TRADHIST"]))
except Exception as e:
    findings.append(("TRADHIST", BUILT["TRADHIST"], f"check failed: {e}", False))
try:
    html = get("https://www.rug.nl/ggdc/productivity/pwt/")
    vers = sorted(set(re.findall(r"PWT (\d+\.\d+)", html)), key=lambda v: [int(x) for x in v.split(".")])
    latest = vers[-1] if vers else None
    newer = bool(latest) and [int(x) for x in latest.split(".")] > [int(x) for x in BUILT["Penn World Table"].split(".")]
    findings.append(("Penn World Table", BUILT["Penn World Table"], latest, newer))
except Exception as e:
    findings.append(("Penn World Table", BUILT["Penn World Table"], f"check failed: {e}", False))
try:
    d = json.loads(get("https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/LEJUQZ"))
    v = d["data"]["latestVersion"]
    stamp = f'{v.get("versionNumber")}.{v.get("versionMinorNumber")} ({v.get("releaseTime", "")[:10]})'
    findings.append(("UN voting (Dataverse LEJUQZ)", "as downloaded 2026-11-15", stamp, v.get("releaseTime", "")[:10] > "2026-11-15"))
except Exception as e:
    findings.append(("UN voting (Dataverse LEJUQZ)", "—", f"check failed: {e}", False))

print("| Source | Site uses | Latest found | Newer? |\n|---|---|---|---|")
for name, have, latest, newer in findings:
    print(f"| {name} | {have} | {latest} | {'**yes**' if newer else 'no'} |")
sys.exit(1 if any(f[3] for f in findings) else 0)
