/* Afterempire · Divergence Metrics worksheets. Data: data/systems.json */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EMP = { GBR: "British", FRA: "French", PRT: "Portuguese", NLD: "Dutch" };
  const COLV = { GBR: "--gbr", FRA: "--fra", PRT: "--prt", NLD: "--nld" };
  let D, C = {};
  const tip = $("ttip");
  const showTip = (html, ev) => {
    tip.innerHTML = html; tip.hidden = false;
    tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 10, ev.clientX + 14)}px`;
    tip.style.top = `${Math.min(innerHeight - tip.offsetHeight - 10, ev.clientY + 14)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  const short = (c) => c.name.split(" / ").pop();
  const modelColour = (n, col) => (n === col ? C[col] : n === "SUN" ? C.soviet : C.uswb);
  const modelName = (n, col) => (n === col ? EMP[col] : n === "SUN" ? "Soviet" : n === "USA" ? "US / BW" : "—");

  // ---------------------------------------------------------- sheet 1
  function sheet1() {
    const decs = D.meta.decades, el = $("c1"); el.innerHTML = "";
    const W = el.clientWidth || 900, H = 340, m = { t: 12, r: 110, b: 28, l: 40 };
    const x = d3.scalePoint().domain(decs).range([m.l, W - m.r]).padding(0.2);
    const y = d3.scaleLinear().domain([0.3, 1]).range([H - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Inheritance index by decade for curated countries, with empire medians");
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(7)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(7).tickFormat(d3.format(".1f")));
    const cur = Object.entries(D.countries).filter(([, c]) => c.curated);
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
    const g = svg.append("g");
    for (const [iso, c] of cur) {
      const pts = decs.filter((d) => c.decades[d] && c.decades[d].inherit != null).map((d) => [d, c.decades[d].inherit]);
      if (pts.length < 2) continue;
      g.append("path").datum(pts).attr("fill", "none").attr("stroke", C[c.coloniser]).attr("stroke-width", 1.2).attr("opacity", 0.45).attr("d", line)
        .style("cursor", "pointer")
        .on("mousemove", function (ev) { d3.select(this).attr("opacity", 1).attr("stroke-width", 2.5); showTip(`<b>${esc(short(c))}</b> · ${EMP[c.coloniser]} until ${c.indep}<br>${pts.map((p) => `${p[0]} ${p[1].toFixed(2)}`).join(" · ")}`, ev); })
        .on("mouseleave", function () { d3.select(this).attr("opacity", 0.45).attr("stroke-width", 1.2); hideTip(); });
    }
    const keys = [];
    for (const k of ["GBR", "FRA", "PRT", "NLD"]) {
      const group = cur.filter(([, c]) => c.coloniser === k);
      if (!group.length) continue;
      const med = decs.map((d) => [d, d3.median(group.map(([, c]) => c.decades[d]?.inherit).filter((v) => v != null))]).filter((p) => p[1] != null);
      if (med.length < 2) continue;
      svg.append("path").datum(med).attr("fill", "none").attr("stroke", C[k]).attr("stroke-width", 3).attr("d", line).style("pointer-events", "none");
      const last = med[med.length - 1];
      svg.append("text").attr("class", "dlabel").attr("x", x(last[0]) + 8).attr("y", y(last[1]) + 4).text(`${EMP[k]} ${last[1].toFixed(2)}`);
      keys.push(`<span><i class="sw" style="--c:${C[k]}"></i>${EMP[k]} (${group.length})</span>`);
    }
    $("w1-key").innerHTML = keys.join("");
  }

  // ---------------------------------------------------------- sheet 2
  function sheet2() {
    const all = $("w2-all").checked, decs = D.meta.decades;
    const rows = Object.entries(D.countries).filter(([, c]) => all || c.curated)
      .sort((a, b) => b[1].curated - a[1].curated || a[1].coloniser.localeCompare(b[1].coloniser) || short(a[1]).localeCompare(short(b[1])));
    $("m2").innerHTML = `<thead><tr><th>Country</th><th>Former coloniser</th>${decs.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>${rows.map(([iso, c]) => `<tr><td class="name">${c.curated ? `<a href="systems.html#${iso}">${esc(short(c))}</a>` : esc(short(c))}</td><td><i class="sw" style="--c:${C[c.coloniser]}"></i> ${c.coloniser} · ${c.indep}</td>${decs.map((d) => {
      const r = c.decades[d];
      if (!r || !r.nearest) return `<td class="cell none">—</td>`;
      return `<td class="cell${c.curated ? "" : " weak"}" style="background:${modelColour(r.nearest, c.coloniser)}" data-iso="${iso}" data-d="${d}">${modelName(r.nearest, c.coloniser)}</td>`;
    }).join("")}</tr>`).join("")}</tbody>`;
    $("m2").querySelectorAll("td.cell[data-iso]").forEach((td) => {
      td.addEventListener("mousemove", (ev) => {
        const c = D.countries[td.dataset.iso], r = c.decades[td.dataset.d];
        const ms = [c.coloniser, "SUN", "USA"].filter((m) => r.mean[m] != null).map((m) => `<div class="r"><span>${modelName(m, c.coloniser)}</span><span>${r.mean[m].toFixed(2)}</span></div>`).join("");
        showTip(`<b>${esc(short(c))} · ${td.dataset.d}</b><div>mean similarity</div>${ms}<div style="margin-top:4px;color:#6a6864">dimensions: ${r.dims.join(", ")}</div>`, ev);
      });
      td.addEventListener("mouseleave", hideTip);
    });
  }

  // ---------------------------------------------------------- sheet 3
  function sheet3() {
    const rows = Object.entries(D.countries).filter(([, c]) => c.curated).sort((a, b) => a[1].coloniser.localeCompare(b[1].coloniser) || short(a[1]).localeCompare(short(b[1])));
    const f = (v) => (v == null ? `<span style="color:#6a6864">not by 2019</span>` : `${v} yrs`);
    $("t3").innerHTML = `<thead><tr><th>Country</th><th>Former coloniser</th><th class="num">Independence</th><th class="num">Monetary arrangement</th><th class="num">Planning institution</th><th class="num">Planning regime</th></tr></thead><tbody>${rows.map(([iso, c]) => `<tr><td><a href="systems.html#${iso}">${esc(short(c))}</a></td><td><i class="sw" style="--c:${C[c.coloniser]}"></i> ${EMP[c.coloniser]}</td><td class="num">${c.indep}</td><td class="num">${f(c.persistence.monetary_arrangement)}</td><td class="num">${f(c.persistence.planning_institution)}</td><td class="num">${f(c.persistence.planning_regime)}</td></tr>`).join("")}</tbody>`;
  }

  // ---------------------------------------------------------- sheet 4
  function sheet4() {
    const el = $("c4"); el.innerHTML = "";
    const pts = [];
    for (const [iso, c] of Object.entries(D.countries)) {
      if (!c.curated) continue;
      for (const [d, r] of Object.entries(c.decades)) if (r.metro_share != null && r.inherit != null) pts.push({ iso, c, d, x: r.metro_share, y: r.inherit });
    }
    const W = el.clientWidth || 900, H = 360, m = { t: 12, r: 20, b: 40, l: 44 };
    const x = d3.scaleLinear().domain([0, Math.min(1, (d3.max(pts, (p) => p.x) || 1) * 1.05)]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0.3, 1]).range([H - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Share of trade with the former metropole against inheritance index");
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(7)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".0%")));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(7).tickFormat(d3.format(".1f")));
    svg.append("text").attr("class", "dlabel").attr("x", W - m.r).attr("y", H - 6).attr("text-anchor", "end").text("share of trade with the former metropole →");
    svg.append("text").attr("class", "dlabel").attr("x", m.l + 4).attr("y", m.t + 10).text("↑ inheritance index");
    svg.selectAll("circle").data(pts).join("circle").attr("cx", (p) => x(p.x)).attr("cy", (p) => y(p.y)).attr("r", 5)
      .attr("fill", (p) => C[p.c.coloniser]).attr("stroke", "#fbfaf7").attr("stroke-width", 2).style("cursor", "pointer")
      .on("mousemove", (ev, p) => showTip(`<b>${esc(short(p.c))} · ${p.d}</b><div class="r"><span>trade with ${p.c.coloniser}</span><span>${Math.round(p.x * 100)}%</span></div><div class="r"><span>inheritance</span><span>${p.y.toFixed(2)}</span></div>`, ev))
      .on("mouseleave", hideTip);
    const n = pts.length, mx = d3.mean(pts, (p) => p.x), my = d3.mean(pts, (p) => p.y);
    const r = d3.sum(pts, (p) => (p.x - mx) * (p.y - my)) / Math.sqrt(d3.sum(pts, (p) => (p.x - mx) ** 2) * d3.sum(pts, (p) => (p.y - my) ** 2));
    $("w4-r").textContent = `n = ${n} country-decades · Pearson r = ${r.toFixed(2)}`;
  }

  (async function boot() {
    Object.assign(C, { GBR: css("--gbr"), FRA: css("--fra"), PRT: css("--prt"), NLD: css("--nld"), soviet: css("--soviet"), uswb: css("--uswb") });
    D = await fetch("data/systems.json").then((r) => r.json());
    const all = Object.values(D.countries);
    $("n-c").textContent = `${all.filter((c) => c.curated).length} curated · ${all.length} ex-colonies`;
    $("meta-line").textContent = `updated ${D.meta.generated}`;
    sheet1(); sheet2(); sheet3(); sheet4();
    $("w2-all").addEventListener("change", sheet2);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { sheet1(); sheet4(); }, 150); });
  })();
})();
