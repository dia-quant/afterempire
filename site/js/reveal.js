/* Afterempire · scroll-in animation for charts and tables (Flows of Empire, Divergence Metrics).
   Reveal.chart(el): data lines draw in, points pop, labels fade in — once, when el scrolls into view.
   Reveal.rows(el):  table rows / matrix cells slide in with a short stagger.
   Charts redrawn after they have been revealed (a new selection, a resize) animate straight away.
   Does nothing when the browser lacks IntersectionObserver or the reader prefers reduced motion,
   so the charts are always complete without it. */
window.Reveal = (() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ok = "IntersectionObserver" in window && !reduced && typeof Element.prototype.animate === "function";
  const EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
  const seen = new WeakSet();
  const io = ok ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      seen.add(e.target);
      const play = e.target.__aePlay; e.target.__aePlay = null;
      if (play) play();
    }
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }) : null;

  function schedule(el, prepare, play) {
    if (!ok || !el) return;
    if (seen.has(el)) { prepare(); requestAnimationFrame(play); return; }
    prepare();
    el.__aePlay = play;
    io.observe(el);
  }

  function chart(el) {
    const lines = [...el.querySelectorAll("svg path[fill='none']:not(.domain)")];
    const dots = [...el.querySelectorAll("svg circle")].filter((c) => c.getAttribute("opacity") !== "0");
    const labels = [...el.querySelectorAll("svg .dlabel")];
    const lens = lines.map((p) => { try { return p.getTotalLength(); } catch { return 0; } });
    schedule(el, () => {
      lines.forEach((p, i) => { p.style.strokeDasharray = `${lens[i]} ${lens[i]}`; p.style.strokeDashoffset = lens[i]; });
      dots.forEach((c) => { c.style.opacity = 0; });
      labels.forEach((t) => { t.style.opacity = 0; });
    }, () => {
      lines.forEach((p, i) => {
        p.animate([{ strokeDashoffset: lens[i] }, { strokeDashoffset: 0 }], { duration: 1400, delay: Math.min(i, 24) * 45, easing: EASE, fill: "forwards" })
          .finished.then((a) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; a.cancel(); }).catch(() => {});
      });
      dots.forEach((c, i) => {
        c.style.transformBox = "fill-box"; c.style.transformOrigin = "center";
        c.animate([{ opacity: 0, transform: "scale(0.2)" }, { opacity: 1, transform: "scale(1)" }], { duration: 500, delay: 200 + Math.min(i, 160) * 6, easing: EASE, fill: "forwards" })
          .finished.then((a) => { c.style.opacity = ""; a.cancel(); }).catch(() => {});
      });
      labels.forEach((t, i) => {
        t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 900 + i * 60, easing: EASE, fill: "forwards" })
          .finished.then((a) => { t.style.opacity = ""; a.cancel(); }).catch(() => {});
      });
    });
  }

  function rows(el, selector = "tbody tr") {
    const items = [...el.querySelectorAll(selector)];
    schedule(el, () => { items.forEach((r) => { r.style.opacity = 0; }); }, () => {
      items.forEach((r, i) => {
        const a = r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: Math.min(i, 40) * 22, easing: EASE, fill: "forwards" });
        a.finished.then(() => { r.style.opacity = ""; a.cancel(); }).catch(() => {});
      });
    });
  }

  function cells(el, selector = "td.cell") {
    const items = [...el.querySelectorAll(selector)];
    schedule(el, () => { items.forEach((c) => { c.style.opacity = 0; }); }, () => {
      items.forEach((c) => {
        const tr = c.parentElement, row = [...tr.parentElement.children].indexOf(tr), col = [...tr.children].indexOf(c);
        c.animate([{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: Math.min(row, 30) * 28 + col * 55, easing: EASE, fill: "forwards" })
          .finished.then((a) => { c.style.opacity = ""; a.cancel(); }).catch(() => {});
      });
    });
  }

  return { chart, rows, cells, enabled: ok };
})();
