// The conformance check: whether a profile an extension adds keeps its facet's contract, in a live
// page. It imports nothing at runtime and reads computed values only, never a sheet's rules, which
// chromium hides from a file:// page and across origins, so it runs alike from file://, a CDN, a
// local server, and node_modules.
// Adapted from spike-html-design (fe75220): modules/conformance.js.

import type { Facet } from "./registry.ts";

/** One rule a profile breaks, and what broke, in words. */
export interface Failure {
  rule: string;
  message: string;
}

/** The registry's facets, a copy, since this module imports nothing at runtime. */
const FACETS: readonly Facet[] = ["color", "space", "type"];

/** Each facet's rule names, in the order check() reports them. */
export const RULES: Readonly<Record<Facet, readonly string[]>> = Object.freeze({
  color: Object.freeze([
    "tokens", // each of the sixteen tokens is a color, in light and in dark
    "color-only", // no space or type token is set
    "layer", // the block is in foundation.tokens.color
    "specificity", // the selector is :where([data-palette="<name>"])
    "paints", // a scope paints its background from its --bg and its text from its --fg
    "surfaces", // --bg, --bg-1, and --bg-2 each step closer to --fg's luminance
    "registered", // the registry lists the name under color
  ]),
  space: Object.freeze([
    "tokens", // --space-base, --line-s, --line-m, and --radius-base are lengths
    "space-only",
    "layer",
    "specificity",
    "scale", // the nine steps derived from --space-base ascend strictly
    "registered",
  ]),
  type: Object.freeze([
    "tokens", // the four role fonts and four role leadings are set
    "type-only",
    "layer",
    "specificity",
    "scale", // the text steps ascend strictly, and each role font resolves to a family
    "registered",
  ]),
});

/** The sixteen color tokens, in the facet's order. */
const COLOR = [
  "--bg",
  "--bg-1",
  "--bg-2",
  "--border",
  "--border-2",
  "--fg",
  "--fg-2",
  "--fg-3",
  "--red",
  "--orange",
  "--yellow",
  "--green",
  "--cyan",
  "--blue",
  "--purple",
  "--magenta",
];

/** The space facet's nine spacing steps, smallest first. */
const STEPS = [
  "--space-3xs",
  "--space-2xs",
  "--space-xs",
  "--space-s",
  "--space-m",
  "--space-l",
  "--space-xl",
  "--space-2xl",
  "--space-3xl",
];

/** The four values a space profile sets, which the rest derive from. */
const SPACE_VALUES = ["--space-base", "--line-s", "--line-m", "--radius-base"];

/** The space facet's tokens: the values its profiles set and every token derived from them. */
const SPACE = [
  "--space-fluid",
  ...SPACE_VALUES,
  ...STEPS,
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-full",
];

/** The type facet's eight text steps, smallest first. */
const TEXT = [
  "--text-xs",
  "--text-s",
  "--text-m",
  "--text-l",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-4xl",
];

/** The four role fonts. */
const FONTS = ["--font-body", "--font-heading", "--font-ui", "--font-code"];
/** The eight values a type profile sets. */
const TYPE_VALUES = [
  ...FONTS,
  "--leading-body",
  "--leading-heading",
  "--leading-ui",
  "--leading-code",
];

/** The type facet's tokens: the values its profiles set and the text scale. */
const TYPE = ["--type-fluid", ...TEXT, ...TYPE_VALUES];

/** What check() needs to know of a facet. */
interface Spec {
  /** The attribute that names a profile of the facet. */
  attribute: string;
  /** The values a profile sets. */
  values: readonly string[];
  /** The other facets' tokens, which a profile never sets. */
  others: readonly string[];
  /**
   * The facet's tokens declared on the root alone, which the check's host leaves to inherit from
   * it, as a scope under the profile reads them: the fluid expansions, and the text scale.
   */
  rooted: readonly string[];
  /** The layer after the facet's sub-layer, in the package's order. */
  next: string;
  /** The schemes a scope is read in, or null for one scope that sets none. */
  schemes: readonly (string | null)[];
}

const SPECS: Readonly<Record<Facet, Spec>> = {
  color: {
    attribute: "data-palette",
    values: COLOR,
    others: [...SPACE, ...TYPE],
    rooted: [],
    next: "foundation.tokens.space",
    schemes: ["light", "dark"],
  },
  space: {
    attribute: "data-space",
    values: SPACE_VALUES,
    others: [...COLOR, ...TYPE],
    rooted: ["--space-fluid"],
    next: "foundation.tokens.type",
    schemes: [null],
  },
  type: {
    attribute: "data-type",
    values: TYPE_VALUES,
    others: [...COLOR, ...SPACE],
    rooted: ["--type-fluid", ...TEXT],
    next: "foundation.reset",
    schemes: [null],
  },
};

/** The attribute that marks the check's own scopes. */
const PROBE = "data-conformance-probe";
/** The value the check's own rules set every value token of the facet to, on its scopes. */
const SENTINEL = "conformance-probe";

/** The color a probe reads when a token is unset or no color: no palette holds one 0.4% opaque. */
const MISSING = "rgba(1, 2, 3, 0.004)";

/** The family a font probe inherits when a token is unset or no family: no profile's. */
const FAMILY = `"${SENTINEL}"`;

/**
 * The check's own stylesheet for the facet: every value token set to SENTINEL at zero specificity
 * on a scope marked same, later in the facet's layer than any profile, and on one marked later, in
 * the layer after it. The layer statement names both layers in the package's order and creates
 * neither when the page's entry already has.
 */
function style(facet: Facet): string {
  const { values, next } = SPECS[facet];
  const sentinels = values.map((token) => `${token}: ${SENTINEL};`).join(" ");
  const layer = `foundation.tokens.${facet}`;
  return `@layer ${layer}, ${next};
@layer ${layer} { :where([${PROBE}="same"]) { ${sentinels} } }
@layer ${next} { :where([${PROBE}="later"]) { ${sentinels} } }`;
}

/** The rules facet's profile `name` breaks, each at most once, in RULES's order: [] conforms. */
export async function check(facet: Facet, name: string): Promise<Failure[]> {
  if (!FACETS.includes(facet)) {
    throw new TypeError(
      `conformance: unknown facet ${facet}; expected one of ${FACETS.join(", ")}`,
    );
  }
  if (typeof name !== "string" || name === "") {
    throw new TypeError(`conformance: a ${facet} profile's name must be a non-empty string`);
  }
  // Every stylesheet has applied once the page has loaded.
  if (document.readyState !== "complete") {
    await new Promise((resolve) => addEventListener("load", resolve, { once: true }));
  }
  return probe(facet, name);
}

/** One scope of the profile, in a scheme or none, with a probe element two levels inside it. */
interface Scope {
  scheme: string | null;
  scope: HTMLElement;
  probe: HTMLElement;
}

/** The probes check() reads: a scope per scheme, and the two the layer rules read. */
interface Probes {
  scopes: Scope[];
  same: HTMLElement;
  later: HTMLElement;
}

/** Builds the probes for facet's profile name, reads them, and removes them. */
function probe(facet: Facet, name: string): Failure[] {
  const spec = SPECS[facet];
  const sheet = document.createElement("style");
  sheet.textContent = style(facet);
  // The host resets every token but the facet's rooted ones, so a scope inside it holds only what
  // the profile, or the check's own rules, set there. It renders nothing: getComputedStyle still
  // computes a subtree that is not displayed.
  const host = document.createElement("div");
  host.style.display = "none";
  for (const token of [...spec.values, ...spec.others]) {
    if (!spec.rooted.includes(token)) host.style.setProperty(token, "initial");
  }
  const scope = (scheme: string | null, marker?: string) => {
    const el = document.createElement("div");
    el.setAttribute(spec.attribute, name);
    if (scheme) el.style.colorScheme = scheme;
    if (marker) el.setAttribute(PROBE, marker);
    return host.appendChild(el);
  };
  const scopes = spec.schemes.map((scheme) => {
    const el = scope(scheme);
    // A color token that is unset falls back to MISSING, and one that is set but no color is
    // invalid at computed-value time, so the probe inherits MISSING from its parent; a font token
    // likewise inherits FAMILY.
    const parent = el.appendChild(document.createElement("div"));
    parent.style.color = MISSING;
    parent.style.fontFamily = FAMILY;
    return { scheme, scope: el, probe: parent.appendChild(document.createElement("div")) };
  });
  const same = scope(null, "same");
  const later = scope(null, "later");
  document.head.append(sheet);
  document.documentElement.append(host);
  try {
    return failures(facet, name, { scopes, same, later });
  } finally {
    host.remove();
    sheet.remove();
  }
}

/** The rules facet's profile name breaks, read from the probes, in RULES's order. */
function failures(facet: Facet, name: string, probes: Probes): Failure[] {
  const spec = SPECS[facet];
  const failed: Failure[] = [];
  const fail = (rule: string, message: string) =>
    failed.push({ rule, message: `${name}: ${message}` });
  const own = getComputedStyle(probes.scopes[0].scope);
  const layer = `foundation.tokens.${facet}`;

  // tokens, and what the derived rules read of the tokens that pass it.
  const derive = TOKENS[facet](probes, fail);

  const others = spec.others.filter((token) => own.getPropertyValue(token).trim() !== "");
  if (others.length) {
    const kinds = { color: "space or type", space: "color or type", type: "color or space" };
    fail(`${facet}-only`, `sets ${kinds[facet]} tokens: ${others.join(", ")}`);
  }

  // The values the profile sets on its scope, as the layer and specificity rules read them.
  const set = spec.values.filter((token) => own.getPropertyValue(token).trim() !== "");
  const beaten = (el: HTMLElement) => {
    const computed = getComputedStyle(el);
    return set.filter((token) => computed.getPropertyValue(token).trim() !== SENTINEL);
  };
  const outLayered = set.length ? beaten(probes.later) : [];
  if (outLayered.length) {
    fail(
      "layer",
      `beats a zero-specificity rule in the layer after ${layer} for ${outLayered.join(", ")}, so it is not in that layer`,
    );
  }
  const outSpecific = set.length && !outLayered.length ? beaten(probes.same) : [];
  if (outSpecific.length) {
    fail(
      "specificity",
      `beats a later zero-specificity rule in ${layer} for ${outSpecific.join(", ")}, so its selector is more specific than :where([${spec.attribute}="${name}"])`,
    );
  }

  derive();

  const store = (globalThis as Record<symbol, unknown>)[
    Symbol.for("spike-html-apps-foundation.registry")
  ] as Partial<Record<Facet, string[]>> | undefined;
  if (!store?.[facet]?.includes(name)) {
    fail("registered", `is not registered under ${facet} in the registry`);
  }
  return failed;
}

/** A rule's failure, reported under the profile's name. */
type Fail = (rule: string, message: string) => void;

/**
 * Each facet's tokens rule, run on the probes: it reports what fails, and returns the facet's
 * derived rules, bound to what they read of the tokens that passed, to run after specificity. A
 * derived rule skips a token that failed tokens, so a missing token fails tokens alone.
 */
const TOKENS: Readonly<Record<Facet, (probes: Probes, fail: Fail) => () => void>> = {
  color: colorTokens,
  space: spaceTokens,
  type: typeTokens,
};

/** The color tokens rule, reading each token in each scheme; returns paints and surfaces. */
function colorTokens({ scopes }: Probes, fail: Fail): () => void {
  // Each scheme's computed color per token, or null when the token is unset or no color there.
  const colors = scopes.map(({ scheme, probe }) => {
    const resolved: Record<string, string | null> = {};
    for (const token of COLOR) {
      probe.style.color = `var(${token}, ${MISSING})`;
      const value = getComputedStyle(probe).color;
      resolved[token] = value === getComputedStyle(probe.parentElement!).color ? null : value;
    }
    return { scheme, resolved };
  });
  const broken = COLOR.filter((token) => colors.some(({ resolved }) => resolved[token] === null));
  if (broken.length) {
    const where = broken.map((token) => {
      const off = colors.filter(({ resolved }) => resolved[token] === null);
      return `${token} (${off.map(({ scheme }) => scheme).join(", ")})`;
    });
    fail("tokens", `sets no color in a scheme for ${where.join(", ")}`);
  }

  return () => {
    const unpainted = [];
    for (const [i, { scheme, scope }] of scopes.entries()) {
      const { resolved } = colors[i];
      const painted = getComputedStyle(scope);
      if (resolved["--bg"] && painted.backgroundColor !== resolved["--bg"]) {
        unpainted.push(
          `background ${painted.backgroundColor} is not --bg ${resolved["--bg"]} in ${scheme}`,
        );
      }
      if (resolved["--fg"] && painted.color !== resolved["--fg"]) {
        unpainted.push(`text ${painted.color} is not --fg ${resolved["--fg"]} in ${scheme}`);
      }
    }
    if (unpainted.length) fail("paints", `a scope's ${unpainted.join("; ")}`);

    const unordered = [];
    for (const { scheme, resolved } of colors) {
      const surfaces = ["--bg", "--bg-1", "--bg-2"];
      if (![...surfaces, "--fg"].every((token) => resolved[token])) continue;
      const text = luminance(resolved["--fg"]!);
      const distance = surfaces.map((token) => Math.abs(luminance(resolved[token]!) - text));
      if (!(distance[0] > distance[1] && distance[1] > distance[2])) unordered.push(scheme);
    }
    if (unordered.length) {
      fail(
        "surfaces",
        `--bg, --bg-1 and --bg-2 do not step toward --fg in ${unordered.join(", ")}`,
      );
    }
  };
}

/** The space tokens rule, reading each of the four values as a length; returns scale. */
function spaceTokens({ scopes: [{ probe }] }: Probes, fail: Fail): () => void {
  const broken = SPACE_VALUES.filter((token) => length(probe, token) === null);
  if (broken.length) fail("tokens", `sets no length for ${broken.join(", ")}`);

  return () => {
    if (broken.includes("--space-base")) return;
    const steps = STEPS.map((token) => length(probe, token));
    if (!ascending(steps)) {
      fail(
        "scale",
        `--space-3xs to --space-3xl compute to ${shown(steps)}, which do not strictly ascend`,
      );
    }
  };
}

/** The type tokens rule, reading each of the eight values as set; returns scale. */
function typeTokens({ scopes: [{ scope, probe }] }: Probes, fail: Fail): () => void {
  const own = getComputedStyle(scope);
  const broken = TYPE_VALUES.filter((token) => own.getPropertyValue(token).trim() === "");
  if (broken.length) fail("tokens", `sets no value for ${broken.join(", ")}`);

  return () => {
    const problems = [];
    const steps = TEXT.map((token) => length(probe, token));
    if (!ascending(steps)) {
      problems.push(
        `--text-xs to --text-4xl compute to ${shown(steps)}, which do not strictly ascend`,
      );
    }
    const inherited = getComputedStyle(probe.parentElement!).fontFamily;
    const unresolved = FONTS.filter((token) => {
      if (broken.includes(token)) return false;
      probe.style.fontFamily = `var(${token})`;
      const family = getComputedStyle(probe).fontFamily;
      return family === "" || family === inherited;
    });
    probe.style.fontFamily = "";
    if (unresolved.length) problems.push(`${unresolved.join(", ")} resolve to no font family`);
    if (problems.length) fail("scale", problems.join("; "));
  };
}

/**
 * The length, in px, that token computes to on the probe, or null when it is unset or no length
 * there. A margin that reads an invalid token computes to 0 whatever is added to it,
 * while a length's two sums differ by the 1px between them.
 */
function length(probe: HTMLElement, token: string): number | null {
  const sum = (px: number) => {
    probe.style.marginLeft = `calc(var(${token}) + ${px}px)`;
    return Number.parseFloat(getComputedStyle(probe).marginLeft);
  };
  const [one, two] = [sum(1), sum(2)];
  probe.style.marginLeft = "";
  return Math.abs(two - one - 1) < 0.01 ? one - 1 : null;
}

/** Whether every value is a length, each strictly greater than the one before. */
function ascending(values: (number | null)[]): boolean {
  return values.every((value, i) => value !== null && (i === 0 || value > values[i - 1]!));
}

/** Lengths written for a message, in px, unresolved ones as such. */
function shown(values: (number | null)[]): string {
  return values
    .map((value) => (value === null ? "no length" : `${+value.toFixed(3)}px`))
    .join(", ");
}

/** The one-pixel canvas luminance() draws on, made at its first call. */
let context: CanvasRenderingContext2D | null = null;

/**
 * A computed color's WCAG relative luminance, 0 to 1. The color is drawn into a one-pixel canvas
 * and read back as sRGB, so any notation a computed value takes reads alike.
 */
function luminance(color: string): number {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
