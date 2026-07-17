/**
 * Target packs: every pack file must be registered with matching id.
 */
import { test, expect } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listTargetPacks, registeredTargetPackIds } from "./registry";

const dir = import.meta.dir;

const packFiles = (): string[] =>
  readdirSync(dir)
    .filter((name) => {
      if (name === "contract.ts" || name === "registry.ts" || name.endsWith(".test.ts")) return false;
      if (!name.endsWith(".ts")) return false;
      return statSync(join(dir, name)).isFile();
    })
    .map((n) => n.replace(/\.ts$/, ""));

test("every target pack file is registered", () => {
  const files = packFiles().sort();
  const ids = registeredTargetPackIds().sort();
  expect(ids).toEqual(files);
});

test("each pack id is non-empty and has targets + mock", () => {
  for (const p of listTargetPacks()) {
    expect(p.id.length).toBeGreaterThan(0);
    expect(p.targets.length).toBeGreaterThan(0);
    expect(p.mockHtml.length).toBeGreaterThan(0);
  }
});
