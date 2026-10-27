// The full registration module, the JS mirror of page-full.css: it registers every profile that
// entry ships, each facet's default first, in the order the entry imports them. Like the entry it
// is self-contained, not an add-on to register.js: a page that links page-full.css imports this
// module alone. It loads no CSS.
// Adapted from spike-html-design (fe75220): modules/register-full.js.

import { register } from "./registry.ts";

for (const name of ["flexoki", "primer", "catppuccin", "everforest"]) register("color", name);
for (const name of ["regular", "compact"]) register("space", name);
for (const name of ["mono", "sans"]) register("type", name);
