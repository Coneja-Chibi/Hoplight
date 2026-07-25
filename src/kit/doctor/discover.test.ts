/** Verifies the production doctor catalog is folder-discovered and complete. */
import { expect, test } from "bun:test";
import { discoverDoctorChecks } from "./discover";

test("discovers the four approved doctor checks", async () => {
  const checks = await discoverDoctorChecks();
  expect(checks.map((check) => check.id).sort()).toEqual([
    "provider",
    "studio",
    "vault",
    "version",
  ]);
});
