/* One place for the site-wide "data up to date as of" date. Update it when the data are refreshed. */
window.AE_ASOF = "18 November 2026";
document.querySelectorAll("[data-asof]").forEach((el) => { el.textContent = window.AE_ASOF; });
