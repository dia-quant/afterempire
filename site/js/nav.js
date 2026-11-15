/* Renders the shared header into <header class="topbar" data-page="..."></header>.
   One list of sections for the whole site: edit SECTIONS to add or enable a page. */
(() => {
  const SECTIONS = [
    { id: "flows", name: "Flows of Empire", href: "flows" },
    { id: "systems", name: "Inherited Systems", href: "systems" },
    { id: "metrics", name: "Divergence Metrics", href: "metrics" },
    { id: "archive", name: "The Archive", href: "archive" },
    { id: "terms", name: "Terms of Account", href: "terms" },
    { id: "correspondence", name: "Correspondence", href: "correspondence" },
  ];
  const el = document.querySelector("header.topbar");
  if (!el) return;
  const cur = el.dataset.page;
  const items = SECTIONS.map((s) => s.href
    ? `<a href="${s.href}"${s.id === cur ? ' aria-current="page"' : ""}>${s.name}</a>`
    : `<span class="soon" title="Built in phase ${s.phase.slice(1)}">${s.name}<sup>${s.phase}</sup></span>`).join("");
  el.innerHTML = `<a class="tb-mark" href="./">Afterempire</a>
    <nav class="tb-nav" aria-label="Sections">${items}</nav>
    <a class="tb-back" href="./">← Return to Observatory</a>`;
})();
