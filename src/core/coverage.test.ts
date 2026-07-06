import { expect, test } from "bun:test";
import { coversPath, type CoverageDecl } from "./coverage";

const decl: CoverageDecl = { carries: ["greetings", "identity.name", "presentation.palette"] };

test("coversPath matches exact paths and dot-boundary prefixes", () => {
  expect(coversPath(decl, "greetings")).toBe(true);
  expect(coversPath(decl, "greetings.firstMessage")).toBe(true);
  expect(coversPath(decl, "identity.name")).toBe(true);
  expect(coversPath(decl, "presentation.palette")).toBe(true);
});

test("coversPath never matches across path-name boundaries or siblings", () => {
  expect(coversPath(decl, "greetingsX")).toBe(false);
  expect(coversPath(decl, "identity.nameSuffix")).toBe(false);
  expect(coversPath(decl, "identity.fullName")).toBe(false);
  expect(coversPath(decl, "presentation.gradientColors")).toBe(false);
  expect(coversPath({ carries: [] }, "identity.name")).toBe(false);
});
