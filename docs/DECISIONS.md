# Afterempire: Decision Log

Everything agreed during the scoping discussion. If a later change contradicts this file, update the file in the same commit.

## Purpose & audience
- A geo-spatial, time-indexed tracker of colonial holdings and trade flows, 1800–2025, with an auxiliary analysis of whether colonisers' development/planning systems shaped those of their colonies after independence, and in which direction.
- **Audience:** academic researchers and students.
- The home page is the geo-spatial tracker. Trade and development each get their own deeper pages.

## Scope
- **Colonisers (MVP):** Britain, France, Portugal, Netherlands, covering **every** holding of each.
- **Other powers** (Japan, Germany, Denmark, USA, Ottoman, etc.) appear whenever they acquire or occupy a holding of the four (e.g. Japan in the Dutch East Indies 1942–45; German colonies becoming British/French mandates; Danish India sold to Britain 1845). The data model supports any coloniser, so adding more empires later only means adding rows.
- **Period:** 1800–2025, with yearly resolution.
- **What counts as a colony:** any control that is "more than soft power". That includes colonies, protectorates, League mandates / UN trust territories, chartered-company rule, condominiums and military occupation of an existing holding. Informal empire (e.g. Britain in Argentina) is excluded.
- **Settler dominions** (Canada, Australia, NZ, South Africa, Newfoundland, Brazil to 1822) are included, with graded status. They are treated as a separate group in the development analysis (filter on by default).
- **Territories still dependent in 2025** (French overseas departments, Aruba, Curaçao, Gibraltar, Falklands, etc.) get an "integrated / still dependent" status.

## Unit of analysis
- A **holding** is a territory, enclave or trading post with a location, a status, and a sequence of owners. Example: India = British India + princely states + French, Portuguese, Dutch and Danish enclaves.
- Bubbles have **no magnitude**. Size is fixed by holding type (territory vs enclave/port) for visibility only.
- **Status encoding:** ● solid = colony / protectorate / mandate / company rule · ◐ half = self-governing / dominion · ○ hollow = sovereign (former holding, still tracked for trade).

## Trade flows
- One arc per pair = **total bilateral trade**. No commodity breakdown at this stage.
- **Widths are relative to period t**: flows are ranked by percentile **among the flows currently shown** and mapped to ~6 width classes. The largest visible flow is always widest. Widths are not comparable across years, and the map says so.
- **Default view:** flows where at least one side is a holding or former holding of the selected empire(s), top 50 per year. **Focus view** (click a holding): its top ~20 partners.
- **Hover:** a HUD box with approximate total, rank, and the **direction ratio** as a simple fraction (e.g. 3:2), plus which side ran the surplus. Flows recorded by only one partner are labelled "one-sided estimate".
- Values are approximate. Estimation and interpolation are acceptable and always flagged.

## Development origins
- ~10 dimensions describe each economy's "development system": planning regime, planning institution, monetary arrangement, central bank independence, legal origin, state ownership, trade orientation, fiscal structure, administrative tradition, geopolitical alignment.
- Colonisers are profiled at decolonisation. Ex-colonies are profiled by decade after independence.
- **Qualitative** lineage per country (influence shares from coloniser / Soviet bloc / US–World Bank–IMF / regional / homegrown, with citations and confidence).
- **Quantitative** page: inheritance index, nearest model, persistence half-life, trade-vs-institutions link.
- **Descriptive, not causal.** A downloadable panel (CSV + codebook) will be published on Zenodo with a DOI.
- Hand-coded dimensions are drafted with citations into a plain review sheet. The project owner spot-checks it (no code involved).
- Sources from colonised countries (national plan documents, archives, scholars) are explicitly included.
- No further dimensions for now (avoid data saturation).

## Pages (names)
| Function | Name |
|---|---|
| Home: geo-spatial tracker | **Territorial Ledger** |
| Trade | **Flows of Empire** |
| Development: qualitative lineages | **Inherited Systems** |
| Development: quantitative scores | **Divergence Metrics** |
| Method | **Terms of Account** |
| Sources | **The Archive** |
| Contributions | **Correspondence** |

**Site name:** Afterempire

## Design
See `DESIGN_BRIEF.md`.

## Infrastructure
- Static site, no backend. Cloudflare Pages for the site, Cloudflare R2 for large data files. Code + pipeline on GitHub.
- Historical data is frozen and versioned. Post-independence indicators (World Bank, trade) are refreshed monthly by a scheduled GitHub Action, never fetched client-side.
- Each dataset shows an "updated on" stamp.
- Curated data lives in plain CSVs editable without code.
- Correspondence submissions become GitHub issues for approval.
- Open-source data only.
