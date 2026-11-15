# Gazetteer notes

`data/curated/holdings.csv` lists one row per holding (territory, enclave or island group) with a representative point (capital or main port).
`data/curated/periods.csv` lists consecutive control periods per holding: `start`/`end` as `YYYY` or `YYYY-MM-DD`, end exclusive, blank end = ongoing.

Edit the CSVs directly, then run `python pipeline/build_holdings.py`. It fails if periods overlap or leave gaps, and writes `data/processed/validation_report.md`.

## Codes
- **controller**: GBR FRA PRT NLD (focus empires) · DNK SWE DEU JPN ITA OTT ESP USA AUS NZL ZAF IND IDN BRA ARG UN RHO · GBRFRA (condominium) · SOV (sovereign / independent, including absorption into a sovereign state)
- **status → bubble style**
  - solid: colony, protectorate, mandate, trust, company, condominium, occupation, leased
  - ringed: integrated, still_dependent
  - half: self_governing, dominion
  - hollow: sovereign
- **confidence**: high / medium. Medium means the start or end date is debated or simplified.

## Known differences from COLDAT (Becker 2019), and why
| Case | Ours | COLDAT | Reason |
|---|---|---|---|
| Canada, Australia, NZ, South Africa | dominion until the Statute of Westminster (1931/1942/1947) | ~1919–20 | COLDAT ends at Versailles signature; we show a graded dominion stage |
| Egypt | 1922 | 1935 | we use the 1922 declaration; COLDAT uses the 1936 treaty |
| Iraq | 1932, plus reoccupation 1941–47 | 1932 | we include the WWII British reoccupation |
| Guyana (NLD), St Lucia (FRA) | end at British occupation 1803 | 1814–15 | COLDAT ignores wartime occupations; we show them |
| Indonesia (NLD) | 1949 | 1962 | West New Guinea is a separate holding here (to 1962) |
| Malaysia | 1957 (Malaya) | 1963 | Sarawak, North Borneo and Singapore are separate holdings to 1963 |
| Namibia, Nauru, Samoa, PNG (New Guinea) | South African / Australian / NZ control | British | mandates were held by the dominions; coded as those powers |
| Ghana (PRT) | none after 1800 | 1823 | no Portuguese Gold Coast holding after 1800 found; flag for review |

## Simplifications
- Large colonies are single points (e.g. Nigeria, Kenya). Holdings are split only where ownership differed (Cameroons, Togoland, the Indian enclaves, Straits Settlements, South African colonies).
- Princely states: Hyderabad and Mysore represent the ~560 states under British paramountcy.
- A "Merged into a larger holding" event is generated when a holding's last period ends before 2025 (e.g. Natal → Union of South Africa in 1910).
