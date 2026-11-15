/* Renders the shared header into <header class="topbar" data-page="..."></header>.
   One list of sections for the whole site: edit SECTIONS to add or enable a page. */
(() => {
  const SECTIONS = [
    { id: "flows", name: "Flows of Empire", href: "flows.html" },
    { id: "systems", name: "Inherited Systems", href: "systems.html" },
    { id: "metrics", name: "Divergence Metrics", href: "metrics.html" },
    { id: "archive", name: "The Archive", href: "archive.html" },
    { id: "terms", name: "Terms of Account", phase: "P6" },
    { id: "correspondence", name: "Correspondence", phase: "P6" },
  ];
  const el = document.querySelector("header.topbar");
  if (!el) return;
  const cur = el.dataset.page;
  const items = SECTIONS.map((s) => s.href
    ? `<a href="${s.href}"${s.id === cur ? ' aria-current="page"' : ""}>${s.name}</a>`
    : `<span class="soon" title="Built in phase ${s.phase.slice(1)}">${s.name}<sup>${s.phase}</sup></span>`).join("");
  el.innerHTML = `<a class="tb-mark" href="index.html">Afterempire</a>
    <nav class="tb-nav" aria-label="Sections">${items}</nav>
    <a class="tb-back" href="index.html">← Return to Observatory</a>`;
})();
