// The formatters' emitted declaration against v0.1.0's handwritten one, both printed by tsc, and
// tsc, under tsconfig.json, refusing runtime code in a declaration file, run against scratch trees.
// Adapted from spike-html-packages-foundation (5dd8a58): test/unit/declarations.test.js.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = join(import.meta.dirname, "../..");
// The check's own tsc, mise.toml's TypeScript-Go pin, not the typescript package in node_modules.
const tsc = "tsc";

/** v0.1.0's handwritten format.d.ts as tsc's declaration printer writes it: the file compiled as
 * a .ts source in scratch, under tsconfig.json, its declaration emitted, so the comparison with the
 * build's emit is one printer's against the same printer's, layout aside. */
function printed(declaration) {
  const scratch = mkdtempSync(join(tmpdir(), "declarations-"));
  try {
    mkdirSync(join(scratch, "src"));
    copyFileSync(declaration, join(scratch, "src/format.ts"));
    const compilerOptions = { rootDir: "src", outDir: "out", emitDeclarationOnly: true };
    writeFileSync(
      join(scratch, "tsconfig.json"),
      JSON.stringify({ extends: join(root, "tsconfig.json"), compilerOptions, include: ["src"] }),
    );
    const run = spawnSync(tsc, ["-p", "."], { cwd: scratch, encoding: "utf8" });
    assert.equal(run.error, undefined, `tsc didn't run: ${run.error}`);
    assert.equal(run.status, 0, run.stdout);
    return readFileSync(join(scratch, "out/format.d.ts"), "utf8");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Each "path code" tsc reports, sorted, for `files` (paths under layers/ to sources) in scratch. */
function check(files) {
  const scratch = mkdtempSync(join(tmpdir(), "declarations-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(scratch, "layers", path, ".."), { recursive: true });
      writeFileSync(join(scratch, "layers", path), `${source}\n`);
    }
    writeFileSync(
      join(scratch, "tsconfig.json"),
      JSON.stringify({ extends: join(root, "tsconfig.json"), include: ["layers"] }),
    );
    const run = spawnSync(tsc, ["--noEmit", "-p", "."], { cwd: scratch, encoding: "utf8" });
    assert.equal(run.error, undefined, `tsc didn't run: ${run.error}`);
    const errors = [...run.stdout.matchAll(/^layers\/(\S+)\(\d+,\d+\): error (TS\d+)/gm)];
    // An error outside the scratch layers/ (a config tsc can't read, say) would leave the list
    // empty and pass the cases that expect none, so every error tsc reports must be one of these.
    assert.equal(run.stdout.match(/error TS\d+/g)?.length ?? 0, errors.length, run.stdout);
    return errors.map(([, path, code]) => `${path} ${code}`).sort();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const runtime = {
  "statement.d.ts": `export interface A {}\nconsole.log("runs");`,
  "body.d.ts": `export declare function f(): number;\nexport function g(): number { return 1; }`,
  "binding.d.ts": `let count = 0;`,
  "method.d.ts": `export declare class C { m(): void { } }`,
  "format.d.ts": `export declare function formatBytes(bytes: number): string;\nformatBytes(1);`,
};

// skipLibCheck off is the guard: with it on, tsc skips every .d.ts, and these errors with them.
describe("formatter declarations", () => {
  // The formatters' signatures are v0.1.0's: its declaration, kept as the fixture, is the
  // contract src/format.ts's emit keeps, JSDoc included. It reads the dist/ mise run build wrote.
  test("the built format.d.ts declares v0.1.0's signatures exactly", () => {
    const fixture = join(root, "test/fixtures/v0.1.0/format.d.ts");
    assert.equal(readFileSync(join(root, "dist/format.d.ts"), "utf8"), printed(fixture));
  });

  test("tsc, under tsconfig.json, refuses runtime code in a declaration file", () => {
    assert.deepEqual(check(runtime), [
      "binding.d.ts TS1039",
      "binding.d.ts TS1046",
      "body.d.ts TS1183",
      "format.d.ts TS1036",
      "method.d.ts TS1183",
      "statement.d.ts TS1036",
    ]);
  });

  test("tsc, under tsconfig.json, checks a declaration file's types", () => {
    assert.deepEqual(check({ "types.d.ts": `export type A = Missing;` }), ["types.d.ts TS2304"]);
  });

  test("tsc accepts declarations alone", () => {
    assert.deepEqual(
      check({
        "ok.d.ts": [
          `export type BytesOptions = Omit<Intl.NumberFormatOptions, "style" | "unit">;`,
          `export interface RelativeOptions extends Intl.RelativeTimeFormatOptions { now?: Date }`,
          `export declare const a: BytesOptions;`,
          `export declare function f(x: number): string;`,
        ].join("\n"),
      }),
      [],
    );
  });
});
