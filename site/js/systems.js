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

  function folderHTML(iso, c, i) {
    const L = c.lineage;
    const decs = Object.entries(c.decades);
    const models = decs.map(([d, r]) => {
      const n = r.nearest, colour = n === c.coloniser ? css(COL[c.coloniser]) : n === "SUN" ? css("--soviet") : css("--uswb");
      return `<div class="mcell" style="--c:${colour}">${d}<b>${n === c.coloniser ? EMP[n] : MODEL[n] || "—"}</b><i></i><span>inherit ${r.inherit?.toFixed(2) ?? "—"}</span></div>`;
    }).join("");
    const rows = decs.map(([d, r]) => `<tr><td>${d}</td><td>${r.planning_regime == null ? "—" : esc(PLAN[r.planning_regime])}</td><td>${esc(INST[r.planning_institution] || "—")}</td><td>${esc(MON[r.monetary_arrangement] || "—")}</td><td class="num">${pct(r.open)}</td><td class="num">${pct(r.gov)}</td><td class="num">${pct(r.un[c.coloniser])}</td><td class="num">${pct(r.un.USA)}</td><td class="num">${pct(r.un.SUN)}</td></tr>`).join("");
    const rev = c.review || {};
    const revTxt = Object.entries(rev).map(([k, v]) => `${v} ${k}`).join(" · ");
    const xs = ["0%", "18%", "36%", "54%"];
    return `<details class="folder" id="${iso}" style="--c:var(${TAB[c.coloniser]});--x:${xs[i % 4]}" data-col="${c.coloniser}">
      <summary><span class="ftab">${esc(c.name.split(" / ").pop())}<small>${c.coloniser} · ${c.indep}</small></span></summary>
      <div class="fbody"><div class="fsheet">
        <div>
          <h2>${esc(L.summary)}</h2>
          <div class="fmeta"><span>FILE ${iso}</span><span>${EMP[c.coloniser]} until ${c.indep}</span><span>legal origin: ${esc(c.legal_origin)}</span><span>confidence: ${esc(L.confidence)}</span></div>
          <div class="fmeta"><span>administration: ${esc(c.admin_tradition || "—")}</span></div>
        </div>
        <div class="lineage"><div class="flabel">Lineage · first two decades</div>${lineageSVG(c)}</div>
        <div class="full"><div class="flabel">Nearest model by decade (own coloniser · Soviet · US/Bretton Woods)</div><div class="models">${models}</div></div>
        <div class="full"><div class="flabel">Evidence</div><ol class="notes">${L.notes.map((n) => `<li><span class="t">${esc(n.t)}</span><span>${esc(n.text)}<span class="src">${esc(n.src)}</span></span></li>`).join("")}</ol></div>
        <div class="full"><div class="flabel">Codings by decade</div><div class="twrap"><table class="ctable"><thead><tr><th>Decade</th><th>Planning regime</th><th>Planning institution</th><th>Monetary arrangement</th><th class="num">Openness</th><th class="num">Gov. share</th><th class="num">UN agree ${c.coloniser}</th><th class="num">UN agree US</th><th class="num">UN agree USSR/RUS</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="full filed">FILED FROM: ${c.sources.map(esc).join(" · ")} · Openness and government share: Penn World Table 11 · UN agreement: Bailey, Strezhnev &amp; Voeten · <span class="review">${esc(revTxt)}</span></div>
      </div></div>
    </details>`;
  }

  function render() {
    const list = Object.entries(D.countries).filter(([, c]) => c.curated && (!filter || c.coloniser === filter))
      .sort((a, b) => a[1].coloniser.localeCompare(b[1].coloniser) || a[1].name.split(" / ").pop().localeCompare(b[1].name.split(" / ").pop()));
    $("stack").innerHTML = list.map(([iso, c], i) => folderHTML(iso, c, i)).join("");
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
