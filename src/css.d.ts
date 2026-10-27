// A CSS module script, `import sheet from "./x.css" with { type: "css" }`: one CSSStyleSheet.
// From spike-html-packages-foundation (5dd8a58): src/css.d.ts.
// Adapted from spike-html-conventions (a88828a): layers/css.d.ts, without its Vite plugin.

declare module "*.css" {
  const sheet: CSSStyleSheet;
  export default sheet;
}
