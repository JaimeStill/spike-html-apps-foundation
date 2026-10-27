# spike-html-apps-foundation

spike-html-apps-foundation is the foundation layer of
[spike-html-apps](https://github.com/JaimeStill/spike-html-apps): the baseline stylesheets, the
tool sheets, the DOM helpers, the registry and keys family, and the formatter declarations. It is
released by tag and built on by the layers above it. This context records only working knowledge
the code and the README do not express.

## Working knowledge

- The layer is a copy, under a new name, of the source its provenance lines name; an upstream fix
  is ported by hand, never taken as a dependency.
- A version bump, with its `CHANGELOG.md` section headed `## [<version>]`, is what releases; a push
  to main that bumps nothing ends green.
