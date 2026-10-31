# spike-html-apps-foundation

The foundation layer of [spike-html-apps](https://github.com/JaimeStill/spike-html-apps), the
native web stack's base: the baseline stylesheets (tokens, reset, and elements), the profiles for
color, space, and type, the tool sheets (meta, structure, and utilities), the DOM helpers, the
registry and keys family, the theme preferences and menu, the conformance check for profiles, and
the Intl formatters. It is plain CSS and ES modules with their type declarations, with no
dependencies, and is released by git tag.

## Install

Each release is a tag, `v<version>`, whose tree is the package as `pnpm pack` builds it:
`package.json`, this README, the LICENSE, and `dist/`. Install it by the tag:

```
npm install --allow-git=root github:JaimeStill/spike-html-apps-foundation#v0.2.3
pnpm add github:JaimeStill/spike-html-apps-foundation#v0.2.3
bun add github:JaimeStill/spike-html-apps-foundation#v0.2.3
```

npm 12 refuses git dependencies unless `--allow-git` allows them; `root` allows the ones the
project itself declares. Each GitHub release also carries the tarball.

## Use

The package is `@jaimestill/spike-html-apps-foundation`. A page links one page entry and imports
the modules by their `.js` subpaths. The lean entry, `page.css`, carries the default profiles, and
`register.js` registers them. `<base>` is where the package's `dist/` is served from, such as
`node_modules/@jaimestill/spike-html-apps-foundation/dist`:

```html
<link rel="stylesheet" href="<base>/page.css" />
<script type="module" blocking="render" src="<base>/register.js"></script>
<script type="module" blocking="render" src="<base>/preferences.js"></script>
<script type="module">
  import { register } from "@jaimestill/spike-html-apps-foundation/keys.js";
</script>
```

- `./*.css`: the stylesheets: the page entries, `page.css` and `page-full.css`, `baseline.css`,
  the tool sheets, `meta.css`, `structure.css`, and `utilities.css`, and the menu's
  `theme-menu.css`, each self-layered so a shadow root adopts it alone.
- `./profiles/<facet>/<name>.{css,js}`: the built-in profiles, each a unit of a sheet and a
  registration module. Color has `flexoki` (the default), `primer`, `catppuccin`, and
  `everforest`; space has `regular` (the default) and `compact`; type has `mono` (the default)
  and `sans`. A page adds a unit by linking its sheet after `page.css` and importing its module
  beside `register.js`. `page-full.css` and `register-full.js` import every unit, in place of
  `page.css` and `register.js`.
- `./*.js`: the modules, with their `.d.ts`: `dom.js`, `registry.js`, `keys.js`, `keys-help.js`,
  `keys-grammar.js`, `register.js`, `register-full.js`, `preferences.js`, `theme-menu.js`,
  `conformance.js`, and `format.js`.
- `./preferences.js`: applies the reader's stored theme choice to the root before first paint and
  follows other tabs' saves. Its `<sl-theme-menu>` opens on the invoker command `--open` and loads
  `theme-menu.js` on first open; the menu's sheet sits in the layer `foundation.theme-menu`. A
  page loads it with `blocking="render"` after its registration modules.
- `./conformance.js`: `check(facet, name)` reads a registered profile's computed values and
  resolves to a failure, a rule from `RULES` and a message, for each rule the profile breaks; an
  empty list conforms.
- `./format.js`: the Intl formatters, `formatBytes`, `formatDate`, `formatDateTime`,
  `formatRelative`, and `formatDuration`, each taking an optional locale and options.
- `./css`: the ambient `*.css` declaration for CSS module scripts,
  `import sheet from "./x.css" with { type: "css" }`, for a project's `types`.

The primary interaction color is the hook `--interaction-color`, which the baseline and
`meta.css` read with `--blue` as its fallback and no profile declares. Links, the focus outline,
the caret, selected text, the hover border of fields and neutral buttons, and `accent-color`, which
tints checkboxes, radios, ranges, and progress bars, all follow it. A page sets it on any element,
in its own layer, and that subtree follows: `.danger-zone { --interaction-color: var(--red); }`.

A package outside the foundation adds a profile as a built-in unit does: a sheet that declares
its facet's tokens in one `:where([data-<attribute>="<name>"])` block inside that facet's layer,
`foundation.tokens.<facet>`, and a registration module that calls `register(facet, name)` from
`registry.js`. The page links the sheet after its entry and imports the module, and the theme menu
then lists the profile. The profile must pass `check(facet, name)`.

## Development

Tasks run through [mise](https://mise.jdx.dev):

```
mise run install      # the pinned tools and node_modules; reads the network
mise run check        # lint, types, build, and the unit and browser tiers; reads no network
mise run build        # src/ into dist/
mise run demo         # serve the demo pages on dist/
mise run screenshots  # capture the demo pages light and dark, shown inline in kitty
mise run currency     # report every tool, package, action pin, and tooling tag behind its latest
```

The demo pages, in `demo/`, are `tools.html` (every tool class), `profiles.html` (the tools page
switched through every profile), `theme.html` (the theme menu on `page-full.css`), `unit.html`
(`page.css` with the Primer unit), `keys.html`, and `format.html`. Page layout belongs to the
consumer, so each page links `demo.css`, a `demo` layer of its own that lays out the column and
its sections. `mise run screenshots` renders the tools page, keys help, and the theme menu, wide
and narrow, light and dark, on `page-full.css`. It runs the `spike-html-apps-screenshots` bin of
[spike-html-apps-tooling](https://github.com/JaimeStill/spike-html-apps-tooling), the
devDependency the browser tier's driver and server also come from, over the capture description
in `scripts/screenshots.config.ts`, and passes its arguments on. With none it captures the default
profile, and `--all` captures every color and compact and sans; `mise run screenshots -- --help`
lists the other flags, and the tooling's README documents them. The check never runs it.

A push to main whose `package.json` version has no tag yet releases it: the check, then the pack
committed and tagged, and a GitHub release from `CHANGELOG.md`.

## Provenance

The layer is copied from spike-html-packages-foundation at 5dd8a58, its v0.1.0. The profiles it
adds, the registration modules, the preferences module, the theme menu, the conformance check, and
the full entry are ported from spike-html-design at fe75220, its v0.7.0. Each copied file that
takes comments names its source in a provenance line; the JSON files, which take none, carry no
line.

## License

[Apache License 2.0](LICENSE).
