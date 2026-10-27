# Standards

The judgement calls the check can't enforce, one line each, for the standards-reviewer. What
`mise run check` enforces is never restated here. They are spike-html-apps' Design, Layers, and
Code calls that apply to the foundation, with the source layer's calls that still hold.

The architecture pages that apply, in the architecture repository:

- `principles/minimal-footprint.md`
- `principles/rolling-currency.md`
- `principles/independent-releases.md`
- `principles/validation-first.md`

## Design

- spike-html-design v0.7.0 is the visual baseline: native elements keep its styling, and every
  profile renders as it does there.
- A sheet is finished in every profile the baseline carries, light and dark.
- Focus is always visible, motion is brief and honours reduced motion, and nothing shifts layout.
- Density, alignment, and spacing in the tool sheets come from the tokens, never a literal.

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
  `From|Adapted from <repo> (<commit>): <path>`; the immediate source comes first, and an earlier
  source's line stays below it.
- Sources use `.ts` relative specifiers, which tsc rewrites; handwritten `.d.ts` keep `.js`.
- A lazy load uses a literal `import()`.
- The browser tier tests `dist/`, and no server transforms what it serves.
- A mise task runs one script or one command, and `check` is a depends list.
