// The registry's store, shared by every copy of the module. A case's page is a fresh copy, imported
// by a URL no other case uses, after the store is removed from the global object.
// Adapted from spike-html-packages-foundation (5dd8a58): test/unit/registry.test.js, in TypeScript.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type * as Registry from "../../src/registry.ts";
import type { Store } from "../../src/registry.ts";

const url = new URL("../../src/registry.ts", import.meta.url).href;
const KEY = Symbol.for("spike-html-apps-foundation.registry");
/** The global object, with the store at its key, as the registry reaches it. */
const scope = globalThis as typeof globalThis & Record<symbol, Store | undefined>;

/** The names v0.7.0's lean and full registration modules list, per facet, in order. */
const LEAN = { color: ["flexoki"], space: ["regular"], type: ["mono"] };
const FULL = {
  color: ["flexoki", "primer", "catppuccin", "everforest"],
  space: ["regular", "compact"],
  type: ["mono", "sans"],
};

/** A copy of the registry by the URL with the query, a module instance of its own. */
const copy = (query: string): Promise<typeof Registry> => import(`${url}?${query}`);

let pages = 0;

/** A fresh page: the store removed, its own copy of the registry, and a copy() of that copy. */
async function page() {
  delete scope[KEY];
  const name = `page=${++pages}`;
  return { registry: await copy(name), copy: (suffix: string) => copy(`${name}&${suffix}`) };
}

/** Registers what v0.7.0's modules/register.js does, through the registry given. */
function registerLean({ register }: typeof Registry) {
  register("color", "flexoki");
  register("space", "regular");
  register("type", "mono");
}

/** Registers what v0.7.0's modules/register-full.js does, through the registry given. */
function registerFull({ register }: typeof Registry) {
  for (const name of ["flexoki", "primer", "catppuccin", "everforest"]) register("color", name);
  for (const name of ["regular", "compact"]) register("space", name);
  for (const name of ["mono", "sans"]) register("type", name);
}

/** The store at its global key, as JSON. */
const STORE = () => JSON.parse(JSON.stringify(scope[KEY]));

/** Each facet's names as the registry given lists them. */
const listed = ({ FACETS, profiles }: typeof Registry) =>
  Object.fromEntries(FACETS.map((facet) => [facet, profiles(facet)]));

describe("registry", () => {
  test("two copies of the registry from two URLs share one store", async () => {
    // registry.html: copies a and b, the lean module run twice and the full module through the
    // page's copy, and an extension registering twice through a.
    const { registry, copy } = await page();
    const a = await copy("a");
    const b = await copy("b");
    registerLean(registry);
    registerLean(registry);
    registerFull(registry);
    a.register("color", "extension");
    a.register("color", "extension");
    assert.notEqual(a.register, b.register);
    // Copy b lists what the registration modules and copy a registered, each name once though
    // the lean module ran twice and the extension registered twice.
    const expected = { ...FULL, color: [...FULL.color, "extension"] };
    assert.deepEqual(listed(b), expected);
    assert.deepEqual(STORE(), expected);
  });

  test("the store is a plain object of the three facets' name lists", async () => {
    registerLean((await page()).registry);
    const store = scope[KEY];
    assert.ok(store, "registering made the store");
    assert.deepEqual(
      [
        Object.getPrototypeOf(store) === Object.prototype,
        Object.keys(store),
        Object.values(store).every(Array.isArray),
      ],
      [true, ["color", "space", "type"], true],
    );
  });

  test("a copy that finds a store already there uses it, and adds a facet it lacks", async () => {
    // A store an older copy made, with no type facet: the new copy keeps it, and gives type its
    // list on first use.
    delete scope[KEY];
    const older = { color: ["flexoki"], space: [] };
    scope[KEY] = older;
    const registry = await copy(`page=${++pages}`);
    registry.register("type", "mono");
    assert.equal(scope[KEY], older);
    assert.deepEqual(STORE(), { color: ["flexoki"], space: [], type: ["mono"] });
  });

  test("profiles() returns a copy, so changing it changes no store", async () => {
    const { registry } = await page();
    registerLean(registry);
    registry.profiles("color").push("mutated");
    assert.deepEqual(registry.profiles("color"), ["flexoki"]);
    assert.deepEqual(STORE(), LEAN);
  });

  test("register throws on an unknown facet or an empty name, and registers nothing", async () => {
    const { registry } = await page();
    registerLean(registry);
    const thrown = (call: () => unknown) => {
      try {
        call();
        return null;
      } catch (error) {
        return error instanceof Error ? [error.name, error.message] : [error];
      }
    };
    // A caller outside TypeScript can name any facet, which the types refuse.
    assert.deepEqual(
      // @ts-expect-error scheme is no facet.
      thrown(() => registry.register("scheme", "dark")),
      ["TypeError", "registry: unknown facet scheme; expected one of color, space, type"],
    );
    assert.deepEqual(
      // @ts-expect-error palette is no facet.
      thrown(() => registry.profiles("palette")),
      ["TypeError", "registry: unknown facet palette; expected one of color, space, type"],
    );
    assert.deepEqual(
      thrown(() => registry.register("color", "")),
      ["TypeError", "registry: a color profile's name must be a non-empty string"],
    );
    assert.deepEqual(STORE(), LEAN);
  });
});
