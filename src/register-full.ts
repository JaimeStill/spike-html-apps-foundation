// The full registration module, the JS mirror of page-full.css: a plain aggregator of the built-in
// units, importing each one's registration module, each facet's default first, in the order the
// entry imports their sheets, so the registry lists them in that order. It registers nothing of
// its own: each unit's module is complete alone. Like the entry it is self-contained, not an
// add-on to register.js: a page that links page-full.css imports this module alone. It loads no
// CSS.
// Adapted from spike-html-design (fe75220): modules/register-full.js.

import "./profiles/color/flexoki.ts";
import "./profiles/color/primer.ts";
import "./profiles/color/catppuccin.ts";
import "./profiles/color/everforest.ts";
import "./profiles/space/regular.ts";
import "./profiles/space/compact.ts";
import "./profiles/type/mono.ts";
import "./profiles/type/sans.ts";
