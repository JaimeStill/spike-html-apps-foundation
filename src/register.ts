// The lean registration module, the JS mirror of page.css: it imports the units of the profiles
// that entry ships, each facet's default, flexoki, regular, and mono, whose modules register them.
// A page that links page.css imports it, and any other unit's module beside it for each unit's
// sheet it links after the entry; one that links page-full.css imports register-full.js instead.
// It loads no CSS.
// Adapted from spike-html-design (fe75220): modules/register.js.

import "./profiles/color/flexoki.ts";
import "./profiles/space/regular.ts";
import "./profiles/type/mono.ts";
