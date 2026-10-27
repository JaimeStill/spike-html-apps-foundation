// The Primer unit's registration module, beside its sheet, primer.css:
// importing it registers primer under the color facet, and that is all. It loads no CSS: the
// page links the sheet.

import { register } from "../../registry.ts";

register("color", "primer");
