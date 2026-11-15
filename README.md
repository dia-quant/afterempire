# Afterempire

A geo-spatial, time-indexed tracker of colonial holdings and trade flows, 1800–2025, with an analysis of whether colonisers' development and planning systems shaped those of their former colonies.

**Pages:** Territorial Ledger · Flows of Empire · Inherited Systems · Divergence Metrics · Terms of Account · The Archive · Correspondence

- Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Design brief: [`docs/DESIGN_BRIEF.md`](docs/DESIGN_BRIEF.md)
- Plan: [`docs/PLAN.md`](docs/PLAN.md)

Built entirely on open data. Sources and licences are listed in The Archive.

## Site
- Live: **https://dia-quant.github.io/afterempire/**
- Deploys automatically on every push to `main` that changes `site/` (`.github/workflows/pages.yml`).
- Local preview: `cd site && python -m http.server`

## Data pipeline
| Step | Command |
|---|---|
| Holdings gazetteer | `python pipeline/build_holdings.py` |
| Trade flows | `python pipeline/build_trade.py` |
| Development systems | `python pipeline/build_systems.py` |
| Archive cards | `python pipeline/build_archive.py` |
| Check for newer source versions | `python pipeline/check_sources.py` (runs monthly; opens an issue if something is newer) |

Raw downloads live in `data/raw/` and are not committed; see `docs/DECISIONS.md` and Terms of Account for sources.
Reviewing codings: `docs/REVIEW_SHEET.md`.
