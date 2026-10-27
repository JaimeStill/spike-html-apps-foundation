// The reader's stored theme choice, applied to the root before first paint, kept in storage, and
// followed across tabs; and <sl-theme-menu>, the thin element that opens the menu.
//
// A page loads it render-blocking, after the registration module that matches its CSS entry:
//
//   <script type="module" blocking="render" src=".../register-full.js"></script>
//   <script type="module" blocking="render" src=".../preferences.js"></script>
//
// Module scripts run in document order, so the registry lists the page's profiles when this module
// runs, and blocking="render" holds first paint until it has applied the stored choice: no flash of
// the default profile. Its bytes delay first paint, so it holds only that: apply, persistence, the
// storage event, and the thin element. The menu itself is theme-menu.ts, fetched the first time the
// menu opens. Without storage, or without this module, the page renders its defaults: preferences
// are progressive enhancement.
//
// A choice is { color, space, type, scheme }: a registered profile name per facet, as its
// data-palette, data-space, or data-type value, and a scheme of system, light, or dark, as
// data-scheme, where system means no data-scheme. Every page on an origin shares one choice, as
// JSON under KEY in localStorage.
// Adapted from spike-html-design (fe75220): modules/preferences.js.

import { define } from "./dom.ts";
import { DEFAULTS, FACETS, profiles } from "./registry.ts";
import type { Facet } from "./registry.ts";
import type * as Menu from "./theme-menu.ts";

/** A key of a choice: each facet, and the scheme. */
export type Key = Facet | "scheme";

/** A choice as save() stores it: every key named. */
export type Choice = Record<Key, string>;

/** A choice as read() or another page hands it over: any key may be missing or hold anything. */
export type Loose = Partial<Record<Key, unknown>>;

/** The localStorage key, one per origin. */
export const KEY = "spike-html-apps-foundation.preferences";

/** Each facet's attribute, and the scheme's. */
export const ATTRIBUTES: Readonly<Record<Key, string>> = Object.freeze({
  color: "data-palette",
  space: "data-space",
  type: "data-type",
  scheme: "data-scheme",
});

/** The scheme's values, system (the default) first. */
export const SCHEMES: readonly string[] = Object.freeze(["system", "light", "dark"]);

let open = false;

/**
 * The stored choice, or null when nothing is stored or storage is blocked. Storage can throw
 * (blocked, or a sandboxed page) and its value can be anything another page wrote, so either reads
 * as nothing stored.
 */
export function read(): Loose | null {
  try {
    const choice: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return choice && typeof choice === "object" ? (choice as Loose) : null;
  } catch {
    return null;
  }
}

/**
 * Applies the choice to el, the root by default, without saving it. Each facet's attribute is set
 * to the choice's name when this page registered it and removed otherwise, so a name only another
 * page registered falls back to this page's default (DEFAULTS, which the CSS applies with no
 * attribute) and stays in storage. A scheme of light or dark sets data-scheme; system, or anything
 * else, removes it.
 */
export function apply(choice: Loose | null, el: Element = document.documentElement): void {
  for (const facet of FACETS) {
    const name = choice?.[facet];
    if (typeof name === "string" && profiles(facet).includes(name)) {
      el.setAttribute(ATTRIBUTES[facet], name);
    } else el.removeAttribute(ATTRIBUTES[facet]);
  }
  const scheme = choice?.scheme;
  if (typeof scheme === "string" && SCHEMES.includes(scheme) && scheme !== SCHEMES[0]) {
    el.setAttribute(ATTRIBUTES.scheme, scheme);
  } else el.removeAttribute(ATTRIBUTES.scheme);
}

/** Stores the choice's four keys, each facet's default and the system scheme filling a gap, and
 * returns whether storage took it. */
export function save(choice: Partial<Choice> | null): boolean {
  const stored = { scheme: choice?.scheme ?? SCHEMES[0] } as Choice;
  for (const facet of FACETS) stored[facet] = choice?.[facet] ?? DEFAULTS[facet];
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/** Marks the menu open or closed; while open, another tab's save is ignored here, and the menu's
 * Save or Cancel settles it. */
export function setOpen(value: boolean): void {
  open = Boolean(value);
}

/** Whether the menu is open. */
export function isOpen(): boolean {
  return open;
}

// Before first paint: the stored choice, if any. With nothing stored the root keeps whatever the
// page wrote on it.
const stored = read();
if (stored) apply(stored);

// Another tab's save fires storage here, never in the tab that saved. The open menu ignores it: its
// Save overwrites it, and its Cancel restores read(), the other tab's choice included. A cleared
// key (newValue null) restores the defaults.
addEventListener("storage", (event) => {
  if (open || (event.key !== KEY && event.key !== null)) return;
  apply(read() ?? {});
});

let menu: Promise<typeof Menu | null> | null = null;

/** Imports theme-menu.ts once, resolving to it, or to null after a failure the next call retries. */
function load(): Promise<typeof Menu | null> {
  menu ??= import("./theme-menu.ts").catch((error: unknown) => {
    // Forgotten, so the next open retries, and the browser requests the module again.
    menu = null;
    console.warn("preferences: the theme menu module failed to load", error);
    return null;
  });
  return menu;
}

/**
 * The thin element the page places once, in light DOM, with an id its own button names:
 * <button commandfor="theme" command="--open">. It opens on that invoker command, and only then
 * fetches theme-menu.ts, whose open(element) builds the menu inside it. It binds no key: a page
 * binds T by giving that button data-keys="t" and loading keys.js, which clicks it. The menu module
 * marks itself open and closed through setOpen.
 */
export class ThemeMenu extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("command", (event) => {
      if ((event as CommandEvent).command === "--open") this.show();
    });
  }

  /**
   * Loads the menu module once, on first open, and opens the menu. A second call while the module
   * loads opens the menu once, since the menu's open ignores an element whose menu is already open.
   */
  show(): void {
    if (open) return;
    load().then((module) => module?.open(this));
  }
}

define("sl-theme-menu", ThemeMenu);
