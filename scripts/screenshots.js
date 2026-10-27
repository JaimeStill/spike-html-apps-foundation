// mise run screenshots' capture half: renders each state of the demo pages, on dist/, in every
// profile and scheme, through the browser tier's driver, and writes one PNG per capture into the
// directory its one argument names, printing `<path>\t<caption>` as each is written.
// screenshots.sh runs it and shows the captures.
//
// Each capture opens a fresh page, points its stylesheet link at the full entry, page-full.css,
// and names the profile and the scheme on the root by data-palette, data-space, data-type, and
// data-scheme, as demo/profiles.html does in its frame, so no demo page changes: tools.html stays
// as the browser tier compares it.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { launch } from "../test/browser/support/browser-pipe.js";
import { serve } from "../test/browser/support/server.js";

const [dir] = process.argv.slice(2);
if (!dir) throw new Error("usage: node scripts/screenshots.js <directory>");

/** The default profile of each facet, by its attribute. */
const DEFAULTS = { "data-palette": "flexoki", "data-space": "regular", "data-type": "mono" };

/** The profiles, each a name and the attribute it sets over the defaults: every color, then the
 * other space and the other type at the default color. */
const PROFILES = [
  ...["flexoki", "primer", "catppuccin", "everforest"].map((name) => [name, "data-palette"]),
  ["compact", "data-space"],
  ["sans", "data-type"],
];

const SCHEMES = ["light", "dark"];

const WIDE = { width: 1280, height: 800 };
// Below the theme menu's 48rem breakpoint: a phone's width.
const NARROW = { width: 390, height: 844 };

/** Resolves once the expression is truthy, polling for up to 5 s. */
async function waitFor(page, expression) {
  for (let tries = 0; tries < 100; tries++) {
    if (await page.evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${expression}`);
}

/** Sends ? as a US keyboard types it, Shift held, to the page's keys.js. */
async function pressHelp(page) {
  const event = { key: "?", code: "Slash", modifiers: 8, windowsVirtualKeyCode: 191 };
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...event, text: "?" });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/** The states, in the order they're named: each page, its viewport, how it opens, and whether
 * the capture takes the whole page or the viewport. */
const STATES = [
  { name: "1-tools", caption: "the tools page", page: "tools", size: WIDE, full: true },
  {
    name: "2-keys-help",
    caption: "keys help open",
    page: "keys",
    size: WIDE,
    async open(page) {
      await pressHelp(page);
      // keys-help.js replaces the placeholder with the list and its note once it has loaded.
      await waitFor(
        page,
        `document.getElementById("help").open && !!document.querySelector("[data-keys-note]")`,
      );
    },
  },
  ...[
    ["3-theme-menu-wide", "the theme menu open, wide", WIDE],
    ["4-theme-menu-narrow", "the theme menu open, narrow", NARROW],
  ].map(([name, caption, size]) => ({
    name,
    caption,
    page: "theme",
    size,
    async open(page) {
      // The Theme button's command="--open", as a click sends it to <sl-theme-menu>.
      await page.evaluate(`document.querySelector("button[commandfor=theme]").click()`);
      await waitFor(page, `document.querySelector("sl-theme-menu dialog")?.open`);
    },
  })),
];

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

/** Resolves once the fonts are ready and two frames have painted. */
const SETTLED = `document.fonts.ready.then(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))))`;

const server = await serve();
const browser = await launch();
try {
  for (const state of STATES) {
    for (const [profile, attribute] of PROFILES) {
      for (const scheme of SCHEMES) {
        const page = await browser.open(`${server.origin}/demo/${state.page}.html`);
        try {
          await page.cdp("Emulation.setDeviceMetricsOverride", {
            ...state.size,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await page.cdp("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-color-scheme", value: scheme }],
          });
          await page.evaluate(FULL_ENTRY);
          const attributes = { ...DEFAULTS, [attribute]: profile, "data-scheme": scheme };
          await page.evaluate(`(() => {
            const root = document.documentElement;
            for (const [name, value] of Object.entries(${JSON.stringify(attributes)})) {
              root.setAttribute(name, value);
            }
          })()`);
          await state.open?.(page);
          await page.evaluate(SETTLED);
          let clip;
          if (state.full) {
            const { cssContentSize } = await page.cdp("Page.getLayoutMetrics");
            clip = { x: 0, y: 0, width: state.size.width, height: cssContentSize.height, scale: 1 };
          }
          const { data } = await page.cdp("Page.captureScreenshot", {
            format: "png",
            ...(clip && { clip, captureBeyondViewport: true }),
          });
          const path = join(dir, `${state.name}--${profile}-${scheme}.png`);
          writeFileSync(path, Buffer.from(data, "base64"));
          console.log(`${path}\t${state.caption}: ${profile}, ${scheme}`);
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  await server.stop();
}
