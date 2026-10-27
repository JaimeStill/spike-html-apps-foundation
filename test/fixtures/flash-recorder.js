// The flash fixtures' recorder, a classic script ahead of the modules: window.flash records, in ms
// since navigation, the first paint and the moment the stored choice reaches the root, as
// data-palette.
// Adapted from spike-html-design (fe75220): test/fixtures/flash-blocking.html, its inline script.

window.flash = { paint: null, applied: null };
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-paint") window.flash.paint ??= entry.startTime;
  }
}).observe({ type: "paint", buffered: true });
new MutationObserver(() => {
  if (document.documentElement.hasAttribute("data-palette")) {
    window.flash.applied ??= performance.now();
  }
}).observe(document.documentElement, { attributes: true });
