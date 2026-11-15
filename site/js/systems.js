/* Afterempire · Inherited Systems: folder stack of curated country files. Data: data/systems.json */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EMP = { GBR: "British", FRA: "French", PRT: "Portuguese", NLD: "Dutch" };
  const TAB = { GBR: "--tab-gbr", FRA: "--tab-fra", PRT: "--tab-prt", NLD: "--tab-nld" };
  const COL = { GBR: "--gbr", FRA: "--fra", PRT: "--prt", NLD: "--nld" };
  const PLAN = { 0: "none / market", 0.25: "limited", 0.5: "indicative", 0.75: "comprehensive", 1: "central" };
  const INST = { central_committee: "central planning committee", plan_ministry: "ministry / commissariat of plan", planning_commission: "planning commission",
    technocratic_board: "technocratic planning board", advisory: "advisory / forecasting body", none: "none" };
  const MON = { coloniser_zone: "coloniser's currency zone", own_peg: "own currency, pegged", own_float: "own currency, floating", nonconvertible: "non-convertible" };
  const MODEL = { SUN: "Soviet", USA: "US / Bretton Woods" };
  const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  let D, filter = null;

  function lineageSVG(c) {
    const sh = c.lineage.shares;
    const keys = [["coloniser", `${EMP[c.coloniser]} legacy`, css(COL[c.coloniser])], ["soviet", "Soviet bloc", css("--soviet")],
      ["us_wb_imf", "US / WB / IMF", css("--uswb")], ["regional", "Regional", "url(#hatch)"], ["homegrown", "Homegrown", css("--home")]];
    const W = 520, H = 230, x0 = 150, x1 = 360, bw = 14, gap = 6;
    const total = keys.reduce((s, k) => s + (sh[k[0]] || 0), 0) || 100;
    const avail = H - gap * (keys.length - 1) - 20;
    let y = 10, ry = 10 + (H - 20 - avail) / 2;
    let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Influences on ${esc(c.name)}'s post-independence system">
      <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f3f1ec"/><line x1="0" y1="0" x2="0" y2="5" stroke="${css("--home")}" stroke-width="1.6"/></pattern></defs>`;
    for (const [k, label, fill] of keys) {
      const v = sh[k] || 0, h = (v / total) * avail;
      if (v > 0) {
        const t0 = y, t1 = y + h, r0 = ry, r1 = ry + h, mx = (x0 + bw + x1) / 2;
        out += `<path d="M${x0 + bw},${t0} C${mx},${t0} ${mx},${r0} ${x1},${r0} L${x1},${r1} C${mx},${r1} ${mx},${t1} ${x0 + bw},${t1} Z" fill="${fill}" opacity="${fill.startsWith("url") ? 0.9 : 0.35}"/>`;
        out += `<rect x="${x0}" y="${t0}" width="${bw}" height="${Math.max(1, h)}" fill="${fill}"/>`;
        out += `<text x="${x0 - 8}" y="${t0 + h / 2 + 4}" text-anchor="end">${esc(label)} ${v}%</text>`;
        ry += h;
      } else {
        out += `<text x="${x0 - 8}" y="${y + 6}" text-anchor="end" fill="${css("--ink-dim")}">${esc(label)} 0%</text>`;
      }
      y += h + gap;
    }
    out += `<rect x="${x1}" y="${10 + (H - 20 - avail) / 2}" width="${bw}" height="${avail}" fill="${css("--ink")}"/>`;
    out += `<text x="${x1 + bw + 8}" y="${H / 2 - 4}">System at</text><text x="${x1 + bw + 8}" y="${H / 2 + 10}">independence</text></svg>`;
    return out;
  }

  // grouped codings: merge runs of identical values; shade = similarity to the coloniser
  function codingsRows(c, decs) {
    const cols = [
      ["planning_regime", (v) => (v == null ? "—" : PLAN[v])],
      ["planning_institution", (v) => INST[v] || "—"],
      ["monetary_arrangement", (v) => MON[v] || "—"],
    ];
    const base = css(COL[c.coloniser]);
    const spans = cols.map(([k]) => {
      const out = new Array(decs.length).fill(0);
      let i = 0;
      while (i < decs.length) {
        let j = i;
        while (j + 1 < decs.length && decs[j + 1][1][k] === decs[i][1][k]) j++;
        out[i] = j - i + 1; i = j + 1;
      }
      return out;
    });
    return decs.map(([d, r], ri) => {
      const cells = cols.map(([k, f], ci) => {
        const n = spans[ci][ri];
        if (!n) return "";
        const sv = r.sim?.[c.coloniser]?.[k];
        const pctMix = sv == null ? 0 : Math.round(12 + 68 * sv);
        const dark = pctMix > 52;
        return `<td class="cat" rowspan="${n}" style="background:color-mix(in srgb, ${base} ${pctMix}%, #fbfaf7);color:${dark ? "#fff" : "var(--ink)"}" title="similarity to ${c.coloniser}: ${sv == null ? "—" : sv.toFixed(2)}">${esc(f(r[k]))}</td>`;
      }).join("");
      return `<tr><td class="dec">${d}</td>${cells}<td class="num g2">${pct(r.open)}</td><td class="num">${pct(r.gov)}</td><td class="num g3">${pct(r.un[c.coloniser])}</td><td class="num">${pct(r.un.USA)}</td><td class="num">${pct(r.un.SUN)}</td></tr>`;
    }).join("");
  }

  const TERMS = [
    ["Lineage shares", "How much each of five influences shaped the first post-independence system: former coloniser, Soviet bloc, US with the World Bank and IMF, regional neighbours, homegrown ideas. Shares sum to 100.", "Editorial judgement", "Plan documents and studies cited in each file"],
    ["Planning regime", "How far the state directed the economy through plans.", "none 0 · limited 0.25 · indicative 0.5 · comprehensive 0.75 · central 1", "Hand-coded from national plan documents (review sheet)"],
    ["Planning institution", "The body that prepared plans.", "central planning committee · ministry/commissariat of plan · planning commission · technocratic board · advisory body · none", "Hand-coded from institutional histories"],
    ["Monetary arrangement", "Whose currency system the country used.", "coloniser's currency zone · own currency, pegged · own currency, floating · non-convertible", "Hand-coded from central bank and currency histories"],
    ["Legal origin", "Family of the legal system.", "common law · civil law", "La Porta, Lopez-de-Silanes and Shleifer (2008)"],
    ["Administration", "How colonial rule was organised.", "direct · indirect · protectorate", "Lange (2009); Müller-Crepon (2020)"],
    ["Openness", "Exports plus imports as a share of GDP, decade average, current prices.", "%", "Penn World Table 11.0, national accounts (dataverse.nl)"],
    ["Gov. share", "Government consumption as a share of GDP, decade average.", "%", "Penn World Table 11.0, national accounts (dataverse.nl)"],
    ["UN voting agreement", "Share of UN General Assembly votes in which the country voted the same way as the reference country, decade average.", "0–100%", "Bailey, Strezhnev and Voeten (2017), Harvard Dataverse doi:10.7910/DVN/LEJUQZ"],
    ["Inheritance index", "Average similarity to the former coloniser across planning regime, institution, monetary arrangement, legal origin and UN voting.", "0 (nothing in common) to 1 (identical)", "Computed (pipeline/build_systems.py)"],
    ["Nearest model", "Which of the former coloniser, the Soviet model and the US/Bretton Woods model the country most resembled in that decade.", "coloniser · Soviet · US/Bretton Woods", "Computed; see Divergence Metrics"],
    ["Shading in codings", "Darker cells are closer to the former coloniser's own system on that dimension; repeated values are merged across decades.", "light = far · dark = close", "Computed from the same similarity scores"],
    ["Confidence", "The drafter's rating of the evidence for the file as a whole.", "high · medium", "Project"],
  ];
  const WHY = `<p><b>Why these 21 countries.</b> The files are a first, hand-curated set chosen to meet four tests together:</p>
    <ol class="why">
      <li><b>Every empire represented</b>, roughly in proportion to its post-1945 decolonisations: 11 British, 7 French, 2 Portuguese, 1 Dutch.</li>
      <li><b>Weight:</b> the most populous ex-colony of each empire is included (India, Nigeria, Algeria, Indonesia, Angola and Mozambique), together with the other large South Asian and South-East Asian successors.</li>
      <li><b>Contrast in trajectories:</b> close continuity (Senegal, Côte d'Ivoire), early socialist breaks (Guinea, Tanzania, Vietnam, Myanmar, Angola, Mozambique), mixed-economy planning (India, Pakistan, Indonesia) and developmental states (Singapore, Malaysia).</li>
      <li><b>Evidence:</b> national plan documents and trade records that run across independence are available for each.</li>
    </ol>
    <p>Large gaps remain: Egypt, Iraq, Sudan, Cameroon, Madagascar, Zambia, Zimbabwe, the Caribbean and Suriname have no file yet. The other 73 ex-colonies appear on Divergence Metrics with legal origin and UN voting only. More files can be added in the review sheet.</p>`;
  function indexFolder() {
    return `<details class="folder index" id="INDEX" style="--c:var(--ink);--x:0%">
      <summary><span class="ftab">Index<small>terms · sources · selection</small></span></summary>
      <div class="fbody"><div class="fsheet">
        <div class="full"><h2>How to read a file</h2></div>
        <div class="full"><div class="flabel">Terms and where they come from</div>
          <div class="twrap"><table class="ctable glossary"><thead><tr><th>Term</th><th>Meaning</th><th>Values</th><th>Fetched from</th></tr></thead>
          <tbody>${TERMS.map((t) => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td>${esc(t[3])}</td></tr>`).join("")}</tbody></table></div></div>
        <div class="full why-block">${WHY}</div>
      </div></div>
    </details>`;
  }

  function folderHTML(iso, c, i) {
    const L = c.lineage;
    const decs = Object.entries(c.decades);
    const models = decs.map(([d, r]) => {
      const n = r.nearest, colour = n === c.coloniser ? css(COL[c.coloniser]) : n === "SUN" ? css("--soviet") : css("--uswb");
      return `<div class="mcell" style="--c:${colour}">${d}<b>${n === c.coloniser ? EMP[n] : MODEL[n] || "—"}</b><i></i><span>inherit ${r.inherit?.toFixed(2) ?? "—"}</span></div>`;
    }).join("");
    const rows = codingsRows(c, decs);
    const rev = c.review || {};
    const revTxt = Object.entries(rev).map(([k, v]) => `${v} ${k}`).join(" · ");
    const xs = ["0%", "18%", "36%", "54%"];
    return `<details class="folder" id="${iso}" style="--c:var(${TAB[c.coloniser]});--x:${xs[i % 4]}" data-col="${c.coloniser}">
      <summary><span class="ftab">${esc(c.name.split(" / ").pop())}<small>${c.coloniser} · ${c.indep}</small></span></summary>
      <div class="fbody"><div class="fsheet">
        <div>
          <h2>${esc(L.summary)}</h2>
          <dl class="fmeta">
            <dt>File</dt><dd>${iso}</dd>
            <dt>Rule</dt><dd>${EMP[c.coloniser]} until ${c.indep}</dd>
            <dt>Legal origin</dt><dd>${esc(c.legal_origin)}</dd>
            <dt>Administration</dt><dd>${esc(c.admin_tradition || "—")}</dd>
            <dt>Confidence</dt><dd>${esc(L.confidence)}</dd>
          </dl>
        </div>
        <div class="lineage"><div class="flabel">Lineage · first two decades</div>${lineageSVG(c)}</div>
        <div class="full"><div class="flabel">Nearest model by decade (own coloniser · Soviet · US/Bretton Woods)</div><div class="models">${models}</div></div>
        <div class="full"><div class="flabel">Evidence</div><ol class="notes">${L.notes.map((n) => `<li><span class="t">${esc(n.t)}</span><span>${esc(n.text)}<span class="src">${esc(n.src)}</span></span></li>`).join("")}</ol></div>
        <div class="full"><div class="flabel">Codings by decade</div>
          <div class="shade-key"><span>closer to ${EMP[c.coloniser]} system</span><i style="--c:${css(COL[c.coloniser])}"></i><span>further</span></div>
          <div class="twrap"><table class="ctable grouped"><thead>
            <tr class="grp"><th rowspan="2">Decade</th><th colspan="3">Coded system</th><th colspan="2" class="g2">Economy (PWT)</th><th colspan="3" class="g3">UN voting agreement with</th></tr>
            <tr><th>Planning regime</th><th>Planning institution</th><th>Monetary arrangement</th><th class="num g2">Openness</th><th class="num">Gov. share</th><th class="num g3">${c.coloniser}</th><th class="num">US</th><th class="num">USSR/RUS</th></tr>
          </thead><tbody>${rows}</tbody></table></div></div>
        <div class="full filed">FILED FROM: ${c.sources.map(esc).join(" · ")} · Openness and government share: Penn World Table 11 · UN agreement: Bailey, Strezhnev &amp; Voeten · <span class="review">${esc(revTxt)}</span> · <a href="correspondence.html#FILE-${iso}">Suggest a correction to this file</a></div>
      </div></div>
    </details>`;
  }

  function render() {
    const list = Object.entries(D.countries).filter(([, c]) => c.curated && (!filter || c.coloniser === filter))
      .sort((a, b) => a[1].coloniser.localeCompare(b[1].coloniser) || a[1].name.split(" / ").pop().localeCompare(b[1].name.split(" / ").pop()));
    $("stack").innerHTML = indexFolder() + list.map(([iso, c], i) => folderHTML(iso, c, i + 1)).join("");
    $("stack").querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) { $("stack").querySelectorAll("details[open]").forEach((o) => { if (o !== d) o.open = false; }); history.replaceState(null, "", `#${d.id}`); }
    }));
    const h = location.hash.slice(1);
    if (h && $(h)) { $(h).open = true; $(h).scrollIntoView({ block: "start" }); }
  }

  (async function boot() {
    D = await fetch("data/systems.json").then((r) => r.json());
    const cur = Object.values(D.countries).filter((c) => c.curated);
    $("n-files").textContent = `${cur.length} files`;
    const rv = D.meta.review || {};
    $("review-line").textContent = `· codings ${Object.entries(rv).map(([k, v]) => `${v} ${k}`).join(" · ")} · updated ${D.meta.generated}`;
    $("chips").innerHTML = `<button class="chip-btn" aria-pressed="true" data-c="">All</button>` +
      ["GBR", "FRA", "PRT", "NLD"].map((k) => `<button class="chip-btn" aria-pressed="false" data-c="${k}" style="--c:var(${TAB[k]})"><i></i>${EMP[k]} (${cur.filter((c) => c.coloniser === k).length})</button>`).join("");
    $("chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      filter = b.dataset.c || null;
      $("chips").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    }));
    render();
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && $(h)) $(h).open = true; });
  })();
})();
