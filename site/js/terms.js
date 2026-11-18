/* Afterempire · Terms of Account: fills the model and affinity tables straight from data/systems.json,
   so the method page cannot drift from the pipeline. */
(async () => {
  const $ = (id) => document.getElementById(id);
  const NAME = { GBR: "British", FRA: "French", PRT: "Portuguese", NLD: "Dutch", SUN: "Soviet", USA: "US / BW" };
  const PLAN = { 0: "none", 0.25: "limited", 0.5: "indicative", 0.75: "comprehensive", 1: "central" };
  const label = (s) => s.replace(/_/g, " ");
  try {
    const D = await fetch("data/systems.json").then((r) => r.json());
    const M = D.meta, order = M.model_order;
    $("folio-date").textContent = `DATA UP TO DATE AS OF ${(window.AE_ASOF || "").toUpperCase()}`;
    $("t-models").innerHTML = `<thead><tr><th>Model</th><th>Plan</th><th>Institution</th><th>Money</th><th>Law</th></tr></thead><tbody>${order.map((k) => {
      const m = M.models[k];
      return `<tr><td>${NAME[k]}</td><td>${PLAN[m.planning_regime]}</td><td>${label(m.planning_institution)}</td><td>${label(m.monetary_arrangement)}</td><td>${m.legal_origin}</td></tr>`;
    }).join("")}</tbody>`;
    const aff = (tab, cols) => `<thead><tr><th></th>${cols.map((c) => `<th>${c === "_coloniser" ? "own col." : c}</th>`).join("")}</tr></thead><tbody>${Object.entries(tab).map(([k, v]) =>
      `<tr><td>${label(k)}</td>${cols.map((c) => `<td class="num${v[c] ? "" : " zero"}">${v[c] ?? 0}</td>`).join("")}</tr>`).join("")}</tbody>`;
    $("t-inst").innerHTML = aff(M.institution_affinity, order);
    $("t-mon").innerHTML = aff(M.monetary_affinity, ["_coloniser", ...order]);
  } catch (e) {
    $("t-models").innerHTML = `<tbody><tr><td>Could not load data/systems.json. Reload the page to try again.</td></tr></tbody>`;
  }
})();
