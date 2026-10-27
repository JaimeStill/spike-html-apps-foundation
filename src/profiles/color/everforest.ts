// The Everforest unit's registration module, beside its sheet, everforest.css:
// importing it registers everforest under the color facet, and that is all. It loads no CSS: the
// page links the sheet.

import { register } from "../../registry.ts";

register("color", "everforest");
