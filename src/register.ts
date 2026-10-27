// The lean registration module, the JS mirror of page.css: it registers the profiles that entry
// ships, each facet's default, flexoki, regular, and mono. A page that links page.css imports it;
// one that links page-full.css imports register-full.js instead. It loads no CSS.
// Adapted from spike-html-design (fe75220): modules/register.js.

import { register } from "./registry.ts";

register("color", "flexoki");
register("space", "regular");
register("type", "mono");
