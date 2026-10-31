// The full registration module, page-full.css's: it imports every built-in unit's module, in the
// order the entry imports their sheets, so the registry lists them in that order, and registers
// nothing of its own. A page that links page-full.css imports it in place of register.js.
// Adapted from spike-html-design (fe75220): modules/register-full.js.
import "./profiles/color/flexoki.js";
import "./profiles/color/primer.js";
import "./profiles/color/catppuccin.js";
import "./profiles/color/everforest.js";
import "./profiles/space/regular.js";
import "./profiles/space/compact.js";
import "./profiles/type/mono.js";
import "./profiles/type/sans.js";
