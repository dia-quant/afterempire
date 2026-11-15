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
  const STEP_MS = { normal: 650, fast: 130 };
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
    intro: { on: false, i: 0, timer: null }, zoom: d3.zoomIdentity,
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
    const proj = d3.geoOrthographic().scale(100).translate([110, 110]).clipAngle(90);
    let raf, rot = 0;
    const pts = [];
    for (let lat = -80; lat <= 80; lat += 8) for (let lon = -180; lon < 180; lon += 8) pts.push([lon, lat]);
    function frame() {
      rot += 0.6; proj.rotate([rot, -18]);
      ctx.clearRect(0, 0, 220, 220);
      const src = S.dots || pts;
      for (const d of src) {
        const xy = proj(d); if (!xy) continue;
        ctx.fillStyle = S.dots ? "rgba(120,170,230,.85)" : "rgba(120,140,170,.35)";
        ctx.fillRect(xy[0] - 0.8, xy[1] - 0.8, 1.6, 1.6);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return { stop: () => cancelAnimationFrame(raf) };
  })();

  async function loadAll() {
    const jobs = [
      ["holdings", "data/holdings.json"], ["dots", "data/land_dots.json"],
      ["b1800", "data/borders/borders_1800.json"],
    ];
    let done = 0;
    const out = {};
    await Promise.all(jobs.map(async ([k, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
      out[k] = await r.json();
      if (k === "dots") S.dots = out[k];
      done++; $("loader-pct").textContent = `${Math.round((done / jobs.length) * 100)}%`;
    }));
    S.data = out.holdings; S.dots = out.dots;
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
      .showAtmosphere(true).atmosphereColor(css("--halo-a")).atmosphereAltitude(0.17)
      .particlesData([S.dots]).particleLat((d) => d[1]).particleLng((d) => d[0]).particleAltitude(0.002)
      .particlesColor(() => COLOR.land).particlesSize(2.4).particlesSizeAttenuation(false)
      .pathPoints((d) => d).pathPointLat((p) => p[1]).pathPointLng((p) => p[0])
      .pathPointAlt(0.004).pathColor(() => COLOR.border).pathStroke(null).pathTransitionDuration(0)
      .htmlLat((d) => d.lat).htmlLng((d) => d.lng)
      .htmlAltitude((d) => (d.type === "c" ? 0.07 : 0.01))
      .htmlElement((d) => d.el)
      .htmlTransitionDuration(0)
      .onGlobeClick(() => select(null))
      .pointOfView({ lat: 12, lng: 30, altitude: 2.4 });
    if (typeof globe.htmlElementVisibilityModifier === "function") {
      globe.htmlElementVisibilityModifier((elx, vis) => elx.classList.toggle("hidden-side", !vis));
    }
    const mat = globe.globeMaterial();
    if (mat && mat.color) { mat.color.set("#05080e"); if (mat.emissive) mat.emissive.set("#03060b"); mat.shininess = 4; }
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
    flat.cv.addEventListener("click", (e) => {
      const r = flat.cv.getBoundingClientRect();
      const [x, y] = S.zoom.invert([e.clientX - r.left, e.clientY - r.top]);
      let best = null, bd = 12 / S.zoom.k;
      for (const hit of flat.hits) { const d = Math.hypot(hit.x - x, hit.y - y); if (d < bd) { bd = d; best = hit; } }
      select(best ? best.id : null);
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
    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = "#04070c"; ctx.fill();
    ctx.lineWidth = 1 / k; ctx.strokeStyle = "rgba(220,235,255,.28)"; ctx.stroke();
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = "rgba(220,235,255,.10)"; ctx.stroke();
    ctx.fillStyle = COLOR.land;
    const r = Math.max(0.6, 0.95 / Math.sqrt(k));
    for (const d of S.dots) { const xy = proj(d); if (xy) { ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, 6.283); ctx.fill(); } }
    const snap = currentBorderLines();
    if (snap) { ctx.beginPath(); path({ type: "MultiLineString", coordinates: snap }); ctx.strokeStyle = COLOR.border; ctx.lineWidth = 0.8 / k; ctx.stroke(); }

    flat.hits = [];
    const sel = [];
    for (const h of S.data.holdings) {
      const st = stateOf(h, S.year);
      if (!visible(st)) continue;
      const xy = proj([h.lon, h.lat]); if (!xy) continue;
      const rad = (SIZE[h.kind] || 9) / 2 / Math.sqrt(k) + 0.5;
      drawBubble(ctx, xy[0], xy[1], rad, st, k);
      flat.hits.push({ id: h.id, x: xy[0], y: xy[1] });
      if (S.labels && h.kind === "territory" || S.selected === h.id) sel.push([h, st, xy, rad]);
    }
    ctx.font = `${11 / k}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    for (const [h, st, xy, rad] of sel) {
      ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillText(displayName(h, st), xy[0] + rad + 4.5 / k, xy[1] + 0.6 / k);
      ctx.fillStyle = "#e6ecf5"; ctx.fillText(displayName(h, st), xy[0] + rad + 4 / k, xy[1]);
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
      ctx.fillStyle = "rgba(3,5,8,.75)"; ctx.fillRect(x - w / 2, y - 12 / k, w, 15 / k);
      ctx.fillStyle = c.el.style.getPropertyValue("--c"); ctx.fillRect(x - w / 2, y - 12 / k, 1 / k, 15 / k);
      ctx.fillStyle = "#eef3fa"; ctx.fillText(txt, x - w / 2 + 5 / k, y);
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
    const ruled = S.data.holdings.reduce((n, h) => { const st = stateOf(h, y); return n + (visible(st) && st.ctrl !== "SOV" ? 1 : 0); }, 0);
    $("year-sub").textContent = `${ruled} holdings under imperial rule`;
    if (S.view === "globe") renderGlobe(); else drawFlat();
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

  // ---------------------------------------------------------------- feed
  function renderFeed() {
    $("feed-year").textContent = S.year;
    const list = $("feed-list");
    const evs = S.data.events.filter((e) => Math.floor(e.t) === S.year).filter((e) => {
      const st = stateOf(S.byId.get(e.h), S.year);
      const groups = st ? st.groups : [groupOf(e.from || "OTH")];
      return groups.some((g) => S.filters.has(g));
    });
    if (!evs.length) { list.innerHTML = `<li class="empty">No transfers recorded in ${S.year}.</li>`; return; }
    list.innerHTML = evs.slice(0, 10).map((e) => {
      const h = S.byId.get(e.h);
      const c = colorOf(e.to ? (e.to === "SOV" ? (e.from || "SOV") : e.to) : (e.from || "SOV"));
      const what = e.to ? (e.to === "SOV" ? "Independent" : `${ctrlName(e.to)} ${STATUS_NAME[e.st]}`) : "Merged";
      const nm = h.name.split(" / ")[e.to === "SOV" ? h.name.split(" / ").length - 1 : 0];
      const detail = e.label.toLowerCase().includes((STATUS_NAME[e.st] || "~").split(" ")[0]) ? e.label : `${what} · ${e.label}`;
      return `<li><button data-id="${h.id}" style="--c:${c}"><i></i><div><b>${escapeHtml(nm)}</b><span>${escapeHtml(detail)}</span></div></button></li>`;
    }).join("") + (evs.length > 10 ? `<li class="empty">+ ${evs.length - 10} more in the ledger table</li>` : "");
    list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { select(b.dataset.id); flyTo(S.byId.get(b.dataset.id)); }));
  }

  // ---------------------------------------------------------------- selection & panel
  function select(id) {
    S.selected = id;
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
    $("p-meta").textContent = `${h.region} · ${h.kind} · ${h.lat.toFixed(1)}°, ${h.lon.toFixed(1)}°`;
    $("p-status").innerHTML = st
      ? `<i class="b ${st.style}${st.condo ? " condo" : ""}" style="--c:${st.color}"></i><span><b>${S.year}</b> · ${escapeHtml(ctrlName(st.ctrl))} ${escapeHtml(STATUS_NAME[st.p.st])}</span>`
      : `<span>${S.year} · not a separate holding this year</span>`;
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
    $("p-events").innerHTML = h.periods.map((p) => {
      const cc = p.c === "SOV" ? (lastColonial(h, p.s) || "SOV") : p.c;
      const now = p.s <= t && t < (p.e ?? 9999);
      return `<li class="${now ? "now" : ""}"><span class="yr">${fmtYear(p.s)}</span><i style="--c:${colorOf(cc)}"></i><div>${escapeHtml(p.ev)}<br><span class="st">${escapeHtml(ctrlName(p.c))} · ${escapeHtml(STATUS_NAME[p.st])}</span>${p.cf === "medium" ? ` <span class="cf">· date debated</span>` : ""}</div></li>`;
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
      ctx.fillStyle = d.y === S.year ? "#ffffff" : "rgba(95,211,198,.38)";
      ctx.fillRect(x(d.y) - bw / 2, h - bh, bw, bh);
      if (d.events) { ctx.fillStyle = d.y === S.year ? "#fff" : "rgba(232,238,247,.75)"; ctx.fillRect(x(d.y) - bw / 2, 0, bw, Math.min(5, 1 + d.events)); }
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
    $("btn-play").textContent = on ? "❚❚" : "▶";
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
    { y: 1800, lat: 15, lng: 10, alt: 2.5, t: "1800 · Four empires at the threshold", x: "Britain, France, Portugal and the Netherlands hold scattered ports, islands and plantation colonies. Portugal still rules Brazil; the Dutch East India Company has just been dissolved." },
    { y: 1811, lat: -5, lng: 95, alt: 1.9, t: "1811 · War moves the map", x: "With the Netherlands annexed by Napoleon, Britain seizes Java. Across the Napoleonic Wars, British forces occupy Dutch, French and Danish holdings from the Caribbean to India." },
    { y: 1815, lat: -20, lng: 40, alt: 2.1, t: "1815 · The peace settlement", x: "The Cape, Ceylon, Mauritius, Malta and British Guiana stay British. Java, Réunion and the Caribbean islands are handed back." },
    { y: 1825, lat: 8, lng: 95, alt: 1.6, t: "1825 · The Anglo-Dutch swap", x: "Under the 1824 treaty, Malacca and Chinsurah pass to Britain and the Netherlands keeps the archipelago: the line that later divides Malaysia from Indonesia." },
    { y: 1858, lat: 20, lng: 80, alt: 1.6, t: "1858 · From company to Crown", x: "After the 1857 uprising the East India Company is abolished and the British Crown rules India directly. French, Portuguese and Danish enclaves remain inside it." },
    { y: 1900, lat: 3, lng: 18, alt: 2.0, t: "1900 · The partition of Africa", x: "After the Berlin Conference, nearly all of Africa is under European rule. French West and Equatorial Africa and British East and Southern Africa take shape." },
    { y: 1923, lat: 30, lng: 40, alt: 1.8, t: "1923 · Mandates", x: "Germany's colonies and the Ottoman Arab provinces become League of Nations mandates under Britain, France and the dominions." },
    { y: 1943, lat: 5, lng: 110, alt: 1.8, t: "1943 · Japanese occupation", x: "Japan holds Burma, Malaya, Singapore, Hong Kong, the Dutch East Indies and Portuguese Timor. Colonial authority in Asia never fully recovers." },
    { y: 1948, lat: 18, lng: 78, alt: 1.7, t: "1947–48 · South Asia", x: "India and Pakistan become dominions, then Burma and Ceylon follow. The French and Portuguese enclaves outlast the Raj by years." },
    { y: 1960, lat: 5, lng: 10, alt: 2.0, t: "1960 · The year of Africa", x: "Seventeen African states become independent, most of them former French colonies that passed through a brief stage of autonomy in the French Community." },
    { y: 1975, lat: -10, lng: 25, alt: 2.1, t: "1975 · The end of Portugal's empire", x: "After the Carnation Revolution, Angola, Mozambique, Cape Verde and São Tomé become independent. Timor-Leste is invaded by Indonesia." },
    { y: 2025, lat: 10, lng: -40, alt: 2.4, t: "2025 · What remains", x: "Ringed markers show territories that are still dependent or integrated: French overseas departments, the Dutch Caribbean and British Overseas Territories." },
  ];
  function runIntro(i = 0) {
    stopIntro(false);
    S.intro.on = true; S.intro.i = i;
    play(false); select(null);
    const s = TOUR[i];
    $("intro").hidden = false;
    $("intro-step").textContent = `INTRO ${i + 1}/${TOUR.length}`;
    $("intro-title").textContent = s.t;
    $("intro-text").textContent = s.x;
    setYear(s.y);
    if (S.view === "globe") globe.pointOfView({ lat: s.lat, lng: s.lng, altitude: s.alt }, 1800);
    S.intro.timer = setTimeout(() => (i + 1 < TOUR.length ? runIntro(i + 1) : stopIntro(true)), 7000);
  }
  function stopIntro(hide = true) {
    clearTimeout(S.intro.timer); S.intro.on = false;
    if (hide) $("intro").hidden = true;
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
  function renderTable() {
    $("table-year").textContent = S.year;
    const rows = [];
    for (const h of S.data.holdings) {
      const st = stateOf(h, S.year);
      if (!visible(st)) continue;
      rows.push({ h, st });
    }
    rows.sort((a, b) => a.st.ctrl.localeCompare(b.st.ctrl) || a.h.name.localeCompare(b.h.name));
    $("ledger-table").tBodies[0].innerHTML = rows.map(({ h, st }) =>
      `<tr><td>${escapeHtml(displayName(h, st))}</td><td>${escapeHtml(h.region)}</td><td><i style="--c:${st.color}"></i>${escapeHtml(ctrlName(st.ctrl))}</td><td>${escapeHtml(STATUS_NAME[st.p.st])}</td><td>${fmtYear(st.p.s)}</td></tr>`).join("");
  }

  // ---------------------------------------------------------------- wiring
  function wire() {
    $("year").addEventListener("input", (e) => { stopIntro(); setYear(+e.target.value); });
    $("btn-play").addEventListener("click", () => { stopIntro(); play(!S.playing); });
    $("btn-fast").addEventListener("click", () => {
      S.fast = !S.fast; $("btn-fast").setAttribute("aria-pressed", S.fast);
      if (S.playing) play(true);
    });
    document.querySelectorAll(".flt").forEach((b) => b.addEventListener("click", () => {
      const e = b.dataset.emp;
      S.filters.has(e) ? S.filters.delete(e) : S.filters.add(e);
      b.classList.toggle("on", S.filters.has(e)); b.setAttribute("aria-pressed", S.filters.has(e));
      setYear(S.year);
    }));
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
    $("btn-table").addEventListener("click", () => { renderTable(); $("table-dlg").showModal(); });
    $("table-close").addEventListener("click", () => $("table-dlg").close());
    $("rail-toggle").addEventListener("click", () => {
      const open = $("rail").classList.toggle("open"); $("rail-toggle").setAttribute("aria-expanded", open);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input[type=search], dialog")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.target.id === "year") return; // native slider handles it
        e.preventDefault(); stopIntro();
        setYear(S.year + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1));
      } else if (e.key === " " && e.target === document.body) { e.preventDefault(); play(!S.playing); }
      else if (e.key === "Escape") select(null);
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
    wire(); initSearch(); drawTicks();
    const small = window.matchMedia("(max-width: 760px)").matches;
    setView(small ? "flat" : "globe");
    setYear(1800);
    loopLeader();
    setTimeout(() => { $("loader").classList.add("done"); loaderDots.stop(); }, 350);
  })();
})();
