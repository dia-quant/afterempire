"""Build static geometry for the site: dotted-land grid for the flat map.

Borders are simplified separately with mapshaper (see docs/GAZETTEER_NOTES.md).
Run: python pipeline/build_site_data.py
"""
import json
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
land = json.loads((ROOT / "site/data/land.json").read_text())
feats = land["features"] if "features" in land else land["geometries"]
geom = prep(unary_union([shape(f.get("geometry", f)).buffer(0) for f in feats]))
STEP = 1.0
dots = []
lat = -58.0
while lat <= 84:
    lon = -180.0 + (STEP / 2 if round(lat / STEP) % 2 else 0)  # offset rows -> hex-like grid
    while lon < 180:
        if geom.contains(Point(lon, lat)):
            dots.append([round(lon, 2), round(lat, 2)])
        lon += STEP
    lat += STEP
(ROOT / "site/data/land_dots.json").write_text(json.dumps(dots, separators=(",", ":")))
print(len(dots), "dots")
