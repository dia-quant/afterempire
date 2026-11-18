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
    : `<span class="soon">${s.name}</span>`).join("");
  const foot = document.createElement("footer");
  foot.className = "sitefoot";
  foot.innerHTML = `<span>Afterempire · created by <b>Dia Atal</b> · data up to date as of <span data-asof></span></span>
    <span><a class="ae-mail" href="#">Contact</a> · <a href="correspondence">Send a correction</a> · <a href="https://github.com/dia-quant/afterempire" target="_blank" rel="noopener">Data and code</a> · <a href="https://doi.org/10.5281/zenodo.24281902" target="_blank" rel="noopener">Cite (DOI)</a></span>`;
  document.body.appendChild(foot);
  el.innerHTML = `<a class="tb-mark" href="./">Afterempire</a>
    <nav class="tb-nav" aria-label="Sections">${items}</nav>
    <a class="tb-back" href="./">← Return to Observatory</a>`;
})();

/* Contact address assembled in the browser so it is not sitting in the page source for scrapers. */
(() => {
  const u = ["dia", "atal", "158"].join(""), d = ["gmail", "com"].join(".");
  document.querySelectorAll(".ae-mail").forEach((a) => {
    a.href = `mailto:${u}@${d}`;
    a.title = `${u}@${d}`;
    if (a.dataset.show === "address") a.textContent = `${u}@${d}`;
  });
})();
