/**
 * Regression: pinned platform compendiums keep explicit, duplicate-free source inventories.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

interface CoverageExpectation {
  readonly id: string;
  readonly path: string;
  readonly pin: string;
  readonly includedHeading: string;
  readonly excludedHeading: string;
  readonly included: number;
  readonly excluded: number;
}

const expectations: readonly CoverageExpectation[] = [
  {
    id: "SillyTavern",
    path: "docs/reference/platforms/sillytavern/source-coverage.md",
    pin: "70e5e4d3c239253fca4692fe82e3936cb9c4b1b1",
    includedHeading: "Included authoring pages",
    excludedHeading: "Evaluated exclusions (path-level)",
    included: 21,
    excluded: 71,
  },
  {
    id: "Marinara",
    path: "docs/reference/platforms/marinara/source-coverage.md",
    pin: "b7545a63e7e264a1cd9eeea1a5490d50c08ddb29",
    includedHeading: "Included",
    excludedHeading: "Excluded (path-level)",
    included: 57,
    excluded: 61,
  },
] as const;

const tablePaths = (markdown: string, heading: string): string[] => {
  const start = markdown.indexOf(`## ${heading}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = markdown.slice(start + heading.length + 3);
  const nextHeading = rest.indexOf("\n## ");
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return [...section.matchAll(/^\| `([^`]+\.md)` \|/gm)].map((match) => match[1]!);
};

for (const expected of expectations) {
  test(`${expected.id} source coverage is explicit and complete at its pin`, () => {
    const markdown = readFileSync(join(root, expected.path), "utf8");
    const included = tablePaths(markdown, expected.includedHeading);
    const excluded = tablePaths(markdown, expected.excludedHeading);
    const all = [...included, ...excluded];

    expect(markdown).toContain(expected.pin);
    expect(included).toHaveLength(expected.included);
    expect(excluded).toHaveLength(expected.excluded);
    expect(new Set(all).size).toBe(all.length);
    expect(all.some((path) => path.includes("*"))).toBe(false);
    expect(all.every((path) => !path.startsWith("/") && !path.includes("\\"))).toBe(true);
  });
}
