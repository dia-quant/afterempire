# Afterempire: Plan of Action

Each phase ends with a ✅ checkpoint reviewed by the project owner.

| Phase | Work | Checkpoint | Status |
|---|---|---|---|
| 0 | Repo, decision log, design brief, plan | Approve brief | **in progress** |
| 1 | **Holdings gazetteer**: every holding of GBR/FRA/PRT/NLD 1800–2025 from Wikidata, cross-checked with COLDAT and ICOW, gaps hand-filled. Status-over-time coding. Entity crosswalk (one ID ↔ names in RICardo/TRADHIST/Wikidata/ISO). Licence audit. | Browse holdings spreadsheet | next |
| 2 | **Visual prototype** (parallel to 1): Territorial Ledger mock (globe, dots, bubbles, slider, filter strip, HUD) + one Record Room page | Look-and-feel sign-off | |
| 3 | Territorial Ledger on real data: transfers, status styles, event callouts, intro tour, historical borders | Live preview | |
| 4 | Trade pipeline (RICardo, TRADHIST, BACI, IMF) → percentile width classes, hover ratios, focus view. Flows of Empire page | Preview + spot-check known cases | |
| 5 | Development data: coloniser profiles, automatic dimensions, drafted hand codings → review sheet. Inherited Systems + Divergence Metrics | Spot-check review sheet | |
| 6 | The Archive, Terms of Account, Correspondence | | |
| 7 | Monthly refresh Action, "updated on" stamps, Cloudflare Pages + R2 deploy, accessibility/mobile/performance pass, Zenodo DOI | Launch | |
| 8 | Stories, more empires, earlier periods | | |

## Repository layout
```
docs/            decisions, design brief, plan, codebooks
data/raw/        downloaded source files (not committed if licence forbids)
data/curated/    hand-editable CSVs: holdings, transfers, crosswalk, codings
data/processed/  pipeline outputs consumed by the site
pipeline/        Python scripts that build processed data from raw + curated
site/            the web front end
```
