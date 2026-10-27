// The full registration module, page-full.css's: it imports every built-in unit's module, in the
// order the entry imports their sheets, so the registry lists them in that order, and registers
// nothing of its own. A page that links page-full.css imports it in place of register.js.
// Adapted from spike-html-design (fe75220): modules/register-full.js.

import "./profiles/color/flexoki.ts";
import "./profiles/color/primer.ts";
import "./profiles/color/catppuccin.ts";
import "./profiles/color/everforest.ts";
import "./profiles/space/regular.ts";
import "./profiles/space/compact.ts";
import "./profiles/type/mono.ts";
import "./profiles/type/sans.ts";
