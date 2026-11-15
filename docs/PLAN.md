# Afterempire: Plan of Action

Each phase ends with a ✅ checkpoint reviewed by the project owner.

| Phase | Work | Checkpoint | Status |
|---|---|---|---|
| 0 | Repo, decision log, design brief, plan | Approve brief | done |
| 1 | **Holdings gazetteer**: every holding of GBR/FRA/PRT/NLD 1800–2025 from Wikidata, cross-checked with COLDAT and ICOW, gaps hand-filled. Status-over-time coding. Entity crosswalk (one ID ↔ names in RICardo/TRADHIST/Wikidata/ISO). Licence audit. | Browse holdings spreadsheet | done (v0.1; Wikidata/ICOW cross-links = Phase 1b) |
| 2 | **Visual prototype** (parallel to 1): Territorial Ledger mock (globe, dots, bubbles, slider, filter strip, HUD) + one Record Room page | Look-and-feel sign-off | done (review deferred to built site) |
| 3 | Territorial Ledger on real data: transfers, status styles, event callouts, intro tour, historical borders | Live preview | **v0.1 built** (globe, flat, intro, feed, panel, table, Archive) |
| 4 | Trade pipeline (RICardo, TRADHIST, BACI, IMF) → percentile width classes, hover ratios, focus view. Flows of Empire page | Preview + spot-check known cases | **v0.1 built** (arcs, hover ratio, focus view, Flows of Empire page) |
| 5 | Development data: coloniser profiles, automatic dimensions, drafted hand codings → review sheet. Inherited Systems + Divergence Metrics | Spot-check review sheet | **v0.1 built** (21 files, 94 ex-colonies, review sheet in docs/REVIEW_SHEET.md) |
| 6 | The Archive, Terms of Account, Correspondence | | **v0.1 built** (Correspondence opens pre-filled GitHub issues; labels and issue templates in repo) |
| 7 | Monthly refresh Action, "updated on" stamps, Cloudflare Pages + R2 deploy, accessibility/mobile/performance pass, Zenodo DOI | Launch | **live** at https://dia-quant.github.io/afterempire/ (deploy on push, monthly source check, 0 axe violations); Zenodo release pending review of codings |
| 8 | Stories, more empires, earlier periods | | |

## Review approach
The project owner reviews the built site and gives feedback in rounds, instead of signing off at each checkpoint.

## Preview
`python pipeline/make_preview.py OUT_DIR` makes a copy of `site/` for publishing as a claude.ai preview. For local viewing: `cd site && python -m http.server`.

## Repository layout
```
docs/            decisions, design brief, plan, codebooks
data/raw/        downloaded source files (not committed if licence forbids)
data/curated/    hand-editable CSVs: holdings, transfers, crosswalk, codings
data/processed/  pipeline outputs consumed by the site
pipeline/        Python scripts that build processed data from raw + curated
site/            the web front end
```
