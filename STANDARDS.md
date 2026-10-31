# Standards

The judgement calls the check can't enforce, one line each, for the standards-reviewer. What
`mise run check` enforces is never restated here. They are spike-html-apps' Design, Layers, and
Code calls that apply to the foundation, with the source layer's calls that still hold.

The architecture pages that apply, in the architecture repository:

- `principles/minimal-footprint.md`
- `principles/rolling-currency.md`
- `principles/independent-releases.md`
- `principles/downward-dependencies.md`
- `principles/validation-first.md`

## Design

- spike-html-design v0.7.0 is the visual baseline: native elements keep its styling, and every
  profile renders as it does there. The one deliberate exception: native `progress` takes
  `--accent-color`, magenta by default, where v0.7.0's takes the interaction color, because
  progress reports state rather than inviting interaction.
- A sheet is finished in every profile the baseline carries, light and dark.
- Focus is always visible, motion is brief and honours reduced motion, and nothing shifts layout.
- Density, alignment, and spacing in the tool sheets come from the tokens, never a literal.
- A visual change's session brief carries its screenshots per profile; the architect's acceptance
  is the design review, and a passing check alone doesn't ship one.
- The baseline is open for extension, closed for modification: a consumer extends it in its own
  layers, and a new profile joins as a unit beside the built-in ones.
- Page layout is the consumer's: the foundation's sheets set no page column, gutters, or section
  spacing, and the demo pages take theirs from their own layer, `demo/demo.css`.

## Conformance

- A profile an extension package ships, in any facet, must pass `check(facet, name)` from
  `./conformance.js`. The contract is that facet's rules in `RULES`, and nothing more.

## Package

- The package is `@jaimestill/spike-html-apps-foundation`, the bottom row of spike-html-apps'
  layer table, and the tool sheets stay in it.
- It declares no runtime dependency and imports no layer above it: the foundation is the platform
  alone.
- The keys family gives the app the means to bind; the foundation binds no key itself.
- `dist/` lives only in a release tag's tree, the pack, never on a branch.
- Releases are `v<version>` annotated tags cut by `release.yml` from `package.json`'s version,
  each with its `CHANGELOG.md` section, and never changed or re-cut.

## Code

- Code meets the bar of spike-html-conventions' `layers/` code at a88828a: a 2–4 line header, a
  one-line doc comment per export, and comments only for a non-obvious why.
- A copied file names its source repository and commit in a provenance line, which reads
  `From|Adapted from <repo> (<commit>): <path>`. It names the immediate source alone; that source
  keeps the earlier lines.
- Sources use `.ts` relative specifiers, which tsc rewrites; handwritten `.d.ts` keep `.js`.
- Tests are TypeScript run under Node's type stripping, erasable syntax only, type-checked by
  `tsconfig.test.json`; browser-served fixtures stay `.js`.
- A lazy load uses a literal `import()`.
- The browser tier tests `dist/`, and no server transforms what it serves.
- A mise task runs one script or one command, and `check` is a depends list.
