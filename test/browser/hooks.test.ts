// The baseline's two color hooks from the package's dist/, on test/fixtures/hooks.html under the
// full page entry, in each built-in palette and scheme: progress takes --accent-color, by
// default --magenta, and the checkbox and the link take --interaction-color, by default --blue;
// each hook set on a subtree moves only what follows it there.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";

/** The repository root, which the server serves. */
const root = join(import.meta.dirname, "../..");

const PALETTES = ["flexoki", "primer", "catppuccin", "everforest"];
const SCHEMES = ["light", "dark"];
/** The colors the fixture's app layer gives each hook on its subtree. */
const ACCENT = "rgb(1, 2, 3)";
const INTERACTION = "rgb(4, 5, 6)";

/** One group's computed colors: progress's and the checkbox's accent-color, the link's color. */
interface Group {
  progress: string;
  checkbox: string;
  link: string;
}
/** The fixture's three groups, and the palette's --magenta and --blue as computed colors. */
interface Hooks {
  plain: Group;
  accented: Group;
  interacting: Group;
  magenta: string;
  blue: string;
}

/** The fixture's reading with the palette and scheme set on the root. */
const READ = (palette: string, scheme: string) => `(() => {
  const root = document.documentElement;
  root.setAttribute("data-palette", ${JSON.stringify(palette)});
  root.setAttribute("data-scheme", ${JSON.stringify(scheme)});
  const style = (selector, property) =>
    getComputedStyle(document.querySelector(selector)).getPropertyValue(property);
  const group = (id) => ({
    progress: style("#" + id + " progress", "accent-color"),
    checkbox: style("#" + id + " input", "accent-color"),
    link: style("#" + id + " a", "color"),
  });
  return {
    plain: group("plain"),
    accented: group("accented"),
    interacting: group("interacting"),
    magenta: style("#magenta", "color"),
    blue: style("#blue", "color"),
  };
})()`;

describe("foundation hooks", () => {
  let server: Server;
  let browser: Browser;
  let page: Page;

  before(async () => {
    server = await serve({ root });
    browser = await launch();
    page = await browser.open(`${server.origin}/test/fixtures/hooks.html`);
  });
  after(async () => {
    await page?.close();
    await browser?.close();
    await server?.stop();
  });

  for (const palette of PALETTES) {
    for (const scheme of SCHEMES) {
      test(`${palette} ${scheme}: progress follows --accent-color, the checkbox and the link --interaction-color`, async () => {
        const hooks: Hooks = await page.evaluate(READ(palette, scheme));
        const { plain, accented, interacting, magenta, blue } = hooks;
        // The two defaults differ, so a reader on the wrong hook can't pass.
        assert.notEqual(magenta, blue);
        assert.deepEqual(plain, { progress: magenta, checkbox: blue, link: blue });
        assert.deepEqual(accented, { progress: ACCENT, checkbox: blue, link: blue });
        assert.deepEqual(interacting, {
          progress: magenta,
          checkbox: INTERACTION,
          link: INTERACTION,
        });
      });
    }
  }
});
