/* Afterempire · Flows of Empire page
   Data: data/trade.json (pipeline/build_trade.py), data/holdings.json, data/trade_h/<holding>.json */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const FOCUS = ["GBR", "FRA", "PRT", "NLD"];
  const NAME = { GBR: "British", FRA: "French", PRT: "Portuguese", NLD: "Dutch" };
  const C = {};
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let T, H, byId;

  const periodAt = (h, t) => h.periods.find((p) => p.s <= t && t < (p.e ?? 9999)) || null;
  const lastColonial = (h, t) => { let c = null; for (const p of h.periods) { if (p.s > t) break; if (p.c !== "SOV") c = p.c; } return c; };
  const colourOf = (c) => (FOCUS.includes(c) ? C[c] : c === "SOV" || !c ? C.SOV : C.OTH);
  const unitFor = (y) => T.meta.units.find((u) => y >= u.from && y <= u.to) || T.meta.units[T.meta.units.length - 1];
  function money(vk, y) {
    if (vk == null) return "—";
    const sym = unitFor(y).unit.startsWith("US$") ? "US$" : "£", v = vk * 1000;
    if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}bn`;
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}m`;
    return `${sym}${Math.round(v / 1e3)}k`;
  }
  function ratio(a, b) {
    if (a == null || b == null || !a || !b) return "one-sided";
    const r = a / b;
    if (r >= 6) return "> 5 : 1"; if (r <= 1 / 6) return "1 : > 5";
    let best = [1, 1], bd = Infinity;
    for (let p = 1; p <= 5; p++) for (let q = 1; q <= 5; q++) { const d = Math.abs(Math.log(p / q) - Math.log(r)); if (d < bd) { bd = d; best = [p, q]; } }
    return `${best[0]} : ${best[1]}`;
  }
  const tip = $("ttip");
  function showTip(html, ev) {
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 10, ev.clientX + 14);
    const y = Math.min(window.innerHeight - tip.offsetHeight - 10, ev.clientY + 14);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  // ------------------------------------------------------------ 1. erosion curve
  function erosionData() {
    const by = { GBR: new Map(), FRA: new Map(), PRT: new Map(), NLD: new Map() };
    const members = { GBR: new Set(), FRA: new Set(), PRT: new Set(), NLD: new Set() };
    for (const [hid, series] of Object.entries(T.share)) {
      const ind = T.indep[hid]; const h = byId.get(hid);
      if (!ind || !h) continue;
      const metro = lastColonial(h, ind - 0.01);
      if (!FOCUS.includes(metro)) continue;
      for (const [y, tot, wm] of series) {
        const t = y - ind;
        if (t < -30 || t > 60 || !tot) continue;
        if (!by[metro].has(t)) by[metro].set(t, []);
        by[metro].get(t).push(wm / tot);
        members[metro].add(hid);
      }
    }
    const out = {};
    for (const k of FOCUS) {
      out[k] = [...by[k].entries()].filter(([, v]) => v.length >= 3).map(([t, v]) => [t, d3.median(v), v.length]).sort((a, b) => a[0] - b[0]);
    }
    return { out, members };
  }
  function drawErosion() {
    const { out, members } = erosionData();
    $("ero-n").textContent = FOCUS.map((k) => `${k} ${members[k].size}`).join(" · ");
    $("ero-legend").innerHTML = FOCUS.filter((k) => out[k].length).map((k) => `<span style="--c:${C[k]}"><i></i>Former ${NAME[k]} holdings (${members[k].size})</span>`).join("");
    const el = $("ero-chart"); el.innerHTML = "";
    const W = el.clientWidth || 900, Hh = 320, m = { t: 14, r: 120, b: 30, l: 44 };
    const x = d3.scaleLinear().domain([-30, 60]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([Hh - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${Hh}`).attr("role", "img")
      .attr("aria-label", "Median share of trade with the former metropole by years since independence, per empire");
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(5)).join("line")
      .attr("x1", m.l).attr("x2", W - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(9).tickFormat((d) => (d > 0 ? `+${d}` : d)));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));
    svg.append("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", Hh - m.b);
    svg.append("text").attr("class", "dlabel").attr("x", x(0) + 6).attr("y", m.t + 10).text("independence");
    svg.append("text").attr("class", "dlabel").attr("x", W - m.r).attr("y", Hh - 4).attr("text-anchor", "end").classed("dim", true).text("years since independence");
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1])).defined((d, i, a) => i === 0 || d[0] - a[i - 1][0] <= 3);
    for (const k of FOCUS) {
      if (!out[k].length) continue;
      svg.append("path").datum(out[k]).attr("fill", "none").attr("stroke", C[k]).attr("stroke-width", 2).attr("stroke-linejoin", "round").attr("d", line);
      const last = out[k][out[k].length - 1];
      svg.append("text").attr("class", "dlabel").attr("x", x(last[0]) + 6).attr("y", y(last[1]) + 4).text(`${NAME[k]} ${Math.round(last[1] * 100)}%`);
    }
    // crosshair
    const cross = svg.append("line").attr("stroke", C.ink).attr("y1", m.t).attr("y2", Hh - m.b).attr("opacity", 0);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent")
      .on("mousemove", (ev) => {
        const [px] = d3.pointer(ev); const t = Math.round(x.invert(px));
        cross.attr("x1", x(t)).attr("x2", x(t)).attr("opacity", 0.6);
        const rows = FOCUS.map((k) => { const r = out[k].find((d) => d[0] === t); return r ? `<div class="r"><span><i style="--c:${C[k]}"></i>${NAME[k]}</span><span>${Math.round(r[1] * 100)}% · n=${r[2]}</span></div>` : ""; }).join("");
        showTip(`<b>${t > 0 ? "+" + t : t} years</b>${rows || "<div>no data</div>"}`, ev);
      })
      .on("mouseleave", () => { cross.attr("opacity", 0); hideTip(); });
    // table view
    const ts = [-20, -10, 0, 10, 20, 30, 40, 50, 60];
    window.Reveal && Reveal.chart(el);
    $("ero-table").innerHTML = `<table class="dtable"><thead><tr><th>Empire</th>${ts.map((t) => `<th class="num">${t > 0 ? "+" + t : t}</th>`).join("")}</tr></thead><tbody>${FOCUS.map((k) => `<tr><td><span class="sw" style="--c:${C[k]}"></span>${NAME[k]}</td>${ts.map((t) => { const r = out[k].find((d) => d[0] === t); return `<td class="num">${r ? Math.round(r[1] * 100) + "%" : "—"}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  }

  // ------------------------------------------------------------ 2. holding explorer
  function lineChart(el, series, { yDomain, yFormat, log = false, ind, strip, label }) {
    el.innerHTML = "";
    const W = el.clientWidth || 500, Hh = 220, m = { t: strip ? 18 : 10, r: 14, b: 26, l: 52 };
    const x = d3.scaleLinear().domain([1800, 2025]).range([m.l, W - m.r]);
    const y = (log ? d3.scaleLog() : d3.scaleLinear()).domain(yDomain).range([Hh - m.b, m.t]).clamp(true);
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${Hh}`).attr("role", "img").attr("aria-label", label);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(log ? 4 : 5)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(W < 480 ? 4 : 8).tickFormat(d3.format("d")));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(log ? 4 : 5, log ? "~s" : undefined).tickFormat(yFormat));
    if (strip) for (const s of strip) svg.append("rect").attr("x", x(s[0])).attr("width", Math.max(1, x(s[1]) - x(s[0]))).attr("y", 2).attr("height", 6).attr("fill", s[2]).attr("opacity", s[3] ? 0.35 : 0.9);
    if (ind) {
      svg.append("line").attr("class", "zero").attr("x1", x(ind)).attr("x2", x(ind)).attr("y1", m.t).attr("y2", Hh - m.b);
      svg.append("text").attr("class", "dlabel").attr("x", x(ind) + 4).attr("y", m.t + 10).text(`independence ${ind}`);
    }
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1])).defined((d, i, a) => i === 0 || d[0] - a[i - 1][0] <= 5);
    svg.append("path").datum(series).attr("fill", "none").attr("stroke", C.trace).attr("stroke-width", 2).attr("d", line);
    const cross = svg.append("line").attr("stroke", C.ink).attr("y1", m.t).attr("y2", Hh - m.b).attr("opacity", 0);
    const dot = svg.append("circle").attr("r", 4).attr("fill", C.trace).attr("stroke", C.paper).attr("stroke-width", 2).attr("opacity", 0);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", Hh - m.t - m.b).attr("fill", "transparent")
      .on("mousemove", (ev) => {
        const [px] = d3.pointer(ev); const yr = x.invert(px);
        const r = series.reduce((b, d) => (Math.abs(d[0] - yr) < Math.abs(b[0] - yr) ? d : b), series[0]);
        if (!r) return;
        cross.attr("x1", x(r[0])).attr("x2", x(r[0])).attr("opacity", 0.6);
        dot.attr("cx", x(r[0])).attr("cy", y(r[1])).attr("opacity", 1);
        showTip(`<b>${r[0]}</b><div>${r[2]}</div>`, ev);
      })
      .on("mouseleave", () => { cross.attr("opacity", 0); dot.attr("opacity", 0); hideTip(); });
    window.Reveal && Reveal.chart(el);
  }
  async function drawExplorer(hid) {
    const h = byId.get(hid), series = T.share[hid] || [];
    const ind = T.indep[hid];
    $("ex-code").textContent = `HLD-${h.iso3}-${hid.replace("_", "").toUpperCase()}`;
    const metroNow = series.length ? series[series.length - 1][3] : null;
    $("ex-metro").textContent = metroNow ? `(${metroNow}${ind ? `, former metropole after ${ind}` : ""})` : "";
    const strip = h.periods.filter((p) => (p.e ?? 2026) > 1800).map((p) => [Math.max(1800, p.s), Math.min(2025, p.e ?? 2025), p.c === "SOV" ? colourOf(lastColonial(h, p.s)) : colourOf(p.c), p.c === "SOV"]);
    const share = series.filter((r) => r[1] > 0).map((r) => [r[0], r[2] / r[1], `${Math.round((r[2] / r[1]) * 100)}% with ${r[3] || "metropole"} · total ${money(r[1], r[0])}`]);
    lineChart($("ex-share"), share, { yDomain: [0, 1], yFormat: d3.format(".0%"), ind, strip, label: `Share of ${h.name}'s trade with its metropole, 1800 to 2025` });
    const totals = series.filter((r) => r[1] > 0).map((r) => [r[0], r[1], `total ${money(r[1], r[0])}`]);
    const mx = d3.max(totals, (d) => d[1]) || 10;
    lineChart($("ex-total"), totals, { yDomain: [Math.max(1, (d3.min(totals, (d) => d[1]) || 1)), mx], log: true, yFormat: (d) => (d >= 1e6 ? `${d / 1e6}bn` : d >= 1e3 ? `${d / 1e3}m` : `${d}k`), ind, label: `Recorded trade of ${h.name}, log scale` });
    // partners by decade
    let d = {};
    try { const r = await fetch(`data/trade_h/${hid}.json`); if (r.ok) d = await r.json(); } catch { /* none */ }
    const tot = new Map(series.map((r) => [r[0], r[1]]));
    const decades = [];
    for (let y = 1810; y <= 2020; y += 10) {
      const key = [y, y + 1, y - 1, y + 2, y - 2].map(String).find((k) => d[k] && d[k].length);
      if (key) decades.push(key);
    }
    $("ex-partners").innerHTML = decades.length
      ? `<thead><tr><th>Year</th><th class="num">Total</th>${[1, 2, 3, 4, 5].map((i) => `<th>#${i} partner (share)</th>`).join("")}</tr></thead><tbody>${decades.map((k) => {
        const y = +k, all = tot.get(y) || d[k].reduce((s, r) => s + r[1], 0);
        return `<tr><td>${k}</td><td class="num">${money(all, y)}</td>${d[k].slice(0, 5).map((r) => `<td>${esc((T.nodes[r[0]] || { n: r[0] }).n)} <span class="dim">${Math.round((r[1] / all) * 100)}%</span></td>`).join("")}</tr>`;
      }).join("")}</tbody>`
      : `<tbody><tr><td class="dim">No recorded partners for this holding.</td></tr></tbody>`;
    window.Reveal && Reveal.rows($("ex-partners"));
  }

  // ------------------------------------------------------------ 3. ranking
  function drawRanking(y) {
    const rows = T.years[String(y)] || [];
    $("rk-year-out").textContent = y;
    $("rk-src").textContent = `${T.meta.sources[String(y)] || ""} · ${unitFor(y).label}`;
    const side = (code) => {
      const n = T.nodes[code]; if (!n || !n.h) return null;
      const h = byId.get(n.h); const p = periodAt(h, y + 0.5); if (!p) return null;
      const c = p.c === "SOV" ? lastColonial(h, y + 0.5) : p.c;
      return { colour: colourOf(c), txt: p.c === "SOV" ? `sovereign (former ${c || "—"})` : `${p.c} ${p.st.replace("_", " ")}` };
    };
    $("rk-table").innerHTML = rows.length
      ? `<thead><tr><th class="num">#</th><th>Flow</th><th class="num">Total</th><th>A→B : B→A</th><th>Holding side</th></tr></thead><tbody>${rows.slice(0, 30).map((r, i) => {
        const [a, b, t, ab, ba] = r; const sa = side(a), sb = side(b), s = sa || sb;
        return `<tr><td class="num dim">${String(i + 1).padStart(2, "0")}</td><td>${esc((T.nodes[a] || { n: a }).n)} ⇄ ${esc((T.nodes[b] || { n: b }).n)}</td><td class="num">${money(t, y)}</td><td>${ratio(ab, ba)}</td><td>${s ? `<span class="sw" style="--c:${s.colour}"></span>${esc(s.txt)}` : ""}</td></tr>`;
      }).join("")}</tbody>`
      : `<tbody><tr><td class="dim">No recorded flows touching a holding in ${y}.</td></tr></tbody>`;
    if (!drawRanking.once) { drawRanking.once = true; window.Reveal && Reveal.rows($("rk-table")); }
  }

  // ------------------------------------------------------------ boot
  (async function boot() {
    Object.assign(C, { GBR: css("--gbr"), FRA: css("--fra"), PRT: css("--prt"), NLD: css("--nld"), OTH: css("--oth"), SOV: css("--sov"),
      ink: css("--ink"), trace: css("--trace"), paper: css("--stock-hi") });
    const [t, h] = await Promise.all([fetch("data/trade.json").then((r) => r.json()), fetch("data/holdings.json").then((r) => r.json())]);
    T = t; H = h; byId = new Map(H.holdings.map((x) => [x.id, x]));
    $("stamp").textContent = `${Object.keys(T.years).length} YEARS · DATA UP TO DATE AS OF ${(window.AE_ASOF || "").toUpperCase()}`;
    drawErosion();
    const opts = Object.keys(T.share).filter((id) => byId.has(id) && T.share[id].length > 5).map((id) => [id, byId.get(id).name]).sort((a, b) => a[1].localeCompare(b[1]));
    $("ex-select").innerHTML = opts.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join("");
    const start = (location.hash.slice(1) && byId.has(location.hash.slice(1))) ? location.hash.slice(1) : "ind";
    $("ex-select").value = start;
    $("ex-select").addEventListener("change", (e) => drawExplorer(e.target.value));
    drawExplorer(start);
    $("rk-year").addEventListener("input", (e) => drawRanking(+e.target.value));
    drawRanking(1913);
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { drawErosion(); drawExplorer($("ex-select").value); }, 150); });
  })();
})();
