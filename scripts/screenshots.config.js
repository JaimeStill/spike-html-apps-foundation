// mise run screenshots' capture description, which the tooling's spike-html-apps-screenshots bin
// runs: the tools page whole, keys help open, and the theme menu open wide and narrow, each with
// the stylesheet pointed at page-full.css and the profile's attributes set on the root, as
// demo/profiles.html does, so no demo page changes. The bin's flags choose the profiles, pages,
// schemes, and output.
// Adapted from spike-html-apps-foundation (9c15b8d): scripts/screenshots.js, its states, profiles,
// and open steps as a Description.

import { until } from "@jaimestill/spike-html-apps-tooling/browser.js";

/** @typedef {import("@jaimestill/spike-html-apps-tooling/browser.js").Page} Page */

// Below the theme menu's 48rem breakpoint: a phone's width.
const NARROW = { width: 390, height: 844 };

/**
 * Sends ? as a US keyboard types it, Shift held, to the page's keys.js.
 * @param {Page} page
 */
async function pressHelp(page) {
  const event = { key: "?", code: "Slash", modifiers: 8, windowsVirtualKeyCode: 191 };
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...event, text: "?" });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/**
 * Opens the theme menu: the Theme button's command="--open", as a click sends it to
 * <sl-theme-menu>.
 * @param {Page} page
 */
async function openThemeMenu(page) {
  await page.evaluate(`document.querySelector("button[commandfor=theme]").click()`);
  await until(page, `document.querySelector("sl-theme-menu dialog")?.open`);
}

/** Points the page's stylesheet link at the full entry, unless it links it, and waits for it. */
const FULL_ENTRY = `(async () => {
  const link = document.querySelector('link[rel="stylesheet"]');
  if (link.href.endsWith("/dist/page-full.css")) return;
  const loaded = new Promise((resolve, reject) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => reject(new Error("page-full.css didn't load")), { once: true });
  });
  link.href = "../dist/page-full.css";
  await loaded;
})()`;

/** @type {import("@jaimestill/spike-html-apps-tooling/screenshots.js").Description} */
export default {
  pages: [
    // One full-page capture, the bin's default state.
    { name: "tools", caption: "the tools page", path: "demo/tools.html" },
    {
      name: "keys",
      caption: "keys help open",
      path: "demo/keys.html",
      states: [
        {
          name: "keys-help",
          caption: "keys help open",
          full: false,
          async open(page) {
            await pressHelp(page);
            // keys-help.js replaces the placeholder with the list and its note once it has loaded.
            await until(
              page,
              `document.getElementById("help").open && !!document.querySelector("[data-keys-note]")`,
            );
          },
        },
      ],
    },
    {
      name: "theme",
      caption: "the theme menu open",
      path: "demo/theme.html",
      states: [
        {
          name: "theme-menu-wide",
          caption: "the theme menu open, wide",
          full: false,
          open: openThemeMenu,
        },
        {
          name: "theme-menu-narrow",
          caption: "the theme menu open, narrow",
          viewport: NARROW,
          full: false,
          open: openThemeMenu,
        },
      ],
    },
  ],
  facets: [
    { flag: "palette", attribute: "data-palette", default: "flexoki" },
    { flag: "space", attribute: "data-space", default: "regular" },
    { flag: "type", attribute: "data-type", default: "mono" },
  ],
  // Every color at the defaults, then the other space and the other type at the default color.
  all: [
    ...["flexoki", "primer", "catppuccin", "everforest"].map((palette) => ({ palette })),
    { space: "compact" },
    { type: "sans" },
  ],
  prepare: (page) => page.evaluate(FULL_ENTRY),
  // The repository root, against this module's directory: the demo pages load ../dist/.
  server: { root: ".." },
};
