import type { Facet } from "./registry.ts";
/** One rule a profile breaks, and what broke, in words. */
export interface Failure {
    rule: string;
    message: string;
}
/** Each facet's rule names, in the order check() reports them. */
export declare const RULES: Readonly<Record<Facet, readonly string[]>>;
/** The rules facet's profile `name` breaks, each at most once, in RULES's order: [] conforms. */
export declare function check(facet: Facet, name: string): Promise<Failure[]>;
