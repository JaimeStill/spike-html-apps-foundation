# Changelog

All notable changes to `@jaimestill/spike-html-apps-foundation` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-27

### Added

- The formatters' runtime: `./format.js` runs the five Intl formatters `./format.d.ts` declared,
  from `src/format.ts`, with v0.1.0's signatures unchanged.
- Five profiles: Primer, Catppuccin, and Everforest for color, compact for space, and sans for
  type, ported from spike-html-design v0.7.0 (fe75220).
- Each built-in profile as a self-contained unit, its sheet at `./profiles/<facet>/<name>.css` and
  its registration module at `./profiles/<facet>/<name>.js`. A lean page links a unit's sheet after
  `page.css` and imports its module to add that one profile.
- The registration modules: `register.js`, for `page.css`, registers the defaults, and
  `register-full.js` is the full page entry's.
- The full page entry, `page-full.css`, and `register-full.js`: each aggregates every unit's sheet
  or module, the entry under the same layer order as `page.css`.
- The preferences module, `./preferences.js`: the reader's theme choice applied to the root before
  first paint, kept under the localStorage key `spike-html-apps-foundation.preferences`, and
  followed across tabs. Its `<sl-theme-menu>` opens on the invoker command `--open` and loads the
  menu, `./theme-menu.js`, on first open; the menu's sheet, `./theme-menu.css`, sits in the
  `foundation.theme-menu` layer.
- The conformance module, `./conformance.js`: `check(facet, name)` reports how a color, space, or
  type profile breaks the facet's contract.
- `mise run screenshots`: the tools page, keys help, and the theme menu, wide and narrow, in every
  profile and scheme, in the pinned chrome-headless-shell, shown inline in kitty. The check never
  runs it.

### Changed

- **Breaking:** the page-wide names move under `spike-html-apps-foundation.*`: the registry's and
  the keys family's global symbols, and the keys settings' localStorage key, from
  `spike-html-design.keys` to `spike-html-apps-foundation.keys`. A reader's saved keys settings
  under the old key are no longer read.
- **Breaking:** the default profiles' sheets move from `./baseline/tokens/<facet>/<name>.css` to
  `./profiles/<facet>/<name>.css`; the old paths are gone.
- `page.css` and `page-full.css` order `foundation.theme-menu` last among the foundation's layers.
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

[Unreleased]: https://github.com/JaimeStill/spike-html-apps-foundation/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/JaimeStill/spike-html-apps-foundation/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JaimeStill/spike-html-apps-foundation/releases/tag/v0.1.0
