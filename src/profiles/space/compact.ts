// The compact unit's registration module, beside its sheet, compact.css:
// importing it registers compact under the space facet, and that is all. It loads no CSS: the
// page links the sheet.

import { register } from "../../registry.ts";

register("space", "compact");
