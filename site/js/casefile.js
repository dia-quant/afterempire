/* Afterempire · CaseFile: opens a record as a physical file, after the folder interaction on mosbyfiles.com.
   Sequence: the rest of the stack drops back · the folder rises from where it sat and tilts flat ·
   the cover swings open from its left edge · the title letters rise · the post-it drops and is pinned ·
   page markers slide out of the folder edge. Esc or the close button reverses it.

   CaseFile.open({
     from: Element,              // the folder or card that was clicked (animation starts from its box)
     stack: Element,             // optional: the stack that drops back while the file is open
     colour, ink, paper,         // folder colour, folder text colour, paper colour
     tab, stamp, title,          // folder tab label, stamp text (e.g. "File IND"), headline
     postit: [[label, html]],    // metadata rows on the post-it
     body: html,                 // sheet content; sections with id="cf-..." can be page-marker targets
     markers: [[label, id]],     // page markers on the folder edge
     prev, next,                 // optional callbacks for the previous / next file
     onClose,
   }) */
window.CaseFile = (() => {
  const EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof Element.prototype.animate !== "function";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let cur = null;

  function splitTitle(t) {
    return t.split(" ").map((w) => `<span class="w">${[...w].map((ch) => `<span class="c">${esc(ch)}</span>`).join("")}</span>`).join(" ");
  }

  function open(o) {
    if (cur) close(true);
    const ov = document.createElement("div");
    ov.className = "cf-overlay";
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "cf-title");
    if (o.colour) ov.style.setProperty("--cf-folder", o.colour);
    if (o.ink) ov.style.setProperty("--cf-folder-ink", o.ink);
    if (o.paper) ov.style.setProperty("--cf-paper", o.paper);
    ov.innerHTML = `
      <div class="cf-bar">
        <button type="button" class="cf-close">← Close file <kbd>Esc</kbd></button>
        <span class="cf-nav">${o.prev || o.next ? `<button type="button" class="cf-prev" ${o.prev ? "" : "disabled"}>Previous</button><button type="button" class="cf-next" ${o.next ? "" : "disabled"}>Next file →</button>` : ""}</span>
      </div>
      <div class="cf-scroll"><div class="cf-stage">
        <div class="cf-folder" data-tab="${esc(o.tab || "")}">
          ${o.markers && o.markers.length ? `<div class="cf-tabs">${o.markers.map(([l, id]) => `<button type="button" class="cf-tab" data-to="${esc(id)}">${esc(l)}</button>`).join("")}</div>` : ""}
          <div class="cf-sheet">
            <span class="cf-holes" aria-hidden="true"><i></i><i></i><i></i></span>
            ${o.stamp ? `<div class="cf-stamp">${esc(o.stamp)}</div>` : ""}
            <h2 class="cf-title" id="cf-title" aria-label="${esc(o.title)}">${splitTitle(o.title || "")}</h2>
            <div class="cf-layout">
              <div class="cf-body">${o.body || ""}</div>
              ${o.postit && o.postit.length ? `<aside class="cf-postit" aria-label="File details"><i class="cf-pin" aria-hidden="true"></i><dl>${o.postit.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl></aside>` : ""}
            </div>
          </div>
          <div class="cf-cover" aria-hidden="true"><span>${esc(o.stamp || "")}</span></div>
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add("cf-open");
    cur = { ov, o, lastFocus: document.activeElement };

    const folder = ov.querySelector(".cf-folder"), cover = ov.querySelector(".cf-cover");
    ov.querySelector(".cf-close").addEventListener("click", () => close());
    ov.querySelector(".cf-prev")?.addEventListener("click", () => o.prev && o.prev());
    ov.querySelector(".cf-next")?.addEventListener("click", () => o.next && o.next());
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("cf-scroll")) close(); });
    ov.querySelectorAll(".cf-tab").forEach((b) => b.addEventListener("click", () => {
      const t = ov.querySelector(`#${CSS.escape(b.dataset.to)}`);
      if (t) t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    }));
    ov.querySelector(".cf-close").focus({ preventScroll: true });
    if (o.stack) o.stack.classList.add("cf-away");

    if (reduced()) { cover.remove(); return; }
    // 1. dim in
    ov.animate([{ backgroundColor: "rgba(14,18,28,0)" }, { backgroundColor: "rgba(14,18,28,0.62)" }], { duration: 400, easing: EASE });
    // 2. folder rises from the clicked element and tilts flat
    const fr = o.from ? o.from.getBoundingClientRect() : null, to = folder.getBoundingClientRect();
    const dy = fr ? fr.top - to.top : 120, sx = fr ? Math.max(0.6, Math.min(1.2, fr.width / to.width)) : 0.96;
    folder.animate([
      { transform: `translateY(${dy}px) scale(${sx}) rotateX(58deg)`, opacity: 0.6 },
      { transform: "translateY(0) scale(1) rotateX(0deg)", opacity: 1 },
    ], { duration: 650, easing: EASE });
    // 3. cover swings open from the left edge
    cover.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], { duration: 850, delay: 480, easing: EASE, fill: "forwards" })
      .finished.then(() => cover.remove()).catch(() => {});
    // 4. headline letters rise
    ov.querySelectorAll(".cf-title .c").forEach((c, i) => {
      c.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], { duration: 600, delay: 820 + Math.min(i, 40) * 22, easing: EASE, fill: "backwards" });
    });
    // 5. post-it drops and is pinned
    const pi = ov.querySelector(".cf-postit");
    if (pi) {
      pi.animate([{ transform: "translateY(-36px) rotate(-9deg)", opacity: 0 }, { transform: "translateY(0) rotate(-2.5deg)", opacity: 1 }], { duration: 650, delay: 1050, easing: EASE, fill: "backwards" });
      pi.querySelector(".cf-pin").animate([{ transform: "scale(0)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 420, delay: 1550, easing: EASE, fill: "backwards" });
    }
    // 6. page markers slide out of the folder edge
    ov.querySelectorAll(".cf-tab").forEach((t, i) => {
      t.animate([{ transform: "translateX(-110%)" }, { transform: "translateX(0)" }], { duration: 500, delay: 1200 + i * 110, easing: EASE, fill: "backwards" });
    });
    ov.querySelector(".cf-body").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1000, easing: EASE, fill: "backwards" });
  }

  function close(instant) {
    if (!cur) return;
    const { ov, o, lastFocus } = cur; cur = null;
    if (o.stack) o.stack.classList.remove("cf-away");
    const done = () => { ov.remove(); if (!document.querySelector(".cf-overlay")) document.body.classList.remove("cf-open"); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); if (o.onClose) o.onClose(); };
    if (instant || reduced()) { done(); return; }
    const folder = ov.querySelector(".cf-folder");
    const fr = o.from ? o.from.getBoundingClientRect() : null, to = folder.getBoundingClientRect();
    const dy = fr ? fr.top - to.top : 120;
    folder.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${dy}px) scale(0.96) rotateX(50deg)`, opacity: 0 }], { duration: 420, easing: "cubic-bezier(0.32, 0, 0.67, 0)", fill: "forwards" });
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: EASE, fill: "forwards" }).finished.then(done).catch(done);
  }

  document.addEventListener("keydown", (e) => {
    if (!cur) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" && cur.o.next && !e.target.closest("input, textarea")) cur.o.next();
    else if (e.key === "ArrowLeft" && cur.o.prev && !e.target.closest("input, textarea")) cur.o.prev();
  });
  return { open, close, isOpen: () => !!cur };
})();
