/* Afterempire · Territorial Ledger
   Globe (globe.gl) and flat map (d3 Equal Earth) views of colonial holdings, 1800–2025.
   Data: data/holdings.json (built by pipeline/build_holdings.py), data/land.json, data/land_dots.json,
         data/borders/borders_YYYY.json (historical-basemaps, simplified). */
(() => {
  "use strict";

  // ---------------------------------------------------------------- constants
  const FOCUS = ["GBR", "FRA", "PRT", "NLD"];
  const BORDER_YEARS = [1800, 1815, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010];
  const SIZE = { territory: 13, island: 9, enclave: 8 };
  const STEP_MS = { normal: 667, fast: 133 }; // ×1 = 1.5 yr/s, ×5 = 7.5 yr/s
  const $ = (id) => document.getElementById(id);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const COLOR = {};
  const readColors = () => {
    Object.assign(COLOR, {
      GBR: css("--gbr"), FRA: css("--fra"), PRT: css("--prt"), NLD: css("--nld"),
      OTH: css("--oth"), SOV: css("--sov"), land: css("--land-dot"), border: css("--border-hist"),
    });
  };
  const STATUS_NAME = {
    colony: "colony", protectorate: "protectorate", mandate: "League mandate", trust: "UN trust territory",
    company: "company rule", condominium: "condominium", occupation: "occupation", leased: "leased territory",
    integrated: "integrated territory", still_dependent: "dependent territory",
    self_governing: "self-governing", dominion: "dominion", sovereign: "sovereign",
  };

  // ---------------------------------------------------------------- state
  const S = {
    data: null, byId: new Map(), year: 1800, prevYear: null,
    view: "globe", selected: null, playing: false, fast: false, timer: null,
    filters: new Set([...FOCUS, "OTH"]), labels: false, callouts: true,
    borders: new Map(), bordersYear: null, land: null, dots: null,
    intro: { on: false, i: 0, timer: null, ids: null, paused: false }, zoom: d3.zoomIdentity,
    trade: null, flowsOn: true, flowCache: new Map(), arcs: [], hoverArc: null, mouse: [0, 0],
  };

  // ---------------------------------------------------------------- data helpers
  const tOf = (y) => y + 0.5;
  const periodAt = (h, t) => h.periods.find((p) => p.s <= t && t < (p.e ?? 9999)) || null;
  const lastColonial = (h, t) => {
    let c = null;
    for (const p of h.periods) { if (p.s > t) break; if (p.c !== "SOV") c = p.c; }
    return c;
  };
  const groupOf = (c) => (FOCUS.includes(c) ? c : "OTH");
  const colorOf = (c) => (c === "GBRFRA" ? COLOR.GBR : FOCUS.includes(c) ? COLOR[c] : c === "SOV" ? COLOR.SOV : COLOR.OTH);
  const styleOf = (st) => S.data.meta.statusStyle[st] || "solid";
  const ctrlName = (c) => S.data.meta.controllers[c] || c;

  function stateOf(h, year) {
    const t = tOf(year);
    const p = periodAt(h, t);
    if (!p) return null;
    let colourCtrl = p.c;
    if (p.c === "SOV") colourCtrl = lastColonial(h, t) || "SOV";
    const groups = p.c === "GBRFRA" ? ["GBR", "FRA"] : [groupOf(colourCtrl === "SOV" ? "OTH" : colourCtrl)];
    return { p, ctrl: p.c, colourCtrl, color: colorOf(colourCtrl), style: styleOf(p.st), condo: p.c === "GBRFRA", groups };
  }
  const visible = (st) => st && st.groups.some((g) => S.filters.has(g));
  const displayName = (h, st) => {
    const parts = h.name.split(" / ");
    if (parts.length < 2 || !st) return h.name;
    return st.ctrl === "SOV" ? parts[parts.length - 1] : parts[0];
  };
  const holdingCode = (h) => `HLD-${h.iso3}-${h.id.replace("_", "").toUpperCase()}`;
  const fmtYear = (t) => String(Math.floor(t));

  // ---------------------------------------------------------------- loading
  const loaderDots = (() => {
    const cv = $("loader-dots"), ctx = cv.getContext("2d");
    const proj = d3.geoOrthographic().scale(84).translate([90, 90]).clipAngle(90);
    let raf, rot = 0;
    const pts = [];
    for (let lat = -80; lat <= 80; lat += 8) for (let lon = -180; lon < 180; lon += 8) pts.push([lon, lat]);
    function frame() {
      rot += 0.6; proj.rotate([rot, -18]);
      ctx.clearRect(0, 0, 180, 180);
      const src = S.dots || pts;
      for (const d of src) {
        const xy = proj(d); if (!xy) continue;
        ctx.fillStyle = S.dots ? "rgba(200,219,255,.9)" : "rgba(143,180,240,.35)";
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 1.1, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return { stop: () => cancelAnimationFrame(raf) };
  })();

  async function loadAll() {
    const jobs = [
      ["holdings", "data/holdings.json"], ["dots", "data/land_dots.json"],
      ["b1800", "data/borders/borders_1800.json"], ["trade", "data/trade.json"],
    ];
    let done = 0;
    const out = {};
    await Promise.all(jobs.map(async ([k, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
      out[k] = await r.json();
      if (k === "dots") S.dots = out[k];
      done++; $("loader-pct").textContent = `${String(Math.round((done / jobs.length) * 100)).padStart(3, "0")}%`;
    }));
    S.data = out.holdings; S.dots = out.dots; S.trade = out.trade;
    S.borders.set(1800, flattenLines(out.b1800));
    for (const h of S.data.holdings) S.byId.set(h.id, h);
  }
  function flattenLines(fc) {
    const lines = [];
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue;
      if (g.type === "LineString") lines.push(g.coordinates);
      else if (g.type === "MultiLineString") lines.push(...g.coordinates);
    }
    return lines;
  }
  async function bordersFor(year) {
    let snap = BORDER_YEARS[0];
    for (const y of BORDER_YEARS) if (y <= year) snap = y;
    if (!S.borders.has(snap)) {
      S.borders.set(snap, null); // in flight
      const r = await fetch(`data/borders/borders_${snap}.json`);
      S.borders.set(snap, flattenLines(await r.json()));
    }
    return { snap, lines: S.borders.get(snap) };
  }

  // ---------------------------------------------------------------- markers (DOM, shared by globe)
  const markers = new Map(); // id -> {el, h, lat, lng, type:'b'}
  function markerFor(h) {
    if (markers.has(h.id)) return markers.get(h.id);
    const el = document.createElement("div");
    el.className = "mk"; el.dataset.kind = h.kind; el.style.setProperty("--s", `${SIZE[h.kind] || 9}px`);
    el.style.pointerEvents = "auto";
    el.innerHTML = `<i class="b"></i><span class="nm"></span>`;
    el.setAttribute("role", "button"); el.tabIndex = 0;
    el.addEventListener("click", (e) => { e.stopPropagation(); select(h.id); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") select(h.id); });
    const m = { el, h, lat: h.lat, lng: h.lon, type: "b" };
    markers.set(h.id, m);
    return m;
  }
  function paintMarker(m, st) {
    const b = m.el.firstChild;
    b.className = `b ${st.style}${st.condo ? " condo" : ""}`;
    b.style.setProperty("--c", st.color);
    m.el.style.setProperty("--c", st.color);
    m.el.querySelector(".nm").textContent = displayName(m.h, st);
    m.el.setAttribute("aria-label", `${displayName(m.h, st)}: ${ctrlName(st.ctrl)} ${STATUS_NAME[st.p.st]}`);
    m.el.classList.toggle("sel", S.selected === m.h.id);
    m.el.classList.toggle("hl", !!(S.intro.ids && S.intro.ids.has(m.h.id)));
  }

  // callouts
  function calloutsFor(year) {
    if (!S.callouts) return [];
    const lo = S.playing ? year - 1 : year;
    const evs = S.data.events.filter((e) => e.to && e.t >= lo && e.t < year + 1);
    const out = [];
    for (const e of evs) {
      const h = S.byId.get(e.h);
      const st = stateOf(h, year);
      const groups = st ? st.groups : [groupOf(e.to)];
      if (!groups.some((g) => S.filters.has(g))) continue;
      out.push({ e, h, age: year - Math.floor(e.t) });
    }
    out.sort((a, b) => (FOCUS.includes(b.e.to) - FOCUS.includes(a.e.to)) || a.age - b.age);
    return out.slice(0, 7).map(({ e, h, age }, idx) => {
      const el = document.createElement("div");
      el.className = "callout";
      const c = colorOf(e.to === "SOV" ? (e.from || "SOV") : e.to);
      el.style.setProperty("--c", c);
      el.style.opacity = age ? 0.45 : 1;
      const dest = e.to === "SOV" ? "independent" : e.to;
      const nm = h.name.split(" / ")[e.to === "SOV" ? h.name.split(" / ").length - 1 : 0];
      el.innerHTML = `{${fmtYear(e.t)}} ${escapeHtml(nm)} → <b>${dest}</b>`;
      el.title = e.label;
      el.style.setProperty("--dy", `${(idx % 3) * 17}px`);
      return { el, lat: h.lat, lng: h.lon, type: "c", idx };
    });
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------------------------------------------------------- globe view
  let globe = null;
  function initGlobe() {
    const el = $("globe");
    globe = new Globe(el, { animateIn: false })
      .backgroundColor("rgba(0,0,0,0)")
      .showGraticules(true)
      .showAtmosphere(true).atmosphereColor(css("--halo")).atmosphereAltitude(0.17)
      .particlesData([S.dots]).particleLat((d) => d[1]).particleLng((d) => d[0]).particleAltitude(0.002)
      .particlesColor(() => COLOR.land).particlesSize(2.4).particlesSizeAttenuation(false)
      .pathPoints((d) => d).pathPointLat((p) => p[1]).pathPointLng((p) => p[0])
      .pathPointAlt(0.004).pathColor(() => COLOR.border).pathStroke(null).pathTransitionDuration(0)
      .htmlLat((d) => d.lat).htmlLng((d) => d.lng)
      .htmlAltitude((d) => (d.type === "c" ? 0.07 : 0.01))
      .htmlElement((d) => d.el)
      .htmlTransitionDuration(0)
      .onGlobeClick(({ lat, lng }) => pickNear(lat, lng))
      .pointOfView({ lat: 12, lng: 30, altitude: 2.4 });
    if (typeof globe.htmlElementVisibilityModifier === "function") {
      globe.htmlElementVisibilityModifier((elx, vis) => elx.classList.toggle("hidden-side", !vis));
    }
    const mat = globe.globeMaterial();
    if (mat && mat.color) { mat.color.set("#05080e"); if (mat.emissive) mat.emissive.set("#03060b"); mat.shininess = 4; }
    initArcs();
    const ctr = globe.controls(); ctr.enableDamping = true; ctr.dampingFactor = 0.12; ctr.rotateSpeed = 0.6; ctr.zoomSpeed = 0.8;
    sizeGlobe();
  }
  function sizeGlobe() {
    if (!globe) return;
    const st = $("stage");
    globe.width(st.clientWidth).height(st.clientHeight);
  }
  function renderGlobe() {
    if (!globe) return;
    const items = [];
    for (const h of S.data.holdings) {
      const st = stateOf(h, S.year);
      if (!visible(st)) continue;
      const m = markerFor(h); paintMarker(m, st); items.push(m);
    }
    items.push(...calloutsFor(S.year));
    globe.htmlElementsData(items);
  }
  function setGlobeBorders(lines) { if (globe) globe.pathsData(lines || []); }

  // click on land/sea: open the nearest visible holding within PICK_KM
  const PICK_KM = 900;
  function kmBetween(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function pickNear(lat, lng) {
    let best = null, bd = PICK_KM;
    for (const h of S.data.holdings) {
      const st = stateOf(h, S.year);
      if (!visible(st)) continue;
      const d = kmBetween(lat, lng, h.lat, h.lon);
      if (d < bd) { bd = d; best = h; }
    }
    if (best) { select(best.id); return; }
    select(null);
    toast(`No holding of the tracked empires within ${PICK_KM} km of ${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(0)}°${lng >= 0 ? "E" : "W"} in ${S.year}.`);
  }
  let toastT;
  function toast(msg) {
    const el = $("toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // great-circle angle between camera centre and a point (degrees) -> for leader line culling
  function angleFromView(lat, lng) {
    const pov = globe.pointOfView();
    const r = Math.PI / 180;
    const c = Math.sin(pov.lat * r) * Math.sin(lat * r) + Math.cos(pov.lat * r) * Math.cos(lat * r) * Math.cos((lng - pov.lng) * r);
    return Math.acos(Math.max(-1, Math.min(1, c))) / r;
  }

  // ---------------------------------------------------------------- flat view
  const flat = { cv: $("flat"), ctx: null, proj: null, path: null, w: 0, h: 0, dpr: 1, hits: [] };
  function initFlat() {
    flat.ctx = flat.cv.getContext("2d");
    const zoom = d3.zoom().scaleExtent([1, 10]).on("zoom", (e) => { S.zoom = e.transform; drawFlat(); });
    d3.select(flat.cv).call(zoom).on("dblclick.zoom", null);
    flat.cv.addEventListener("mousemove", (e) => {
      const r = flat.cv.getBoundingClientRect();
      const [x, y] = S.zoom.invert([e.clientX - r.left, e.clientY - r.top]);
      const f = flatArcAt(x, y);
      if (f !== S.hoverArc) { S.hoverArc = f; renderFlowTip(); drawFlat(); }
    });
    flat.cv.addEventListener("mouseleave", () => { if (S.hoverArc) { S.hoverArc = null; renderFlowTip(); drawFlat(); } });
    flat.cv.addEventListener("click", (e) => {
      const r = flat.cv.getBoundingClientRect();
      const [x, y] = S.zoom.invert([e.clientX - r.left, e.clientY - r.top]);
      let best = null, bd = 14 / S.zoom.k;
      for (const hit of flat.hits) { const d = Math.hypot(hit.x - x, hit.y - y); if (d < bd) { bd = d; best = hit; } }
      if (best) { select(best.id); return; }
      const ll = flat.proj.invert([x, y]);
      if (ll && isFinite(ll[0])) pickNear(ll[1], ll[0]); else select(null);
    });
    sizeFlat();
  }
  function sizeFlat() {
    const st = $("stage");
    flat.dpr = Math.min(window.devicePixelRatio || 1, 2);
    flat.w = st.clientWidth; flat.h = st.clientHeight;
    flat.cv.width = flat.w * flat.dpr; flat.cv.height = flat.h * flat.dpr;
    const top = flat.w < 760 ? 70 : 96;
    flat.proj = d3.geoEqualEarth().fitExtent([[16, top], [flat.w - 16, flat.h - 16]], { type: "Sphere" });
    flat.path = d3.geoPath(flat.proj, flat.ctx);
  }
  function drawFlat() {
    if (S.view !== "flat" || !flat.ctx) return;
    const { ctx, proj, path, dpr } = flat;
    const k = S.zoom.k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, flat.w, flat.h);
    ctx.save();
    ctx.translate(S.zoom.x, S.zoom.y); ctx.scale(k, k);
    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = "#03070f"; ctx.fill();
    ctx.lineWidth = 1 / k; ctx.strokeStyle = "rgba(143,180,240,.35)"; ctx.stroke();
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = "rgba(143,180,240,.10)"; ctx.stroke();
    ctx.fillStyle = COLOR.land;
    const r = Math.max(0.6, 0.95 / Math.sqrt(k));
    for (const d of S.dots) { const xy = proj(d); if (xy) { ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, 6.283); ctx.fill(); } }
    const snap = currentBorderLines();
    if (snap) { ctx.beginPath(); path({ type: "MultiLineString", coordinates: snap }); ctx.strokeStyle = COLOR.border; ctx.lineWidth = 0.8 / k; ctx.stroke(); }

    drawFlatArcs(ctx, k);
    flat.hits = [];
    const sel = [];
    for (const h of S.data.holdings) {
      const st = stateOf(h, S.year);
      if (!visible(st)) continue;
      const xy = proj([h.lon, h.lat]); if (!xy) continue;
      const rad = (SIZE[h.kind] || 9) / 2 / Math.sqrt(k) + 0.5;
      drawBubble(ctx, xy[0], xy[1], rad, st, k);
      flat.hits.push({ id: h.id, x: xy[0], y: xy[1] });
      const hl = S.intro.ids && S.intro.ids.has(h.id);
      if (hl) { ctx.beginPath(); ctx.arc(xy[0], xy[1], rad + 5 / k, 0, 6.283); ctx.strokeStyle = "#c8dbff"; ctx.lineWidth = 1 / k; ctx.stroke(); }
      if (S.labels && h.kind === "territory" || S.selected === h.id || hl) sel.push([h, st, xy, rad]);
    }
    ctx.font = `${10.5 / k}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    for (const [h, st, xy, rad] of sel) {
      ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillText(displayName(h, st), xy[0] + rad + 4.5 / k, xy[1] + 0.6 / k);
      ctx.fillStyle = "#c8dbff"; ctx.fillText(displayName(h, st), xy[0] + rad + 4 / k, xy[1]);
    }
    // callouts
    ctx.font = `${10.5 / k}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textBaseline = "alphabetic";
    for (const c of calloutsFor(S.year)) {
      const xy = proj([c.lng, c.lat]); if (!xy) continue;
      const txt = c.el.textContent;
      const x = xy[0], y = xy[1] - (14 + (c.idx % 3) * 17) / k;
      const w = ctx.measureText(txt).width + 10 / k;
      ctx.globalAlpha = +c.el.style.opacity || 1;
      ctx.fillStyle = "rgba(2,4,10,.82)"; ctx.fillRect(x - w / 2, y - 12 / k, w, 15 / k);
      ctx.fillStyle = c.el.style.getPropertyValue("--c"); ctx.fillRect(x - w / 2, y - 12 / k, 2 / k, 15 / k);
      ctx.fillStyle = "#c8dbff"; ctx.fillText(txt, x - w / 2 + 6 / k, y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    updateLeader();
  }
  function drawBubble(ctx, x, y, r, st, k) {
    const c = st.color;
    ctx.lineWidth = 1.5 / k;
    if (st.condo) {
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = COLOR.GBR; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = COLOR.FRA; ctx.fill();
      return;
    }
    switch (st.style) {
      case "solid":
        ctx.shadowColor = c; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c; ctx.fill(); ctx.shadowBlur = 0; break;
      case "ringed":
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r + 2.5 / k, 0, 6.283); ctx.strokeStyle = c; ctx.lineWidth = 1 / k; ctx.stroke(); break;
      case "half":
        ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = c; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r - 0.75 / k, 0, 6.283); ctx.strokeStyle = c; ctx.stroke(); break;
      default:
        ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, r - 0.75 / k, 0, 6.283); ctx.strokeStyle = c; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function currentBorderLines() {
    let snap = BORDER_YEARS[0];
    for (const y of BORDER_YEARS) if (y <= S.year) snap = y;
    return S.borders.get(snap) || S.borders.get(S.bordersYear) || null;
  }

  // ---------------------------------------------------------------- year updates
  function setYear(y, opts = {}) {
    y = Math.max(1800, Math.min(2025, Math.round(y)));
    S.prevYear = S.year; S.year = y;
    $("year").value = y;
    $("year-big").textContent = y;
    renderMeters();
    S.arcs = computeArcs();
    if (S.view === "globe") { renderGlobe(); renderArcs(); } else { renderFlowLine(); drawFlat(); }
    if (S.hoverArc) { S.hoverArc = null; $("flowtip").hidden = true; }
    pulseChanges();
    renderFeed();
    if (S.selected) renderPanel();
    if ($("table-dlg").open) renderTable();
    drawDensity();
    bordersFor(y).then(({ snap, lines }) => {
      if (!lines || S.bordersYear === snap) return;
      S.bordersYear = snap;
      setGlobeBorders(lines);
      if (S.view === "flat") drawFlat();
    });
  }
  function pulseChanges() {
    if (S.prevYear === null || Math.abs(S.year - S.prevYear) > 2 || S.view !== "globe") return;
    for (const e of S.data.events) {
      if (Math.floor(e.t) !== S.year || !e.to) continue;
      const m = markers.get(e.h); if (!m) continue;
      m.el.classList.remove("pulse"); void m.el.offsetWidth; m.el.classList.add("pulse");
      setTimeout(() => m.el.classList.remove("pulse"), 1300);
    }
  }

  // ---------------------------------------------------------------- meters (htop-style)
  const METER_KEYS = ["GBR", "FRA", "PRT", "NLD", "OTH"];
  function countsFor(year) {
    const c = { GBR: 0, FRA: 0, PRT: 0, NLD: 0, OTH: 0, _all: 0, _vis: 0 };
    for (const h of S.data.holdings) {
      const st = stateOf(h, year);
      if (!st || st.ctrl === "SOV") continue;
      for (const g of st.groups) c[g]++;
      c._all++;
      if (st.groups.some((g) => S.filters.has(g))) c._vis++;
    }
    return c;
  }
  function computeMeterScale() {
    S.meterMax = { GBR: 1, FRA: 1, PRT: 1, NLD: 1, OTH: 1, ALL: 1 };
    for (let y = 1800; y <= 2025; y++) {
      const c = countsFor(y);
      for (const k of METER_KEYS) S.meterMax[k] = Math.max(S.meterMax[k], c[k]);
      S.meterMax.ALL = Math.max(S.meterMax.ALL, c._all);
    }
  }
  function renderMeters() {
    const c = countsFor(S.year);
    const rows = METER_KEYS.filter((k) => S.filters.has(k));
    const total = c._vis;
    const row = (k, label, v, max, colour, cls = "") =>
      `<div class="mrow ${cls}" style="--c:${colour}"><span class="k">${label}</span><span class="mbar"><span style="width:${(v / max) * 100}%"></span></span><span class="v">${String(v).padStart(3, " ")}</span></div>`;
    $("meter-rows").innerHTML =
      row("ALL", "RULED", total, S.meterMax.ALL, "var(--phos-hi)", "total") +
      rows.map((k) => row(k, k, c[k], S.meterMax[k], COLOR[k])).join("");
  }

  // ---------------------------------------------------------------- transfer log
  function renderFeed() {
    const list = $("feed-list");
    const evs = S.data.events.filter((e) => Math.floor(e.t) === S.year).filter((e) => {
      const st = stateOf(S.byId.get(e.h), S.year);
      const groups = st ? st.groups : [groupOf(e.from || "OTH")];
      return groups.some((g) => S.filters.has(g));
    });
    $("feed-count").textContent = `${S.year} · ${String(evs.length).padStart(2, "0")} REC`;
    if (!evs.length) { list.innerHTML = `<li class="empty">-- no transfers recorded in ${S.year} --</li>`; return; }
    list.innerHTML = evs.map((e) => {
      const h = S.byId.get(e.h);
      const c = colorOf(e.to ? (e.to === "SOV" ? (e.from || "SOV") : e.to) : (e.from || "SOV"));
      const what = e.to ? (e.to === "SOV" ? "Independent" : `${ctrlName(e.to)} ${STATUS_NAME[e.st]}`) : "Merged";
      const nm = h.name.split(" / ")[e.to === "SOV" ? h.name.split(" / ").length - 1 : 0];
      const detail = !e.to || e.to === "SOV" || e.label.toLowerCase().includes((STATUS_NAME[e.st] || "~").split(" ")[0]) ? e.label : `${what} · ${e.label}`;
      const cc = (x) => (x === "GBRFRA" ? "CON" : x);
      const code = e.to ? (e.from && e.from !== e.to ? `${cc(e.from)}>${cc(e.to)}` : cc(e.to)) : `${cc(e.from)}>×`;
      return `<li><button data-id="${h.id}" style="--c:${c}"><span class="t">${fmtYear(e.t)}</span><span class="c">${escapeHtml(code)}</span><span class="m"><b>${escapeHtml(nm)}</b> <span>${escapeHtml(detail)}</span></span></button></li>`;
    }).join("");
    list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { select(b.dataset.id); flyTo(S.byId.get(b.dataset.id)); }));
  }

  // ---------------------------------------------------------------- selection & panel
  function select(id) {
    S.selected = id;
    if (id && S.trade && !S.flowCache.has(id)) loadHoldingFlows(id).then(() => { if (S.selected === id) { renderPanel(); S.arcs = computeArcs(); if (S.view === "globe") renderArcs(); else drawFlat(); renderFlowLine(); } });
    S.arcs = computeArcs();
    if (S.view === "globe") renderArcs(); else renderFlowLine();
    $("panel").hidden = !id;
    $("feed").hidden = !!id;
    markers.forEach((m) => m.el.classList.toggle("sel", m.h.id === id));
    if (id) renderPanel();
    if (S.view === "flat") drawFlat();
    updateLeader();
  }
  function renderPanel() {
    const h = S.byId.get(S.selected); if (!h) return;
    const st = stateOf(h, S.year);
    $("p-code").textContent = holdingCode(h);
    $("p-name").textContent = h.name;
    const ll = `${Math.abs(h.lat).toFixed(1)}°${h.lat >= 0 ? "N" : "S"} ${Math.abs(h.lon).toFixed(1)}°${h.lon >= 0 ? "E" : "W"}`;
    const ctrlTxt = st && st.ctrl === "SOV"
      ? `Sovereign${st.colourCtrl !== "SOV" ? ` (former ${st.colourCtrl} holding)` : ""}`
      : st ? `${ctrlName(st.ctrl)} · ${STATUS_NAME[st.p.st]}` : "";
    const ctrl = st
      ? `<i class="sw b ${st.style}${st.condo ? " condo" : ""}" style="--c:${st.color}"></i>${escapeHtml(ctrlTxt)}`
      : "not a separate holding";
    $("p-rec").innerHTML = [
      ["YEAR", S.year], ["CTRL", ctrl], ["SINCE", st ? fmtYear(st.p.s) : "—"],
      ["REGION", escapeHtml(h.region)], ["TYPE", h.kind], ["COORD", ll],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    // timeline
    const span = 2025 - 1800;
    const segs = h.periods.map((p) => {
      const s = Math.max(1800, p.s), e = Math.min(2025.99, p.e ?? 2025.99);
      if (e <= 1800 || s >= 2026) return "";
      const cc = p.c === "SOV" ? (lastColonial(h, p.s) || "SOV") : p.c;
      const w = ((e - s) / (span + 1)) * 100;
      return `<span class="seg ${styleOf(p.st)}" style="width:${w}%;margin-left:0;--c:${colorOf(cc)};background:${p.c === "GBRFRA" ? `linear-gradient(90deg,${COLOR.GBR} 50%,${COLOR.FRA} 50%)` : colorOf(cc)}" title="${escapeHtml(`${fmtYear(p.s)}–${p.e ? fmtYear(p.e) : "present"} · ${ctrlName(p.c)} ${STATUS_NAME[p.st]}`)}"></span>`;
    }).join("");
    const first = Math.max(1800, h.periods[0].s);
    const lead = ((first - 1800) / (span + 1)) * 100;
    const cur = ((S.year + 0.5 - 1800) / (span + 1)) * 100;
    $("p-tl").innerHTML = `<span style="width:${lead}%"></span>${segs}<span class="cursor" style="left:${cur}%"></span>`;
    // events
    const t = tOf(S.year);
    renderPanelTrade(h);
    const FILE = { ind: "IND", pak: "PAK", bgd: "BGD", lka: "LKA", mmr: "MMR", fms: "MYS", sgp: "SGP", idn: "IDN", vnm_n: "VNM", gha: "GHA", nga: "NGA",
      ken: "KEN", tza: "TZA", sen: "SEN", civ: "CIV", gin: "GIN", dza: "DZA", tun: "TUN", mar: "MAR", ago: "AGO", moz: "MOZ" };
    $("p-foot").innerHTML = FILE[h.id]
      ? `<a class="soon-chip" style="color:var(--phos-hi);text-decoration:none" href="systems.html#${FILE[h.id]}">OPEN FILE → INHERITED SYSTEMS</a>`
      : `<span class="soon-chip">NO DEVELOPMENT FILE FOR THIS HOLDING YET</span>`;
    $("p-count").textContent = `${String(h.periods.length).padStart(2, "0")} REC`;
    $("p-events").tBodies[0].innerHTML = h.periods.map((p) => {
      const cc = p.c === "SOV" ? (lastColonial(h, p.s) || "SOV") : p.c;
      const now = p.s <= t && t < (p.e ?? 9999);
      const code = p.c === "GBRFRA" ? "CON" : p.c;
      return `<tr class="${now ? "now" : ""}"><td>${fmtYear(p.s)}</td><td class="c" style="--c:${colorOf(cc)}">${code}</td><td class="s">${escapeHtml(STATUS_NAME[p.st])}</td><td>${escapeHtml(p.ev)}${p.cf === "medium" ? ` <span class="cf">[date debated]</span>` : ""}</td></tr>`;
    }).join("");
  }
  function updateLeader() {
    const svg = $("leader");
    const h = S.selected && S.byId.get(S.selected);
    const st = h && stateOf(h, S.year);
    if (!h || !st || !visible(st) || $("panel").hidden) { svg.classList.add("off"); return; }
    let x, y;
    if (S.view === "globe") {
      if (angleFromView(h.lat, h.lon) > 88) { svg.classList.add("off"); return; }
      ({ x, y } = globe.getScreenCoords(h.lat, h.lon, 0.01));
    } else {
      const xy = flat.proj([h.lon, h.lat]); if (!xy) { svg.classList.add("off"); return; }
      [x, y] = S.zoom.apply(xy);
    }
    const stage = $("stage").getBoundingClientRect();
    const pr = $("panel").getBoundingClientRect();
    const px = pr.left - stage.left, py = Math.min(pr.top - stage.top + 22, stage.height - 10);
    const tx = x < px ? px : pr.right - stage.left;
    const ty = x < px ? py : py;
    if (window.innerWidth <= 760) { svg.classList.add("off"); return; }
    svg.classList.remove("off");
    const line = $("leader-line");
    line.setAttribute("x1", x); line.setAttribute("y1", y); line.setAttribute("x2", tx); line.setAttribute("y2", ty);
    const dot = $("leader-dot"); dot.setAttribute("cx", x); dot.setAttribute("cy", y);
  }
  function loopLeader() { if (S.view === "globe") updateLeader(); requestAnimationFrame(loopLeader); }

  function flyTo(h) {
    if (!h) return;
    if (S.view === "globe") globe.pointOfView({ lat: h.lat, lng: h.lon - 14, altitude: 1.5 }, 1400);
  }

  // ---------------------------------------------------------------- density strip & ticks
  function drawDensity() {
    const cv = $("density"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = 28;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const den = S.data.density, max = Math.max(...den.map((d) => d.active));
    const thumb = 6; // keep bars aligned with slider thumb travel
    const x = (y) => thumb + ((y - 1800) / 225) * (w - 2 * thumb);
    const bw = Math.max(1, (w - 2 * thumb) / 226 - 0.6);
    for (const d of den) {
      const bh = (d.active / max) * (h - 8);
      ctx.fillStyle = d.y === S.year ? "#c8dbff" : "rgba(143,180,240,.34)";
      ctx.fillRect(x(d.y) - bw / 2, h - bh, bw, bh);
      if (d.events) { ctx.fillStyle = d.y === S.year ? "#c8dbff" : "rgba(200,219,255,.6)"; ctx.fillRect(x(d.y) - bw / 2, 0, bw, Math.min(5, 1 + d.events)); }
    }
  }
  function drawTicks() {
    const box = $("ticks"), w = box.clientWidth, thumb = 6;
    let html = "";
    for (let y = 1800; y <= 2020; y += 10) {
      const left = thumb + ((y - 1800) / 225) * (w - 2 * thumb);
      const major = y % (w < 700 ? 50 : 20) === 0;
      html += `<span class="${major ? "" : "minor"}" style="left:${left}px">${y}</span>`;
    }
    box.innerHTML = html;
  }

  // ---------------------------------------------------------------- playback
  function play(on) {
    S.playing = on;
    $("play-ico").setAttribute("href", on ? "#i-pause" : "#i-play");
    $("btn-play").setAttribute("aria-label", on ? "Pause" : "Play");
    $("btn-play").classList.toggle("playing", on);
    clearInterval(S.timer);
    if (!on) { setYear(S.year); return; }
    if (S.year >= 2025) setYear(1800);
    S.timer = setInterval(() => {
      if (S.year >= 2025) { play(false); return; }
      setYear(S.year + 1);
    }, S.fast ? STEP_MS.fast : STEP_MS.normal);
  }

  // ---------------------------------------------------------------- intro tour
  const TOUR = [
    { y: 1800, ids: ["bra","idn","cap","lka","ind"], lat: 15, lng: 10, alt: 2.5, t: "1800 · Four empires at the threshold", x: "Britain, France, Portugal and the Netherlands hold scattered ports, islands and plantation colonies. Portugal still rules Brazil; the Dutch East India Company has just been dissolved." },
    { y: 1811, ids: ["idn","reu","mus","glp","trq","srm"], lat: -5, lng: 95, alt: 1.9, t: "1811 · War moves the map", x: "With the Netherlands annexed by Napoleon, Britain seizes Java. Across the Napoleonic Wars, British forces occupy Dutch, French and Danish holdings from the Caribbean to India." },
    { y: 1815, ids: ["cap","lka","mus","mlt","guy"], lat: -20, lng: 40, alt: 2.1, t: "1815 · The peace settlement", x: "The Cape, Ceylon, Mauritius, Malta and British Guiana stay British. Java, Réunion and the Caribbean islands are handed back." },
    { y: 1825, ids: ["mlc","chn","pul","idn"], lat: 8, lng: 95, alt: 1.6, t: "1825 · The Anglo-Dutch swap", x: "Under the 1824 treaty, Malacca and Chinsurah pass to Britain and the Netherlands keeps the archipelago: the line that later divides Malaysia from Indonesia." },
    { y: 1858, ids: ["ind","pdy","goa","trq"], lat: 20, lng: 80, alt: 1.6, t: "1858 · From company to Crown", x: "After the 1857 uprising the East India Company is abolished and the British Crown rules India directly. French, Portuguese and Danish enclaves remain inside it." },
    { y: 1900, ids: ["nga","ken","sen","cmr","zwe","mdg"], lat: 3, lng: 18, alt: 2.0, t: "1900 · The partition of Africa", x: "After the Berlin Conference, nearly all of Africa is under European rule. French West and Equatorial Africa and British East and Southern Africa take shape." },
    { y: 1923, ids: ["pse","irq","syr","tgo","tza","nam"], lat: 30, lng: 40, alt: 1.8, t: "1923 · Mandates", x: "Germany's colonies and the Ottoman Arab provinces become League of Nations mandates under Britain, France and the dominions." },
    { y: 1943, ids: ["mmr","fms","sgp","hkg","idn","tls"], lat: 5, lng: 110, alt: 1.8, t: "1943 · Japanese occupation", x: "Japan holds Burma, Malaya, Singapore, Hong Kong, the Dutch East Indies and Portuguese Timor. Colonial authority in Asia never fully recovers." },
    { y: 1948, ids: ["ind","pak","mmr","lka","pdy","goa"], lat: 18, lng: 78, alt: 1.7, t: "1947–48 · South Asia", x: "India and Pakistan become dominions, then Burma and Ceylon follow. The French and Portuguese enclaves outlast the Raj by years." },
    { y: 1960, ids: ["sen","civ","cmr","mdg","nga","sml"], lat: 5, lng: 10, alt: 2.0, t: "1960 · The year of Africa", x: "Seventeen African states become independent, most of them former French colonies that passed through a brief stage of autonomy in the French Community." },
    { y: 1975, ids: ["ago","moz","cpv","stp","tls"], lat: -10, lng: 25, alt: 2.1, t: "1975 · The end of Portugal's empire", x: "After the Carnation Revolution, Angola, Mozambique, Cape Verde and São Tomé become independent. Timor-Leste is invaded by Indonesia." },
    { y: 2025, ids: ["reu","glp","cuw","gib","flk","ncl"], lat: 10, lng: -40, alt: 2.4, t: "2025 · What remains", x: "Ringed markers show territories that are still dependent or integrated: French overseas departments, the Dutch Caribbean and British Overseas Territories." },
  ];
  const DWELL = 9000;
  function runIntro(i = 0) {
    stopIntro(false);
    const I = S.intro;
    I.on = true; I.i = i; I.paused = false;
    play(false); select(null);
    const s = TOUR[i];
    I.ids = new Set(s.ids);
    $("intro").hidden = false;
    $("intro-step").textContent = `INTRO ${String(i + 1).padStart(2, "0")}/${TOUR.length}`;
    $("intro-title").textContent = s.t;
    $("intro-text").textContent = s.x;
    $("intro-pause-ico").setAttribute("href", "#i-pause");
    $("intro-pause").setAttribute("aria-label", "Pause tour");
    $("intro-dots").innerHTML = TOUR.map((_, k) => `<button class="${k < i ? "done" : k === i ? "cur" : ""}" data-k="${k}" aria-label="Go to stop ${k + 1}: ${escapeHtml(TOUR[k].t)}"></button>`).join("");
    $("intro-dots").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => runIntro(+b.dataset.k)));
    if (S.view === "globe") globe.pointOfView({ lat: s.lat, lng: s.lng, altitude: s.alt }, 1800);
    // sweep the slider through the years so the changes are visible
    animateYear(s.y, () => {
      $("intro-ids").innerHTML = s.ids.map((id) => {
        const h = S.byId.get(id), st = stateOf(h, S.year);
        return `<button data-id="${id}" style="--c:${st ? st.color : "var(--sov)"}"><i></i>${escapeHtml(displayName(h, st))}</button>`;
      }).join("");
      $("intro-ids").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { pauseIntro(true); select(b.dataset.id); }));
      startDwell(DWELL);
    });
  }
  function animateYear(target, done) {
    const I = S.intro;
    cancelAnimationFrame(I.raf);
    const from = S.year, dist = target - from;
    if (!dist) { setYear(target); done(); return; }
    const dur = Math.min(2200, 300 + Math.abs(dist) * 40), t0 = performance.now();
    const tick = (now) => {
      if (!I.on) return;
      const k = Math.min(1, (now - t0) / dur);
      const y = Math.round(from + dist * (1 - Math.pow(1 - k, 3)));
      if (y !== S.year) setYear(y);
      if (k < 1) I.raf = requestAnimationFrame(tick); else { setYear(target); done(); }
    };
    $("intro-hint").textContent = `moving to ${target}…`;
    $("intro-fill").style.width = "0%";
    I.raf = requestAnimationFrame(tick);
  }
  function startDwell(ms) {
    const I = S.intro;
    I.left = ms; I.t0 = performance.now();
    clearTimeout(I.timer); cancelAnimationFrame(I.prog);
    I.timer = setTimeout(() => (I.i + 1 < TOUR.length ? runIntro(I.i + 1) : endIntro()), ms);
    const prog = (now) => {
      if (!I.on || I.paused) return;
      const left = Math.max(0, I.left - (now - I.t0));
      $("intro-fill").style.width = `${(1 - left / DWELL) * 100}%`;
      $("intro-hint").textContent = I.i + 1 < TOUR.length ? `next stop in ${Math.ceil(left / 1000)}s` : `tour ends in ${Math.ceil(left / 1000)}s`;
      I.prog = requestAnimationFrame(prog);
    };
    I.prog = requestAnimationFrame(prog);
  }
  function pauseIntro(force) {
    const I = S.intro;
    if (!I.on) return;
    const pause = force === undefined ? !I.paused : force;
    if (pause === I.paused) return;
    I.paused = pause;
    $("intro-pause-ico").setAttribute("href", pause ? "#i-play" : "#i-pause");
    $("intro-pause").setAttribute("aria-label", pause ? "Resume tour" : "Pause tour");
    if (pause) {
      clearTimeout(I.timer); cancelAnimationFrame(I.prog);
      I.left = Math.max(0, I.left - (performance.now() - I.t0));
      $("intro-hint").textContent = "paused · press play to continue";
    } else startDwell(I.left || DWELL);
  }
  function endIntro() {
    stopIntro(false);
    $("intro-hint").textContent = "tour complete · explore freely or replay";
    $("intro-fill").style.width = "100%";
    $("intro-pause-ico").setAttribute("href", "#i-play");
    $("intro-pause").setAttribute("aria-label", "Replay tour");
    S.intro.ended = true;
  }
  function stopIntro(hide = true) {
    const I = S.intro;
    clearTimeout(I.timer); cancelAnimationFrame(I.raf); cancelAnimationFrame(I.prog);
    I.on = false; I.ended = false;
    if (hide) {
      const wasOpen = !$("intro").hidden || I.ids;
      $("intro").hidden = true; I.ids = null;
      if (wasOpen && S.data) markers.forEach((m) => m.el.classList.remove("hl"));
    }
  }

  // ---------------------------------------------------------------- trade flows
  const WIDTH_GLOBE = [0.12, 0.2, 0.3, 0.42, 0.58, 0.78];
  const WIDTH_FLAT = [0.6, 1, 1.5, 2.2, 3.1, 4.2];
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tradeKey(y) {
    const latest = S.trade.meta.latest;
    return { key: String(Math.min(y, latest)), carried: y > latest, latest };
  }
  function unitFor(y) {
    const u = S.trade.meta.units.find((u) => y >= u.from && y <= u.to) || S.trade.meta.units[S.trade.meta.units.length - 1];
    return u;
  }
  function fmtMoney(vk, y) {
    if (vk == null) return "—";
    const u = unitFor(y), sym = u.unit.startsWith("US$") ? "US$" : "£";
    const v = vk * 1000;
    if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}bn`;
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}m`;
    return `${sym}${Math.round(v / 1e3)}k`;
  }
  function simpleRatio(a, b) {
    const r = a / b;
    if (r >= 6) return "> 5 : 1";
    if (r <= 1 / 6) return "1 : > 5";
    let best = [1, 1], bd = Infinity;
    for (let p = 1; p <= 5; p++) for (let q = 1; q <= 5; q++) {
      const d = Math.abs(Math.log(p / q) - Math.log(r));
      if (d < bd) { bd = d; best = [p, q]; }
    }
    return `${best[0]} : ${best[1]}`;
  }
  const nodeOf = (c) => S.trade.nodes[c];
  function flowSideColour(code) {
    const n = nodeOf(code); if (!n || !n.h) return null;
    const st = stateOf(S.byId.get(n.h), S.year);
    return st ? { st, colour: st.color, visible: visible(st), colonial: st.ctrl !== "SOV" } : null;
  }
  async function loadHoldingFlows(hid) {
    if (S.flowCache.has(hid)) return S.flowCache.get(hid);
    S.flowCache.set(hid, null);
    try {
      const r = await fetch(`data/trade_h/${hid}.json`);
      const d = r.ok ? await r.json() : {};
      S.flowCache.set(hid, d);
    } catch { S.flowCache.set(hid, {}); }
    return S.flowCache.get(hid);
  }
  function computeArcs() {
    if (!S.trade || !S.flowsOn) return [];
    const { key } = tradeKey(S.year);
    let rows = [];
    const focus = S.selected && S.flowCache.get(S.selected);
    if (S.selected && focus) {
      rows = (focus[key] || []).map(([other, tot, out, inn, me]) => [me, other, tot, out, inn]);
    } else if (!S.selected) {
      for (const r of S.trade.years[key] || []) {
        const A = flowSideColour(r[0]), B = flowSideColour(r[1]);
        if ((A && A.visible) || (B && B.visible)) rows.push(r);
        if (rows.length >= 50) break;
      }
    }
    const n = rows.length;
    return rows.map(([a, b, tot, ab, ba], i) => {
      const na = nodeOf(a), nb = nodeOf(b);
      if (!na || !nb) return null;
      const pct = n > 1 ? 1 - i / (n - 1) : 1;
      const cls = Math.min(5, Math.floor(pct * 6));
      const A = flowSideColour(a), B = flowSideColour(b);
      const side = A && A.colonial ? A : B && B.colonial ? B : A || B;
      const fwd = ba == null || (ab != null && ab >= ba);
      const [s0, s1] = fwd ? [na, nb] : [nb, na];
      return { a, b, tot, ab, ba, rank: i + 1, n, cls, colour: side ? side.colour : COLOR.SOV,
        sLat: s0.lat, sLng: s0.lon, eLat: s1.lat, eLng: s1.lon };
    }).filter(Boolean);
  }
  const rgba = (hex, a) => {
    const m = hex.replace("#", "");
    const v = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  };
  function initArcs() {
    globe
      .arcStartLat((d) => d.f.sLat).arcStartLng((d) => d.f.sLng).arcEndLat((d) => d.f.eLat).arcEndLng((d) => d.f.eLng)
      .arcColor((d) => (d.p ? rgba(d.f.colour, 0.95) : rgba(d.f.colour, S.hoverArc === d.f ? 0.95 : 0.45)))
      .arcStroke((d) => (d.p ? WIDTH_GLOBE[d.f.cls] * 0.9 : WIDTH_GLOBE[d.f.cls] * (S.hoverArc === d.f ? 1.6 : 1)))
      .arcAltitudeAutoScale(0.32)
      .arcDashLength((d) => (d.p ? 0.025 : 1)).arcDashGap((d) => (d.p ? 0.11 : 0))
      .arcDashInitialGap((d) => (d.p ? (d.f.rank * 0.137) % 1 : 0))
      .arcDashAnimateTime((d) => (d.p ? 5200 - d.f.cls * 450 : 0))
      .arcsTransitionDuration(0)
      .onArcHover((d) => { S.hoverArc = d ? d.f : null; renderFlowTip(); refreshArcStyle(); });
  }
  function refreshArcStyle() { if (globe) globe.arcColor(globe.arcColor()).arcStroke(globe.arcStroke()); }
  function renderArcs() {
    S.arcs = computeArcs();
    if (globe && S.view === "globe") {
      const items = [];
      for (const f of S.arcs) { items.push({ f, p: false }); if (!REDUCED) items.push({ f, p: true }); }
      globe.arcsData(items);
    }
    renderFlowLine();
  }
  function renderFlowLine() {
    const el = $("flowline");
    if (!S.trade || !S.flowsOn) { el.textContent = "TRADE LAYER OFF"; return; }
    const { key, carried, latest } = tradeKey(S.year);
    const src = S.trade.meta.sources[key] || "—";
    const n = S.arcs.length;
    const what = S.selected ? `${n} partners of the selected holding` : `${n} largest flows`;
    el.innerHTML = n
      ? `TRADE <b>${what}</b> · ${escapeHtml(src)}${carried ? ` · <b>latest available: ${latest}</b>` : ""}`
      : `TRADE <b>no recorded flows</b> touching the shown holdings in ${S.year}${S.year < 1820 ? " · records before 1820 are sparse" : ""}`;
  }
  function renderFlowTip() {
    const tip = $("flowtip"), f = S.hoverArc;
    if (!f) { tip.hidden = true; return; }
    const na = nodeOf(f.a), nb = nodeOf(f.b);
    const { key, carried } = tradeKey(S.year);
    const y = +key;
    const src = S.trade.meta.sources[key] || "";
    let ratio, split = "", who = "";
    if (f.ab != null && f.ba != null && f.ab > 0 && f.ba > 0) {
      ratio = `<div class="row"><span class="k">${escapeHtml(f.a)}→${escapeHtml(f.b)} : ${escapeHtml(f.b)}→${escapeHtml(f.a)}</span><span>≈ ${simpleRatio(f.ab, f.ba)}</span></div>`;
      const pa = (f.ab / (f.ab + f.ba)) * 100;
      const ca = (flowSideColour(f.a) || {}).colour || COLOR.SOV, cb = (flowSideColour(f.b) || {}).colour || COLOR.SOV;
      split = `<div class="split"><span style="width:${pa}%;background:${ca}"></span><span style="width:${100 - pa}%;background:${cb};opacity:.55"></span></div>`;
      const big = f.ab >= f.ba ? na.n : nb.n;
      who = Math.abs(f.ab - f.ba) / (f.ab + f.ba) < 0.05 ? "roughly balanced" : `${escapeHtml(big)} exports more`;
      who = `<div class="note">${who}</div>`;
    } else {
      const known = f.ab != null ? `${f.a}→${f.b}` : `${f.b}→${f.a}`;
      ratio = `<div class="warn">One-sided estimate: only ${escapeHtml(known)} is recorded.</div>`;
    }
    tip.innerHTML = `<header class="bar"><span>FLOW · ${S.year}${carried ? ` (DATA ${y})` : ""}</span><span>RANK ${f.rank}/${f.n}</span></header>
      <div class="bd"><div class="pair">${escapeHtml(na.n)} ⇄ ${escapeHtml(nb.n)}</div>
      <div class="row"><span class="k">Total</span><span>≈ ${fmtMoney(f.tot, y)}</span></div>
      ${ratio}${split}${who}<div class="note">src: ${escapeHtml(src)} · approximate · ${escapeHtml(unitFor(y).label)}</div></div>`;
    tip.hidden = false;
    placeFlowTip();
  }
  function placeFlowTip() {
    const tip = $("flowtip"); if (tip.hidden) return;
    const st = $("stage").getBoundingClientRect();
    let x = S.mouse[0] + 16, y = S.mouse[1] + 16;
    if (x + 310 > st.width) x = S.mouse[0] - 316;
    if (y + tip.offsetHeight + 10 > st.height) y = S.mouse[1] - tip.offsetHeight - 12;
    tip.style.left = `${Math.max(8, x)}px`; tip.style.top = `${Math.max(8, y)}px`;
  }
  // flat map: great-circle polylines
  function arcPath(f) {
    const interp = d3.geoInterpolate([f.sLng, f.sLat], [f.eLng, f.eLat]);
    const pts = [];
    for (let i = 0; i <= 32; i++) pts.push(flat.proj(interp(i / 32)));
    return pts;
  }
  function drawFlatArcs(ctx, k) {
    flat.arcHits = [];
    for (const f of S.arcs) {
      const pts = arcPath(f);
      ctx.beginPath();
      let prev = null;
      for (const p of pts) {
        if (!p) { prev = null; continue; }
        if (!prev || Math.abs(p[0] - prev[0]) > flat.w / 3) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        prev = p;
      }
      ctx.strokeStyle = rgba(f.colour, S.hoverArc === f ? 0.95 : 0.6);
      ctx.lineWidth = (WIDTH_FLAT[f.cls] * (S.hoverArc === f ? 1.5 : 1)) / Math.sqrt(k);
      ctx.stroke();
      flat.arcHits.push({ f, pts });
    }
  }
  function flatArcAt(x, y) {
    let best = null, bd = 6 / S.zoom.k;
    for (const { f, pts } of flat.arcHits || []) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; if (!a || !b || Math.abs(a[0] - b[0]) > flat.w / 3) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
        const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
        if (d < bd) { bd = d; best = f; }
      }
    }
    return best;
  }
  // record card: trade section
  function renderPanelTrade(h) {
    const box = $("p-trade");
    if (!S.trade) { box.innerHTML = ""; return; }
    const series = S.trade.share[h.id];
    if (!series || !series.length) { box.innerHTML = `<div class="mini-lbl"><span>TRADE</span></div><div class="row"><span class="k">no recorded bilateral trade for this holding</span></div>`; return; }
    const { key } = tradeKey(S.year);
    const y = +key;
    let cur = null;
    for (const r of series) if (r[0] <= y) cur = r;
    const ind = S.trade.indep[h.id];
    // sparkline of metropole share
    const w = 300, hh = 46, x0 = 1800, x1 = 2025;
    const X = (yy) => ((yy - x0) / (x1 - x0)) * w, Y = (v) => hh - 4 - v * (hh - 10);
    const pts = series.filter((r) => r[1] > 0).map((r) => [X(r[0]), Y(r[2] / r[1])]);
    let d = "";
    let last = null;
    for (const p of pts) { d += (last && p[0] - last[0] > X(x0 + 6) ? "M" : d ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); last = p; }
    const metro = cur ? cur[3] : null;
    const share = cur && cur[1] ? Math.round((cur[2] / cur[1]) * 100) : null;
    const flows = S.flowCache.get(h.id);
    const top = flows && flows[key] ? flows[key].slice(0, 5) : null;
    box.innerHTML = `<div class="mini-lbl"><span>TRADE · ${y}${y !== S.year ? " (latest)" : ""}</span><span>${escapeHtml(S.trade.meta.sources[key] || "")}</span></div>
      <div class="row"><span class="k">Recorded trade</span><span>${cur ? fmtMoney(cur[1], cur[0]) : "—"}${cur && cur[0] !== y ? ` (${cur[0]})` : ""}</span></div>
      <div class="row"><span class="k">Share with ${metro ? escapeHtml(metro) : "metropole"}</span><span>${share == null ? "—" : share + "%"}</span></div>
      <svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" role="img" aria-label="Share of trade with the metropole, 1800 to 2025">
        <line x1="0" x2="${w}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(200,219,255,.15)" stroke-width="1"/>
        <line x1="0" x2="${w}" y1="${Y(1)}" y2="${Y(1)}" stroke="rgba(200,219,255,.08)" stroke-width="1"/>
        ${ind ? `<line x1="${X(ind)}" x2="${X(ind)}" y1="2" y2="${hh}" stroke="rgba(200,219,255,.45)" stroke-dasharray="2 2"/><text x="${X(ind) + 3}" y="9" font-size="8" fill="#6f7f99" font-family="IBM Plex Mono, monospace">indep. ${ind}</text>` : ""}
        <path d="${d}" fill="none" stroke="#8fb4f0" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line x1="${X(S.year)}" x2="${X(S.year)}" y1="0" y2="${hh}" stroke="#c8dbff" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <text x="2" y="${hh - 6}" font-size="8" fill="#6f7f99" font-family="IBM Plex Mono, monospace">0%</text><text x="2" y="12" font-size="8" fill="#6f7f99" font-family="IBM Plex Mono, monospace">100%</text>
      </svg>
      ${top ? `<ol>${top.map((r) => `<li><span>${escapeHtml((nodeOf(r[0]) || { n: r[0] }).n)}</span><span>${fmtMoney(r[1], y)}</span></li>`).join("")}</ol>` : ""}`;
  }

  // ---------------------------------------------------------------- view switching
  function setView(v) {
    S.view = v;
    $("view-globe").classList.toggle("active", v === "globe"); $("view-globe").setAttribute("aria-pressed", v === "globe");
    $("view-flat").classList.toggle("active", v === "flat"); $("view-flat").setAttribute("aria-pressed", v === "flat");
    $("globe").hidden = v !== "globe";
    $("flat").hidden = v !== "flat";
    if (v === "globe" && !globe) initGlobe();
    if (v === "flat" && !flat.ctx) initFlat();
    if (v === "flat") { sizeFlat(); }
    if (globe) globe.arcsData(v === "globe" ? globe.arcsData() : []);
    setYear(S.year);
  }

  // ---------------------------------------------------------------- search & table
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function initSearch() {
    const inp = $("search-input"), out = $("search-results");
    inp.addEventListener("input", () => {
      const q = norm(inp.value.trim());
      if (!q) { out.hidden = true; return; }
      const hits = S.data.holdings.filter((h) => norm(h.name).includes(q)).slice(0, 8);
      out.innerHTML = hits.length
        ? hits.map((h) => `<li><button data-id="${h.id}">${escapeHtml(h.name)}<small>${escapeHtml(h.region)}</small></button></li>`).join("")
        : `<li><button disabled>No holding matches “${escapeHtml(inp.value)}”</button></li>`;
      out.hidden = false;
      out.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => {
        const h = S.byId.get(b.dataset.id);
        if (!stateOf(h, S.year)) setYear(Math.max(1800, Math.ceil(h.periods.find((p) => (p.e ?? 9999) > 1800).s)));
        select(h.id); flyTo(h); out.hidden = true; inp.value = "";
      }));
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) out.hidden = true; });
  }
  const T = { sort: { k: "ctrl", dir: 1 }, cur: 0, rows: [] };
  function renderTable() {
    const q = norm($("table-filter").value.trim());
    let all = 0, ruled = 0;
    const rows = [];
    S.data.holdings.forEach((h, i) => {
      const st = stateOf(h, S.year);
      if (!visible(st)) return;
      all++; if (st.ctrl !== "SOV") ruled++;
      const r = {
        h, st, n: i + 1, code: holdingCode(h), name: displayName(h, st), region: h.region,
        ctrl: st.ctrl === "GBRFRA" ? "CON" : st.ctrl, st_: STATUS_NAME[st.p.st], since: Math.floor(st.p.s), cf: st.p.cf,
      };
      if (q && !norm(`${r.name} ${r.region} ${r.ctrl} ${ctrlName(st.ctrl)} ${r.st_} ${r.code}`).includes(q)) return;
      rows.push(r);
    });
    const { k, dir } = T.sort;
    const key = k === "st" ? "st_" : k;
    rows.sort((a, b) => (typeof a[key] === "number" ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key]))) * dir || a.name.localeCompare(b.name));
    T.rows = rows; T.cur = Math.min(T.cur, Math.max(0, rows.length - 1));
    $("table-title").textContent = `LEDGER.DB · ${S.year}`;
    $("table-sum").textContent = `${all} records · ${ruled} under rule · ${rows.length} shown`;
    document.querySelectorAll("#ledger-table th").forEach((th) => th.setAttribute("aria-sort", th.dataset.k === k ? (dir > 0 ? "ascending" : "descending") : "none"));
    $("ledger-table").tBodies[0].innerHTML = rows.length ? rows.map((r, i) =>
      `<tr data-id="${r.h.id}" class="${i === T.cur ? "cur" : ""}"><td class="num dim">${String(r.n).padStart(3, "0")}</td><td class="dim">${r.code}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.region)}</td><td><span class="sw" style="--c:${r.st.color}"></span>${r.ctrl}</td><td>${escapeHtml(r.st_)}</td><td class="num">${r.since}</td><td class="dim">${r.cf === "medium" ? "med" : "high"}</td></tr>`).join("")
      : `<tr><td colspan="8" class="dim">-- no records match --</td></tr>`;
  }
  function tableMove(d) {
    if (!T.rows.length) return;
    T.cur = Math.max(0, Math.min(T.rows.length - 1, T.cur + d));
    const trs = $("ledger-table").tBodies[0].rows;
    [...trs].forEach((tr, i) => tr.classList.toggle("cur", i === T.cur));
    trs[T.cur]?.scrollIntoView({ block: "nearest" });
  }
  function tableOpen(id) {
    $("table-dlg").close();
    select(id); flyTo(S.byId.get(id));
  }
  function openTable() { T.cur = 0; renderTable(); $("table-dlg").showModal(); $("table-filter").focus(); }

  // ---------------------------------------------------------------- wiring
  function wire() {
    $("year").addEventListener("input", (e) => { const y = +e.target.value; stopIntro(); setYear(y); });
    $("btn-play").addEventListener("click", () => { stopIntro(); play(!S.playing); });
    $("btn-prev").addEventListener("click", () => { stopIntro(); play(false); setYear(S.year - 1); });
    $("btn-next").addEventListener("click", () => { stopIntro(); play(false); setYear(S.year + 1); });
    $("btn-speed").addEventListener("click", () => {
      S.fast = !S.fast;
      $("speed-val").textContent = S.fast ? "×5" : "×1";
      $("btn-speed").classList.toggle("fast", S.fast);
      $("btn-speed").setAttribute("aria-label", S.fast ? "Playback speed: fast, 7.5 years per second" : "Playback speed: normal, 1.5 years per second");
      if (S.playing) play(true);
    });
    document.querySelectorAll(".flt").forEach((b) => b.addEventListener("click", () => {
      const e = b.dataset.emp;
      S.filters.has(e) ? S.filters.delete(e) : S.filters.add(e);
      b.classList.toggle("on", S.filters.has(e)); b.setAttribute("aria-pressed", S.filters.has(e));
      setYear(S.year);
    }));
    $("tg-flows").addEventListener("change", (e) => { S.flowsOn = e.target.checked; S.hoverArc = null; $("flowtip").hidden = true; setYear(S.year); });
    $("stage").addEventListener("mousemove", (e) => {
      const r = $("stage").getBoundingClientRect(); S.mouse = [e.clientX - r.left, e.clientY - r.top]; placeFlowTip();
    });
    $("tg-labels").addEventListener("change", (e) => { S.labels = e.target.checked; $("stage").classList.toggle("labels", S.labels); drawFlat(); });
    $("tg-callouts").addEventListener("change", (e) => { S.callouts = e.target.checked; setYear(S.year); });
    $("tg-contrast").addEventListener("change", (e) => {
      document.documentElement.classList.toggle("hc", e.target.checked); readColors();
      if (globe) { globe.particlesColor(() => COLOR.land); globe.particlesData([S.dots]); globe.pathColor(() => COLOR.border); }
      setYear(S.year);
    });
    $("view-globe").addEventListener("click", () => setView("globe"));
    $("view-flat").addEventListener("click", () => setView("flat"));
    $("p-close").addEventListener("click", () => select(null));
    $("btn-intro").addEventListener("click", () => runIntro(0));
    $("intro-stop").addEventListener("click", () => stopIntro(true));
    $("intro-prev").addEventListener("click", () => runIntro(Math.max(0, S.intro.i - 1)));
    $("intro-next").addEventListener("click", () => (S.intro.i + 1 < TOUR.length ? runIntro(S.intro.i + 1) : endIntro()));
    $("intro-pause").addEventListener("click", () => (S.intro.ended || !S.intro.on ? runIntro(S.intro.ended ? 0 : S.intro.i) : pauseIntro()));
    $("btn-table").addEventListener("click", openTable);
    $("table-close").addEventListener("click", () => $("table-dlg").close());
    $("table-filter").addEventListener("input", () => { T.cur = 0; renderTable(); });
    document.querySelectorAll("#ledger-table th").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k;
      T.sort = { k, dir: T.sort.k === k ? -T.sort.dir : 1 }; renderTable();
    }));
    $("ledger-table").tBodies[0].addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) tableOpen(tr.dataset.id); });
    $("table-dlg").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); tableMove(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); tableMove(-1); }
      else if (e.key === "PageDown") { e.preventDefault(); tableMove(15); }
      else if (e.key === "PageUp") { e.preventDefault(); tableMove(-15); }
      else if (e.key === "Enter" && T.rows[T.cur]) { e.preventDefault(); tableOpen(T.rows[T.cur].h.id); }
      else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.id !== "table-filter") { e.preventDefault(); setYear(S.year + (e.key === "ArrowRight" ? 1 : -1)); }
    });
    $("rail-toggle").addEventListener("click", () => {
      const open = $("rail").classList.toggle("open"); $("rail-toggle").setAttribute("aria-expanded", open);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input[type=search], dialog")) return;
      if (!$("intro").hidden && ["ArrowLeft", "ArrowRight", " ", "Escape"].includes(e.key) && e.target.id !== "year") {
        e.preventDefault();
        if (e.key === "ArrowRight") $("intro-next").click();
        else if (e.key === "ArrowLeft") $("intro-prev").click();
        else if (e.key === " ") $("intro-pause").click();
        else stopIntro(true);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.target.id === "year") return; // native slider handles it
        e.preventDefault(); stopIntro();
        setYear(S.year + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1));
      } else if (e.key === " " && e.target === document.body) { e.preventDefault(); play(!S.playing); }
      else if (e.key === "Escape") select(null);
      else if ((e.key === "t" || e.key === "T") && !e.target.closest("input")) { e.preventDefault(); openTable(); }
    });
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { sizeGlobe(); if (S.view === "flat") { sizeFlat(); drawFlat(); } drawTicks(); drawDensity(); }, 120);
    });
  }

  // ---------------------------------------------------------------- boot
  (async function boot() {
    readColors();
    try {
      await loadAll();
    } catch (err) {
      $("loader").querySelector(".loader-text").textContent = `${err.message}. Reload the page to try again.`;
      return;
    }
    $("updated").textContent = S.data.meta.generated;
    computeMeterScale();
    wire(); initSearch(); drawTicks();
    const small = window.matchMedia("(max-width: 760px)").matches;
    setView(small ? "flat" : "globe");
    setYear(1800);
    loopLeader();
    setTimeout(() => { $("loader").classList.add("done"); loaderDots.stop(); }, 350);
  })();
})();
