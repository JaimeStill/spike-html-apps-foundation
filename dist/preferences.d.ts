import type { Facet } from "./registry.ts";
/** A key of a choice: each facet, and the scheme. */
export type Key = Facet | "scheme";
/** A choice as save() stores it: a registered name per facet, and system, light, or dark. */
export type Choice = Record<Key, string>;
/** A choice as read() or another page hands it over: any key may be missing or hold anything. */
export type Loose = Partial<Record<Key, unknown>>;
/** The localStorage key, so every page on an origin shares one choice. */
export declare const KEY = "spike-html-apps-foundation.preferences";
/** Each facet's attribute, and the scheme's. */
export declare const ATTRIBUTES: Readonly<Record<Key, string>>;
/** The scheme's values, system (the default) first. */
export declare const SCHEMES: readonly string[];
/** The stored choice, or null when nothing is stored, it isn't a choice, or storage is blocked. */
export declare function read(): Loose | null;
/** Applies the choice to el, the root by default, without saving it. */
export declare function apply(choice: Loose | null, el?: Element): void;
/** Stores the choice, defaults filling its gaps, and returns whether storage took it. */
export declare function save(choice: Partial<Choice> | null): boolean;
/** Marks the menu open or closed: while it is open, the menu settles another tab's save. */
export declare function setOpen(value: boolean): void;
/** Whether the menu is open. */
export declare function isOpen(): boolean;
/** <sl-theme-menu>: opens the menu on the invoker command "--open", fetching it the first time. */
export declare class ThemeMenu extends HTMLElement {
    constructor();
    /** Opens the menu, loading its module on the first call. */
    show(): void;
}
