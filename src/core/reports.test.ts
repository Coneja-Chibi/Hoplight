/** Regression coverage for named/count-consistent parse and serialize loss reports. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "./canonical";
import { buildParseReport, buildSerializeReport } from "./reports";

const entity = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: "aria",
  body: { identity: { name: "Aria" }, behavior: { virtualScript: "sealed" } },
  original: { risu: { raw: { name: "Aria" }, unmapped: { module: "opaque" } } },
};

describe("loss reports", () => {
  test("parse names escrowed fields and keeps counts aligned", () => {
    const report = buildParseReport(entity, "risu");
    expect(report.escrowed).toEqual(["original.risu.unmapped.module"]);
    expect(report.counts.escrowed).toBe(report.escrowed.length);
  });

  test("cross-format serialize names uncovered canonical and foreign escrow", () => {
    const report = buildSerializeReport(entity, {
      id: "sillytavern",
      coverage: { carries: ["identity"] },
    });
    expect(report.dropped).toContain("behavior.virtualScript");
    expect(report.dropped).toContain("original.risu.raw");
    expect(report.counts.dropped).toBe(report.dropped.length);
  });

  test("same-format serialize does not call its own escrow dropped", () => {
    const report = buildSerializeReport(entity, {
      id: "risu",
      coverage: { carries: ["identity", "behavior"] },
    });
    expect(report.dropped).toEqual([]);
  });
});
