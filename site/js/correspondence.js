/* Afterempire · Correspondence: composes a correction as a pre-filled GitHub issue (no backend).
   A plain #REF in the address (e.g. correspondence.html#HLD-IND-GOA) pre-fills the reference. */
(() => {
  const REPO = "dia-quant/afterempire";
  const LABELS = { holding: "correction: holding", trade: "correction: trade", coding: "correction: coding", source: "source suggestion", other: "correspondence" };
  const KIND = { holding: "A holding, date or transfer", trade: "A trade flow", coding: "A development coding or lineage", source: "A source to add", other: "Something else" };
  const $ = (id) => document.getElementById(id);
  const form = $("form");
  $("dateline").textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    $("ref").value = h;
    const k = h.startsWith("FILE-") ? "coding" : h.startsWith("HLD-") ? "holding" : null;
    if (k) form.querySelector(`input[name=kind][value=${k}]`).checked = true;
  };
  fromHash();
  window.addEventListener("hashchange", fromHash);

  let text = "", title = "";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => $(id).value.trim();
    const kind = form.querySelector("input[name=kind]:checked").value;
    const missing = [["what", "what the site shows"], ["evidence", "the evidence"]].filter(([id]) => !v(id)).map(([, n]) => n);
    if (missing.length) { $("err").textContent = `Add ${missing.join(" and ")} before preparing the letter.`; $("err").hidden = false; return; }
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test([v("what"), v("should"), v("evidence"), v("name"), v("aff")].join(" "))) {
      $("err").textContent = "Remove the email address: submissions are published as public issues."; $("err").hidden = false; return;
    }
    $("err").hidden = true;
    title = `[${LABELS[kind]}] ${v("ref") || v("what").slice(0, 60)}`;
    text = [
      `**Regarding:** ${KIND[kind]}`,
      `**Reference:** ${v("ref") || "—"}`,
      "", "**What the site shows**", v("what"),
      "", "**What it should show**", v("should") || "—",
      "", "**Evidence**", v("evidence"),
      "", `**Signed:** ${v("name") || "anonymous"}${v("aff") ? `, ${v("aff")}` : ""}`,
      "", `_Sent from Afterempire · Correspondence · ${new Date().toISOString().slice(0, 10)}_`,
    ].join("\n");
    $("preview").textContent = `${title}\n\n${text}`;
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}&labels=${encodeURIComponent(LABELS[kind])}`;
    $("issue-link").href = url;
    $("outbox").hidden = false; $("copy-msg").textContent = "";
    $("outbox").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("edit").addEventListener("click", () => { $("outbox").hidden = true; $("what").focus(); });
  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(`${title}\n\n${text}`); $("copy-msg").textContent = "Copied."; }
    catch {
      const r = document.createRange(); r.selectNodeContents($("preview"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      $("copy-msg").textContent = "Your browser blocked copying; the text is selected, so press Ctrl+C or ⌘C.";
    }
  });
})();
