// mise run demo: serves the repository through the tooling's static server, as the browser tier
// does, and prints the demo pages' URLs, which load dist/, until Ctrl-C.
// Adapted from spike-html-packages-foundation (5dd8a58): scripts/demo.js.

import { join } from "node:path";

import { serve } from "@jaimestill/spike-html-apps-tooling/server.js";

const server = await serve({ root: join(import.meta.dirname, "..") });
for (const page of ["tools", "profiles", "theme", "unit", "keys", "format", "hooks"]) {
  console.log(`${server.origin}/demo/${page}.html`);
}
process.once("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
