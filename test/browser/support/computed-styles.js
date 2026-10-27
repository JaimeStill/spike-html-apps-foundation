// The tools cases' in-page half: imported into demo/tools.html, it reads every element's computed
// style. Each export returns plain JSON for evaluate(); differences() also runs on node. :hover is
// forced from outside, through the DevTools Protocol, so a reading takes the page as it is.
// Adapted from spike-html-packages-foundation (5dd8a58): test/browser/support/computed-styles.js.

/** The three lateral-concern sheets, by file name. */
export const concerns = ["meta", "structure", "utilities"];

/** Every rule in the list, depth first, into imported sheets and grouping rules. */
function* rules(list) {
  for (const rule of list) {
    yield rule;
    if (rule instanceof CSSImportRule) {
      if (rule.styleSheet) yield* rules(rule.styleSheet.cssRules);
    } else if (rule.cssRules) {
      yield* rules(rule.cssRules);
    }
  }
}

/** Every rule of every sheet the document has. */
const allRules = () => [...document.styleSheets].flatMap((sheet) => [...rules(sheet.cssRules)]);

/** Each facet's profile attribute. */
const attributes = { color: "data-palette", space: "data-space", type: "data-type" };

/** The profiles the page's sheets define, per facet, by the names their selectors match, in order. */
export function defined() {
  const out = Object.fromEntries(Object.keys(attributes).map((facet) => [facet, []]));
  for (const rule of allRules()) {
    if (!(rule instanceof CSSStyleRule)) continue;
    for (const [facet, attribute] of Object.entries(attributes)) {
      for (const [, name] of rule.selectorText.matchAll(
        new RegExp(`\\[${attribute}="([^"]+)"\\]`, "g"),
      )) {
        if (!out[facet].includes(name)) out[facet].push(name);
      }
    }
  }
  return out;
}

/** Points the page's stylesheet link at the URL, resolving once it and its imports have loaded. */
export async function useSheets(href) {
  const link = document.querySelector('link[rel="stylesheet"]');
  const loaded = new Promise((resolve, reject) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => reject(new Error(`${href} didn't load`)), { once: true });
  });
  link.href = href;
  await loaded;
  const missing = allRules().filter((rule) => rule instanceof CSSImportRule && !rule.styleSheet);
  if (missing.length > 0) throw new Error(`no sheet for ${missing.map((r) => r.href).join(", ")}`);
}

/**
 * Names a profile and a scheme on the page. The scheme's data-scheme goes on the root. The
 * profile's attribute goes on the root, or, given `sentinels`, on the body, with every token named
 * there set on the root to a value no profile holds, by an unlayered adopted sheet that beats every
 * layer: the body then shows each token its profile declares itself, and none it inherits from the
 * default's block.
 */
export function scope({ attribute, name, scheme, sentinels }) {
  const root = document.documentElement;
  if (scheme) root.setAttribute("data-scheme", scheme);
  if (!attribute) return;
  if (!sentinels) {
    root.setAttribute(attribute, name);
    return;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`:root { ${sentinels.map((token) => `${token}: sentinel;`).join(" ")} }`);
  document.adoptedStyleSheets = [sheet];
  document.body.setAttribute(attribute, name);
}

/** Every element's computed properties, each element named by its position, tag, and classes. */
export function reading() {
  const out = {};
  for (const [i, element] of [...document.querySelectorAll("*")].entries()) {
    const name = `${i} ${element.localName}${[...element.classList].map((c) => `.${c}`).join("")}`;
    const style = getComputedStyle(element);
    const values = {};
    for (const property of style) {
      const value = style.getPropertyValue(property);
      // A custom property keeps its source's whitespace, which is formatting, not style.
      values[property] = property.startsWith("--") ? value.trim().replace(/\s+/g, " ") : value;
    }
    out[name] = values;
  }
  return out;
}

/** One line per element and property whose values differ between two readings. */
export function differences(a, b) {
  const lines = [];
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[name] ?? {};
    const y = b[name] ?? {};
    for (const property of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (x[property] !== y[property]) {
        lines.push(`${name} ${property}: ${x[property]} against ${y[property]}`);
      }
    }
  }
  return lines;
}

/** A declaration list split at the semicolons outside parentheses. */
function declarations(cssText) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cssText.length; i++) {
    if (cssText[i] === "(") depth++;
    else if (cssText[i] === ")") depth--;
    else if (cssText[i] === ";" && depth === 0) {
      out.push(cssText.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (cssText.slice(start).trim()) out.push(cssText.slice(start).trim());
  return out;
}

/**
 * Drops each declaration of the imported sheets whose URLs end in one of the suffixes, the
 * lateral-concern sheets by default, in turn, and counts how many differences from the reference
 * reading its absence makes.
 */
export function drops(reference, suffixes = concerns.map((concern) => `/${concern}.css`)) {
  const tried = [];
  const sheets = allRules()
    .filter((rule) => rule instanceof CSSImportRule && rule.styleSheet)
    .map((rule) => rule.styleSheet)
    .filter((sheet) => suffixes.some((suffix) => sheet.href.endsWith(suffix)));
  for (const sheet of sheets) {
    for (const rule of rules(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const whole = rule.style.cssText;
      const list = declarations(whole);
      for (const [i, declaration] of list.entries()) {
        rule.style.cssText = list.filter((_, j) => j !== i).join("; ");
        try {
          const differs = differences(reference, reading()).length;
          tried.push({ sheet: sheet.href, selector: rule.selectorText, declaration, differs });
        } finally {
          rule.style.cssText = whole;
        }
      }
    }
  }
  return tried;
}

/** One sample element per sheet, and the two properties read from it. */
const samples = {
  meta: ['<span class="button">a</span>', "display", "padding-left"],
  structure: ['<div class="field">a</div>', "display", "row-gap"],
  utilities: ['<div class="scroll-y">a</div>', "overflow-y", "padding-right"],
};

/**
 * Adopts each lateral-concern sheet alone into a shadow root, and reports how many imports its
 * source holds, its top-level rules, and its sample's two properties.
 */
export async function adopt(base) {
  const out = {};
  for (const concern of concerns) {
    const text = await (await fetch(`${base}/${concern}.css`)).text();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    const host = document.createElement("div");
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [sheet];
    const [markup, keyword, length] = samples[concern];
    root.innerHTML = markup;
    const style = getComputedStyle(root.firstElementChild);
    out[concern] = {
      imports: (text.replace(/\/\*[\s\S]*?\*\//g, "").match(/@import\b/g) ?? []).length,
      rules: [...sheet.cssRules].map((rule) =>
        rule instanceof CSSLayerBlockRule ? `@layer ${rule.name}` : rule.constructor.name,
      ),
      [keyword]: style.getPropertyValue(keyword),
      [length]: style.getPropertyValue(length),
    };
    host.remove();
  }
  return out;
}
