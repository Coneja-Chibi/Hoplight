/**
 * Folders-as-schema parity: every recipes/<id>/ on disk must be registered, and every
 * registered id must match its folder + default-export id. Browser cannot glob; this test
 * is the wall that keeps the registry honest.
 */
import { test, expect } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listRecipes, registeredRecipeIds } from "./registry";

const recipesDir = import.meta.dir;

const packFolders = (): string[] =>
  readdirSync(recipesDir).filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    const full = join(recipesDir, name);
    if (!statSync(full).isDirectory()) return false;
    try {
      return statSync(join(full, "index.ts")).isFile();
    } catch {
      return false;
    }
  });

test("every pack folder is registered", () => {
  const folders = packFolders().sort();
  const ids = registeredRecipeIds().sort();
  expect(ids).toEqual(folders);
});

test("each pack id matches its folder name", () => {
  for (const r of listRecipes()) {
    expect(packFolders()).toContain(r.id);
  }
});

test("listRecipes is non-empty and each has triggers", () => {
  const list = listRecipes();
  expect(list.length).toBeGreaterThan(0);
  for (const r of list) {
    expect(r.triggers.length).toBeGreaterThan(0);
    expect(r.id.length).toBeGreaterThan(0);
    expect(r.title.length).toBeGreaterThan(0);
  }
});

test("listRecipes is ordered by order then id", () => {
  const list = listRecipes();
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]!;
    const b = list[i]!;
    const ao = a.order ?? 100;
    const bo = b.order ?? 100;
    expect(ao < bo || (ao === bo && a.id <= b.id)).toBe(true);
  }
});
