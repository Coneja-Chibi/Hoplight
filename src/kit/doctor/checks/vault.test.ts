/**
 * The vault doctor check.
 *
 * The case worth pinning is the recovered vault. It reports zero providers exactly like a brand new
 * install, so without an explicit branch the one screen a user opens to find out what went wrong
 * would describe a destroyed key file as "no saved providers" and say nothing else.
 */
import { expect, test } from "bun:test";
import check from "./vault";
import type { DoctorContext, VaultDiagnostic } from "../check";

const context = (vault: VaultDiagnostic): DoctorContext => ({
  pieces: async () => [],
  provider: async () => null,
  vault: async () => vault,
  version: "test",
  runtime: "test",
});

test("a recovered vault reports the incident, not an empty-looking success", async () => {
  const notice = "Kit's key file was damaged, so it was set aside as /tmp/kit.identity.damaged-x.";
  const result = await check.run(context({ backend: "identity-file", providers: 0, active: false, notice }), new AbortController().signal);
  expect(result.status).toBe("warn");
  expect(result.detail).toBe(notice);
});

test("a genuinely empty vault still reads as empty, not as damage", async () => {
  const result = await check.run(context({ backend: "identity-file", providers: 0, active: false }), new AbortController().signal);
  expect(result.status).toBe("warn");
  expect(result.detail).toContain("no saved providers");
  expect(result.detail).not.toContain("damaged");
});

test("a healthy vault with an active provider is ok", async () => {
  const result = await check.run(context({ backend: "dpapi", providers: 2, active: true }), new AbortController().signal);
  expect(result.status).toBe("ok");
  expect(result.detail).toContain("dpapi");
  expect(result.detail).toContain("2 saved");
});

test("saved providers with none active is a warning", async () => {
  const result = await check.run(context({ backend: "dpapi", providers: 2, active: false }), new AbortController().signal);
  expect(result.status).toBe("warn");
  expect(result.detail).toContain("none active");
});
