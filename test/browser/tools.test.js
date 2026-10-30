// The tool sheets in the package's dist/ against v0.7.0's: every element of demo/tools.html
// computes the same, at rest and hovered, and dropping any one declaration shows. The page entry's
// layer order and default profiles are read from the same page. The full page entry's profiles
// compute as v0.7.0's full entry's, in light and in dark, and dropping any one declaration of a
// profile it adds shows; each entry's registration module lists exactly the profiles it defines,
// and each built-in unit's module registers its one profile and loads no CSS.
// demo/profiles.html switches the tools page through every profile.
// Adapted from spike-html-packages-foundation (5dd8a58): test/browser/tools.test.js.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";
import { concerns, differences } from "./support/computed-styles.js";

/** The repository root, which the server serves. */
const root = join(import.meta.dirname, "../..");

const reference = "/test/fixtures/v0.7.0/baseline.css";
const entry = "/dist/page.css";
const fullReference = "/test/fixtures/v0.7.0/full.css";
const fullEntry = "/dist/page-full.css";
const sheet = (concern) => `/dist/${concern}.css`;

/** The foundation's layers, in the order the page entry states. */
const LAYER_ORDER = [
  "foundation.tokens.color",
  "foundation.tokens.space",
  "foundation.tokens.type",
  "foundation.reset",
  "foundation.elements",
  "foundation.meta",
  "foundation.structure",
  "foundation.utilities",
  "foundation.theme-menu",
];

const FACETS = ["color", "space", "type"];
/** One token per facet that tells its profile apart, with its value under each profile. */
const PROFILES = {
  color: { flexoki: { "--bg": "light-dark(#fffcf0, #100f0f)" } },
  space: { regular: { "--radius-base": "0.375rem" } },
  type: {
    mono: {
      "--font-heading":
        'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    },
  },
};
const TOKENS = FACETS.flatMap((facet) => Object.values(PROFILES[facet]).flatMap(Object.keys));

/** Each facet's profile attribute, as v0.7.0 names them. */
const ATTRIBUTES = { color: "data-palette", space: "data-space", type: "data-type" };
/** The profiles each entry ships, per facet, in the order it imports them. */
const LEAN = { color: ["flexoki"], space: ["regular"], type: ["mono"] };
const FULL = {
  color: ["flexoki", "primer", "catppuccin", "everforest"],
  space: ["regular", "compact"],
  type: ["mono", "sans"],
};
const SCHEMES = ["light", "dark"];
/** Each profile of the full entry, as a facet and a name. */
const FULL_PROFILES = FACETS.flatMap((facet) => FULL[facet].map((name) => ({ facet, name })));
/** The profiles the full entry adds to the lean one. */
const ADDED = FULL_PROFILES.filter(({ facet, name }) => !LEAN[facet].includes(name));

/** A file of the repository, by its path on the server, without its CSS comments. */
const source = (path) => readFileSync(join(root, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The class names a stylesheet's selectors name, sorted. */
function classes(css) {
  // A dot after a digit is a number's decimal point, not a class.
  const names = [...css.matchAll(/(?<![\w-])\.(-?[A-Za-z_][\w-]*)/g)].map((match) => match[1]);
  return [...new Set(names)].sort();
}

/** Forces :hover on the page's body and every element in it, through the DevTools Protocol. */
async function forceHover(page) {
  await page.cdp("DOM.enable");
  await page.cdp("CSS.enable");
  const { root: tree } = await page.cdp("DOM.getDocument");
  const { nodeIds } = await page.cdp("DOM.querySelectorAll", {
    nodeId: tree.nodeId,
    selector: "body, body *",
  });
  const hover = (nodeId) =>
    page.cdp("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
  await Promise.all(nodeIds.map(hover));
}

/** The custom properties a stylesheet declares, sorted. */
const declared = (css) =>
  [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))].sort();

/**
 * Each facet's tokens, the ones its default profile declares in v0.7.0's sheet: a scoped reading
 * sets them all on the root to a sentinel, so a profile's scope shows only what it declares.
 */
const SENTINELS = Object.fromEntries(
  FACETS.map((facet) => [
    facet,
    declared(source(`/test/fixtures/v0.7.0/layers/tokens/${facet}/${LEAN[facet][0]}.css`)),
  ]),
);

/** The setup scope() takes for a profile in a scheme, on the root or scoped under sentinels. */
const setup = ({ facet, name }, scheme, scoped) => ({
  attribute: ATTRIBUTES[facet],
  name,
  scheme,
  sentinels: scoped ? SENTINELS[facet] : undefined,
});

/** At most 40 lines of a failure's list. */
const head = (lines) => lines.slice(0, 40).join("\n") + (lines.length > 40 ? "\n…" : "");

describe("foundation tools", () => {
  let server;
  let browser;

  /** demo/tools.html on the stack of sheets, with computed-styles.js bound as window.m. */
  async function toolsPage(sheets) {
    const page = await browser.open(`${server.origin}/demo/tools.html`);
    await page.evaluate(`import("/test/browser/support/computed-styles.js")
      .then((m) => (window.m = m).useSheets(${JSON.stringify(sheets)}))`);
    return page;
  }

  /** The page's reading on the stack of sheets, at rest and hovered. */
  async function snapshot(sheets) {
    const page = await toolsPage(sheets);
    const rest = await page.evaluate("m.reading()");
    await forceHover(page);
    const hover = await page.evaluate("m.reading()");
    await page.close();
    return { rest, hover };
  }

  /** The page's reading at rest on the stack of sheets, with scope() applied first. */
  async function scoped(sheets, options) {
    const page = await toolsPage(sheets);
    await page.evaluate(`m.scope(${JSON.stringify(options)})`);
    const rest = await page.evaluate("m.reading()");
    await page.close();
    return rest;
  }

  // v0.7.0's reading, which every comparison is against, and its lean reading in each scheme
  // forced on the root, which an added profile's must differ from, so a profile that applied
  // nothing can't pass.
  let upstream;
  const defaults = {};
  before(async () => {
    server = await serve({ root });
    browser = await launch();
    upstream = await snapshot(reference);
    for (const scheme of SCHEMES) defaults[scheme] = await scoped(reference, { scheme });
  });
  after(async () => {
    await browser?.close();
    await server?.stop();
  });

  const upstreamClasses = classes(source("/test/fixtures/v0.7.0/layers/tools.css"));

  test("the sheets hold v0.7.0's tool classes, no fewer and no more", () => {
    assert.ok(upstreamClasses.length > 0, "v0.7.0's tools layer names no class");
    assert.deepEqual(classes(concerns.map((c) => source(sheet(c))).join("\n")), upstreamClasses);
  });

  test("the demo page carries every tool class", () => {
    const html = readFileSync(join(root, "demo/tools.html"), "utf8");
    const carried = [...html.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    assert.deepEqual(
      upstreamClasses.filter((name) => !carried.includes(name)),
      [],
    );
  });

  for (const path of [entry, fullEntry]) {
    test(`${path} states the whole layer order in one statement, first`, async () => {
      const page = await toolsPage(path);
      const statements = await page.evaluate(`(() => {
        const sheet = [...document.styleSheets].find(({ href }) => href.endsWith("${path}"));
        const rules = [...sheet.cssRules];
        return rules
          .filter((rule) => rule instanceof CSSLayerStatementRule)
          .map((rule) => ({ index: rules.indexOf(rule), names: [...rule.nameList] }));
      })()`);
      await page.close();
      assert.deepEqual(statements, [{ index: 0, names: LAYER_ORDER }]);
    });
  }

  // The registry must hold no profile whose sheet the page didn't load: each entry, with its
  // registration module imported, registers exactly the profiles its sheets define, in order.
  const registrations = [
    [entry, "/dist/register.js", LEAN],
    [fullEntry, "/dist/register-full.js", FULL],
  ];
  for (const [path, module, expected] of registrations) {
    test(`${path} with ${module} registers exactly the profiles it defines`, async () => {
      const page = await toolsPage(path);
      const { registered, defined } = await page.evaluate(`import("${module}")
        .then(() => import("/dist/registry.js"))
        .then(({ FACETS, profiles }) => ({
          registered: Object.fromEntries(FACETS.map((facet) => [facet, profiles(facet)])),
          defined: m.defined(),
        }))`);
      await page.close();
      assert.deepEqual(defined, expected);
      assert.deepEqual(registered, expected);
    });
  }

  // Each built-in unit's module, imported alone on a page whose registry is otherwise empty,
  // registers its own name under its facet, nothing else, and fetches no stylesheet.
  for (const { facet, name } of FULL_PROFILES) {
    const module = `/dist/profiles/${facet}/${name}.js`;
    test(`${module} registers ${name} under ${facet} alone and loads no CSS`, async () => {
      const page = await toolsPage(entry);
      const sheets = `performance.getEntriesByType("resource")
        .filter(({ name }) => name.endsWith(".css")).length`;
      const { registered, before, after } = await page.evaluate(`(async () => {
        const before = ${sheets};
        await import("${module}");
        const { FACETS, profiles } = await import("/dist/registry.js");
        return {
          registered: Object.fromEntries(FACETS.map((facet) => [facet, profiles(facet)])),
          before,
          after: ${sheets},
        };
      })()`);
      await page.close();
      assert.deepEqual(registered, { color: [], space: [], type: [], [facet]: [name] });
      assert.equal(after, before, "the module fetched a stylesheet");
    });
  }

  test("with no profile attribute, the page entry applies DEFAULTS' profiles", async () => {
    const page = await toolsPage(entry);
    // A custom property keeps its source's line breaks.
    const read = `import("/dist/registry.js").then(({ DEFAULTS }) => {
      const style = getComputedStyle(document.documentElement);
      const token = (name) => style.getPropertyValue(name).trim().replace(/\\s+/g, " ");
      return {
        attributes: document.querySelectorAll("[data-palette], [data-space], [data-type]").length,
        defaults: DEFAULTS,
        tokens: Object.fromEntries(${JSON.stringify(TOKENS)}.map((name) => [name, token(name)])),
      };
    })`;
    const { attributes, defaults, tokens } = await page.evaluate(read);
    await page.close();
    assert.equal(attributes, 0);
    assert.deepEqual(
      tokens,
      Object.assign({}, ...FACETS.map((facet) => PROFILES[facet][defaults[facet]])),
    );
  });

  test("every tool class computes as v0.7.0's, at rest and hovered", async () => {
    assert.notEqual(differences(upstream.rest, upstream.hover).length, 0, "hover changed nothing");
    const ours = await snapshot(entry);
    const lines = ["rest", "hover"].flatMap((state) =>
      differences(upstream[state], ours[state]).map((line) => `${state} ${line}`),
    );
    assert.deepEqual(lines, [], head(lines));
  });

  // The lean entry's defaults with no profile attribute, in each scheme forced on the root.
  for (const scheme of SCHEMES) {
    test(`the page entry computes as v0.7.0's lean entry, ${scheme}`, async () => {
      const lines = differences(defaults[scheme], await scoped(entry, { scheme }));
      assert.deepEqual(lines, [], head(lines));
    });
  }

  test("the forced scheme changes the reading", () => {
    assert.notEqual(differences(defaults.light, defaults.dark).length, 0, "light and dark agree");
  });

  // Every profile of the full entry, named on the root, where its block follows the default's in
  // its sub-layer, and scoped on the body under sentinels, where it shows every token it declares.
  for (const profile of FULL_PROFILES) {
    for (const scheme of SCHEMES) {
      test(`${ATTRIBUTES[profile.facet]}="${profile.name}" computes as v0.7.0's, ${scheme}`, async () => {
        const found = [];
        for (const scope of [false, true]) {
          const options = setup(profile, scheme, scope);
          const ours = await scoped(fullEntry, options);
          const theirs = await scoped(fullReference, options);
          const where = scope ? "scoped" : "root";
          if (!scope && ADDED.includes(profile)) {
            const changed = differences(defaults[scheme], theirs).length;
            assert.notEqual(changed, 0, `${profile.name} changed nothing on the root`);
          }
          found.push(...differences(theirs, ours).map((line) => `${where} ${line}`));
        }
        assert.deepEqual(found, [], head(found));
      });
    }
  }

  // Each added profile's declarations, dropped one at a time on its scope under sentinels: every
  // one must show, as the scope inherits no token its profile fails to declare.
  for (const profile of ADDED) {
    const file = `/profiles/${profile.facet}/${profile.name}.css`;
    test(`dropping any one declaration of ${profile.name}.css fails the comparison`, async () => {
      const options = setup(profile, "light", true);
      const theirs = await scoped(fullReference, options);
      const page = await toolsPage(fullEntry);
      await page.evaluate(`m.scope(${JSON.stringify(options)})`);
      const tried = await page.evaluate(`m.drops(${JSON.stringify(theirs)}, ["${file}"])`);
      await page.close();
      const written = source(`/dist${file}`).match(/^\s*-*[a-z][\w-]*\s*:[^;{]*;/gm);
      assert.equal(tried.length, written.length, "every declaration written is tried");
      const missed = tried
        .filter(({ differs }) => differs === 0)
        .map(({ selector, declaration }) => `${selector} { ${declaration} }`);
      assert.deepEqual(missed, [], `dropped unnoticed:\n${head(missed)}`);
    });
  }

  test("dropping any one declaration of the three sheets fails the comparison", async () => {
    const page = await toolsPage(entry);
    const rest = await page.evaluate(`m.drops(${JSON.stringify(upstream.rest)})`);
    await forceHover(page);
    const hover = await page.evaluate(`m.drops(${JSON.stringify(upstream.hover)})`);
    await page.close();
    // One declaration per `property: value;` line, as each of the three sheets writes them.
    const written = concerns
      .map((c) => source(sheet(c)))
      .join("\n")
      .match(/^\s*-*[a-z][\w-]*\s*:[^;{]*;/gm);
    assert.equal(rest.length, written.length, "every declaration written is tried");
    const missed = rest
      .filter((drop, i) => drop.differs + hover[i].differs === 0)
      .map(({ sheet, selector, declaration }) => `${sheet}: ${selector} { ${declaration} }`);
    assert.deepEqual(missed, [], `dropped unnoticed:\n${head(missed)}`);
  });

  test("demo/profiles.html switches the tools page through every profile and scheme", async () => {
    const page = await browser.open(`${server.origin}/demo/profiles.html`);
    // Each switch's options, and per option the frame root's attribute and a token it then reads,
    // once the frame's link has moved to the full entry and loaded.
    const seen = await page.evaluate(`(async () => {
      const frame = document.querySelector("iframe");
      // The page sets the attributes only once the frame's full entry has loaded.
      const ready = () => frame.contentDocument?.documentElement.hasAttribute("data-palette");
      while (!ready()) await new Promise((resolve) => setTimeout(resolve, 10));
      const root = frame.contentDocument.documentElement;
      const tokens = { "data-palette": "--bg", "data-space": "--radius-base", "data-type": "--font-heading" };
      const out = {};
      for (const select of document.querySelectorAll("select")) {
        out[select.name] = [];
        for (const { value } of select.options) {
          select.value = value;
          select.dispatchEvent(new Event("change"));
          const style = frame.contentWindow.getComputedStyle(root);
          out[select.name].push({
            value,
            attribute: root.getAttribute(select.name),
            token: tokens[select.name] && style.getPropertyValue(tokens[select.name]).trim(),
            scheme: style.colorScheme,
          });
        }
        select.selectedIndex = 0;
        select.dispatchEvent(new Event("change"));
      }
      return out;
    })()`);
    await page.close();
    const facets = { "data-palette": "color", "data-space": "space", "data-type": "type" };
    for (const [attribute, facet] of Object.entries(facets)) {
      const options = seen[attribute];
      assert.deepEqual(
        options.map(({ value, attribute: set }) => [value, set]),
        FULL[facet].map((name) => [name, name]),
        attribute,
      );
      // Each profile's token differs from every other's, so each switch took effect.
      assert.equal(new Set(options.map(({ token }) => token)).size, options.length, attribute);
    }
    assert.deepEqual(
      seen["data-scheme"].map(({ value, attribute, scheme }) => [value, attribute, scheme]),
      [
        ["", null, "light dark"],
        ["light", "light", "light"],
        ["dark", "dark", "dark"],
      ],
    );
  });

  test("each sheet is self-layered and @import-free, and a shadow root adopts it alone", async () => {
    const page = await browser.open(`${server.origin}/demo/tools.html`);
    const adopted = await page.evaluate(`import("/test/browser/support/computed-styles.js")
      .then((m) => m.adopt("/dist"))`);
    await page.close();
    for (const concern of concerns) {
      assert.equal(adopted[concern].imports, 0, `${concern}.css holds an @import`);
      assert.deepEqual(adopted[concern].rules, [`@layer foundation.${concern}`], concern);
    }
    // A var() that found no token through the shadow boundary would leave a length 0px.
    assert.equal(adopted.meta.display, "inline-block");
    assert.notEqual(adopted.meta["padding-left"], "0px");
    assert.equal(adopted.structure.display, "grid");
    assert.notEqual(adopted.structure["row-gap"], "normal");
    assert.equal(adopted.utilities["overflow-y"], "auto");
    assert.notEqual(adopted.utilities["padding-right"], "0px");
  });
});
