# Changelog

All notable changes to `@jaimestill/spike-html-apps-foundation` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `formatBytes` words a count under 1 kB with the byte unit's long form, which Intl pluralizes and
  localizes, so en-US reads "0 bytes", "1 byte", and "13 bytes", not "0 byte" and "13 byte". The
  units from kB up print as before ("1 kB", "1.5 MB"), and a caller's own `unitDisplay` still sets
  every unit, bytes included.

## [0.2.1] - 2026-10-30

### Fixed

- The keys runtime tests the field a key was typed in, not the document's retargeted
  `event.target`, so in a field inside an open shadow root at any depth (an input, textarea,
  select, or contenteditable in a component, or in a component inside one) a single-key binding no
  longer fires and swallows the character, and Escape outside a modal blurs that field as it does
  in light DOM.

### Changed

- The keys runtime's input-method guard no longer reads the deprecated `keyCode`: it passes over
  a press named `Process` or marked `isComposing`, and it tracks `compositionend`, so the Enter or
  Escape WebKit sends after a composition ends, not composing, neither fires a binding nor blurs
  the field. The first keydown within 100 ms of `compositionend` takes the mark.

## [0.2.0] - 2026-10-27

### Added

- The formatters' runtime: `./format.js` runs the five Intl formatters `./format.d.ts` declared,
  from `src/format.ts`, with v0.1.0's signatures unchanged.
- Five profiles: Primer, Catppuccin, and Everforest for color, compact for space, and sans for
  type, ported from spike-html-design v0.7.0 (fe75220).
- Each built-in profile as a self-contained unit, its sheet at `./profiles/<facet>/<name>.css` and
  its registration module at `./profiles/<facet>/<name>.js`. A lean page links a unit's sheet after
  `page.css` and imports its module to add that one profile.
- The registration modules: `register.js`, beside `page.css`, registers the three defaults, and
  `register-full.js`, beside `page-full.css`, registers every built-in profile.
- The full page entry, `page-full.css`: every unit's sheet, under `page.css`'s layer order. It and
  `register-full.js` only aggregate the units and define nothing of their own.
- The preferences module, `./preferences.js`: the reader's theme choice applied to the root before
  first paint, kept under the localStorage key `spike-html-apps-foundation.preferences`, and
  followed across tabs. Its `<sl-theme-menu>` opens on the invoker command `--open` and loads the
  menu, `./theme-menu.js`, on first open; the menu's sheet, `./theme-menu.css`, sits in the
  `foundation.theme-menu` layer.
- The conformance module, `./conformance.js`: `check(facet, name)` reports each rule of the
  facet's `RULES` that a color, space, or type profile breaks.
- `mise run screenshots [--keep]`: the tools page, keys help, and the theme menu, wide and narrow,
  in each of the four colors and in compact and sans, light and dark, in the pinned
  chrome-headless-shell, shown inline in kitty and removed on exit unless `--keep` is given. The
  check never runs it.

### Changed

- **Breaking:** the page-wide names move under `spike-html-apps-foundation.*`: the registry's and
  the keys family's global symbols, and the keys settings' localStorage key, from
  `spike-html-design.keys` to `spike-html-apps-foundation.keys`. A reader's saved keys settings
  under the old key are no longer read.
- **Breaking:** the default profiles' sheets move from `./baseline/tokens/<facet>/<name>.css` to
  `./profiles/<facet>/<name>.css`; the old paths are gone.
- `page.css`'s layer order ends with `foundation.theme-menu`.
- The type-check's lib moves to es2025, for `Intl.DurationFormat`'s types.

### Removed

- The typescript-eslint entries excluded from pnpm's minimum release age: 8.72.1 has aged past it.

## [0.1.0] - 2026-10-27

### Added

- The foundation layer, first released under this name: copied from
  spike-html-packages-foundation v0.1.0 (5dd8a58), its pins brought to their latest. It holds the
  baseline stylesheets, the meta, structure, and utilities tool sheets, and the `page.css` entry;
  the DOM helpers; the registry and keys family, its help dialog loaded lazily; the formatter
  declarations; and the ambient `*.css` declaration for CSS module scripts, as the `./css` types
  subpath.
- The release by tag: `v<version>`, whose tree is the pack, with the tarball on its GitHub
  release.

[Unreleased]: https://github.com/JaimeStill/spike-html-apps-foundation/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/JaimeStill/spike-html-apps-foundation/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JaimeStill/spike-html-apps-foundation/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JaimeStill/spike-html-apps-foundation/releases/tag/v0.1.0
