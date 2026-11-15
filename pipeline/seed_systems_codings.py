"""One-off seed for data/curated/systems_codings.csv (the review sheet).

After seeding, the CSV is the source of truth: edit it directly (or in a spreadsheet) and mark
`review` as ok / flag. Re-running this script overwrites the CSV, so only run it to reset.

Planning regime scale: 0 none/market · 0.25 limited · 0.5 indicative · 0.75 comprehensive (mixed economy,
public-sector-led five-year plans) · 1 central (socialist, imperative).
Institution families: central_committee · plan_ministry · planning_commission · technocratic_board · advisory · none
Monetary: coloniser_zone · own_peg · own_float · nonconvertible
Drafted by the project from the sources cited; confidence is the drafter's own rating.
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"]

# country: (iso3, name, holding, coloniser, legal, admin, planning by decade, institution by decade, monetary by decade, sources)
C = {
 "IND": ("British India / India", "ind", "GBR", "common", "direct (with princely states under indirect rule)",
   [.75, .75, .75, .75, .5, .5, .25],
   ["planning_commission"] * 7,
   ["own_peg", "own_peg", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "Government of India Planning Commission, Second Five Year Plan (1956); Chakravarty, S. (1987) Development Planning: The Indian Experience; NITI Aayog replaced the Planning Commission in 2015."),
 "PAK": ("Pakistan", "pak", "GBR", "common", "direct",
   [.5, .5, .75, .5, .25, .25, .25], ["planning_commission"] * 7,
   ["own_peg", "own_peg", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "Government of Pakistan, First Five Year Plan 1955–60 (prepared with the Harvard Advisory Group); 1972 nationalisations under Bhutto; Papanek, G. (1967) Pakistan's Development."),
 "BGD": ("Bangladesh", "bgd", "GBR", "common", "direct",
   [None, None, .75, .5, .25, .25, .5], [None, None] + ["planning_commission"] * 5,
   [None, None, "own_peg", "own_peg", "own_peg", "own_float", "own_float"],
   "Government of Bangladesh Planning Commission, First Five Year Plan 1973–78 and Sixth Five Year Plan 2011–15."),
 "LKA": ("Ceylon / Sri Lanka", "lka", "GBR", "common", "direct",
   [.25, .5, .75, .25, .25, .25, .25], ["planning_commission"] * 7,
   ["own_peg", "own_peg", "own_peg", "own_peg", "own_peg", "own_float", "own_float"],
   "National Planning Council, The Ten-Year Plan (1959); Five-Year Plan 1972–76; 1977 liberalisation (Jayewardene government)."),
 "MMR": ("Burma / Myanmar", "mmr", "GBR", "common", "direct (Burma proper) and indirect (frontier areas)",
   [.75, 1, 1, 1, .5, .5, .25], ["plan_ministry", "central_committee", "central_committee", "central_committee", "plan_ministry", "plan_ministry", "plan_ministry"],
   ["own_peg", "nonconvertible", "nonconvertible", "nonconvertible", "nonconvertible", "nonconvertible", "own_float"],
   "Pyidawtha: The New Burma (1954), eight-year plan drafted with Knappen Tippetts Abbett; Revolutionary Council, The Burmese Way to Socialism (1962)."),
 "MYS": ("Malaya / Malaysia", "fms", "GBR", "common", "indirect (Malay states) and direct (Straits Settlements)",
   [.25, .5, .75, .5, .5, .5, .5], ["technocratic_board"] * 7,
   ["coloniser_zone", "own_peg", "own_peg", "own_peg", "own_peg", "own_peg", "own_float"],
   "Federation of Malaya, First Five-Year Plan 1956–60; First Malaysia Plan 1966–70; Second Malaysia Plan 1971–75 (New Economic Policy); Economic Planning Unit (1961)."),
 "SGP": ("Singapore", "sgp", "GBR", "common", "direct",
   [None, .5, .5, .5, .25, .25, .25], [None] + ["technocratic_board"] * 6,
   [None, "coloniser_zone", "own_peg", "own_peg", "own_peg", "own_peg", "own_peg"],
   "State of Singapore, Development Plan 1961–1964; Economic Development Board (1961); UN Industrial Survey Mission (Winsemius) report (1961)."),
 "IDN": ("Dutch East Indies / Indonesia", "idn", "NLD", "civil", "indirect through regents (bupati)",
   [.5, .75, .5, .5, .5, .5, .5], ["technocratic_board"] * 7,
   ["own_peg", "nonconvertible", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "First Five-Year Plan 1956–60; Eight-Year Overall Development Plan 1961–69 (Guided Economy); Repelita I 1969–74 and Bappenas; Thee Kian Wie (ed.) (2003) Recollections."),
 "VNM": ("Vietnam", "vnm_n", "FRA", "civil", "direct (Cochinchina) and protectorate (Annam, Tonkin)",
   [1, 1, 1, .75, .5, .5, .5], ["central_committee"] * 4 + ["plan_ministry"] * 3,
   ["nonconvertible"] * 4 + ["own_peg"] * 3,
   "Democratic Republic of Vietnam, First Five-Year Plan 1961–65; Sixth Party Congress, Đổi Mới (1986); Ministry of Planning and Investment (1995)."),
 "GHA": ("Gold Coast / Ghana", "gha", "GBR", "common", "indirect",
   [.5, .75, .5, .25, .25, .25, .25], ["planning_commission"] * 7,
   ["coloniser_zone", "own_peg", "own_peg", "own_float", "own_float", "own_float", "own_float"],
   "Government of Ghana, Seven-Year Development Plan 1963/64–1969/70; Killick, T. (1978) Development Economics in Action; Economic Recovery Programme (1983)."),
 "NGA": ("Nigeria", "nga", "GBR", "common", "indirect (Lugard)",
   [None, .5, .75, .5, .25, .25, .25], [None] + ["plan_ministry"] * 6,
   [None, "own_peg", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "Federal Government of Nigeria, First National Development Plan 1962–68; Second National Development Plan 1970–74; Structural Adjustment Programme (1986)."),
 "KEN": ("Kenya", "ken", "GBR", "common", "indirect (settler colony with direct administration of highlands)",
   [None, .5, .5, .25, .25, .25, .25], [None] + ["plan_ministry"] * 6,
   [None, "coloniser_zone", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "Republic of Kenya, Sessional Paper No. 10 of 1965: African Socialism and its Application to Planning in Kenya; Development Plan 1966–70; Kenya Vision 2030 (2008)."),
 "TZA": ("Tanganyika / Tanzania", "tza", "GBR", "common", "indirect",
   [None, .75, 1, .75, .25, .25, .5], [None] + ["plan_ministry"] * 6,
   [None, "coloniser_zone", "own_peg", "own_peg", "own_float", "own_float", "own_float"],
   "First Five-Year Plan 1964–69; Nyerere, J. (1967) The Arusha Declaration; Coulson, A. (1982) Tanzania: A Political Economy; Economic Recovery Programme (1986)."),
 "SEN": ("Senegal", "sen", "FRA", "civil", "direct (assimilation in the Four Communes)",
   [None, .5, .5, .25, .25, .25, .25], [None] + ["plan_ministry"] * 6,
   [None] + ["coloniser_zone"] * 6,
   "Plan quadriennal de développement 1961–64 (prepared with Louis-Joseph Lebret and IRFED); CFA franc zone (BCEAO) throughout; Plan Sénégal Émergent (2014)."),
 "CIV": ("Côte d'Ivoire", "civ", "FRA", "civil", "direct",
   [None, .5, .5, .25, .25, .25, .5], [None] + ["plan_ministry"] * 6,
   [None] + ["coloniser_zone"] * 6,
   "Ministère du Plan, Perspectives décennales de développement 1960–1970; Plan quinquennal 1971–75; Plan national de développement 2012–15; CFA franc zone throughout."),
 "GIN": ("Guinea", "gin", "FRA", "civil", "direct",
   [None, 1, 1, .25, .25, .25, .25], [None] + ["central_committee"] * 2 + ["plan_ministry"] * 4,
   [None, "nonconvertible", "nonconvertible", "own_peg", "own_float", "own_float", "own_float"],
   "Plan triennal 1960–63 (Sékou Touré government, with Soviet-bloc aid); exit from the franc zone (1960); liberalisation after 1984 (Conté)."),
 "DZA": ("Algeria", "dza", "FRA", "civil", "direct (départements)",
   [None, .75, 1, .75, .25, .5, .5], [None] + ["plan_ministry"] * 6,
   [None, "own_peg", "nonconvertible", "nonconvertible", "own_float", "own_float", "own_float"],
   "Plan triennal 1967–69; Premier Plan quadriennal 1970–73 (industrialising industries, after Destanne de Bernis); IMF stand-by and adjustment (1994)."),
 "TUN": ("Tunisia", "tun", "FRA", "civil", "protectorate (indirect through the bey)",
   [.25, .75, .5, .5, .25, .25, .25], ["plan_ministry"] * 7,
   ["coloniser_zone", "own_peg", "own_peg", "own_peg", "own_peg", "own_float", "own_float"],
   "Perspectives décennales de développement 1962–1971 (Ahmed Ben Salah); end of the cooperative experiment (1969); Nouira liberalisation (1970s)."),
 "MAR": ("Morocco", "mar", "FRA", "civil", "protectorate (indirect through the makhzen)",
   [.5, .5, .5, .25, .25, .25, .25], ["plan_ministry"] * 7,
   ["coloniser_zone", "own_peg", "own_peg", "own_peg", "own_peg", "own_peg", "own_peg"],
   "Plan quinquennal 1960–64 (Abderrahim Bouabid); Moroccanisation decree (1973); Structural adjustment (1983); Haut-Commissariat au Plan."),
 "AGO": ("Angola", "ago", "PRT", "civil", "direct",
   [None, None, 1, 1, .5, .5, .5], [None, None, "central_committee", "central_committee", "plan_ministry", "plan_ministry", "plan_ministry"],
   [None, None, "nonconvertible", "nonconvertible", "nonconvertible", "own_float", "own_peg"],
   "MPLA First Congress (1977), Marxist-Leninist programme; Programa de Saneamento Económico e Financeiro (1987); market reforms from 1990."),
 "MOZ": ("Mozambique", "moz", "PRT", "civil", "direct (with chartered companies in the centre and north)",
   [None, None, 1, .75, .25, .25, .25], [None, None, "central_committee", "central_committee", "plan_ministry", "plan_ministry", "plan_ministry"],
   [None, None, "nonconvertible", "nonconvertible", "own_float", "own_float", "own_float"],
   "FRELIMO Third Congress (1977); Plano Prospectivo Indicativo (1981); Programa de Reabilitação Económica (1987); PARPA poverty reduction plans (2001–)."),
}

rows = []
for iso, (name, hid, col, legal, admin, plan, inst, mon, src) in C.items():
    rows.append([iso, name, hid, col, "static", "legal_origin", legal, "La Porta, Lopez-de-Silanes and Shleifer (2008) legal-origin classification", "La Porta et al. (2008) J. Econ. Lit. 46(2)", "high", "", ""])
    rows.append([iso, name, hid, col, "static", "admin_tradition", admin, "Colonial administrative practice", "Lange, M. (2009) Lineages of Despotism and Development; Müller-Crepon (2020) for French Africa", "medium", "", ""])
    for i, dec in enumerate(D):
        if plan[i] is not None:
            rows.append([iso, name, hid, col, dec, "planning_regime", plan[i], "", src, "medium", "", ""])
        if inst[i] is not None:
            rows.append([iso, name, hid, col, dec, "planning_institution", inst[i], "", src, "medium", "", ""])
        if mon[i] is not None:
            rows.append([iso, name, hid, col, dec, "monetary_arrangement", mon[i], "", src, "medium", "", ""])

with open(ROOT / "data/curated/systems_codings.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["iso3", "country", "holding_id", "coloniser", "decade", "dimension", "value", "evidence", "source", "confidence", "review", "review_note"])
    w.writerows(rows)
print(len(rows), "rows")
