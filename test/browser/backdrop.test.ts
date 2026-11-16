// The baseline's ::backdrop veil from the package's dist/, on test/fixtures/backdrop.html under the
// full page entry, in each built-in palette and scheme: a modal dialog's backdrop computes to the
// veil, the page's --bg at 80%, a popover's, hint, auto, or manual, on the page or inside the open
// dialog, stays transparent, so a hint shown on hover veils nothing, and a fullscreen element's
// stays chromium's black.

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
/** A transparent background, as getComputedStyle gives it. */
const TRANSPARENT = "rgba(0, 0, 0, 0)";
/** Chromium's own background for a fullscreen element's ::backdrop. */
const BLACK = "rgb(0, 0, 0)";

/** Each top-layer element's ::backdrop background color, and the veil the probe computes. */
interface Backdrops {
  veil: string;
  modal: string;
  hint: string;
  auto: string;
  manual: string;
  dialogHint: string;
  modalUnderHint: string;
  fullscreen: string;
}

/** The fixture's reading in one palette and scheme: each popover shown alone, then the modal
 * dialog, then the hint inside it over it, then the fullscreen element, each read while it is in
 * the top layer. Fullscreen asks for a user gesture, which the evaluation carries. */
const READ = (palette: string, scheme: string) => `(async () => {
  const root = document.documentElement;
  root.setAttribute("data-palette", ${JSON.stringify(palette)});
  root.setAttribute("data-scheme", ${JSON.stringify(scheme)});
  const backdrop = (element) => getComputedStyle(element, "::backdrop").backgroundColor;
  const shown = (id) => {
    const popover = document.getElementById(id);
    popover.showPopover();
    const color = backdrop(popover);
    popover.hidePopover();
    return color;
  };
  const out = {
    veil: getComputedStyle(document.getElementById("veil")).backgroundColor,
    hint: shown("hint"),
    auto: shown("auto"),
    manual: shown("manual"),
  };
  const modal = document.getElementById("modal");
  modal.showModal();
  out.modal = backdrop(modal);
  const dialogHint = document.getElementById("dialog-hint");
  dialogHint.showPopover();
  out.dialogHint = backdrop(dialogHint);
  out.modalUnderHint = backdrop(modal);
  dialogHint.hidePopover();
  modal.close();
  const fullscreen = document.getElementById("fullscreen");
  await fullscreen.requestFullscreen();
  if (document.fullscreenElement !== fullscreen) throw new Error("the element isn't fullscreen");
  out.fullscreen = backdrop(fullscreen);
  await document.exitFullscreen();
  return out;
})()`;

describe("foundation backdrop", () => {
  let server: Server;
  let browser: Browser;
  let page: Page;

  before(async () => {
    server = await serve({ root });
    browser = await launch();
    page = await browser.open(`${server.origin}/test/fixtures/backdrop.html`);
  });
  after(async () => {
    await page?.close();
    await browser?.close();
    await server?.stop();
  });

  /** Each palette and scheme's veil, so the readings are seen to differ by profile. */
  const veils = new Set<string>();

  for (const palette of PALETTES) {
    for (const scheme of SCHEMES) {
      test(`${palette} ${scheme}: a modal dialog's backdrop is the veil, a popover's transparent, a fullscreen element's black`, async () => {
        const { result, exceptionDetails } = await page.cdp("Runtime.evaluate", {
          expression: READ(palette, scheme),
          awaitPromise: true,
          returnByValue: true,
          userGesture: true,
        });
        assert.equal(exceptionDetails, undefined, exceptionDetails?.exception?.description);
        const read: Backdrops = result.value;
        veils.add(read.veil);
        // The veil is a color, so a backdrop left transparent can't pass for it.
        assert.notEqual(read.veil, TRANSPARENT);
        assert.deepEqual(read, {
          veil: read.veil,
          modal: read.veil,
          hint: TRANSPARENT,
          auto: TRANSPARENT,
          manual: TRANSPARENT,
          dialogHint: TRANSPARENT,
          modalUnderHint: read.veil,
          fullscreen: BLACK,
        });
      });
    }
  }

  // Each profile's --bg differs, so a reading that never left one profile would show here.
  test("each palette and scheme computes a veil of its own", () => {
    assert.equal(veils.size, PALETTES.length * SCHEMES.length);
  });
});
