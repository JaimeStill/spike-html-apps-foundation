// The keys runtime and its help dialog from the package's dist/, pressed with real keys
// through the DevTools Protocol on test/fixtures/keys*.html.
// Adapted from spike-html-packages-foundation (5dd8a58): test/browser/keys.test.js, in TypeScript.

import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import type { FireDetail } from "@jaimestill/spike-html-apps-foundation/keys.js";

/** The repository root, which the server serves. */
const root = join(import.meta.dirname, "../..");

const KEYS = "/dist/keys.js";
const STORE = 'globalThis[Symbol.for("spike-html-apps-foundation.keys")]';
// The sequence wait the tests set, short so a test waits it out quickly.
const WAIT = 150;

let server: Server;
let browser: Browser;
const pages: Page[] = [];
const fixture = (name: string) => `${server.origin}/test/fixtures/${name}`;

before(async () => {
  server = await serve({ root });
  browser = await launch();
});
// Every fixture shares one origin, and so the reader's stored settings.
afterEach(async () => {
  for (const page of pages.splice(0)) {
    await page.evaluate("localStorage.clear()");
    await page.close();
  }
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

/** Opens a fixture with the wait set to WAIT, recording keys-fire and keys-sequence details. */
async function open(name = "keys.html"): Promise<Page> {
  const page = await browser.open(fixture(name));
  pages.push(page);
  await page.evaluate(`(() => {
    window.defaultWait = ${STORE}.wait;
    ${STORE}.wait = ${WAIT};
    window.fired = [];
    window.sequences = [];
    document.addEventListener("keys-fire", (event) => window.fired.push(event.detail));
    document.addEventListener("keys-sequence", (event) => window.sequences.push(event.detail));
  })()`);
  return page;
}

const MODIFIERS: Record<string, number> = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

/** A press's code and keyCode where its key's default isn't the one, whether it repeats, and the
 * modifiers held. */
interface PressInit {
  code?: string;
  repeat?: boolean;
  keyCode?: number;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/**
 * Sends a real key press: keyDown then keyUp, with a US layout's code for a letter or digit
 * unless given, and the text a character types when no Control or Meta is held.
 */
async function press(
  page: Page,
  key: string,
  { code, repeat = false, keyCode, ...held }: PressInit = {},
) {
  const modifiers = Object.entries(held).reduce(
    (bits, [name, on]) => bits | (on ? MODIFIERS[name] : 0),
    0,
  );
  const letter = /^[a-z]$/i.test(key);
  const event = {
    key,
    code: code ?? (letter ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : ""),
    modifiers,
    autoRepeat: repeat,
    windowsVirtualKeyCode: keyCode ?? (letter ? key.toUpperCase().charCodeAt(0) : 0),
  };
  const text = [...key].length === 1 && !held.ctrl && !held.meta ? { text: key } : {};
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...event, ...text });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/** Presses Escape as a keyboard sends it. */
const pressEscape = (page: Page, init?: PressInit) =>
  press(page, "Escape", { code: "Escape", keyCode: 27, ...init });

/** Presses ?, Shift and the slash key. */
const pressHelp = (page: Page) => press(page, "?", { code: "Slash", shift: true });

/** The actions the fixture's bindings ran, in order. */
const log = (page: Page) => page.evaluate("window.log");

/** The keys-fire details, in order. */
const fired = (page: Page): Promise<FireDetail[]> => page.evaluate("window.fired");

/** How long after compositionend keys takes a keydown as the composition's, in ms. */
const SETTLE = 100;

/**
 * Dispatches, in one task, a composition on the element with the id, or the body, then a keydown
 * of each key there as WebKit sends the key that ends one: after compositionend, not composing.
 */
const composeThen = (page: Page, id: string | null, keys: string[]) =>
  page.evaluate(`(() => {
    const el = ${id ? `document.getElementById(${JSON.stringify(id)})` : "document.body"};
    for (const type of ["compositionstart", "compositionend"]) {
      el.dispatchEvent(new CompositionEvent(type, { data: "", bubbles: true, composed: true }));
    }
    for (const key of ${JSON.stringify(keys)}) {
      el.dispatchEvent(new KeyboardEvent("keydown",
        { key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, bubbles: true,
          cancelable: true, composed: true }));
    }
  })()`);

/** Resolves after ms, as measured in the page. */
const sleep = (page: Page, ms: number) =>
  page.evaluate(`new Promise((resolve) => setTimeout(resolve, ${ms}))`);

/** Evaluates the expression with the page's keys module bound as `keys`. */
const call = (page: Page, body: string) =>
  page.evaluate(`import(${JSON.stringify(KEYS)}).then((keys) => ${body})`);

/** Registers a binding, labelled by its keys, whose handler logs its keys. */
const registerLogged = (page: Page, binding: string) => {
  const keys = JSON.stringify(binding);
  return call(page, `keys.register(${keys}, ${keys}, () => window.log.push(${keys}))`);
};

/** The [name, message] of the error the keys call throws, or null. */
const thrown = (page: Page, body: string) =>
  call(
    page,
    `{ try { ${body}; return null; } catch (e) { return [e.constructor.name, e.message]; } }`,
  );

/** Focuses the element with the id. */
const focus = (page: Page, id: string) =>
  page.evaluate(`document.getElementById(${JSON.stringify(id)}).focus()`);

/** The focused element's id, or its tag when it has none. */
const active = (page: Page) =>
  page.evaluate("document.activeElement.id || document.activeElement.localName");

/** Whether the dialog with the id is open. */
const isOpen = (page: Page, id = "help") =>
  page.evaluate(`document.getElementById(${JSON.stringify(id)}).open`);

/** Whether the dialog with the id is modal. */
const isModal = (page: Page, id = "help") =>
  page.evaluate(`document.getElementById(${JSON.stringify(id)}).matches(":modal")`);

describe("keys: element bindings", () => {
  test("T clicks its button, running the invoker command, and marks the press handled", async () => {
    const page = await open();
    await page.evaluate(
      `document.addEventListener("keydown", (event) => (window.handled = event.defaultPrevented))`,
    );
    await press(page, "t");
    assert.deepEqual(await log(page), ["command --theme"]);
    assert.equal(await page.evaluate("window.handled"), true);
    assert.deepEqual(await fired(page), [{ binding: "t", keys: ["t"] }]);
    // A single press that fires at once is no sequence.
    assert.deepEqual(await page.evaluate("window.sequences"), []);
  });

  test("on a layout such as Russian, the key on T's code runs the T binding", async () => {
    const page = await open();
    await press(page, "е", { code: "KeyT" }); // Cyrillic е, not Latin e.
    assert.deepEqual(await log(page), ["command --theme"]);
    assert.deepEqual(await fired(page), [{ binding: "t", keys: ["t"] }]);
  });

  test("a field's binding focuses it", async () => {
    const page = await open();
    await press(page, "/");
    assert.equal(await active(page), "search");
  });

  test("keys reads the page at each press: an added element binds, a removed one unbinds", async () => {
    const page = await open();
    await page.evaluate(`document.body.insertAdjacentHTML("beforeend",
      '<button type="button" data-keys="n" data-log="n">N</button>')`);
    await press(page, "n");
    await page.evaluate(`document.querySelector("[data-keys=t]").removeAttribute("data-keys")`);
    await press(page, "t");
    assert.deepEqual(await log(page), ["n"]);
  });

  test("a malformed data-keys binds nothing and warns once", async () => {
    const page = await open();
    await page.evaluate(
      `(window.warnings = [], console.warn = (message) => window.warnings.push(message))`,
    );
    await press(page, "x");
    await press(page, "y");
    assert.deepEqual(await log(page), []);
    const warnings = await page.evaluate("window.warnings");
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].startsWith("keys: data-keys binds nothing:"));
  });

  test("the first of two elements sharing keys wins, ahead of a register() binding", async () => {
    const page = await open();
    await registerLogged(page, "f");
    await press(page, "f");
    assert.deepEqual(await log(page), ["f first"]);
    await page.evaluate(`document.querySelectorAll("[data-keys=f]").forEach((el) => el.remove())`);
    await press(page, "f");
    assert.deepEqual(await log(page), ["f first", "f"]);
  });
});

describe("keys: register()", () => {
  test("fires its handler with the keys-fire event; its remover removes only that binding", async () => {
    const page = await open();
    await call(
      page,
      `(window.removeOne = keys.register("q", "one", (event) => window.log.push("one " + event.type)),
      keys.register("q", "two", () => window.log.push("two")))`,
    );
    await press(page, "q");
    assert.deepEqual(await log(page), ["one keys-fire"]);
    assert.deepEqual(await fired(page), [{ binding: "q", keys: ["q"], label: "one" }]);
    await page.evaluate("(window.removeOne(), window.removeOne())");
    await press(page, "q");
    assert.deepEqual(await log(page), ["one keys-fire", "two"]);
  });

  test("throws a TypeError on a malformed binding, label, or handler", async () => {
    const page = await open();
    const [name, message] = await thrown(page, `keys.register("Control+", "x", () => {})`);
    assert.equal(name, "TypeError");
    assert.ok(message.startsWith("keys: "));
    assert.equal((await thrown(page, `keys.register("x", 1, () => {})`))[0], "TypeError");
    assert.equal((await thrown(page, `keys.register("x", "x", null)`))[0], "TypeError");
    assert.deepEqual(await page.evaluate(`${STORE}.registered`), []);
  });
});

describe("keys: sequences", () => {
  test("g c runs the longer and g, when the wait ends, the shorter", async () => {
    const page = await open();
    assert.equal(await page.evaluate("window.defaultWait"), 1500);
    await press(page, "g");
    await press(page, "c");
    await press(page, "g");
    assert.deepEqual(await log(page), ["g c"]);
    await sleep(page, WAIT + 100);
    assert.deepEqual(await log(page), ["g c", "g"]);
    assert.deepEqual(await page.evaluate("window.sequences"), [
      { state: "start", presses: ["g"] },
      { state: "end", presses: ["g", "c"], reason: "fired" },
      { state: "start", presses: ["g"] },
      { state: "end", presses: ["g"], reason: "fired" },
    ]);
    assert.deepEqual(
      (await fired(page)).map(({ keys }) => keys),
      [["g", "c"], ["g"]],
    );
  });

  test("a press that doesn't continue the sequence ends it and is dropped, not retried", async () => {
    const page = await open();
    await press(page, "g");
    await press(page, "t"); // Bound, but as a new start, not as g's next press.
    await sleep(page, WAIT + 100);
    assert.deepEqual(await log(page), []);
    assert.deepEqual(await page.evaluate("window.sequences"), [
      { state: "start", presses: ["g"] },
      { state: "end", presses: ["g"], reason: "dropped" },
    ]);
  });

  test("a press after the wait finds the sequence timed out", async () => {
    const page = await open();
    await registerLogged(page, "w e r");
    await press(page, "w");
    await press(page, "e");
    await sleep(page, WAIT + 100);
    await press(page, "r");
    assert.deepEqual(await log(page), []);
    assert.deepEqual(await page.evaluate("window.sequences"), [
      { state: "start", presses: ["w"] },
      { state: "continue", presses: ["w", "e"] },
      { state: "end", presses: ["w", "e"], reason: "timeout" },
    ]);
    for (const key of ["w", "e", "r"]) await press(page, key);
    assert.deepEqual(await log(page), ["w e r"]);
  });

  test("the indicator, an outside module, shows the pending presses from keys-sequence alone", async () => {
    const page = await open();
    const shown = () => page.evaluate(`document.getElementById("indicator").textContent`);
    await registerLogged(page, "w e r");
    await press(page, "w");
    assert.equal(await shown(), "w");
    await press(page, "e");
    assert.equal(await shown(), "w then e");
    await press(page, "r");
    assert.equal(await shown(), "");
  });
});

const FIELDS = ["text", "notes", "pick", "editable", "search"];

describe("keys: silence", () => {
  test("nothing fires in a field, even a combination", async () => {
    const page = await open();
    await registerLogged(page, "Control+k");
    for (const id of FIELDS) {
      await focus(page, id);
      await press(page, "t");
      await press(page, "k", { ctrl: true });
    }
    assert.deepEqual(await log(page), []);
    await page.evaluate("document.activeElement.blur()");
    await press(page, "k", { ctrl: true });
    assert.deepEqual(await log(page), ["Control+k"]);
  });

  test("with Control or Meta held, a bare binding doesn't match", async () => {
    const page = await open();
    await press(page, "t", { ctrl: true });
    await press(page, "t", { meta: true });
    assert.deepEqual(await log(page), []);
  });

  test("nothing fires on a repeat, while composing, on Dead or Process, or with AltGraph", async () => {
    const page = await open();
    await press(page, "t", { repeat: true });
    await press(page, "Dead");
    // Chrome and Firefox name a press an input method takes, before isComposing is set, Process.
    await press(page, "Process", { keyCode: 229 });
    await page.evaluate(`for (const init of [{ isComposing: true }, { modifierAltGraph: true }]) {
      document.dispatchEvent(new KeyboardEvent("keydown",
        { key: "t", code: "KeyT", bubbles: true, cancelable: true, ...init }));
    }`);
    assert.deepEqual(await log(page), []);
    assert.deepEqual(await fired(page), []);
  });

  test("the keydown WebKit sends after compositionend fires nothing, and only that one", async () => {
    const page = await open();
    await composeThen(page, null, ["t"]);
    assert.deepEqual(await log(page), []);
    await composeThen(page, null, ["t", "t"]);
    assert.deepEqual(await log(page), ["command --theme"]);
    assert.deepEqual(await fired(page), [{ binding: "t", keys: ["t"] }]);
  });

  test("once a composition has settled, the next press fires", async () => {
    const page = await open();
    await composeThen(page, null, []);
    await sleep(page, SETTLE + 50);
    await press(page, "t");
    assert.deepEqual(await log(page), ["command --theme"]);
  });

  test("an input method's composition in a field fires nothing, and Escape then blurs it", async () => {
    const page = await open();
    await page.evaluate(`window.composed = [];
      for (const type of ["compositionstart", "compositionend"]) {
        document.addEventListener(type, () => window.composed.push(type));
      }`);
    await focus(page, "text");
    await page.cdp("Input.imeSetComposition", { text: "k", selectionStart: 1, selectionEnd: 1 });
    await page.cdp("Input.imeSetComposition", { text: "か", selectionStart: 1, selectionEnd: 1 });
    await page.cdp("Input.insertText", { text: "か" });
    assert.deepEqual(await page.evaluate("window.composed"), [
      "compositionstart",
      "compositionend",
    ]);
    assert.equal(await page.evaluate(`document.getElementById("text").value`), "か");
    assert.deepEqual(await log(page), []);
    assert.equal(await active(page), "text");
    await sleep(page, SETTLE + 50);
    await pressEscape(page);
    assert.equal(await active(page), "body");
  });

  test("an event already handled is left alone", async () => {
    const page = await open();
    await page.evaluate(
      `document.body.addEventListener("keydown", (event) => event.preventDefault())`,
    );
    await press(page, "t");
    assert.deepEqual(await log(page), []);
  });

  test("a modifier pressed alone neither starts nor drops a sequence", async () => {
    const page = await open();
    await press(page, "g");
    await press(page, "Shift", { code: "ShiftLeft", shift: true });
    await press(page, "c");
    assert.deepEqual(await log(page), ["g c"]);
  });
});

describe("keys: scope", () => {
  test("a disabled, inert, or hidden element binds nothing", async () => {
    const page = await open();
    for (const key of ["d", "i", "h"]) await press(page, key);
    assert.deepEqual(await log(page), []);
    await page.evaluate(`document.querySelector("[data-keys=d]").disabled = false`);
    await press(page, "d");
    assert.deepEqual(await log(page), ["d"]);
  });

  test("under a modal only its own bindings are active and register() bindings pause", async () => {
    const page = await open();
    await registerLogged(page, "r");
    await press(page, "o");
    assert.equal(await isModal(page, "modal"), true);
    for (const key of ["t", "r", "g"]) await press(page, key);
    await sleep(page, WAIT + 100);
    await press(page, "m");
    assert.deepEqual(await log(page), ["m"]);
    await pressEscape(page);
    assert.equal(await isOpen(page, "modal"), false);
    await press(page, "r");
    assert.deepEqual(await log(page), ["m", "r"]);
  });
});

describe("keys: Escape releases a field", () => {
  test("Escape in an input, textarea, select, or contenteditable blurs it, and j fires again", async () => {
    const page = await open();
    await registerLogged(page, "j");
    for (const id of FIELDS) {
      await focus(page, id);
      await press(page, "j");
      assert.equal(await active(page), id);
      await pressEscape(page);
      assert.equal(await active(page), "body");
      await press(page, "j");
    }
    const each = FIELDS.map(() => "j");
    assert.deepEqual(await log(page), each);
    // Escape is no binding: only the j presses fired keys-fire.
    assert.deepEqual(
      (await fired(page)).map(({ binding }) => binding),
      each,
    );
  });

  test("a search input's native Escape still clears it as keys blurs it", async () => {
    const page = await open();
    await page.evaluate(`document.getElementById("search").value = "query"`);
    await focus(page, "search");
    await pressEscape(page);
    assert.equal(await page.evaluate(`document.getElementById("search").value`), "");
    assert.equal(await active(page), "body");
  });

  test("the off switch doesn't cover it", async () => {
    const page = await open();
    await call(page, "keys.changeSettings({ enabled: false })");
    await focus(page, "text");
    await pressEscape(page);
    assert.equal(await active(page), "body");
  });

  test("a handled, repeated, or composing Escape blurs nothing", async () => {
    const page = await open();
    await focus(page, "text");
    await pressEscape(page, { repeat: true });
    await page.evaluate(`document.getElementById("text").dispatchEvent(new KeyboardEvent("keydown",
      { key: "Escape", code: "Escape", isComposing: true, bubbles: true, composed: true }))`);
    assert.equal(await active(page), "text");
    await page.evaluate(
      `document.getElementById("text").addEventListener("keydown", (event) => event.preventDefault())`,
    );
    await pressEscape(page);
    assert.equal(await active(page), "text");
  });

  test("the Escape WebKit sends after compositionend, cancelling it, blurs nothing", async () => {
    const page = await open();
    await focus(page, "text");
    await composeThen(page, "text", ["Escape"]);
    assert.equal(await active(page), "text");
    await composeThen(page, "text", ["Escape", "Escape"]);
    assert.equal(await active(page), "body");
  });

  test("an Escape whose listener moved focus on blurs nothing", async () => {
    const page = await open();
    await page.evaluate(`document.getElementById("text").addEventListener("keydown",
      () => document.getElementById("notes").focus())`);
    await focus(page, "text");
    await pressEscape(page);
    assert.equal(await active(page), "notes");
  });

  test("inside an open modal the dialog keeps Escape: keys blurs nothing and it closes", async () => {
    const page = await open();
    await page.evaluate(`(() => {
      const modal = document.getElementById("modal");
      modal.querySelector("[data-keys=Escape]").remove();
      modal.append(Object.assign(document.createElement("input"), { id: "inside" }));
      modal.showModal();
      document.getElementById("inside").focus();
      // Added after keys's listener, it sees where focus is once keys has run.
      document.addEventListener("keydown", () => (window.after = document.activeElement.id));
    })()`);
    await pressEscape(page);
    assert.equal(await page.evaluate("window.after"), "inside");
    assert.equal(await isOpen(page, "modal"), false);
  });
});

// Each field of keys-shadow.html, as the path through open shadow roots to it: one root deep in
// x-fields, and two in x-panel's own x-fields.
const SHADOW_FIELDS = ["input", "textarea", "editable"].flatMap((id) => [
  ["fields", id],
  ["panel", "inner", id],
]);

/** The expression for the element at the path: a document id, then an id in each shadow root. */
const deep = ([host, ...rest]: string[]) =>
  rest.reduce(
    (expression, id) => `${expression}.shadowRoot.getElementById(${JSON.stringify(id)})`,
    `document.getElementById(${JSON.stringify(host)})`,
  );

/** The text the field at the path holds: its value, or a contenteditable's text. */
const typed = (page: Page, path: string[]) =>
  page.evaluate(`(() => { const el = ${deep(path)}; return el.value ?? el.textContent; })()`);

/** Whether the field at the path is focused, as the page follows focus through shadow roots. */
const isFocused = (page: Page, path: string[]) =>
  page.evaluate(`(() => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el === ${deep(path)};
  })()`);

describe("keys: fields in open shadow roots", () => {
  test("a key typed in a field one or two shadow roots deep types and binds nothing", async () => {
    const page = await open("keys-shadow.html");
    await registerLogged(page, "/");
    for (const path of SHADOW_FIELDS) {
      await page.evaluate(`${deep(path)}.focus()`);
      await press(page, "t");
      await press(page, "/");
      assert.equal(await typed(page, path), "t/", path.join(" > "));
    }
    assert.deepEqual(await log(page), []);
    assert.deepEqual(await fired(page), []);
  });

  test("with focus outside any field, the bindings still fire", async () => {
    const page = await open("keys-shadow.html");
    await registerLogged(page, "/");
    await page.evaluate(`${deep(["panel", "inner", "input"])}.focus()`);
    await page.evaluate(`${deep(["panel", "inner", "input"])}.blur()`);
    await press(page, "t");
    await press(page, "/");
    assert.deepEqual(await log(page), ["t", "/"]);
  });

  test("Escape blurs a field one or two shadow roots deep, and t fires again", async () => {
    const page = await open("keys-shadow.html");
    for (const path of SHADOW_FIELDS) {
      await page.evaluate(`${deep(path)}.focus()`);
      assert.equal(await isFocused(page, path), true);
      await pressEscape(page);
      assert.equal(await isFocused(page, path), false, path.join(" > "));
      assert.equal(await active(page), "body");
      await press(page, "t");
    }
    assert.deepEqual(
      await log(page),
      SHADOW_FIELDS.map(() => "t"),
    );
  });
});

// Each modal of keys-modal.html, as the paths to its dialog and to its field: in the document,
// one shadow root deep in x-modal, and two in x-nest's own x-modal.
const MODALS = [
  { name: "light", dialog: ["light"], field: ["field"] },
  { name: "one", dialog: ["one", "dialog"], field: ["one", "field"] },
  { name: "two", dialog: ["two", "inner", "dialog"], field: ["two", "inner", "field"] },
];

/**
 * Records, as window.after, where focus is once keys has run on each keydown: added after keys's
 * listener, it runs after it.
 */
const followFocus = (page: Page) =>
  page.evaluate(`document.addEventListener("keydown", () => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    window.after = el;
  })`);

describe("keys: modals in open shadow roots", () => {
  test("while a modal one or two shadow roots deep is open, only its own bindings fire", async () => {
    const page = await open("keys-modal.html");
    await registerLogged(page, "/");
    const expected: string[] = [];
    for (const { name, dialog } of MODALS) {
      await page.evaluate(`${deep(dialog)}.showModal()`);
      // Out of the field showModal() focused, onto the slotted button.
      await page.evaluate(`document.querySelector('[data-log="m ${name}"]').focus()`);
      await press(page, "t");
      await press(page, "/");
      await pressHelp(page);
      assert.equal(await isOpen(page, "help"), false, name);
      // Its slotted button binds.
      await press(page, "m");
      await page.evaluate(`${deep(dialog)}.close()`);
      await press(page, "t");
      await press(page, "/");
      expected.push(`m ${name}`, "t", "/");
      assert.deepEqual(await log(page), expected, name);
    }
  });

  test("with focus gone from the open modal to the body, the page's bindings stay quiet", async () => {
    const page = await open("keys-modal.html");
    await registerLogged(page, "/");
    for (const { name, dialog, field } of MODALS) {
      await page.evaluate(`${deep(dialog)}.showModal()`);
      await page.evaluate(`${deep(field)}.focus()`);
      await page.evaluate(`${deep(field)}.remove()`);
      assert.equal(await active(page), "body", name);
      await press(page, "t");
      await press(page, "/");
      assert.deepEqual(await log(page), [], name);
      await page.evaluate(`${deep(dialog)}.close()`);
    }
    await press(page, "t");
    assert.deepEqual(await log(page), ["t"]);
  });

  test("Escape in a field of a modal one or two shadow roots deep blurs nothing and it closes", async () => {
    const page = await open("keys-modal.html");
    await followFocus(page);
    for (const { name, dialog, field } of MODALS) {
      await page.evaluate(`${deep(dialog)}.showModal()`);
      await page.evaluate(`${deep(field)}.focus()`);
      await pressEscape(page);
      assert.equal(await page.evaluate(`window.after === ${deep(field)}`), true, name);
      assert.equal(await page.evaluate(`${deep(dialog)}.open`), false, name);
    }
  });

  test("with a modal open over another, only the topmost one's bindings fire", async () => {
    const page = await open("keys-modal.html");
    await page.evaluate(`document.getElementById("host").showModal()`);
    // The host's own x-modal, then the document's light dialog, each opened over the host.
    for (const { name, dialog } of [
      { name: "over", dialog: ["over", "dialog"] },
      { name: "light", dialog: ["light"] },
    ]) {
      await page.evaluate(`${deep(dialog)}.showModal()`);
      await page.evaluate(`document.querySelector('[data-log="m ${name}"]').focus()`);
      await press(page, "o");
      await press(page, "t");
      await press(page, "m");
      await page.evaluate(`${deep(dialog)}.close()`);
      await page.evaluate(`document.querySelector('[data-log="o"]').focus()`);
      await press(page, "o");
    }
    assert.deepEqual(await log(page), ["m over", "o", "m light", "o"]);
  });
});

describe("keys: a modal open before keys loads", () => {
  test("while it is open, only its own bindings fire, and the page's once it closes", async () => {
    const page = await open("keys-modal-early.html");
    await registerLogged(page, "/");
    assert.equal(await page.evaluate(`${deep(["early", "dialog"])}.open`), true);
    await press(page, "t");
    await press(page, "/");
    await pressHelp(page);
    assert.equal(await isOpen(page, "help"), false);
    await press(page, "m");
    await page.evaluate(`${deep(["early", "dialog"])}.close()`);
    await press(page, "t");
    assert.deepEqual(await log(page), ["m", "t"]);
  });

  test("Escape in its field, focused before keys loaded, blurs nothing and it closes", async () => {
    const page = await open("keys-modal-early.html?field");
    assert.equal(await isFocused(page, ["early", "field"]), true);
    await followFocus(page);
    await pressEscape(page);
    assert.equal(await page.evaluate(`window.after === ${deep(["early", "field"])}`), true);
    assert.equal(await page.evaluate(`${deep(["early", "dialog"])}.open`), false);
  });
});

describe("keys: extension and the store", () => {
  test("cancelling keys-fire stops the action", async () => {
    const page = await open();
    await registerLogged(page, "q");
    await page.evaluate(
      `document.addEventListener("keys-fire", (event) => event.preventDefault())`,
    );
    await press(page, "t");
    await press(page, "q");
    assert.deepEqual(await log(page), []);
    assert.deepEqual(
      (await fired(page)).map(({ binding }) => binding),
      ["t", "q"],
    );
  });

  test("keys-fire bubbles from the bound element", async () => {
    const page = await open();
    await page.evaluate(`document.querySelector("[data-keys=t]").addEventListener("keys-fire",
      (event) => (window.from = [event.target.dataset.keys, event.bubbles, event.cancelable]))`);
    await press(page, "t");
    assert.deepEqual(await page.evaluate("window.from"), ["t", true, true]);
  });

  test("two copies from two URLs share one store and one listener, so a key fires once", async () => {
    const page = await open("keys-copies.html");
    assert.equal(await page.evaluate("window.copies"), true);
    for (const key of ["t", "a", "b"]) await press(page, key);
    assert.deepEqual(await log(page), ["t", "a", "b"]);
    assert.deepEqual(await page.evaluate(`Object.keys(${STORE})`), [
      "registered",
      "wait",
      "listening",
    ]);
    assert.deepEqual(
      await page.evaluate(`${STORE}.registered.map(({ keys, label }) => [keys, label])`),
      [
        ["a", "from a"],
        ["b", "from b"],
      ],
    );
  });
});

// The settings fixture's bindings: a key, a symbol, a chord, two combinations, and a named key.
const SETTINGS = "keys-settings.html";
const ALL = ["t", "?", "g c", "Alt+t", "Control+k", "Escape"];
// Each binding's aria-keyshortcuts with the off switch on, and with it off.
const DECLARED = {
  t: "T",
  "?": "Shift+/",
  "g c": null,
  "Alt+t": "Alt+T",
  "Control+k": "Control+K",
  Escape: "Escape",
};
const OFF = { ...DECLARED, t: null, "?": null };

/** Each bound button's aria-keyshortcuts, by its data-log. */
const declared = (page: Page) =>
  page.evaluate(`Object.fromEntries([...document.querySelectorAll("[data-log]")]
    .map((el) => [el.dataset.log, el.getAttribute("aria-keyshortcuts")]))`);

/** Writes the reader's settings as another tab would, and sends the storage event it sends. */
const store = (page: Page, value: unknown) => {
  const json = JSON.stringify(typeof value === "string" ? value : JSON.stringify(value));
  return page.evaluate(`(() => {
    const oldValue = localStorage.getItem("spike-html-apps-foundation.keys");
    localStorage.setItem("spike-html-apps-foundation.keys", ${json});
    dispatchEvent(new StorageEvent("storage", { key: "spike-html-apps-foundation.keys", oldValue,
      newValue: ${json}, storageArea: localStorage, url: location.href }));
  })()`);
};

/** The reader's stored settings, or null. */
const saved = (page: Page) =>
  page.evaluate(`JSON.parse(localStorage.getItem("spike-html-apps-foundation.keys"))`);

/** Presses each of the settings fixture's bindings as written. */
async function pressAll(page: Page) {
  await press(page, "t");
  await pressHelp(page);
  await press(page, "g");
  await press(page, "c");
  // Option changes the character on macOS, so Alt matches a letter by its code.
  await press(page, "†", { code: "KeyT", alt: true });
  await press(page, "k", { ctrl: true });
  await press(page, "Escape", { code: "Escape" });
}

describe("keys: bindings as written", () => {
  test("a key, a symbol, a written chord, written combinations, and a named key all fire", async () => {
    const page = await open(SETTINGS);
    assert.deepEqual(await declared(page), DECLARED);
    await pressAll(page);
    assert.deepEqual(await log(page), ALL);
    assert.deepEqual(
      (await fired(page)).map(({ keys }) => keys),
      [["t"], ["?"], ["g", "c"], ["Alt+t"], ["Control+k"], ["Escape"]],
    );
    // Modifiers are exact: k without Control, and Alt+Shift+T, fire nothing.
    await page.evaluate("window.log = []");
    await press(page, "k");
    await press(page, "†", { code: "KeyT", alt: true, shift: true });
    assert.deepEqual(await log(page), []);
  });
});

describe("keys: the reader's settings", () => {
  test("settings() is { enabled, wait }, the wait the store's by default", async () => {
    const page = await open(SETTINGS);
    assert.deepEqual(await call(page, "keys.settings()"), { enabled: true, wait: WAIT });
  });

  test("the stored wait wins over the store's", async () => {
    const page = await open(SETTINGS);
    await registerLogged(page, "w e");
    const pressSlowly = async () => {
      await press(page, "w");
      await sleep(page, WAIT + 250);
      await press(page, "e");
    };
    await pressSlowly();
    assert.deepEqual(await log(page), []);
    await call(page, "keys.changeSettings({ wait: 1000 })");
    assert.equal(await call(page, "keys.settings().wait"), 1000);
    await pressSlowly();
    assert.deepEqual(await log(page), ["w e"]);
  });

  test("invalid or unknown stored values read as defaults, and unparseable JSON as all defaults", async () => {
    const page = await open(SETTINGS);
    const defaults = { enabled: true, wait: WAIT };
    await store(page, { enabled: "no", foo: 1, wait: 20 });
    assert.deepEqual(await call(page, "keys.settings()"), defaults);
    await store(page, { foo: 1, wait: 3000 });
    assert.deepEqual(await call(page, "keys.settings()"), { ...defaults, wait: 3000 });
    for (const value of ["{", "[]", "null", '"foo"']) {
      await store(page, value);
      assert.deepEqual(await call(page, "keys.settings()"), defaults);
    }
    await press(page, "t");
    assert.deepEqual(await log(page), ["t"]);
  });

  test("changeSettings() stores only changed settings; a default or null removes one", async () => {
    const page = await open(SETTINGS);
    await call(page, `keys.changeSettings({ wait: 3000 })`);
    assert.deepEqual(await saved(page), { wait: 3000 });
    await call(page, `keys.changeSettings({ enabled: false })`);
    assert.deepEqual(await saved(page), { wait: 3000, enabled: false });
    await call(page, `keys.changeSettings({ wait: null, enabled: true })`);
    assert.equal(await saved(page), null);
    // Invalid values and unknown names already stored are dropped on the next change.
    await store(page, { enabled: 1, foo: 1 });
    await call(page, `keys.changeSettings({ wait: 5000 })`);
    assert.deepEqual(await saved(page), { wait: 5000 });
    for (const change of [`{ foo: 1 }`, `{ wait: 20 }`, `{ colour: "red" }`]) {
      assert.equal(
        (await thrown(page, `keys.changeSettings(${change})`))?.[0],
        "TypeError",
        change,
      );
    }
    assert.deepEqual(await saved(page), { wait: 5000 });
  });

  test("the off switch turns off keys and chords of characters and leaves combinations on", async () => {
    const page = await open(SETTINGS);
    await registerLogged(page, "j");
    await registerLogged(page, "Alt+j");
    await call(page, "keys.changeSettings({ enabled: false })");
    assert.deepEqual(await declared(page), OFF);
    await pressAll(page);
    await press(page, "j");
    await press(page, "∆", { code: "KeyJ", alt: true });
    assert.deepEqual(await log(page), ["Alt+t", "Control+k", "Escape", "Alt+j"]);
    await page.evaluate("window.log = []");
    await call(page, "keys.changeSettings({ enabled: true })");
    assert.deepEqual(await declared(page), DECLARED);
    await pressAll(page);
    assert.deepEqual(await log(page), ALL);
  });
});

describe("keys: aria-keyshortcuts", () => {
  test("another tab's change to the settings applies at once, to presses and the attribute", async () => {
    const page = await open(SETTINGS);
    await store(page, { enabled: false });
    assert.deepEqual(await declared(page), OFF);
    await pressAll(page);
    assert.deepEqual(await log(page), ["Alt+t", "Control+k", "Escape"]);
    // Storage cleared in another tab sends a null key.
    await page.evaluate(`(localStorage.clear(),
      dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage })))`);
    assert.deepEqual(await declared(page), DECLARED);
  });

  test("two tabs on one origin: a change in one rewrites the other's attribute", async () => {
    const one = await open(SETTINGS);
    const two = await open(SETTINGS);
    await call(one, `keys.changeSettings({ enabled: false })`);
    await sleep(two, 50); // The other tab's storage event arrives as a task.
    assert.deepEqual(await declared(two), OFF);
    await press(two, "t");
    await press(two, "k", { ctrl: true });
    assert.deepEqual(await log(two), ["Control+k"]);
  });

  test("stored settings apply on load", async () => {
    const page = await open(SETTINGS);
    await page.evaluate(
      `localStorage.setItem("spike-html-apps-foundation.keys", '{"enabled":false}')`,
    );
    await page.goto(fixture(SETTINGS));
    assert.deepEqual(await declared(page), OFF);
  });

  test("follows added elements and data-keys changes, and leaves unbound elements alone", async () => {
    const page = await open(SETTINGS);
    const shortcut = async (keys: string | null) => {
      await page.evaluate(
        keys === null
          ? `document.getElementById("added").removeAttribute("data-keys")`
          : `document.getElementById("added").dataset.keys = ${JSON.stringify(keys)}`,
      );
      return page.evaluate(`document.getElementById("added").getAttribute("aria-keyshortcuts")`);
    };
    await page.evaluate(
      `document.body.append(Object.assign(document.createElement("button"), { id: "added" }))`,
    );
    assert.equal(await shortcut("n"), "N");
    assert.equal(await shortcut("Alt+n, ?"), "Alt+N Shift+/");
    // A sequence declares nothing; nor does a malformed binding.
    assert.equal(await shortcut("n m"), null);
    assert.equal(await shortcut("Control+"), null);
    // data-keys removed: the attribute keys wrote goes with it.
    assert.equal(await shortcut("n"), "N");
    assert.equal(await shortcut(null), null);
    // An element that never carried data-keys keeps its own.
    await call(page, `keys.changeSettings({ enabled: false })`);
    assert.equal(
      await page.evaluate(`document.getElementById("unbound").getAttribute("aria-keyshortcuts")`),
      "Alt+U",
    );
  });
});

// The help dialog: keys loads keys-help.js the first time a dialog holding
// [data-keys-list] opens, and it fills the dialog.
describe("keys: the help dialog", () => {
  const HELP = "keys-help.html";
  const ESCAPE = ["[Esc]", "Leave a field"];
  // The fixture's rows, with j registered after the elements.
  const ROWS = [
    ["[?]", "Help"],
    ["[T]", "Theme"],
    ["[A]", "Archive the thread"],
    ["[F]", "First"],
    ["[G] then [C]", "Contents"],
    ["[Control]+[K]", "Command"],
    ["[/]", "Search"],
    ["[J]", "Next section"],
  ];

  /** Whether the page has fetched the help module. */
  const fetchedHelp = (page: Page) =>
    page.evaluate(
      `performance.getEntriesByType("resource").some(({ name }) => name.endsWith("/keys-help.js"))`,
    );

  /** Resolves once the help dialog is open and filled. */
  const filled = (page: Page) =>
    until(
      page,
      `document.getElementById("help").open && !!document.querySelector("#help [data-keys-list] [data-keys-table]")`,
    );

  /** Opens the dialog from its Help button, a show-modal invoker. */
  const clickHelp = (page: Page) =>
    page.evaluate(`document.querySelector("button[command=show-modal]").click()`);

  /** Opens the dialog from its Help button and waits for it to fill. */
  async function openHelp(page: Page) {
    await clickHelp(page);
    await filled(page);
  }

  const closeHelp = (page: Page) => page.evaluate(`document.getElementById("help").close()`);

  /**
   * The table's rows as [keys, action]: each kbd drawn as [name], an off row's keys ending " off",
   * and the action the row button's text, or the fixed Escape row's cell text.
   */
  const rows = (page: Page): Promise<[string, string][]> =>
    page.evaluate(`[...document.querySelectorAll("#help [data-keys-table] tbody tr")].map((row) => {
      const [keys, action] = row.cells;
      const drawn = [...keys.childNodes].map((node) =>
        node.localName === "kbd" ? "[" + node.textContent + "]" : node.textContent).join("");
      return [drawn, (action.querySelector("button") ?? action).textContent];
    })`);

  /** Clicks the row button whose text is the action. */
  const clickRow = (page: Page, action: string) =>
    page.evaluate(`[...document.querySelectorAll("#help [data-keys-table] button")]
      .find((button) => button.textContent === ${JSON.stringify(action)}).click()`);

  /** Sets one of the dialog's settings controls as the reader would. */
  const choose = (page: Page, name: string, value: unknown) =>
    page.evaluate(`(() => {
      const control = document.querySelector("#help [data-keys-settings] [name=${name}]");
      if (control.type === "checkbox") control.checked = ${JSON.stringify(value)};
      else control.value = ${JSON.stringify(String(value))};
      control.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);

  /** Registers j, and a second f the first element's f shadows. */
  const registerJ = (page: Page) =>
    call(
      page,
      `(keys.register("j", "Next section", (event) => window.log.push("j " + JSON.stringify(event.detail))),
      keys.register("f", "Shadowed f", () => window.log.push("f registered")))`,
    );

  /** Answers every request for the help module with a 404, resolving to a count of them. */
  async function refuseHelp(page: Page) {
    let requests = 0;
    page.on("Fetch.requestPaused", ({ requestId }: { requestId: string }) => {
      requests++;
      page.cdp("Fetch.fulfillRequest", { requestId, responseCode: 404 });
    });
    await page.cdp("Fetch.enable", { patterns: [{ urlPattern: "*/keys-help.js" }] });
    return () => requests;
  }

  test("keys-help.js loads on the first open by the show-modal button, not before", async () => {
    const page = await open(HELP);
    await sleep(page, 100);
    assert.equal(await fetchedHelp(page), false);
    assert.equal(
      await page.evaluate(`document.querySelector("[data-keys-list]").childElementCount`),
      0,
    );
    await openHelp(page);
    assert.equal(await fetchedHelp(page), true);
    assert.equal(await isModal(page), true);
    assert.deepEqual(await rows(page), [...ROWS.slice(0, -1), ESCAPE]);
  });

  test("a failed load leaves the dialog usable, warns, and imports again at the next open", async () => {
    const page = await open(HELP);
    const requests = await refuseHelp(page);
    await page.evaluate(`(() => {
      window.unhandled = [];
      window.warned = [];
      addEventListener("unhandledrejection", (event) => window.unhandled.push(String(event.reason)));
      const warn = console.warn;
      console.warn = (...args) => (window.warned.push(String(args[0])), warn(...args));
    })()`);
    // The dialog opens as the page wrote it, and its own Close closes it.
    const attempt = async () => {
      await clickHelp(page);
      await sleep(page, 200);
      assert.equal(await isModal(page), true);
      assert.equal(
        await page.evaluate(`document.querySelector("#help [data-keys-list]").childElementCount`),
        0,
      );
      await page.evaluate(`document.querySelector("#help [command=close]").click()`);
      assert.equal(await isOpen(page), false);
    };
    await attempt();
    await attempt();
    const failed = "keys: the help module failed to load";
    assert.deepEqual(await page.evaluate("window.warned"), [failed, failed]);
    // Chromium 156 keeps no failed module fetch in the module map, so each import requests the
    // module again, and so does a document loaded later.
    assert.equal(requests(), 2);
    assert.deepEqual(await page.evaluate("window.unhandled"), []);
    await page.goto(fixture(HELP));
    await attempt();
    assert.equal(requests(), 3);
  });

  test("of two copies at two URLs, the first installs the listener and loads the help beside it", async () => {
    // a/ and b/ both link to the package's dist/, so the page holds two copies of keys.js at
    // two URLs.
    const tree = await mkdtemp(join(tmpdir(), "keys-copies-"));
    await symlink(join(root, "dist"), join(tree, "a"));
    await symlink(join(root, "dist"), join(tree, "b"));
    await writeFile(
      join(tree, "copies.html"),
      `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>keys help copies</title>
          <script type="module">
            import * as a from "./a/keys.js";
            import * as b from "./b/keys.js";
            window.copies = a.register !== b.register;
          </script>
        </head>
        <body>
          <button type="button" commandfor="help" command="show-modal">Help</button>
          <dialog id="help"><div data-keys-list></div></dialog>
        </body>
      </html>`,
    );
    const copies = await serve({ root: tree });
    try {
      const page = await browser.open(`${copies.origin}/copies.html`);
      pages.push(page);
      assert.equal(await page.evaluate("window.copies"), true);
      await openHelp(page);
      // A second listener would load b's help too.
      assert.deepEqual(
        await page.evaluate(`performance.getEntriesByType("resource").map(({ name }) => name)
          .filter((name) => name.endsWith("/keys-help.js"))`),
        [`${copies.origin}/a/keys-help.js`],
      );
    } finally {
      await copies.stop();
      await rm(tree, { recursive: true });
    }
  });

  test("showModal() from script, or the ? key, opens and fills it too", async () => {
    const page = await open(HELP);
    await page.evaluate(`document.getElementById("help").showModal()`);
    await filled(page);
    assert.equal(await fetchedHelp(page), true);
    // Its own Close carries ? inside the modal.
    await pressHelp(page);
    assert.equal(await isOpen(page), false);
    await page.evaluate(`document.querySelector("[data-keys-list]").replaceChildren()`);
    await pressHelp(page);
    await filled(page);
    assert.deepEqual(await rows(page), [...ROWS.slice(0, -1), ESCAPE]);
  });

  test("lists each active binding once, as the one that fires, with its label by the rule", async () => {
    const page = await open(HELP);
    await registerJ(page);
    await openHelp(page);
    // Second F and the registered f lose to First; Disabled, Inert, Hidden, and the dialog's own
    // Close are left out; A's label is its aria-label, Search's its <label>'s text.
    assert.deepEqual(await rows(page), [...ROWS, ESCAPE]);
    // Each open lists the page as it is then.
    await closeHelp(page);
    await page.evaluate(`(document.querySelector("[data-keys=d]").disabled = false,
      document.querySelector("[data-log='f first']").remove())`);
    await openHelp(page);
    const listed = await rows(page);
    assert.ok(listed.some(([keys, action]) => keys === "[D]" && action === "Disabled"));
    assert.ok(listed.some(([keys, action]) => keys === "[F]" && action === "Second"));
  });

  test("a row button closes the dialog and runs its binding: click, focus, or the handler", async () => {
    const page = await open(HELP);
    await registerJ(page);
    for (const action of ["Theme", "Next section", "Search"]) {
      await openHelp(page);
      await clickRow(page, action);
      assert.equal(await isOpen(page), false);
    }
    assert.deepEqual(await log(page), [
      "t",
      `j ${JSON.stringify({ binding: "j", keys: [], label: "Next section" })}`,
    ]);
    // Running a row is no key press: keys-fire is not dispatched.
    assert.deepEqual(await fired(page), []);
    assert.equal(await active(page), "search");
  });

  test("the settings are stored through changeSettings and change what fires", async () => {
    const page = await open(HELP);
    await openHelp(page);
    const shown = await page.evaluate(`(() => {
      const fieldset = document.querySelector("#help [data-keys-settings]");
      return {
        legend: fieldset.querySelector("legend").textContent,
        controls: [...fieldset.querySelectorAll("input, select")].map((el) => el.type === "checkbox"
          ? [el.name, el.checked, null]
          : [el.name, el.value, [...el.options].map((o) => o.value)]),
      };
    })()`);
    assert.deepEqual(shown, {
      legend: "Settings",
      controls: [
        ["enabled", true, null],
        // The tests' store wait, WAIT, is the page's own: the empty first option.
        ["wait", "", ["", "1000", "1500", "3000", "5000"]],
      ],
    });
    await choose(page, "wait", 3000);
    assert.deepEqual(await saved(page), { wait: 3000 });
    assert.deepEqual(await call(page, "keys.settings()"), { enabled: true, wait: 3000 });
    // The page's own wait removes the reader's from storage.
    await choose(page, "wait", "");
    assert.equal(await saved(page), null);
    await choose(page, "enabled", false);
    assert.deepEqual(await saved(page), { enabled: false });
    await closeHelp(page);
    await press(page, "t");
    await press(page, "k", { ctrl: true });
    assert.deepEqual(await log(page), ["Control+k"]);
  });

  test("the off switch marks character-key rows off while combinations still fire", async () => {
    const page = await open(HELP);
    await openHelp(page);
    await choose(page, "enabled", false);
    assert.deepEqual(await saved(page), { enabled: false });
    const offs =
      await page.evaluate(`[...document.querySelectorAll("#help [data-keys-table] tbody tr")]
      .map((row) => [row.cells[1].textContent, row.hasAttribute("data-keys-off")])`);
    assert.deepEqual(offs, [
      ["Help", true],
      ["Theme", true],
      ["Archive the thread", true],
      ["First", true],
      ["Contents", true],
      ["Command", false],
      ["Search", true],
      // The fixed Escape row is no binding: the off switch never covers it.
      ["Leave a field", false],
    ]);
    assert.deepEqual((await rows(page))[1], ["[T] off", "Theme"]);
    // An off row's button still runs its action: a click is no character-key shortcut.
    await clickRow(page, "Theme");
    assert.deepEqual(await log(page), ["t"]);
    for (const key of ["t", "g", "c"]) await press(page, key);
    await press(page, "k", { ctrl: true });
    assert.deepEqual(await log(page), ["t", "Control+k"]);
  });

  test("lists Escape's fixed row last, never off, and Escape on its controls closes it natively", async () => {
    const page = await open(HELP);
    await openHelp(page);
    await choose(page, "enabled", false);
    const fixed = await page.evaluate(`(() => {
      const row = document.querySelector("#help [data-keys-table] tbody tr:last-child");
      return [row.hasAttribute("data-keys-fixed"), row.hasAttribute("data-keys-off"),
        row.cells[0].innerHTML, row.cells[1].textContent, row.querySelector("button")];
    })()`);
    assert.deepEqual(fixed, [true, false, "<kbd>Esc</kbd>", "Leave a field", null]);
    await page.evaluate(`document.querySelector("#help [data-keys-settings] [name=wait]").focus()`);
    await pressEscape(page);
    assert.equal(await isOpen(page), false);
  });

  test("carries the screen-reader note", async () => {
    const page = await open(HELP);
    await openHelp(page);
    const note = await page.evaluate(
      `document.querySelector("#help [data-keys-note]").textContent`,
    );
    for (const text of ["NVDA+F2", "JAWS+3", "Narrator+3", "VO+Tab"])
      assert.ok(note.includes(text), text);
  });

  test("another tab's change shows in the dialog on the next open, and changes what fires", async () => {
    const one = await open(HELP);
    const two = await open(HELP);
    await openHelp(two);
    await closeHelp(two);
    await openHelp(one);
    await choose(one, "wait", 5000);
    await choose(one, "enabled", false);
    await sleep(two, 50);
    await openHelp(two);
    assert.deepEqual((await rows(two))[1], ["[T] off", "Theme"]);
    const controls = `[...document.querySelectorAll("#help [data-keys-settings] :is(input, select)")]`;
    assert.deepEqual(
      await two.evaluate(
        `${controls}.map((el) => (el.type === "checkbox" ? el.checked : el.value))`,
      ),
      [false, "5000"],
    );
    await closeHelp(two);
    await press(two, "t");
    await press(two, "k", { ctrl: true });
    assert.deepEqual(await log(two), ["Control+k"]);
  });
});
