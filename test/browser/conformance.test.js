// The conformance module from the package's dist/, as an extension's author runs it: every
// built-in profile of the full entry conforms, in light and in dark, and with the entry's sheets
// from another origin, whose rules chromium hides; each fixture profile in
// test/fixtures/conformance/ fails the one rule it breaks, by name; and the check rejects what it
// can't check, and leaves the page as it found it.
// Adapted from spike-html-design (fe75220): test/conformance.test.js.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";

/** The repository root, which the server serves. */
const root = join(import.meta.dirname, "../..");

const CONFORMANCE = "/dist/conformance.js";

/** The full entry's profiles, per facet. */
const BUILT_IN = {
  color: ["flexoki", "primer", "catppuccin", "everforest"],
  space: ["regular", "compact"],
  type: ["mono", "sans"],
};

/** The fixture profiles, per facet, each to the one rule it breaks. */
const BROKEN = {
  color: {
    missing: "tokens",
    spacing: "color-only",
    unlayered: "layer",
    specific: "specificity",
    unpainted: "paints",
    surfaces: "surfaces",
    unregistered: "registered",
  },
  space: {
    missing: "tokens",
    coloring: "space-only",
    unlayered: "layer",
    specific: "specificity",
    flat: "scale",
    unregistered: "registered",
  },
  type: {
    missing: "tokens",
    spacing: "type-only",
    unlayered: "layer",
    specific: "specificity",
    descending: "scale",
    unfamilied: "scale",
    unregistered: "registered",
  },
};

let server;
let other;
let browser;
const pages = [];
const fixture = (name) => `${server.origin}/test/fixtures/${name}`;

before(async () => {
  server = await serve({ root });
  // A second origin for the cross-origin case: the same tree on another port.
  other = await serve({ root });
  browser = await launch();
});
afterEach(async () => {
  for (const page of pages.splice(0)) await page.close();
});
after(async () => {
  await browser?.close();
  await server?.stop();
  await other?.stop();
});

/** Opens the URL, closing it after the test. */
async function open(url) {
  const page = await browser.open(url);
  pages.push(page);
  return page;
}

/**
 * The failures check() returns for each facet's names on the page, facet to name to list, with the
 * conformance module imported from dist/.
 */
const checked = (page, names) =>
  page.evaluate(`import(${JSON.stringify(CONFORMANCE)}).then(async ({ check }) => {
    const results = {};
    for (const [facet, list] of Object.entries(${JSON.stringify(names)})) {
      results[facet] = {};
      for (const name of list) results[facet][name] = await check(facet, name);
    }
    return results;
  })`);

/** The result checked() resolves to when every one of names conforms. */
const conforming = (names) =>
  Object.fromEntries(
    Object.entries(names).map(([facet, list]) => [
      facet,
      Object.fromEntries(list.map((name) => [name, []])),
    ]),
  );

/** Each fixture's rule names, facet to name to list, from checked()'s results. */
const rules = (results) =>
  Object.fromEntries(
    Object.entries(results).map(([facet, byName]) => [
      facet,
      Object.fromEntries(
        Object.entries(byName).map(([name, failures]) => [name, failures.map(({ rule }) => rule)]),
      ),
    ]),
  );

describe("conformance", () => {
  for (const scheme of ["light", "dark"]) {
    test(`the eight built-in profiles conform on the full entry, with the system in ${scheme}`, async () => {
      const page = await open(fixture("conformance.html"));
      await page.cdp("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: scheme }],
      });
      assert.deepEqual(await checked(page, BUILT_IN), conforming(BUILT_IN));
    });
  }

  test("the eight built-in profiles conform with the entry's sheets from another origin", async () => {
    // A cross-origin sheet served without CORS hides its rules: the check reads computed values
    // alone.
    const page = await open(`${fixture("conformance-cross-origin.html")}?sheets=${other.origin}`);
    assert.deepEqual(
      await page.evaluate(`[document.styleSheets.length, [...document.styleSheets].every((sheet) => {
        try { return sheet.cssRules && false; } catch { return true; }
      })]`),
      [1, true],
    );
    assert.deepEqual(await checked(page, BUILT_IN), conforming(BUILT_IN));
  });

  test("each fixture profile fails the one rule it breaks, by name", async () => {
    const page = await open(fixture("conformance.html"));
    const names = Object.fromEntries(
      Object.entries(BROKEN).map(([facet, byName]) => [facet, Object.keys(byName)]),
    );
    const results = await checked(page, names);
    const expected = Object.fromEntries(
      Object.entries(BROKEN).map(([facet, byName]) => [
        facet,
        Object.fromEntries(Object.entries(byName).map(([name, rule]) => [name, [rule]])),
      ]),
    );
    assert.deepEqual(rules(results), expected);
    for (const [facet, byName] of Object.entries(results)) {
      for (const [name, failures] of Object.entries(byName)) {
        assert.ok(failures[0].message.startsWith(`${name}: `), `${facet} ${name}`);
      }
    }
  });

  test("every rule the module exports has a fixture that breaks it", async () => {
    const page = await open(fixture("conformance.html"));
    const RULES = await page.evaluate(
      `import(${JSON.stringify(CONFORMANCE)}).then(({ RULES }) => RULES)`,
    );
    assert.deepEqual(Object.keys(RULES), Object.keys(BROKEN));
    for (const [facet, byName] of Object.entries(BROKEN)) {
      assert.deepEqual([...new Set(Object.values(byName))].sort(), [...RULES[facet]].sort(), facet);
    }
  });

  test("names what broke, and an unknown name fails tokens and registered alone", async () => {
    const page = await open(fixture("conformance.html"));
    const results = await checked(page, {
      color: ["missing", "absent"],
      space: ["missing", "flat", "absent"],
      type: ["missing", "descending", "unfamilied", "absent"],
    });
    const messages = (facet, name) => results[facet][name].map(({ message }) => message);
    assert.deepEqual(messages("color", "missing"), [
      "missing: sets no color in a scheme for --magenta (light, dark)",
    ]);
    assert.deepEqual(messages("space", "missing"), ["missing: sets no length for --radius-base"]);
    assert.deepEqual(messages("space", "flat"), [
      "flat: --space-3xs to --space-3xl compute to 0px, 0px, 0px, 0px, 0px, 0px, 0px, 0px, 0px, which do not strictly ascend",
    ]);
    assert.deepEqual(messages("type", "missing"), ["missing: sets no value for --leading-code"]);
    assert.match(
      messages("type", "descending")[0],
      /^descending: --text-xs to --text-4xl compute to (\d+(\.\d+)?px, ){7}\d+(\.\d+)?px, which do not strictly ascend$/,
    );
    assert.deepEqual(messages("type", "unfamilied"), [
      "unfamilied: --font-code resolve to no font family",
    ]);
    // A name no stylesheet applies sets no value, so the rules that read values are skipped.
    for (const facet of ["color", "space", "type"]) {
      assert.deepEqual(
        results[facet].absent.map(({ rule }) => rule),
        ["tokens", "registered"],
        facet,
      );
    }
  });

  test("a scope painted from other tokens by a consumer's rule fails paints", async () => {
    // A consumer rule that repaints every flexoki scope breaks paints for flexoki alone.
    const page = await open(fixture("conformance.html"));
    await page.evaluate(`document.head.append(Object.assign(document.createElement("style"), {
      textContent: '[data-palette="flexoki"] { background-color: var(--red); }',
    }))`);
    const results = await checked(page, { color: ["flexoki", "primer"] });
    assert.deepEqual(rules(results), { color: { flexoki: ["paints"], primer: [] } });
  });

  test("freezes the rules, and rejects an unknown facet or an empty name", async () => {
    const page = await open(fixture("conformance.html"));
    assert.deepEqual(
      await page.evaluate(`import(${JSON.stringify(CONFORMANCE)}).then(async ({ check, RULES }) => {
        const rejected = (call) => call.then(() => null, (error) => [error.name, error.message]);
        return [
          Object.isFrozen(RULES) && Object.values(RULES).every(Object.isFrozen),
          await rejected(check("scheme", "dark")),
          await rejected(check("space", "")),
          await rejected(check("type")),
        ];
      })`),
      [
        true,
        ["TypeError", "conformance: unknown facet scheme; expected one of color, space, type"],
        ["TypeError", "conformance: a space profile's name must be a non-empty string"],
        ["TypeError", "conformance: a type profile's name must be a non-empty string"],
      ],
    );
  });

  test("leaves the page as it found it, and loads nothing", async () => {
    const page = await open(fixture("conformance.html"));
    const state = `[document.querySelectorAll("*").length, document.styleSheets.length,
      performance.getEntriesByType("resource").length]`;
    const before = await page.evaluate(state);
    await checked(page, { color: ["flexoki"], space: ["regular"], type: ["mono"] });
    // The module itself is the one resource the check adds.
    const [elements, sheets, resources] = await page.evaluate(state);
    assert.deepEqual([elements, sheets, resources], [before[0], before[1], before[2] + 1]);
  });
});
