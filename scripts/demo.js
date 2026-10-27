// mise run demo: serves the repository through the browser tier's static server and prints the
// demo pages' URLs, which load dist/, until Ctrl-C.
// Adapted from spike-html-packages-foundation (5dd8a58): scripts/demo.js.

import { serve } from "../test/browser/support/server.js";

const server = await serve();
for (const page of ["tools", "profiles", "theme", "unit", "keys", "format"]) {
  console.log(`${server.origin}/demo/${page}.html`);
}
process.once("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
