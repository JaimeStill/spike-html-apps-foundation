// The reader's theme choice, applied to the root before first paint, kept in localStorage, and
// followed across tabs; and <sl-theme-menu>, the thin element that loads the menu on first open. A
// page loads it with blocking="render" after its registration module, so the registry is full when
// it runs and no default flashes; its bytes delay first paint, so it holds nothing more.
// Adapted from spike-html-design (fe75220): modules/preferences.js.
import { define } from "./dom.js";
import { DEFAULTS, FACETS, profiles } from "./registry.js";
/** The localStorage key, so every page on an origin shares one choice. */
export const KEY = "spike-html-apps-foundation.preferences";
/** Each facet's attribute, and the scheme's. */
export const ATTRIBUTES = Object.freeze({
    color: "data-palette",
    space: "data-space",
    type: "data-type",
    scheme: "data-scheme",
});
/** The scheme's values, system (the default) first. */
export const SCHEMES = Object.freeze(["system", "light", "dark"]);
let open = false;
/** The stored choice, or null when nothing is stored, it isn't a choice, or storage is blocked. */
export function read() {
    // Storage throws when blocked or sandboxed, and holds whatever another page wrote.
    try {
        const choice = JSON.parse(localStorage.getItem(KEY) ?? "null");
        return choice && typeof choice === "object" ? choice : null;
    }
    catch {
        return null;
    }
}
/** Applies the choice to el, the root by default, without saving it. */
export function apply(choice, el = document.documentElement) {
    // A name this page didn't register removes the attribute, so the facet falls back to the default
    // the CSS applies with none, and the name stays in storage for the pages that registered it.
    for (const facet of FACETS) {
        const name = choice?.[facet];
        if (typeof name === "string" && profiles(facet).includes(name)) {
            el.setAttribute(ATTRIBUTES[facet], name);
        }
        else
            el.removeAttribute(ATTRIBUTES[facet]);
    }
    // System, or anything not a scheme, leaves data-scheme off.
    const scheme = choice?.scheme;
    if (typeof scheme === "string" && SCHEMES.includes(scheme) && scheme !== SCHEMES[0]) {
        el.setAttribute(ATTRIBUTES.scheme, scheme);
    }
    else
        el.removeAttribute(ATTRIBUTES.scheme);
}
/** Stores the choice, defaults filling its gaps, and returns whether storage took it. */
export function save(choice) {
    const stored = { scheme: choice?.scheme ?? SCHEMES[0] };
    for (const facet of FACETS)
        stored[facet] = choice?.[facet] ?? DEFAULTS[facet];
    try {
        localStorage.setItem(KEY, JSON.stringify(stored));
        return true;
    }
    catch {
        return false;
    }
}
/** Marks the menu open or closed: while it is open, the menu settles another tab's save. */
export function setOpen(value) {
    open = Boolean(value);
}
/** Whether the menu is open. */
export function isOpen() {
    return open;
}
// Before first paint: the stored choice, if any. With nothing stored the root keeps whatever the
// page wrote on it.
const stored = read();
if (stored)
    apply(stored);
// Another tab's save fires storage here, never in the tab that saved. The open menu ignores it: its
// Save overwrites it, and its Cancel restores read(), the other tab's choice included. A cleared
// key (newValue null) restores the defaults.
addEventListener("storage", (event) => {
    if (open || (event.key !== KEY && event.key !== null))
        return;
    apply(read() ?? {});
});
let menu = null;
/** Imports theme-menu.ts once, resolving to it, or to null after a failure the next call retries. */
function load() {
    menu ??= import("./theme-menu.js").catch((error) => {
        // Forgotten, so the next open retries, and the browser requests the module again.
        menu = null;
        console.warn("preferences: the theme menu module failed to load", error);
        return null;
    });
    return menu;
}
/** <sl-theme-menu>: opens the menu on the invoker command "--open", fetching it the first time. */
export class ThemeMenu extends HTMLElement {
    // It binds no key: a page binds T by giving its --open button data-keys="t" and loading keys.js,
    // which clicks it.
    constructor() {
        super();
        this.addEventListener("command", (event) => {
            if (event.command === "--open")
                this.show();
        });
    }
    /** Opens the menu, loading its module on the first call. */
    show() {
        // A second call while the module loads opens one menu: open() ignores an element already open.
        if (open)
            return;
        load().then((module) => module?.open(this));
    }
}
define("sl-theme-menu", ThemeMenu);
