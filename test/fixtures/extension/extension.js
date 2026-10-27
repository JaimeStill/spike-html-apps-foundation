// The extension fixture's registration module: a profile from outside the package joins as a
// built-in unit does, calling register() from the built package's registry.js, which shares one
// store with every other copy, so the foundation's preferences and menu read it unchanged.

import { register } from "../../../dist/registry.js";

register("color", "extension");
