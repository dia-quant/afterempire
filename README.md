# Afterempire

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24281902.svg)](https://doi.org/10.5281/zenodo.24281902)

Created by **Dia Atal** (diaatal158@gmail.com); corrections through [Correspondence](https://dia-quant.github.io/afterempire/correspondence).

A geo-spatial, time-indexed tracker of colonial holdings and trade flows, 1800–2025, with an analysis of whether colonisers' development and planning systems shaped those of their former colonies.

**Pages:** Territorial Ledger · Flows of Empire · Inherited Systems · Divergence Metrics · Terms of Account · The Archive · Correspondence

- Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Design brief: [`docs/DESIGN_BRIEF.md`](docs/DESIGN_BRIEF.md)
- Plan: [`docs/PLAN.md`](docs/PLAN.md)

Built entirely on open data. Sources and licences are listed in The Archive.

## Site
- Live: **https://dia-quant.github.io/afterempire/**
- Deploys automatically on every push to `main` that changes `site/` (`.github/workflows/pages.yml`).
- Local preview: `python pipeline/serve.py`, then open http://localhost:8000/ (resolves `/flows` to `flows.html` like GitHub Pages)

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

## Citation
See [`CITATION.cff`](CITATION.cff). Suggested form: Atal, D. (2026). *Afterempire: colonial holdings, trade flows and inherited development systems, 1800–2025* (v0.1.0). Zenodo. https://doi.org/10.5281/zenodo.24281902

The DOI above always resolves to the latest version; v0.1.0 specifically is https://doi.org/10.5281/zenodo.24281903.

## Licence
The project's own data are under **CC BY 4.0** and the code under **MIT** (`LICENSE`). Files derived from third-party sources keep their original licences; see [`LICENSE-DATA.md`](LICENSE-DATA.md).
