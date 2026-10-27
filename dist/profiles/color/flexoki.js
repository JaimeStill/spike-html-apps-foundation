// The Flexoki unit's registration module, beside its sheet, flexoki.css:
// importing it registers flexoki under the color facet, and that is all. It loads no CSS: the
// page links the sheet.
import { register } from "../../registry.js";
register("color", "flexoki");
