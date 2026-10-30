// The preferences module and the theme menu from the package's dist/, as a consumer loads them:
// the stored choice applied before first paint, kept in storage, and followed across tabs, and
// <sl-theme-menu>, pressed with real keys through the DevTools Protocol, on
// test/fixtures/preferences*.html and test/fixtures/flash-*.html, and demo/theme.html and
// demo/unit.html; and a unit, built-in or from outside the package, joining a lean page.
// Adapted from spike-html-design (fe75220): test/preferences.test.js.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";

/** The repository root, which the server serves. */
const root = join(import.meta.dirname, "../..");

const KEY = "spike-html-apps-foundation.preferences";
const PREFERENCES = "/dist/preferences.js";
const MENU = "button[commandfor=theme]";
const DIALOG = "sl-theme-menu dialog";
/** A profile other than the default in every facet, and the dark scheme. */
const CHOICE = { color: "primer", space: "compact", type: "sans", scheme: "dark" };
const APPLIED = {
  "data-palette": "primer",
  "data-space": "compact",
  "data-type": "sans",
  "data-scheme": "dark",
};
const NONE = { "data-palette": null, "data-space": null, "data-type": null, "data-scheme": null };
const DEFAULT_STATE = {
  "data-palette": "flexoki",
  "data-space": "regular",
  "data-type": "mono",
  "data-scheme": null,
};

let server;
let browser;
const pages = [];
const fixture = (name) => `${server.origin}/test/fixtures/${name}`;

before(async () => {
  server = await serve({ root });
  browser = await launch();
});
// Every page shares one origin, and so the one stored choice.
afterEach(async () => {
  for (const page of pages.splice(0)) {
    await page.evaluate("localStorage.clear()").catch(() => {});
    await page.close();
  }
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

/** Opens the URL, closing it after the test. */
async function open(url) {
  const page = await browser.open(url);
  pages.push(page);
  return page;
}

/**
 * Stores the value under KEY, as JSON unless it is a string, or clears it when null, from a page
 * of the origin, which it returns: a fixture loaded next finds the value in storage.
 */
async function seed(value) {
  const page = await open(fixture("preferences.html"));
  await page.evaluate(
    value === null
      ? `localStorage.removeItem(${JSON.stringify(KEY)})`
      : `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(
          typeof value === "string" ? value : JSON.stringify(value),
        )})`,
  );
  return page;
}

/** The page's stored choice, parsed. */
const stored = (page) => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);

/** The root's four preference attributes, null where one is absent. */
const rooted = (page) =>
  page.evaluate(`Object.fromEntries(["data-palette", "data-space", "data-type", "data-scheme"]
    .map((name) => [name, document.documentElement.getAttribute(name)]))`);

/** Resolves after ms, as measured in the page. */
const sleep = (page, ms) => page.evaluate(`new Promise((resolve) => setTimeout(resolve, ${ms}))`);

/** Evaluates the body with the page's preferences module, the one it loaded, bound. */
const call = (page, body) =>
  page.evaluate(`import(${JSON.stringify(PREFERENCES)}).then((preferences) => ${body})`);

/** When the page fetched the file of dist/, in ms since navigation, or null. */
const fetched = (page, name) =>
  page.evaluate(`performance.getEntriesByType("resource")
    .find(({ name }) => name.endsWith("/dist/${name}"))?.startTime ?? null`);

/** Sends a real key press, keyDown then keyUp, with a US layout's code for a letter. */
async function press(page, key, { repeat = false } = {}) {
  const letter = /^[a-z]$/i.test(key);
  const codes = { Escape: 27, Tab: 9, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  const event = {
    key,
    code: letter ? `Key${key.toUpperCase()}` : key,
    autoRepeat: repeat,
    windowsVirtualKeyCode: letter ? key.toUpperCase().charCodeAt(0) : (codes[key] ?? 0),
  };
  const text = letter ? { text: key } : {};
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...event, ...text });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/** Clicks the page's Theme button and resolves once its menu is open. */
async function clickTheme(page) {
  await page.evaluate(`document.querySelector(${JSON.stringify(MENU)}).click()`);
  await until(page, `document.querySelector(${JSON.stringify(DIALOG)})?.open`);
}

/** Loads the fixture with the value stored (see seed) and opens its menu. */
async function openMenu(value = null, name = "preferences.html") {
  await seed(value);
  const page = await open(fixture(name));
  await clickTheme(page);
  return page;
}

/** Resolves once the page's menu has closed. */
const closed = (page) =>
  until(page, `!document.querySelector("sl-theme-menu").hasAttribute("data-open")`);

/**
 * The open menu's focus, as [section, value] of the focused radio, its selection per section, and
 * the root's and the preview's four preference attributes.
 */
const state = (page) =>
  page.evaluate(`(() => {
    const dialog = document.querySelector(${JSON.stringify(DIALOG)});
    const names = ["data-palette", "data-space", "data-type", "data-scheme"];
    const attributes = (el) => Object.fromEntries(names.map((n) => [n, el.getAttribute(n)]));
    const focused = document.activeElement;
    return {
      focus: [focused.closest("fieldset")?.dataset.section ?? null, focused.value ?? null],
      selection: Object.fromEntries([...dialog.querySelectorAll("fieldset")]
        .map((row) => [row.dataset.section, row.querySelector(":checked").value])),
      root: attributes(document.documentElement),
      preview: attributes(dialog.querySelector(".theme-menu-preview")),
    };
  })()`);

/** Counts localStorage.setItem's calls into window.writes. */
const countWrites = (page) =>
  page.evaluate(`(() => {
    window.writes = 0;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.writes++; return setItem.apply(this, args); };
  })()`);

/** The computed value of the property on the first element the selector matches. */
const style = (page, selector, property) =>
  page.evaluate(
    `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).getPropertyValue(${JSON.stringify(property)})`,
  );

describe("preferences: apply and storage", () => {
  test("applies the stored choice to the root, under the foundation's key", async () => {
    await seed(CHOICE);
    const page = await open(fixture("preferences.html"));
    assert.deepEqual(await rooted(page), APPLIED);
    assert.match(await style(page, "h1", "font-family"), /^system-ui/);
    assert.equal(await call(page, "preferences.KEY"), KEY);
  });

  test("the system scheme sets no data-scheme", async () => {
    await seed({ ...CHOICE, scheme: "system" });
    const page = await open(fixture("preferences.html"));
    assert.deepEqual(await rooted(page), { ...APPLIED, "data-scheme": null });
  });

  test("with nothing stored, or a value that isn't a choice, the page keeps its defaults", async () => {
    for (const value of [null, "not json", "42"]) {
      await seed(value);
      const page = await open(fixture("preferences.html"));
      assert.deepEqual(await rooted(page), NONE, String(value));
      assert.equal(await call(page, "preferences.read()"), null, String(value));
    }
  });

  test("a name this page didn't register falls back to its default and stays in storage", async () => {
    await seed(CHOICE);
    const page = await open(fixture("preferences-lean.html"));
    assert.deepEqual(await rooted(page), { ...NONE, "data-scheme": "dark" });
    assert.deepEqual(await stored(page), CHOICE);
    // The default's tokens apply: mono's heading font, not sans's.
    assert.match(await style(page, "h1", "font-family"), /^ui-monospace/);
  });

  test("a saved choice applies after a reload and on another page of the origin", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    assert.equal(await call(page, `preferences.save(${JSON.stringify(CHOICE)})`), true);
    // save writes storage only; the menu applies a choice itself.
    assert.deepEqual(await rooted(page), NONE);
    const lean = await open(fixture("preferences-lean.html"));
    assert.deepEqual(await rooted(lean), { ...NONE, "data-scheme": "dark" });
    await page.goto(fixture("preferences.html"));
    assert.deepEqual(await rooted(page), APPLIED);
  });

  test("save fills a partial choice with the defaults and the system scheme", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    await call(page, `preferences.save({ type: "sans" })`);
    assert.deepEqual(await stored(page), {
      scheme: "system",
      color: "flexoki",
      space: "regular",
      type: "sans",
    });
  });

  test("apply sets a choice on any element without saving it", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    const set = await call(
      page,
      `{
        const el = document.createElement("div");
        preferences.apply(${JSON.stringify(CHOICE)}, el);
        return [...el.attributes].map(({ name, value }) => name + "=" + value).sort();
      }`,
    );
    assert.deepEqual(set, [
      "data-palette=primer",
      "data-scheme=dark",
      "data-space=compact",
      "data-type=sans",
    ]);
    assert.deepEqual(await rooted(page), NONE);
    assert.equal(await stored(page), null);
  });

  test("blocked storage reads as nothing stored and saves nothing, without throwing", async () => {
    await seed(CHOICE);
    const page = await open(fixture("preferences.html"));
    // Storage that throws on get and on set from before the modules run, as a sandboxed frame's.
    await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.errors = [];
        addEventListener("error", (event) => window.errors.push(String(event.message)));
        addEventListener("unhandledrejection", (event) => window.errors.push(String(event.reason)));
        for (const name of ["getItem", "setItem"]) {
          Storage.prototype[name] = () => { throw new DOMException("blocked", "SecurityError"); };
        }`,
    });
    await page.goto(fixture("preferences.html"));
    assert.deepEqual(await rooted(page), NONE);
    assert.equal(await page.evaluate(`customElements.get("sl-theme-menu") !== undefined`), true);
    assert.deepEqual(await call(page, `[preferences.read(), preferences.save({})]`), [null, false]);
    // The menu opens, applies, and closes on Save and on Escape, storing nothing.
    await clickTheme(page);
    await press(page, "l");
    assert.equal((await rooted(page))["data-palette"], "primer");
    await press(page, "t");
    await closed(page);
    assert.equal((await rooted(page))["data-palette"], "primer");
    await clickTheme(page);
    await press(page, "l");
    await press(page, "Escape");
    await closed(page);
    assert.equal((await rooted(page))["data-palette"], "primer");
    assert.deepEqual(await page.evaluate("window.errors"), []);
  });
});

// The flash: the stored choice reaching the root against first paint, with each module's fetch
// held. The recorder takes first-paint from a PerformanceObserver and the moment data-palette
// lands from a MutationObserver.
describe("preferences: the flash", () => {
  const DELAY = 200;

  /** Loads the flash fixture with CHOICE stored and every dist/ module's fetch held DELAY ms. */
  async function flash(name) {
    const page = await seed(CHOICE);
    page.on("Fetch.requestPaused", ({ requestId }) => {
      setTimeout(() => page.cdp("Fetch.continueRequest", { requestId }).catch(() => {}), DELAY);
    });
    await page.cdp("Fetch.enable", { patterns: [{ urlPattern: "*/dist/*.js" }] });
    await page.goto(fixture(name));
    await until(page, "window.flash.paint !== null", 5000);
    return { page, ...(await page.evaluate("window.flash")) };
  }

  test("render-blocking, the stored choice applies before first paint", async () => {
    const blocking = await flash("flash-blocking.html");
    assert.notEqual(blocking.applied, null);
    assert.ok(blocking.applied <= blocking.paint, `applied ${blocking.applied}, ${blocking.paint}`);
    assert.ok(blocking.paint >= DELAY, `first paint ${blocking.paint} didn't wait on the fetch`);
    assert.deepEqual(await rooted(blocking.page), APPLIED);
    // Not blocking, the defaults paint first and the choice lands after the held fetch.
    const deferred = await flash("flash-deferred.html");
    assert.ok(deferred.applied > deferred.paint, `applied ${deferred.applied}, ${deferred.paint}`);
  });
});

describe("preferences: the storage event", () => {
  test("another tab's save applies live while the menu is closed", async () => {
    await seed(null);
    const saver = await open(fixture("preferences.html"));
    const page = await open(fixture("preferences.html"));
    await call(saver, `preferences.save(${JSON.stringify(CHOICE)})`);
    await until(page, `document.documentElement.getAttribute("data-palette") === "primer"`);
    assert.deepEqual(await rooted(page), APPLIED);
    // A cleared key restores the defaults.
    await saver.evaluate("localStorage.clear()");
    await until(page, `!document.documentElement.hasAttribute("data-palette")`);
    assert.deepEqual(await rooted(page), NONE);
  });

  test("while the menu is open it is ignored, and Cancel then restores it", async () => {
    const page = await openMenu(CHOICE);
    const saver = await open(fixture("preferences.html"));
    await press(page, "l");
    assert.equal((await rooted(page))["data-palette"], "catppuccin");
    const next = { color: "everforest", space: "regular", type: "mono", scheme: "light" };
    await call(saver, `preferences.save(${JSON.stringify(next)})`);
    await until(
      page,
      `JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).color === "everforest"`,
    );
    // Time for the storage event to have been delivered, had it been followed.
    await sleep(page, 100);
    assert.deepEqual(await state(page), {
      focus: ["color", "catppuccin"],
      selection: { ...CHOICE, color: "catppuccin" },
      root: { ...APPLIED, "data-palette": "catppuccin" },
      preview: { ...APPLIED, "data-palette": "catppuccin" },
    });
    await press(page, "Escape");
    await closed(page);
    assert.deepEqual(await rooted(page), {
      "data-palette": "everforest",
      "data-space": "regular",
      "data-type": "mono",
      "data-scheme": "light",
    });
    // Closed again: the next save applies.
    await call(saver, `preferences.save(${JSON.stringify({ ...next, color: "primer" })})`);
    await until(page, `document.documentElement.getAttribute("data-palette") === "primer"`);
  });
});

describe("preferences: <sl-theme-menu>", () => {
  test("the menu module and its sheet are fetched on the first open, after first paint", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    assert.equal(await page.evaluate(`customElements.get("sl-theme-menu") !== undefined`), true);
    await sleep(page, 100);
    assert.equal(await fetched(page, "theme-menu.js"), null);
    assert.equal(await fetched(page, "theme-menu.css"), null);
    await clickTheme(page);
    const paint = await page.evaluate(
      `performance.getEntriesByName("first-paint")[0]?.startTime ?? 0`,
    );
    assert.ok((await fetched(page, "theme-menu.js")) > paint);
    assert.ok((await fetched(page, "theme-menu.css")) > paint);
    assert.equal(await call(page, "preferences.isOpen()"), true);
  });

  test("opens on the --open command alone, binding no key itself", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    // Another command opens nothing.
    await page.evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(MENU)});
      button.command = "--other";
      button.click();
      button.command = "--open";
    })()`);
    // With the Theme button's data-keys removed, T opens nothing: keys.js was its only binding.
    await page.evaluate(
      `document.querySelector(${JSON.stringify(MENU)}).removeAttribute("data-keys")`,
    );
    await press(page, "t");
    await sleep(page, 100);
    assert.equal(await call(page, "preferences.isOpen()"), false);
    assert.equal(await fetched(page, "theme-menu.js"), null);
    // With it, keys.js clicks the button.
    await page.evaluate(`document.querySelector(${JSON.stringify(MENU)}).dataset.keys = "t"`);
    await press(page, "t");
    await until(page, `document.querySelector(${JSON.stringify(DIALOG)})?.open`);
  });

  test("two opens while the menu module loads open one menu", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    await page.evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(MENU)});
      button.click();
      button.click();
    })()`);
    await until(page, `document.querySelector(${JSON.stringify(DIALOG)})?.open`);
    await sleep(page, 100);
    assert.equal(
      await page.evaluate(`document.querySelectorAll(${JSON.stringify(DIALOG)}).length`),
      1,
    );
  });

  test("a failed load warns, opens nothing, and imports again at the next open", async () => {
    await seed(null);
    const page = await open(fixture("preferences.html"));
    let requests = 0;
    page.on("Fetch.requestPaused", ({ requestId }) => {
      requests++;
      page.cdp("Fetch.fulfillRequest", { requestId, responseCode: 404 });
    });
    await page.cdp("Fetch.enable", { patterns: [{ urlPattern: "*/theme-menu.js" }] });
    await page.evaluate(`(() => {
      window.warned = [];
      const warn = console.warn;
      console.warn = (...args) => (window.warned.push(String(args[0])), warn(...args));
    })()`);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(`document.querySelector(${JSON.stringify(MENU)}).click()`);
      await sleep(page, 200);
    }
    const failed = "preferences: the theme menu module failed to load";
    assert.deepEqual(await page.evaluate("window.warned"), [failed, failed]);
    assert.equal(requests, 2);
    assert.equal(await call(page, "preferences.isOpen()"), false);
    await page.cdp("Fetch.disable");
    await clickTheme(page);
  });
});

// The menu, opened on the full-entry fixture. Keys are real key presses, so the radios' native
// arrow cycling and Tab order are Chromium's own.
describe("preferences: the menu", () => {
  test("is a modal dialog in light DOM, a radio group per section listing the registry's names", async () => {
    const page = await openMenu();
    const menu = await page.evaluate(`(() => {
      const dialog = document.querySelector("sl-theme-menu > dialog");
      const hidden = (el) => getComputedStyle(el).clipPath === "inset(50%)";
      return {
        modal: dialog.matches(":modal"),
        shadow: document.querySelector("sl-theme-menu").shadowRoot,
        rows: [...dialog.querySelectorAll("fieldset")].map((row) => ({
          section: row.dataset.section,
          legend: row.querySelector("legend").textContent,
          names: [...row.querySelectorAll("input[type=radio]")].map((radio) => radio.value),
          groups: new Set([...row.querySelectorAll("input")].map((radio) => radio.name)).size,
          shown: [...row.querySelectorAll("label")].filter((label) => !hidden(label))
            .map((label) => label.textContent),
          radiosHidden: [...row.querySelectorAll("input")].every(hidden),
          arrows: [...row.querySelectorAll("[aria-hidden=true]")].map((el) => el.textContent),
        })),
        actions: [...dialog.querySelectorAll("footer button")].map((button) => [
          button.textContent.replace(/\\s+/g, " ").trim(),
          button.querySelector("kbd").textContent,
          button.getAttribute("aria-keyshortcuts"),
        ]),
      };
    })()`);
    assert.equal(menu.modal, true);
    assert.equal(menu.shadow, null);
    const row = (section, legend, names) => ({
      section,
      legend,
      names,
      groups: 1,
      shown: [names[0]],
      radiosHidden: true,
      arrows: ["◀", "▶"],
    });
    assert.deepEqual(menu.rows, [
      row("color", "Color", ["flexoki", "primer", "catppuccin", "everforest"]),
      row("scheme", "Scheme", ["system", "light", "dark"]),
      row("space", "Space", ["regular", "compact"]),
      row("type", "Type", ["mono", "sans"]),
    ]);
    assert.deepEqual(menu.actions, [
      ["Cancel Esc", "Esc", "Escape"],
      ["Save T", "T", "T"],
    ]);
    const { focus, root } = await state(page);
    assert.deepEqual({ focus, root }, { focus: ["color", "flexoki"], root: NONE });
  });

  test("on the lean entry, its rows list the lean registry's names", async () => {
    const page = await openMenu(null, "preferences-lean.html");
    const names = await page.evaluate(`Object.fromEntries([...document.querySelectorAll(
      "sl-theme-menu fieldset")].map((row) => [row.dataset.section,
      [...row.querySelectorAll("input")].map((radio) => radio.value)]))`);
    assert.deepEqual(names, {
      color: ["flexoki"],
      scheme: ["system", "light", "dark"],
      space: ["regular"],
      type: ["mono"],
    });
  });

  test("opens on what applies: the stored choice checked, the preview carrying it", async () => {
    const page = await openMenu(CHOICE);
    assert.deepEqual(await state(page), {
      focus: ["color", "primer"],
      selection: CHOICE,
      root: APPLIED,
      preview: APPLIED,
    });
  });

  test("Up/Down and k/j move between rows; Left/Right and h/l cycle one, applying at once", async () => {
    const page = await openMenu();
    const focus = async () => (await state(page)).focus;

    await press(page, "ArrowDown");
    assert.deepEqual(await state(page), {
      focus: ["scheme", "system"],
      selection: { color: "flexoki", scheme: "system", space: "regular", type: "mono" },
      root: NONE,
      preview: DEFAULT_STATE,
    });
    await press(page, "j");
    assert.deepEqual(await focus(), ["space", "regular"]);
    await press(page, "k");
    await press(page, "ArrowUp");
    assert.deepEqual(await focus(), ["color", "flexoki"]);
    // Up from the first row stays there, and down from the last.
    await press(page, "ArrowUp");
    assert.deepEqual(await focus(), ["color", "flexoki"]);
    for (let i = 0; i < 4; i++) await press(page, "j");
    assert.deepEqual(await focus(), ["type", "mono"]);
    for (let i = 0; i < 3; i++) await press(page, "k");

    // The scheme row cycles system, light, dark, and wraps both ways.
    await press(page, "j");
    await press(page, "ArrowRight");
    let now = await state(page);
    assert.deepEqual(now.focus, ["scheme", "light"]);
    assert.deepEqual(now.root, { ...DEFAULT_STATE, "data-scheme": "light" });
    assert.deepEqual(now.preview, { ...DEFAULT_STATE, "data-scheme": "light" });
    await press(page, "l");
    assert.equal((await state(page)).root["data-scheme"], "dark");
    await press(page, "l");
    now = await state(page);
    assert.deepEqual(now.focus, ["scheme", "system"]);
    // Once changed, the root names every facet, the defaults included.
    assert.deepEqual(now.root, DEFAULT_STATE);
    await press(page, "h");
    assert.deepEqual(await focus(), ["scheme", "dark"]);
    await press(page, "ArrowLeft");
    await press(page, "ArrowLeft");
    assert.deepEqual(await focus(), ["scheme", "system"]);

    // h on the first color wraps to the last, applying to the page and the preview.
    await press(page, "k");
    await press(page, "h");
    now = await state(page);
    assert.deepEqual(now.focus, ["color", "everforest"]);
    assert.equal(now.root["data-palette"], "everforest");
    assert.equal(now.preview["data-palette"], "everforest");
  });

  test("a click on a row's arrow steps it", async () => {
    const page = await openMenu();
    await page.evaluate(`document.querySelector('[data-section="space"] [data-step="1"]').click()`);
    assert.equal((await rooted(page))["data-space"], "compact");
    await page.evaluate(
      `document.querySelector('[data-section="space"] [data-step="-1"]').click()`,
    );
    assert.equal((await rooted(page))["data-space"], "regular");
  });

  test("Tab is one stop per row, then the actions", async () => {
    const page = await openMenu();
    const stops = [];
    for (let i = 0; i < 5; i++) {
      await press(page, "Tab");
      stops.push(
        await page.evaluate(`document.activeElement.closest("fieldset")?.dataset.section ??
          document.activeElement.dataset.action`),
      );
    }
    assert.deepEqual(stops, ["scheme", "space", "type", "cancel", "save"]);
  });

  test("every key the menu handles stops at the dialog", async () => {
    const page = await openMenu();
    await page.evaluate(`(() => {
      window.seen = [];
      document.addEventListener("keydown", (event) => window.seen.push(event.key));
      addEventListener("keydown", (event) => window.seen.push(event.key));
    })()`);
    for (const name of ["ArrowDown", "j", "ArrowRight", "l", "h", "ArrowLeft", "k", "ArrowUp"]) {
      await press(page, name);
    }
    await press(page, "t", { repeat: true });
    await press(page, "Escape", { repeat: true });
    await press(page, "Escape");
    await closed(page);
    assert.deepEqual(await page.evaluate("window.seen"), []);
  });

  test("T and Save store once and close", async () => {
    for (const accept of ["t", "save"]) {
      const page = await openMenu();
      await countWrites(page);
      await press(page, "l");
      await press(page, "j");
      await press(page, "l");
      if (accept === "t") await press(page, "t");
      else await page.evaluate(`document.querySelector("[data-action=save]").click()`);
      await closed(page);
      const choice = { color: "primer", scheme: "light", space: "regular", type: "mono" };
      assert.deepEqual(await stored(page), choice, accept);
      assert.equal(await page.evaluate("window.writes"), 1, accept);
      assert.deepEqual(await rooted(page), {
        ...DEFAULT_STATE,
        "data-palette": "primer",
        "data-scheme": "light",
      });
      assert.equal(await call(page, "preferences.isOpen()"), false);
      assert.equal(await page.evaluate(`document.querySelector("dialog")`), null);
    }
  });

  test("Escape and Cancel restore what applied at open and store nothing", async () => {
    for (const cancel of ["Escape", "cancel"]) {
      const page = await openMenu(CHOICE);
      await countWrites(page);
      await press(page, "l");
      await press(page, "j");
      await press(page, "l");
      assert.notDeepEqual((await state(page)).root, APPLIED);
      if (cancel === "Escape") await press(page, "Escape");
      else await page.evaluate(`document.querySelector("[data-action=cancel]").click()`);
      await closed(page);
      assert.deepEqual(await rooted(page), APPLIED, cancel);
      assert.deepEqual(await stored(page), CHOICE, cancel);
      assert.equal(await page.evaluate("window.writes"), 0, cancel);
      assert.equal(await call(page, "preferences.isOpen()"), false, cancel);
    }
  });

  test("a held T or Escape does nothing", async () => {
    const page = await openMenu();
    await countWrites(page);
    await press(page, "l");
    await press(page, "t", { repeat: true });
    await press(page, "Escape", { repeat: true });
    await sleep(page, 100);
    assert.equal(
      await page.evaluate(`document.querySelector(${JSON.stringify(DIALOG)})?.open`),
      true,
    );
    assert.equal(await call(page, "preferences.isOpen()"), true);
    assert.equal(await page.evaluate("window.writes"), 0);
    assert.equal((await rooted(page))["data-palette"], "primer");
  });

  test("a backdrop click does nothing", async () => {
    const page = await openMenu();
    for (const type of ["mousePressed", "mouseReleased"]) {
      await page.cdp("Input.dispatchMouseEvent", {
        type,
        x: 2,
        y: 2,
        button: "left",
        clickCount: 1,
      });
    }
    await sleep(page, 100);
    assert.equal(
      await page.evaluate(`document.querySelector(${JSON.stringify(DIALOG)})?.open`),
      true,
    );
    assert.equal(await call(page, "preferences.isOpen()"), true);
  });

  test("for every selection, the preview's tokens match what the root resolves for it", async () => {
    const page = await openMenu();
    const result = await page.evaluate(`(() => {
      const dialog = document.querySelector(${JSON.stringify(DIALOG)});
      const preview = dialog.querySelector(".theme-menu-preview");
      const radios = (section) => [...dialog.querySelectorAll('[data-section="' + section + '"] input')];
      const tokens = (el) => {
        const style = getComputedStyle(el);
        return Object.fromEntries([...getComputedStyle(document.documentElement)]
          .filter((name) => name.startsWith("--")).map((name) => [name, style.getPropertyValue(name)]));
      };
      const mismatches = [];
      let count = 0;
      for (const color of radios("color")) for (const scheme of radios("scheme"))
        for (const space of radios("space")) for (const type of radios("type")) {
          for (const radio of [color, scheme, space, type]) radio.checked = true;
          dialog.dispatchEvent(new Event("change"));
          count++;
          const root = tokens(document.documentElement);
          const scoped = tokens(preview);
          for (const name in root) {
            if (root[name] !== scoped[name]) mismatches.push([color.value, scheme.value, space.value, type.value, name]);
          }
        }
      return { count, tokens: Object.keys(tokens(preview)).length, mismatches };
    })()`);
    assert.equal(result.count, 4 * 3 * 2 * 2);
    assert.ok(result.tokens > 30, `${result.tokens} tokens`);
    assert.deepEqual(result.mismatches, []);
  });

  test("its sheet is adopted once, in foundation.theme-menu, over the elements layer and under a consumer's", async () => {
    const page = await openMenu();
    // Reopened twice, the sheet is still adopted once.
    for (let i = 0; i < 2; i++) {
      await press(page, "Escape");
      await closed(page);
      await clickTheme(page);
    }
    const sheet = await page.evaluate(`(() => {
      const sheets = document.adoptedStyleSheets;
      const rules = [...sheets[0].cssRules];
      return {
        count: sheets.length,
        layers: rules.map((rule) => rule.name),
        colors: /#[0-9a-f]{3,8}\\b|\\b(rgba?|hsla?|hwb|oklch|oklab|lch|lab)\\(/i.test(rules.map((r) => r.cssText).join("")),
      };
    })()`);
    assert.deepEqual(sheet, { count: 1, layers: ["foundation.theme-menu"], colors: false });
    assert.equal(
      await page.evaluate(`performance.getEntriesByType("resource")
        .filter(({ name }) => name.endsWith("/dist/theme-menu.css")).length`),
      1,
    );

    // The menu's rule beats the elements layer: a row's legend has the menu's padding, none, not
    // the elements layer's legend padding.
    const legend = ".theme-menu-row > legend";
    assert.equal(await style(page, legend, "padding-left"), "0px");
    // A consumer's layer, declared after the foundation's, beats the menu's rule.
    await page.evaluate(`document.head.insertAdjacentHTML("beforeend", "<style>" +
      "@layer foundation, app; @layer app { .theme-menu-row > legend { padding-left: 3px; } }</style>")`);
    assert.equal(await style(page, legend, "padding-left"), "3px");
  });

  test("rows sit beside the preview at 48rem and wider, and above it when narrower", async () => {
    const layout = `(() => {
      const rows = document.querySelector(".theme-menu-rows").getBoundingClientRect();
      const preview = document.querySelector(".theme-menu-preview").getBoundingClientRect();
      return { beside: preview.left >= rows.right, below: preview.top >= rows.bottom };
    })()`;
    const page = await openMenu();
    const at = async (width) => {
      await page.cdp("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return page.evaluate(layout);
    };
    // 48rem is 768px at the default 16px root font size.
    assert.deepEqual(await at(768), { beside: true, below: false });
    assert.deepEqual(await at(767), { beside: false, below: true });
    assert.deepEqual(await at(1280), { beside: true, below: false });
    assert.deepEqual(await at(420), { beside: false, below: true });
  });
});

// A unit joins a lean page by its sheet linked after the entry and its module imported, a built-in
// unit from dist/profiles/ or a profile from outside the package, test/fixtures/extension/, alike:
// the menu lists it, and the attribute and a stored choice apply it.
describe("preferences: units and extensions", () => {
  /** The menu's names per section, on a page whose menu is open. */
  const listed = (page) =>
    page.evaluate(`Object.fromEntries([...document.querySelectorAll(
      "sl-theme-menu fieldset")].map((row) => [row.dataset.section,
      [...row.querySelectorAll("input")].map((radio) => radio.value)]))`);

  /** The root's --bg, its whitespace collapsed. */
  const background = (page) =>
    page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue("--bg")
      .trim().replace(/\\s+/g, " ")`);

  const units = [
    ["preferences-extension.html", "extension", "light-dark(#fdf6fd, #120a12)"],
    ["preferences-unit.html", "primer", "light-dark(#ffffff, #1c2128)"],
  ];
  for (const [name, color, bg] of units) {
    test(`on ${name}, the menu lists flexoki and ${color} alone, beside the lean defaults`, async () => {
      const page = await openMenu(null, name);
      assert.deepEqual(await listed(page), {
        color: ["flexoki", color],
        scheme: ["system", "light", "dark"],
        space: ["regular"],
        type: ["mono"],
      });
    });

    test(`on ${name}, data-palette="${color}" applies its tokens`, async () => {
      await seed(null);
      const page = await open(fixture(name));
      const flexoki = await background(page);
      await page.evaluate(`document.documentElement.setAttribute("data-palette", "${color}")`);
      assert.equal(await background(page), bg);
      assert.notEqual(flexoki, bg);
    });

    test(`on ${name}, a stored choice of ${color} applies on load`, async () => {
      await seed({ ...CHOICE, color });
      const page = await open(fixture(name));
      assert.deepEqual(await rooted(page), {
        ...NONE,
        "data-palette": color,
        "data-scheme": "dark",
      });
      assert.equal(await background(page), bg);
    });
  }
});

describe("preferences: demo/theme.html", () => {
  const demo = () => `${server.origin}/demo/theme.html`;

  test("its Theme button opens the menu, and the choice survives a reload and syncs to a second tab", async () => {
    await seed(null);
    const page = await open(demo());
    const other = await open(demo());
    await clickTheme(page);
    assert.equal(
      await page.evaluate(`document.querySelectorAll("sl-theme-menu fieldset").length`),
      4,
    );
    await press(page, "l");
    await press(page, "t");
    await closed(page);
    assert.equal((await rooted(page))["data-palette"], "primer");
    await until(other, `document.documentElement.getAttribute("data-palette") === "primer"`);
    await page.goto(demo());
    assert.equal((await rooted(page))["data-palette"], "primer");
  });
});

describe("preferences: demo/unit.html", () => {
  test("its menu lists the lean defaults and the Primer unit, and applies primer", async () => {
    await seed(null);
    const page = await open(`${server.origin}/demo/unit.html`);
    await clickTheme(page);
    const colors = await page.evaluate(`[...document.querySelectorAll(
      'sl-theme-menu [data-section="color"] input')].map((radio) => radio.value)`);
    assert.deepEqual(colors, ["flexoki", "primer"]);
    await press(page, "l");
    await press(page, "t");
    await closed(page);
    assert.equal((await rooted(page))["data-palette"], "primer");
    assert.equal(await style(page, "body", "background-color"), "rgb(255, 255, 255)");
  });
});
