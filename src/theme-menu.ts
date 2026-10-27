// The theme menu, which <sl-theme-menu> loads on its first open: a modal native <dialog> in light
// DOM, so the elements layer styles it, with a radio row each for color, scheme, space, and type, a
// live preview, and Save and Cancel. Every change applies at once to the preview and the page. Its
// sheet, theme-menu.css, is adopted onto the document once, in the layer foundation.theme-menu.
// Adapted from spike-html-design (fe75220): modules/theme-menu.js.

import { ATTRIBUTES, apply, KEY, read, SCHEMES, save, setOpen } from "./preferences.ts";
import type { Choice, Key } from "./preferences.ts";
import { DEFAULTS, FACETS, profiles } from "./registry.ts";
import sheet from "./theme-menu.css" with { type: "css" };

/** The rows, in order: each key of a choice with its legend. */
const SECTIONS: readonly (readonly [Key, string])[] = [
  ["color", "Color"],
  ["scheme", "Scheme"],
  ["space", "Space"],
  ["type", "Type"],
];

/**
 * The preview card's contents without its frame or token strip; {id} names its input. Its neutral
 * button reads Retry, not the card's Cancel, so it never reads as the menu's own.
 */
const PREVIEW = `<h3>Nightly build</h3>
<p>Read the <a href="#release-notes">release notes</a>, run <code>mise run check</code>, or press <kbd>Ctrl</kbd> <kbd>K</kbd> to search.</p>
<p class="theme-menu-buttons"><button type="button">Retry</button> <button type="button" class="button-blue">Deploy</button></p>
<div class="field"><label for="{id}">Branch</label><input type="text" id="{id}" value="main" /></div>
<table class="table-striped">
<thead><tr><th scope="col">Run</th><th scope="col">Status</th><th scope="col">Time</th></tr></thead>
<tbody><tr><td>1204</td><td>passed</td><td>2m 14s</td></tr><tr><td>1205</td><td>failed</td><td>48s</td></tr><tr><td>1206</td><td>queued</td><td>—</td></tr></tbody>
</table>`;

/** An open menu: its dialog, preview, what applied when it opened, and the raw stored value then,
 * to tell whether another tab saved. */
interface Open {
  dialog: HTMLDialogElement;
  preview: HTMLElement;
  snapshot: Choice;
  stored: string | null;
}

/** Each element's open menu. */
const menus = new WeakMap<HTMLElement, Open>();

/** A section's names: the registry's for a facet, SCHEMES for the scheme. */
function options(key: Key): string[] {
  return key === "scheme" ? [...SCHEMES] : profiles(key);
}

/** What applies to the root now, as a choice: each facet's attribute, or its default where none is
 * set, and the scheme, system when data-scheme is absent. */
function current(): Choice {
  const root = document.documentElement;
  const choice = { scheme: root.getAttribute(ATTRIBUTES.scheme) ?? SCHEMES[0] } as Choice;
  for (const facet of FACETS) {
    choice[facet] = root.getAttribute(ATTRIBUTES[facet]) ?? DEFAULTS[facet];
  }
  return choice;
}

/** The raw stored value, or null when nothing is stored or storage is blocked. */
function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Adds the menu's sheet to the document's adopted sheets, once. */
function adopt(): void {
  if (!document.adoptedStyleSheets.includes(sheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
}

/** The dialog for element, its rows listing what the registry lists now, each checked at choice.
 * The ids derive from element's id, so two menus on a page never share one. */
function build(element: HTMLElement, choice: Choice): HTMLDialogElement {
  const base = element.id || "theme-menu";
  const dialog = document.createElement("dialog");
  dialog.className = "theme-menu";
  dialog.setAttribute("aria-labelledby", `${base}-title`);
  dialog.innerHTML = `<h2 id="${base}-title">Theme</h2>
<div class="theme-menu-body">
<div class="theme-menu-rows"></div>
<div class="theme-menu-preview" inert>${PREVIEW.replaceAll("{id}", `${base}-preview-branch`)}</div>
</div>
<footer>
<button type="button" data-action="cancel" aria-keyshortcuts="Escape">Cancel <kbd>Esc</kbd></button>
<button type="button" data-action="save" aria-keyshortcuts="T">Save <kbd>T</kbd></button>
</footer>`;
  const rows = dialog.querySelector(".theme-menu-rows") as HTMLElement;
  for (const [key, legend] of SECTIONS) {
    rows.append(row(`${base}-${key}`, key, legend, choice[key]));
  }
  return dialog;
}

/** A section's radio group, named name, its radios listing the section's options, the one at value
 * checked. Each is drawn as ◀ value ▶, the other radios and labels hidden visually but kept in the
 * group, so a screen reader announces the value's place among them. Names come from whatever
 * registered them, so they are set as text and attribute values, never parsed as markup. */
function row(name: string, key: Key, legend: string, value: string): HTMLFieldSetElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "theme-menu-row";
  fieldset.dataset.section = key;
  const title = document.createElement("legend");
  title.textContent = legend;
  fieldset.append(title, stepper(-1, "◀"));
  for (const option of options(key)) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    Object.assign(radio, { type: "radio", name, value: option, checked: option === value });
    label.append(radio, option);
    fieldset.append(label);
  }
  fieldset.append(stepper(1, "▶"));
  return fieldset;
}

/** A row's arrow, which steps it by delta when clicked. It is hidden from assistive technology and
 * takes no focus: the radios are the control, and the arrows draw it. */
function stepper(delta: number, glyph: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.step = String(delta);
  span.ariaHidden = "true";
  span.textContent = glyph;
  return span;
}

/** The dialog's checked value per section, as a choice. */
function selection(dialog: HTMLDialogElement): Choice {
  return Object.fromEntries(
    SECTIONS.map(([key]) => [
      key,
      dialog.querySelector<HTMLInputElement>(`[data-section="${key}"] :checked`)?.value ??
        options(key)[0],
    ]),
  ) as Choice;
}

/** The row holding node, or null. */
function rowOf(node: EventTarget | Element | null): HTMLFieldSetElement | null {
  return node instanceof Element ? node.closest<HTMLFieldSetElement>(".theme-menu-row") : null;
}

/** Checks the radio delta places from row's checked one, wrapping as native radios do, focuses it,
 * and applies the new selection. */
function step(menu: Open, row: HTMLFieldSetElement, delta: number): void {
  const radios = [...row.querySelectorAll("input")];
  const at = radios.findIndex((radio) => radio.checked);
  const next = radios[(at + delta + radios.length) % radios.length];
  next.checked = true;
  next.focus();
  update(menu);
}

/** Focuses the checked radio of the row delta rows from the one holding focus, stopping at the
 * first and the last. From outside the rows, down enters the first and up the last. */
function move(menu: Open, delta: number): void {
  const rows = [...menu.dialog.querySelectorAll<HTMLFieldSetElement>(".theme-menu-row")];
  const at = rows.indexOf(rowOf(document.activeElement) as HTMLFieldSetElement);
  const to = at === -1 ? (delta > 0 ? 0 : rows.length - 1) : at + delta;
  rows[Math.min(Math.max(to, 0), rows.length - 1)]
    .querySelector<HTMLInputElement>(":checked")
    ?.focus();
}

/** Applies the dialog's selection to the page and the preview. */
function update(menu: Open): void {
  const choice = selection(menu.dialog);
  apply(choice);
  apply(choice, menu.preview);
}

/** Settles element's open menu: accepted, it stores the selection; otherwise it restores the stored
 * value if another tab saved while the menu was open, and the snapshot taken at open if not. Either
 * way it closes the dialog and marks the menu closed. */
function close(element: HTMLElement, accepted: boolean): void {
  const menu = menus.get(element);
  if (!menu) return;
  menus.delete(element);
  if (accepted) save(selection(menu.dialog));
  else if (stored() !== menu.stored) apply(read() ?? {});
  else apply(menu.snapshot);
  setOpen(false);
  element.toggleAttribute("data-open", false);
  if (menu.dialog.open) menu.dialog.close();
  menu.dialog.remove();
}

/**
 * Handles the keys the menu owns and stops each at the dialog, so no page-wide listener sees one.
 * A held key repeats a move, as a native arrow does, but never Save or Cancel, so holding the T
 * that opened the menu doesn't save it. T is the menu's own key, as Escape is, not a keys.js
 * binding: focus sits on a radio, a field where keys is silent, so Save carries no data-keys.
 */
function onkey(element: HTMLElement, event: KeyboardEvent): void {
  const menu = menus.get(element);
  if (!menu || event.ctrlKey || event.altKey || event.metaKey) return;
  const row = rowOf(event.target);
  switch (event.key) {
    case "ArrowUp":
    case "k":
      move(menu, -1);
      break;
    case "ArrowDown":
    case "j":
      move(menu, 1);
      break;
    case "ArrowLeft":
    case "ArrowRight":
      // Native: the radio group cycles and fires change.
      event.stopPropagation();
      return;
    case "h":
    case "l":
      if (row) step(menu, row, event.key === "h" ? -1 : 1);
      break;
    case "t":
    case "T":
      if (!event.repeat) close(element, true);
      break;
    case "Escape":
      if (!event.repeat) close(element, false);
      break;
    default:
      return;
  }
  event.preventDefault();
  event.stopPropagation();
}

/** Opens the menu inside element, from the registry as it is now, checked at what applies. */
export function open(element: HTMLElement): void {
  if (menus.has(element)) return;
  adopt();
  const snapshot = current();
  const dialog = build(element, snapshot);
  const preview = dialog.querySelector(".theme-menu-preview") as HTMLElement;
  const menu: Open = { dialog, preview, snapshot, stored: stored() };
  menus.set(element, menu);
  apply(snapshot, menu.preview);

  dialog.addEventListener("change", () => update(menu));
  dialog.addEventListener("keydown", (event) => onkey(element, event));
  dialog.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action) close(element, action === "save");
    const arrow = target?.closest<HTMLElement>("[data-step]");
    const at = rowOf(arrow ?? null);
    if (arrow && at) step(menu, at, Number(arrow.dataset.step));
  });
  // A close request the keydown didn't see (a platform back gesture) cancels, as Escape does; a
  // close by any other means settles the menu the same way.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close(element, false);
  });
  dialog.addEventListener("close", () => {
    if (menus.get(element)?.dialog === dialog) close(element, false);
  });

  element.append(dialog);
  // Marked open, another tab's save waits on the menu's Save or Cancel.
  setOpen(true);
  element.toggleAttribute("data-open", true);
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>(".theme-menu-row :checked")?.focus();
}
