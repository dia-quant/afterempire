"""Validate the curated holdings gazetteer and build the JSON the site consumes.

Inputs : data/curated/holdings.csv, data/curated/periods.csv, data/raw/coldat/dyads.csv (optional)
Outputs: data/processed/holdings.json, data/processed/validation_report.md

Run:  python pipeline/build_holdings.py
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CUR = ROOT / "data" / "curated"
OUT = ROOT / "data" / "processed"
COLDAT = ROOT / "data" / "raw" / "coldat" / "dyads.csv"

START_YEAR, END_YEAR = 1800, 2025

CONTROLLERS = {
    "GBR": "British", "FRA": "French", "PRT": "Portuguese", "NLD": "Dutch",
    "DNK": "Danish", "SWE": "Swedish", "DEU": "German", "JPN": "Japanese",
    "ITA": "Italian", "OTT": "Ottoman", "ESP": "Spanish", "USA": "United States",
    "AUS": "Australian", "NZL": "New Zealand", "ZAF": "South African",
    "IND": "Indian", "IDN": "Indonesian", "ARG": "Argentine", "UN": "United Nations",
    "RHO": "Rhodesian (UDI)", "BRA": "Brazilian", "GBRFRA": "Anglo-French condominium",
    "SOV": "Sovereign",
}
FOCUS = {"GBR", "FRA", "PRT", "NLD"}
# status -> bubble style used by the site
STATUS_STYLE = {
    "colony": "solid", "protectorate": "solid", "mandate": "solid", "trust": "solid",
    "company": "solid", "condominium": "solid", "occupation": "solid", "leased": "solid",
    "integrated": "ringed", "still_dependent": "ringed",
    "self_governing": "half", "dominion": "half",
    "sovereign": "hollow",
}
COLDAT_NAME = {"GBR": "britain", "FRA": "france", "PRT": "portugal", "NLD": "netherlands"}


def to_year(s: str) -> float | None:
    """'1947' -> 1947.0 ; '1947-08-15' -> fractional year."""
    s = s.strip()
    if not s:
        return None
    parts = [int(p) for p in s.split("-")]
    if len(parts) == 1:
        return float(parts[0])
    y, m = parts[0], parts[1]
    d = parts[2] if len(parts) > 2 else 1
    doy = (date(y, m, d) - date(y, 1, 1)).days
    days = (date(y + 1, 1, 1) - date(y, 1, 1)).days
    return round(y + doy / days, 4)


def read(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    holdings = read(CUR / "holdings.csv")
    periods = read(CUR / "periods.csv")
    errors: list[str] = []
    warnings: list[str] = []

    hmap = {}
    for h in holdings:
        if h["holding_id"] in hmap:
            errors.append(f"duplicate holding_id {h['holding_id']}")
        hmap[h["holding_id"]] = h

    by_h: dict[str, list[dict]] = {}
    for p in periods:
        if p["holding_id"] not in hmap:
            errors.append(f"period for unknown holding {p['holding_id']}")
            continue
        if p["controller"] not in CONTROLLERS:
            errors.append(f"{p['holding_id']}: unknown controller {p['controller']}")
        if p["status"] not in STATUS_STYLE:
            errors.append(f"{p['holding_id']}: unknown status {p['status']}")
        if (p["controller"] == "SOV") != (p["status"] == "sovereign"):
            errors.append(f"{p['holding_id']} {p['start']}: SOV controller must pair with sovereign status")
        p["_s"], p["_e"] = to_year(p["start"]), to_year(p["end"])
        if p["_e"] is not None and p["_e"] < p["_s"]:
            errors.append(f"{p['holding_id']} {p['start']}: end before start")
        by_h.setdefault(p["holding_id"], []).append(p)

    for hid in hmap:
        if hid not in by_h:
            errors.append(f"holding {hid} has no periods")
    for hid, ps in by_h.items():
        ps.sort(key=lambda p: p["_s"])
        for a, b in zip(ps, ps[1:]):
            if a["_e"] is None:
                errors.append(f"{hid}: open-ended period followed by another")
            elif abs(a["_e"] - b["_s"]) > 1e-6:
                kind = "gap" if a["_e"] < b["_s"] else "overlap"
                errors.append(f"{hid}: {kind} between {a['end']} and {b['start']}")
        if not any(p["controller"] in FOCUS for p in ps):
            warnings.append(f"{hid}: never held by a focus empire")

    # ---- COLDAT cross-check: compare last focus-empire end year with COLDAT colend_max
    coldat_rows = []
    if COLDAT.exists():
        cd = {}
        for r in read(COLDAT):
            if r["col"] == "1":
                cd[(r["country"], r["colonizer"])] = r
        matched_countries = set()
        for hid, ps in by_h.items():
            cname = hmap[hid]["coldat_country"].strip()
            if not cname:
                continue
            matched_countries.add(cname)
            for code, cz in COLDAT_NAME.items():
                ours = [p for p in ps if p["controller"] == code
                        or (p["controller"] == "GBRFRA" and code in ("GBR", "FRA"))]
                row = cd.get((cname, cz))
                if not ours and not row:
                    continue
                if row and row["colend_max"] not in ("", "NA") and float(row["colend_max"]) < START_YEAR:
                    continue
                our_end = max((p["_e"] or END_YEAR) for p in ours) if ours else None
                # end of direct rule (excludes dominion / self-governing stages)
                direct = [p for p in ours if STATUS_STYLE[p["status"]] in ("solid", "ringed")]
                our_direct = max((p["_e"] or END_YEAR) for p in direct) if direct else None
                c_end = None if not row or row["colend_max"] in ("", "NA") else float(row["colend_max"])
                if our_end is None:
                    status = "missing in ours"
                elif c_end is None:
                    status = "not in COLDAT"
                else:
                    if abs(our_end - c_end) <= 3:
                        status = "ok"
                    elif our_direct is not None and abs(our_direct - c_end) <= 3:
                        status = "ok (COLDAT ends at self-government/dominion)"
                    else:
                        status = f"differs by {our_end - c_end:+.0f}y"
                coldat_rows.append((cname, hid, code, our_end, c_end, status))
        all_c = {k[0] for k, r in cd.items() if r["colonizer"] in COLDAT_NAME.values()
                 and (r["colend_max"] in ("", "NA") or float(r["colend_max"]) >= START_YEAR)}
        for c in sorted(all_c - matched_countries):
            warnings.append(f"COLDAT country not linked to any holding: {c}")
    else:
        warnings.append("COLDAT not downloaded; cross-check skipped")

    # ---- build output
    out_h, events = [], []
    for h in holdings:
        ps = by_h.get(h["holding_id"], [])
        rows = []
        for i, p in enumerate(ps):
            prev = ps[i - 1] if i else None
            rows.append({
                "s": p["_s"], "e": p["_e"], "c": p["controller"], "st": p["status"],
                "ev": p["event"], "cf": p["confidence"],
            })
            if START_YEAR <= p["_s"] <= END_YEAR + 1:
                events.append({
                    "t": p["_s"], "h": h["holding_id"], "name": h["name"],
                    "from": prev["controller"] if prev else None, "to": p["controller"],
                    "st": p["status"], "label": p["event"],
                })
        if ps and ps[-1]["_e"] is not None and ps[-1]["_e"] <= END_YEAR:
            events.append({"t": ps[-1]["_e"], "h": h["holding_id"], "name": h["name"],
                           "from": ps[-1]["controller"], "to": None, "st": None,
                           "label": "Merged into a larger holding"})
        out_h.append({
            "id": h["holding_id"], "name": h["name"], "kind": h["kind"],
            "lat": float(h["lat"]), "lon": float(h["lon"]), "iso3": h["iso3"],
            "region": h["region"], "periods": rows,
        })
    events.sort(key=lambda e: e["t"])

    # data density = active non-sovereign holdings + transfer events, per year
    density = []
    for y in range(START_YEAR, END_YEAR + 1):
        t = y + 0.5
        active = sum(1 for h in out_h for p in h["periods"]
                     if p["s"] <= t < (p["e"] or 9999) and p["c"] != "SOV")
        ev = sum(1 for e in events if y <= e["t"] < y + 1)
        density.append({"y": y, "active": active, "events": ev})

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {"generated": date.today().isoformat(), "start": START_YEAR, "end": END_YEAR,
                 "controllers": CONTROLLERS, "focus": sorted(FOCUS), "statusStyle": STATUS_STYLE},
        "holdings": out_h, "events": events, "density": density,
    }
    (OUT / "holdings.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    rep = ["# Holdings validation report", "", f"Generated {date.today().isoformat()}", "",
           f"- Holdings: **{len(holdings)}**", f"- Periods: **{len(periods)}**",
           f"- Transfer events 1800–2025: **{len(events)}**", "",
           f"## Errors ({len(errors)})", *([f"- {e}" for e in errors] or ["- none"]), "",
           f"## Warnings ({len(warnings)})", *([f"- {w}" for w in warnings] or ["- none"]), "",
           "## COLDAT cross-check (end year of rule by each focus empire)", "",
           "| COLDAT country | holding | empire | our end | COLDAT end | result |", "|---|---|---|---|---|---|"]
    for c, hid, code, oe, ce, st in sorted(coldat_rows):
        rep.append(f"| {c} | {hid} | {code} | {'' if oe is None else int(oe)} | {'' if ce is None else int(ce)} | {st} |")
    (OUT / "validation_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

    print(f"holdings={len(holdings)} periods={len(periods)} events={len(events)} "
          f"errors={len(errors)} warnings={len(warnings)}")
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
