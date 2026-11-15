# Reviewing the development codings (no code needed)

Open `data/curated/systems_codings.csv` in Excel, Numbers or Google Sheets. One row = one country × decade × dimension.

| Column | Meaning |
|---|---|
| value | the coding (planning regime: 0 none · 0.25 limited · 0.5 indicative · 0.75 comprehensive · 1 central) |
| source | where it comes from |
| confidence | drafter's rating |
| **review** | write `ok` or `flag` |
| **review_note** | anything you'd change, and why |

Qualitative lineage shares and evidence notes are in `data/curated/lineages.json` (one block per country). Comment on them in a review note or a GitHub issue.

After editing, run `python pipeline/build_systems.py` (or ask Claude to). The site shows the count of reviewed and flagged rows on Inherited Systems.
