// The mono unit's registration module, beside its sheet, mono.css:
// importing it registers mono under the type facet, and that is all. It loads no CSS: the
// page links the sheet.

import { register } from "../../registry.ts";

register("type", "mono");
