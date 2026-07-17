/**
 * Folders-as-schema parity for CSS starter recipes.
 */
import { test, expect } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listCssRecipes, registeredCssRecipeIds } from "./registry";

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

test("every CSS recipe folder is registered", () => {
  expect(registeredCssRecipeIds().sort()).toEqual(packFolders().sort());
});

test("each recipe has css body", () => {
  for (const r of listCssRecipes()) {
    expect(r.css.trim().length).toBeGreaterThan(10);
    expect(r.title.length).toBeGreaterThan(0);
  }
});
