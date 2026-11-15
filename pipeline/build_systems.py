"""Build the development-systems layer (Inherited Systems + Divergence Metrics).

Hand-coded (21 countries, by decade): planning regime, planning institution, monetary arrangement;
static: legal origin, administrative tradition  -> data/curated/systems_codings.csv (review sheet)
Qualitative lineages and model profiles -> data/curated/lineages.json
Automatic (every ex-colony with data, by decade):
  UN General Assembly voting agreement with each model country (Bailey, Strezhnev & Voeten; CC0)
  trade openness and government consumption share of GDP (Penn World Table 11, national accounts)

Similarity of a country to a model on each dimension is in [0, 1]:
  planning regime   1 - |a - b|
  institution       affinity table in lineages.json
  monetary          affinity table (coloniser_zone counts only for the country's own coloniser)
  legal origin      1 if same family, else 0
  UN agreement      the agreement score itself
Openness and government share are shown as context only (comparing them with large economies such as
the US misleads). Inheritance index = mean similarity to the country's own former coloniser.
Nearest model = whichever of {own former coloniser, Soviet model, US/Bretton Woods model} is most similar.
Non-curated countries have only legal origin and UN agreement, and are marked as such.
Descriptive only: it says whom a system resembles, not why.

Output: site/data/systems.json, data/processed/systems_report.md
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, CUR = ROOT / "data/raw", ROOT / "data/curated"
DECADES = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"]
MODELS = ["GBR", "FRA", "PRT", "NLD", "SUN", "USA"]
UN_CODE = {"GBR": "GBR", "FRA": "FRA", "PRT": "PRT", "NLD": "NLD", "SUN": "RUS", "USA": "USA"}
FOCUS = {"GBR", "FRA", "PRT", "NLD"}
LEGAL_DEFAULT = {"GBR": "common", "FRA": "civil", "PRT": "civil", "NLD": "civil"}

lin = json.loads((CUR / "lineages.json").read_text(encoding="utf-8"))
models = lin["models"]
inst_aff, mon_aff = lin["institution_affinity"], lin["monetary_affinity"]

# ---------------------------------------------------------------- holdings -> ex-colony countries
holdings = {r["holding_id"]: r for r in csv.DictReader(open(CUR / "holdings.csv", encoding="utf-8"))}


def yr(s):
    s = s.strip()
    return None if not s else int(s.split("-")[0])


periods = defaultdict(list)
for r in csv.DictReader(open(CUR / "periods.csv", encoding="utf-8")):
    periods[r["holding_id"]].append((yr(r["start"]), yr(r["end"]), r["controller"], r["status"]))
for v in periods.values():
    v.sort(key=lambda p: p[0])

OVERRIDE = {r["holding_id"]: int(r["year"]) for r in csv.DictReader(open(CUR / "independence_overrides.csv", encoding="utf-8"))}
MAIN = {"IND": "ind", "GHA": "gha", "MYS": "fms", "ZAF": "cap", "CMR": "cmr", "TGO": "tgo", "IDN": "idn", "CAN": "can",
        "TTO": "tri", "VNM": "vnm_n", "SOM": "som", "PNG": "pap", "TZA": "tza", "NGA": "nga", "YEM": "ade"}
countries = {}
by_iso = defaultdict(list)
for hid, h in holdings.items():
    by_iso[h["iso3"]].append(hid)
for iso, hids in by_iso.items():
    hid = MAIN.get(iso) or (hids[0] if len(hids) == 1 else None)
    if not hid:
        continue
    seen, indep, coloniser = False, None, None
    for s, e, c, st in periods[hid]:
        if c != "SOV":
            seen = True
            if c in FOCUS:
                coloniser = c
        elif seen and s >= 1800 and indep is None:
            indep = s
    # coloniser = last focus-empire ruler before independence
    if indep:
        last = None
        for s, e, c, st in periods[hid]:
            if s < indep and c in FOCUS:
                last = c
        coloniser = last
    indep = OVERRIDE.get(hid, indep)
    if indep and coloniser and indep >= 1900:
        countries[iso] = {"holding": hid, "coloniser": coloniser, "indep": indep, "name": holdings[hid]["name"]}

# ---------------------------------------------------------------- automatic data, by decade
dec_of = lambda y: f"{(int(y) // 10) * 10}s"
pwt = pd.read_parquet(RAW / "pwt/pwt11_ratios.parquet")
pwt = pwt[(pwt.year >= 1950) & (pwt.year <= 2019)]
pwt["dec"] = pwt.year.map(dec_of)
pwt_dec = pwt.groupby(["countrycode", "dec"])[["open", "gov"]].mean()
un = pd.read_parquet(RAW / "unvotes/agree_ref.parquet")
un = un[(un.year >= 1950) & (un.year <= 2019)].copy()
un["dec"] = un.year.map(dec_of)
un_dec = un.groupby(["iso3c", "ref", "dec"])["agree"].mean()


def pwt_val(iso, dec, col):
    try:
        v = pwt_dec.loc[(iso, dec), col]
        return None if pd.isna(v) else round(float(v), 4)
    except KeyError:
        return None


def un_val(iso, ref, dec):
    try:
        return round(float(un_dec.loc[(iso, ref, dec)]), 4)
    except KeyError:
        return None


# ---------------------------------------------------------------- hand codings
hand = defaultdict(lambda: defaultdict(dict))
cname = {}
static = defaultdict(dict)
review = defaultdict(int)
src_by = defaultdict(set)
rev_by = defaultdict(lambda: defaultdict(int))
for r in csv.DictReader(open(CUR / "systems_codings.csv", encoding="utf-8")):
    src_by[r["iso3"]].add(r["source"])
    cname[r["iso3"]] = r["country"]
    rev_by[r["iso3"]][r["review"].strip().lower() or "unreviewed"] += 1
    v = r["value"]
    if r["dimension"] == "planning_regime":
        v = float(v)
    if r["decade"] == "static":
        static[r["iso3"]][r["dimension"]] = v
    else:
        hand[r["iso3"]][r["decade"]][r["dimension"]] = v
    review[r["review"].strip().lower() or "unreviewed"] += 1


def sim(dim, a, model, coloniser, dec):
    m = models[model]
    if dim == "planning_regime":
        return None if a is None else 1 - abs(a - m["planning_regime"])
    if dim == "planning_institution":
        return None if a is None else inst_aff.get(a, {}).get(model, 0.0)
    if dim == "monetary_arrangement":
        if a is None:
            return None
        aff = mon_aff.get(a, {})
        if model == coloniser and "_coloniser" in aff:
            return aff["_coloniser"]
        return aff.get(model, 0.0) if a != "coloniser_zone" else 0.0
    if dim == "legal_origin":
        return None if a is None else float(a == m["legal_origin"])
    return None


out = {}
for iso, c in sorted(countries.items()):
    col = c["coloniser"]
    curated = iso in lin["countries"]
    legal = static[iso].get("legal_origin") or LEGAL_DEFAULT[col]
    decs = {}
    for dec in DECADES:
        start = int(dec[:4])
        if start + 9 < c["indep"]:
            continue
        h = hand[iso].get(dec, {}) if curated else {}
        row = {
            "planning_regime": h.get("planning_regime"), "planning_institution": h.get("planning_institution"),
            "monetary_arrangement": h.get("monetary_arrangement"),
            "open": pwt_val(iso, dec, "open"), "gov": pwt_val(iso, dec, "gov"),
            "un": {m: un_val(iso, UN_CODE[m], dec) for m in MODELS},
        }
        sims = {}
        for m in MODELS:
            parts = {}
            for dim in ("planning_regime", "planning_institution", "monetary_arrangement"):
                s = sim(dim, row[dim], m, col, dec)
                if s is not None:
                    parts[dim] = round(s, 3)
            parts["legal_origin"] = sim("legal_origin", legal, m, col, dec)
            if row["un"][m] is not None:
                parts["un"] = row["un"][m]
            sims[m] = parts
        cand = (col, "SUN", "USA")
        mean = {m: round(sum(p.values()) / len(p), 3) for m, p in sims.items() if len(p) >= 2}
        near = {m: v for m, v in mean.items() if m in cand}
        if not mean:
            continue
        row["sim"] = sims
        row["mean"] = mean
        row["inherit"] = mean.get(col)
        row["nearest"] = max(near, key=near.get) if near else None
        row["dims"] = sorted(sims.get(col, {}).keys())
        decs[dec] = row
    if not decs:
        continue
    # persistence: first decade where a coded dimension departs from the coloniser
    persist = {}
    if curated:
        for dim in ("monetary_arrangement", "planning_institution", "planning_regime"):
            first = None
            for dec in DECADES:
                if dec not in decs or decs[dec][dim] is None:
                    continue
                s = sim(dim, decs[dec][dim], col, col, dec)
                if s is not None and s < 0.75:
                    first = int(dec[:4])
                    break
            persist[dim] = None if first is None else max(0, first - c["indep"])
    if iso in cname:
        c = {**c, "name": cname[iso]}
    entry = {**c, "curated": curated, "legal_origin": legal, "legal_derived": iso not in static or "legal_origin" not in static[iso],
             "admin_tradition": static[iso].get("admin_tradition"), "decades": decs, "persistence": persist}
    if curated:
        entry["lineage"] = lin["countries"][iso]
        entry["sources"] = sorted(src_by[iso])
        entry["review"] = dict(rev_by[iso])
    out[iso] = entry

# metropole trade share by decade (from the trade layer)
trade = json.loads((ROOT / "site/data/trade.json").read_text())
for iso, e in out.items():
    series = trade["share"].get(e["holding"], [])
    by = defaultdict(list)
    for y, tot, wm, metro in series:
        if tot and 1950 <= y <= 2019:
            by[dec_of(y)].append(wm / tot)
    for dec, row in e["decades"].items():
        row["metro_share"] = round(sum(by[dec]) / len(by[dec]), 3) if by.get(dec) else None

payload = {"meta": {"generated": date.today().isoformat(), "decades": DECADES, "models": models, "model_order": MODELS,
                    "review": dict(review)},
           "countries": out}
with open(ROOT / "site/data/systems_panel.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["iso3", "country", "coloniser", "independence", "curated", "decade", "planning_regime", "planning_institution",
                "monetary_arrangement", "legal_origin", "openness", "gov_share", "un_agree_coloniser", "un_agree_usa", "un_agree_ussr_russia",
                "inheritance_index", "nearest_model", "metro_trade_share"])
    for iso, e in sorted(out.items()):
        for dec, r in e["decades"].items():
            w.writerow([iso, e["name"], e["coloniser"], e["indep"], int(e["curated"]), dec, r["planning_regime"], r["planning_institution"],
                        r["monetary_arrangement"], e["legal_origin"], r["open"], r["gov"], r["un"].get(e["coloniser"]), r["un"].get("USA"),
                        r["un"].get("SUN"), r["inherit"], r["nearest"], r.get("metro_share")])
(ROOT / "site/data/systems.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

cur = [i for i, e in out.items() if e["curated"]]
lines = ["# Systems layer report", "", f"Generated {date.today().isoformat()}", "",
         f"- Ex-colonies with data: {len(out)} (curated with hand codings: {len(cur)})",
         f"- Review status of hand codings: {dict(review)}", "",
         "| country | coloniser | indep | nearest model 1960s | 1980s | 2000s | inheritance 1960s→2000s |", "|---|---|---|---|---|---|---|"]
for iso in cur:
    d = out[iso]["decades"]
    g = lambda k, f: (d.get(k) or {}).get(f)
    lines.append(f"| {iso} | {out[iso]['coloniser']} | {out[iso]['indep']} | {g('1960s','nearest') or g('1970s','nearest')} | {g('1980s','nearest')} | {g('2000s','nearest')} | {g('1960s','inherit') or g('1970s','inherit')} → {g('2000s','inherit')} |")
(ROOT / "data/processed/systems_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"countries={len(out)} curated={len(cur)}")
print("\n".join(lines[6:]))
