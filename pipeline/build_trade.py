"""Build the trade-flow layer for Afterempire.

Sources (all values are approximate):
  1800–1826  RICardo (Dedinger & Girard), current £ sterling, reporter-based.
  1827–2014  TRADHIST v4 (CEPII, Fouquin & Hugot), current £ sterling, exporter→importer.
  2015–2020  CEPII Gravity V202211, BACI trade flow (thousand current US$), exporter→importer.
  2021–2025  no newer bilateral data in these open sources; the site shows 2020 as "latest available".

Keeps only pairs where at least one side is a holding (or former holding) that exists in that year,
then the top N pairs per year. Also builds, per holding, the share of its trade with its metropole.

Inputs : data/raw/{ricardo,tradhist,gravity}, data/raw/geo/countries-50m.json,
         data/curated/{holdings.csv,periods.csv,trade_codes.csv}
Outputs: site/data/trade.json, data/processed/trade_report.md
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import pandas as pd
import pycountry
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
RAW, CUR = ROOT / "data" / "raw", ROOT / "data" / "curated"
TOP_N = 200

# ---------------------------------------------------------------- holdings
holdings = {r["holding_id"]: r for r in csv.DictReader(open(CUR / "holdings.csv", encoding="utf-8"))}
periods = defaultdict(list)


def to_year(s):
    s = s.strip()
    if not s:
        return None
    p = [int(x) for x in s.split("-")]
    return p[0] + ((p[1] - 1) / 12 if len(p) > 1 else 0)


for r in csv.DictReader(open(CUR / "periods.csv", encoding="utf-8")):
    periods[r["holding_id"]].append((to_year(r["start"]), to_year(r["end"]) or 9999, r["controller"], r["status"]))
for v in periods.values():
    v.sort()


def holding_exists(hid, year):
    t = year + 0.5
    return any(s <= t < e for s, e, _, _ in periods[hid])


def controller_at(hid, year):
    """(controller now, last colonial controller up to now)."""
    t = year + 0.5
    now, last = None, None
    for s, e, c, _ in periods[hid]:
        if s > t:
            break
        if c != "SOV":
            last = c
        if s <= t < e:
            now = c
    return now, last


# main holding for an ISO3 code (where one country contains several holdings)
MAIN = {"IND": "ind", "GHA": "gha", "MYS": "fms", "ZAF": "cap", "CMR": "cmr", "TGO": "tgo", "IDN": "idn",
        "CAN": "can", "TTO": "tri", "VNM": "vnm_n", "SOM": "som", "PNG": "pap", "TZA": "tza", "NGA": "nga",
        "YEM": "ade", "PAK": "pak", "BGD": "bgd", "VIR": "dwi", "URY": "mvd", "GNQ": "fpo", "IRL": "irl",
        "GRC": None, "DEU": None, "ESP": None, "USA": None, "NIC": None, "CHN": None}
by_iso = defaultdict(list)
for hid, h in holdings.items():
    by_iso[h["iso3"]].append(hid)

# ---------------------------------------------------------------- nodes
codes = {r["code"]: r for r in csv.DictReader(open(CUR / "trade_codes.csv", encoding="utf-8"))}
geo = json.loads((RAW / "geo" / "countries-50m.json").read_text())


def topo_features(topo, obj="countries"):
    """Minimal TopoJSON → shapely conversion (arcs decoded with transform)."""
    tr = topo.get("transform")
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for a, b in arc:
            if tr:
                x += a; y += b
                pts.append((x * tr["scale"][0] + tr["translate"][0], y * tr["scale"][1] + tr["translate"][1]))
            else:
                pts.append((a, b))
        arcs.append(pts)

    def ring(idx):
        out = []
        for i in idx:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(seg if not out else seg[1:])
        return out

    feats = {}
    for g in topo["objects"][obj]["geometries"]:
        if g["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": [ring(r) for r in g["arcs"]]}
        elif g["type"] == "MultiPolygon":
            geom = {"type": "MultiPolygon", "coordinates": [[ring(r) for r in p] for p in g["arcs"]]}
        else:
            continue
        try:
            feats[str(g.get("id"))] = shape(geom).buffer(0)
        except Exception:
            pass
    return feats


country_geom = topo_features(geo)


def iso_point(code):
    c = pycountry.countries.get(alpha_3=code)
    if not c:
        return None
    g = country_geom.get(str(int(c.numeric)).zfill(3)) or country_geom.get(str(int(c.numeric)))
    if g is None or g.is_empty:
        return None
    big = max(g.geoms, key=lambda p: p.area) if g.geom_type == "MultiPolygon" else g
    p = big.representative_point()
    return round(p.y, 2), round(p.x, 2), c.name


nodes, unresolved = {}, set()


def node(code):
    """Return node info {n, lat, lon, h} or None."""
    if code in nodes:
        return nodes[code]
    info = None
    if code in codes:
        r = codes[code]
        hid = r["holding_id"] or None
        if hid:
            h = holdings[hid]
            lat = float(r["lat"]) if r["lat"] else float(h["lat"])
            lon = float(r["lon"]) if r["lon"] else float(h["lon"])
        else:
            lat, lon = float(r["lat"]), float(r["lon"])
        info = {"n": r["name"], "lat": lat, "lon": lon, "h": hid}
    else:
        hid = MAIN.get(code, by_iso[code][0] if len(by_iso.get(code, [])) == 1 else None)
        if hid:
            h = holdings[hid]
            c = pycountry.countries.get(alpha_3=code)
            info = {"n": c.name if c else h["name"], "lat": float(h["lat"]), "lon": float(h["lon"]), "h": hid}
        else:
            p = iso_point(code)
            if p:
                info = {"n": p[2], "lat": p[0], "lon": p[1], "h": None}
    if info is None:
        unresolved.add(code)
    nodes[code] = info
    return info


# ---------------------------------------------------------------- directional flows → dict[year][(a,b)] = value
flows = defaultdict(lambda: defaultdict(float))   # flows[year][(exporter, importer)] = value (in source unit)
src_year = {}

# RICardo 1800–1826
RIC = {
    "UnitedStatesofAmerica": "USA", "France": "FRA", "Portugal": "PRT", "Spain": "ESP", "RussiaUSSR": "RUS",
    "UnitedKingdom": "GBR", "Scotland": "GBR", "Berwick_IsleofMan_UnitedKingdom": "GBR", "Netherlands": "NLD",
    "Belgium_Netherlands": "UKNLD", "Prussia": "PRUS", "IonianIs": "ION", "AustriaHungaryAustrianEmpire": "AUTHUN",
    "TwoSicilies": "2SICIL", "Java_Madura": "IDN", "IndonesiaDutchEastIndies": "IDN", "Switzerland": "CHE",
    "HanseTowns": "HANS", "Hamburg": "HAMBG", "Denmark": "DNK", "Denmark_Norway": "DNK", "Sweden": "SWE",
    "Norway_Sweden": "SWENOR", "CapeColonyCapeofGoodHope": "ZAFCAP", "SierraLeone": "SLE",
    "BritishWestIndies": "GBRWINDIES", "Cuba": "CUB", "PeoplesRepublicofChinaChina": "CHN", "Malta": "MLT",
    "VirginIslandsDanishWestIndies": "VIR", "Ireland": "IRL", "Gibraltar": "GIB", "BritishEastIndies": "GBRIND",
    "Bengal": "GBRIND", "CapeVerde": "CPV", "Haiti": "HTI", "MadeiraIsles": "MADEIRA", "AzoresWesternIsles": "AZORES",
    "BritishAmerica": "CAN", "BritishNorthernAmerica": "CAN", "NewfoundlandandLabradorNewfoundland": "NFLD",
    "Brazil": "BRA", "Tobago": "TOB", "Mauritius": "MUS", "ReunionBourbonI": "REU", "FrenchWestIndies": "FRAWINDIES",
    "AmericanColonies_FrenchWestIndies": "FRAWINDIES", "NetherlandsAntilles": "ANT",
    "AmericanColonies_NetherlandsAntilles": "ANT", "SriLankaCeylon": "LKA", "PortugueseAsia": "PRTIND",
    "FrenchEastIndies": "FRAIND", "DanishIndia": "DNKIND", "Macao": "MAC", "Philippines": "PHL", "Mexico": "MEX",
    "Japan": "JPN", "Australia": "AUS", "TurkeyOttomanEmpire": "OTTO", "Greece": "GRC", "Chile": "CHL", "Peru": "PER",
    "BuenosAires": "ARG", "ThailandSiam": "THA", "GermanyZollverein": "ZOLL", "Italy": "ITA",
    "KingdomofSardinia": "SARD", "PortugueseAfricaother": "PRTAFRI", "FrenchAfrica": "FRAAFRI",
    "FrenchAfricaother": "FRAAFRI", "BritishAfrica": "GBRAFRI", "ColombiaNewGranadaGranColombia": "COL",
    "Guatemala": "GTM", "PapalStates": "ROME", "Tuscany": "TUSC",
}
for y in range(1800, 1827):
    path = RAW / "ricardo" / f"nn_{y}.json"
    if not path.exists():
        continue
    rep = defaultdict(dict)
    for r in json.loads(path.read_text())["network"]:
        a, b = RIC.get(r["reporting_id"]), RIC.get(r["partner_id"])
        if not a or not b or a == b or not r.get("flow"):
            continue
        key = (a, b) if r["expimp"] == "Exp" else (b, a)
        # exporter's own report preferred over importer's
        kind = "exp" if r["expimp"] == "Exp" else "imp"
        if kind == "exp" or "exp" not in rep[key]:
            rep[key][kind] = float(r["flow"])
    # bilateral endpoint rows (include colonial partners missing from the nations network)
    for f in (RAW / "ricardo_bilateral").glob("*.json"):
        for r in json.loads(f.read_text()):
            if r["year"] != y:
                continue
            a, b = RIC.get(r["reporting_id"]), RIC.get(r["partner_id"])
            if not a or not b or a == b:
                continue
            if r.get("exp"):
                rep[(a, b)]["exp"] = float(r["exp"])
            if r.get("imp") and "exp" not in rep[(b, a)]:
                rep[(b, a)]["imp"] = float(r["imp"])
    for key, d in rep.items():
        if d:
            flows[y][key] = d.get("exp", d.get("imp"))
    src_year[y] = "RICardo"

# TRADHIST 1827–2014
th = pd.read_parquet(RAW / "tradhist" / "tradhist_flows.parquet")
th = th[(th.year >= 1827) & (th.year <= 2014)]
for (y, o, d), v in th.groupby(["year", "iso_o", "iso_d"])["FLOW"].sum().items():
    if o != d:
        flows[int(y)][(o, d)] += float(v)
for y in range(1827, 2015):
    src_year[y] = "TRADHIST"

# Gravity / BACI 2015–2020 (thousand US$ → US$)
gv = pd.read_parquet(RAW / "gravity" / "gravity_trade_2010plus.parquet")
gv = gv[gv.year >= 2015]
gv["v"] = gv["tradeflow_baci"].fillna(gv["tradeflow_imf_o"]) * 1000
for r in gv[gv.v.notna() & (gv.v > 0)].itertuples():
    if r.iso3_o != r.iso3_d:
        flows[int(r.year)][(r.iso3_o, r.iso3_d)] = float(r.v)
for y in range(2015, 2021):
    src_year[y] = "CEPII Gravity (BACI)"

# ---------------------------------------------------------------- per year: pairs touching a holding
METRO = {"GBR": {"GBR"}, "FRA": {"FRA"}, "PRT": {"PRT"}, "NLD": {"NLD", "UKNLD"}, "DEU": {"DEU", "WDEU", "ZOLL", "PRUS"},
         "ESP": {"ESP"}, "DNK": {"DNK"}, "JPN": {"JPN"}, "ITA": {"ITA"}, "USA": {"USA"}, "AUS": {"AUS"},
         "NZL": {"NZL"}, "ZAF": {"ZAF"}, "OTT": {"OTTO", "TUR"}, "SWE": {"SWE", "SWENOR"}, "IND": {"IND"},
         "IDN": {"IDN"}, "BRA": {"BRA"}, "GBRFRA": {"GBR", "FRA"}}
years_out, share = {}, defaultdict(list)
per_h = defaultdict(dict)   # per_h[hid][year] = [[partner, total, out, in], ...] top 20
stats = []
for y in sorted(flows):
    pair = defaultdict(lambda: [0.0, None, None])  # (a,b) sorted -> [total, a->b, b->a]
    for (o, d), v in flows[y].items():
        no, nd = node(o), node(d)
        if not no or not nd:
            continue
        a, b = sorted((o, d))
        rec = pair[(a, b)]
        rec[0] += v
        idx = 1 if o == a else 2
        rec[idx] = (rec[idx] or 0) + v
    keep = []
    totals = defaultdict(float)
    with_metro = defaultdict(float)
    for (a, b), (tot, ab, ba) in pair.items():
        ha, hb = nodes[a]["h"], nodes[b]["h"]
        ok_a = ha and holding_exists(ha, y)
        ok_b = hb and holding_exists(hb, y)
        if ha and hb and ha == hb:
            continue  # internal flow between two nodes of one holding
        if not (ok_a or ok_b):
            continue
        keep.append((a, b, tot, ab, ba))
        for code, hid, other in ((a, ha, b), (b, hb, a)):
            if hid and holding_exists(hid, y):
                totals[(hid, code)] += tot
                now, last = controller_at(hid, y)
                metro = now if now and now != "SOV" else last
                if metro and other in METRO.get(metro, set()):
                    with_metro[(hid, code)] += tot
    keep.sort(key=lambda r: -r[2])
    unit = 1000.0
    # per-holding top partners (for the focus view)
    ph = defaultdict(list)
    for a, b, tot, ab, ba in keep:
        for me, other, out_, in_ in ((a, b, ab, ba), (b, a, ba, ab)):
            hid = nodes[me]["h"]
            if hid and holding_exists(hid, y):
                ph[hid].append([other, round(tot / unit), None if out_ is None else round(out_ / unit), None if in_ is None else round(in_ / unit), me])
    for hid, lst in ph.items():
        lst.sort(key=lambda r: -r[1])
        per_h[hid][str(y)] = lst[:20]
    years_out[str(y)] = [[a, b, round(t / unit), None if ab is None else round(ab / unit), None if ba is None else round(ba / unit)]
                         for a, b, t, ab, ba in keep[:TOP_N]]
    # share series: one line per holding (use its largest code that year)
    best = {}
    for (hid, code), t in totals.items():
        if hid not in best or t > totals[(hid, best[hid])]:
            best[hid] = code
    for hid, code in best.items():
        now, last = controller_at(hid, y)
        metro = now if now and now != "SOV" else last
        t = totals[(hid, code)]
        share[hid].append([y, round(t / unit), round(with_metro[(hid, code)] / unit), metro])
    stats.append((y, len(pair), len(keep)))

used = {c for rows in years_out.values() for r in rows for c in r[:2]}
used |= {r[0] for d in per_h.values() for lst in d.values() for r in lst} | {r[4] for d in per_h.values() for lst in d.values() for r in lst}

# independence year: first sovereign period that follows a non-sovereign one (overrides in curated CSV)
OVR = {r["holding_id"]: int(r["year"]) for r in csv.DictReader(open(CUR / "independence_overrides.csv", encoding="utf-8"))}
indep = {}
for hid, ps in periods.items():
    seen = False
    for s_, e_, c, st in ps:
        if c != "SOV":
            seen = True
        elif seen and s_ >= 1800:
            indep[hid] = int(s_)
            break
indep.update({h: y for h, y in OVR.items() if h in periods})
out = {
    "meta": {
        "generated": date.today().isoformat(), "topN": TOP_N, "latest": max(int(y) for y in years_out),
        "units": [{"from": 1800, "to": 2014, "unit": "£k", "label": "thousand £ sterling, current prices"},
                  {"from": 2015, "to": 2020, "unit": "US$k", "label": "thousand US$, current prices"}],
        "sources": {str(y): src_year[y] for y in sorted(src_year)},
    },
    "nodes": {c: nodes[c] for c in sorted(used)},
    "years": years_out,
    "share": {h: v for h, v in share.items()},
    "indep": indep,
}
hdir = ROOT / "site" / "data" / "trade_h"
hdir.mkdir(parents=True, exist_ok=True)
for old in hdir.glob("*.json"):
    old.unlink()
for hid, d in per_h.items():
    (hdir / f"{hid}.json").write_text(json.dumps(d, separators=(",", ":")), encoding="utf-8")
(ROOT / "site" / "data" / "trade.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

rep = ["# Trade layer report", "", f"Generated {date.today().isoformat()}", "",
       f"- Years with flows: {len(years_out)} ({min(years_out)}–{max(years_out)})",
       f"- Nodes used: {len(used)}", f"- Unresolved trade codes (dropped): {len(unresolved)}", "",
       "## Unresolved codes", ", ".join(sorted(unresolved)) or "none", "",
       "## Pairs per year (all pairs / pairs touching a holding)", "", "| year | all | holding pairs |", "|---|---|---|"]
rep += [f"| {y} | {a} | {k} |" for y, a, k in stats if y % 10 == 0]
(ROOT / "data" / "processed" / "trade_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
size = (ROOT / "site" / "data" / "trade.json").stat().st_size
print(f"years={len(years_out)} nodes={len(used)} unresolved={len(unresolved)} size={size/1e6:.2f}MB")
print("unresolved:", sorted(unresolved))
