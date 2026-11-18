/* Afterempire · The Archive: each index card is pulled out of the drawer and opened as a case file. */
(() => {
  const cards = [...document.querySelectorAll(".drawer details.card")];
  const drawer = document.querySelector(".drawer");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof Element.prototype.animate !== "function";
  const text = (el, sel) => (el.querySelector(sel)?.textContent || "").trim();
  const field = (card, label) => {
    const dt = [...card.querySelectorAll("dt")].find((d) => d.textContent.trim().toLowerCase() === label);
    return dt ? dt.nextElementSibling : null;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function openCard(i) {
    const card = cards[i]; if (!card) return;
    const name = text(card, "h2"), no = text(card, ".tab .no");
    const further = !!card.closest(".drawer") && card.previousElementSibling && [...card.parentElement.children].slice(0, [...card.parentElement.children].indexOf(card)).some((n) => n.classList.contains("further"));
    const link = field(card, "link");
    const go = () => {
      history.replaceState(null, "", `#${card.id}`);
      CaseFile.open({
        from: card, stack: drawer, colour: "#111111", ink: "#ffffff", paper: "#ffffff",
        tab: name, stamp: `Card ${no}`, title: name,
        postit: [["Card", no], ["Shelf", further ? "Further reading" : "Used by the site"],
          ["Coverage", esc(field(card, "coverage")?.textContent.trim() || "—")],
          ["Licence", esc(field(card, "licence")?.textContent.trim() || "—")],
          ["Link", link ? link.innerHTML : "—"]],
        markers: [["Citation", "cf-cite"]],
        body: `<p class="cf-lede">${esc(text(card, ".use-line"))}</p>
          <section class="cf-section" id="cf-cite"><div class="cf-label">Citation</div><p class="cf-cite">${esc(field(card, "citation")?.textContent.trim() || "")}</p></section>`,
        prev: i > 0 ? () => openCard(i - 1) : null,
        next: i < cards.length - 1 ? () => openCard(i + 1) : null,
        onClose: () => { if (!CaseFile.isOpen()) history.replaceState(null, "", location.pathname); },
      });
    };
    if (reduced || CaseFile.isOpen()) { go(); return; }
    // pull the card up out of the drawer first
    card.animate([{ transform: "none" }, { transform: "translateY(-26px)" }], { duration: 260, easing: "cubic-bezier(0.33, 1, 0.68, 1)" }).finished.then(go).catch(go);
  }

  cards.forEach((card, i) => {
    card.querySelector("summary").addEventListener("click", (e) => { e.preventDefault(); openCard(i); });
  });
  const h = location.hash.slice(1);
  const at = cards.findIndex((c) => c.id === h);
  if (at >= 0) openCard(at);
})();
