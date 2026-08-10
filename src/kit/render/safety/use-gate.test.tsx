/** @jsxImportSource @opentui/react */
/**
 * The gate controller's standing policy.
 *
 * A confirm has two effects: it answers THIS call, and it can change what happens to the NEXT one.
 * Every test here is about the second, because the first is obvious the moment you use it and the
 * second is invisible until the day it matters.
 *
 * The regression: applying a choice to policy used to live only in the seam's `onChoice`, which made
 * it a second call each caller had to remember. The rail's confirm did not, because a person editing
 * blocks is not in a turn and calls `requestConfirm` directly. Lock down blocked that one write and
 * left the session unlocked.
 */
import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactNode } from "react";
import { runRenderUpdate, settleRender as tick, testRender } from "../test-render";
import { useGateController, type GateController } from "./use-gate";
import type { GateRequest } from "../../tools/safety/gated-dispatch";

/**
 * THESE TESTS READ A REAL FILE, and until this was here they read the DEVELOPER'S.
 *
 * The hook remembers the mode from `~/.hoplight/gates.json`, so the suite's idea of "the standing
 * policy starts guarded" was really "whatever this machine last chose". Running `/gates full` in the
 * app - an ordinary thing to do, and the thing this feature exists for - turned six tests red with
 * failures that pointed at the gate logic and had nothing to do with it. A suite that breaks because
 * somebody used the product is a suite that gets ignored the next time it is right.
 *
 * HOPLIGHT_HOME is the seam the config already reads, so pointing it at an empty directory gives
 * every run the same fresh-install starting point.
 */
beforeAll(() => {
  process.env["HOPLIGHT_HOME"] = mkdtempSync(join(tmpdir(), "hoplight-gate-"));
});

const request = (name: string): GateRequest => ({
  name,
  verdict: { access: "write", level: "caution", reason: "writes a piece" },
  peek: { title: name, detail: "", level: "caution", reason: "writes a piece" },
});

/** Mount the hook and hand the controller back, since it cannot be called outside React. */
async function mountGate(): Promise<() => GateController> {
  let latest: GateController | null = null;
  function Probe(): ReactNode {
    latest = useGateController();
    return <text>gate</text>;
  }
  await testRender(<Probe />, { width: 80, height: 24 });
  await tick();
  return () => latest!;
}

test("answering a confirm updates standing policy, without a second call", async () => {
  const gate = await mountGate();
  expect(gate().mode).toBe("guarded");

  // Exactly what the rail does: requestConfirm directly, no turn, no onChoice.
  let answered = false;
  const pending = gate().seam().requestConfirm!(request("rail_apply")).then(() => { answered = true; });
  await tick();

  runRenderUpdate(() => gate().choose({ type: "abort" }));
  await pending;

  expect(answered).toBe(true);
  // The whole finding: this used to still be "guarded".
  expect(gate().seam().state.mode).toBe("locked");
});

test("allow for the session is remembered, so the next call is not asked again", async () => {
  const gate = await mountGate();
  const pending = gate().seam().requestConfirm!(request("studio_export"));
  await tick();
  runRenderUpdate(() => gate().choose({ type: "allow-session" }));
  await pending;

  expect(gate().seam().state.grants.has("studio_export")).toBe(true);
});

test("a one-shot answer changes nothing standing", async () => {
  // allow-once and deny must not widen or narrow anything: they answer one call and expire.
  for (const type of ["allow-once", "deny"] as const) {
    const gate = await mountGate();
    const pending = gate().seam().requestConfirm!(request("studio_export"));
    await tick();
    runRenderUpdate(() => gate().choose({ type }));
    await pending;

    expect(gate().seam().state.mode).toBe("guarded");
    expect(gate().seam().state.grants.size).toBe(0);
  }
});

test("a hold grants nothing, because asking about a call is not permitting it", async () => {
  const gate = await mountGate();
  const pending = gate().seam().requestConfirm!(request("studio_export"));
  await tick();
  runRenderUpdate(() => gate().choose({ type: "hold" }));
  await pending;

  expect(gate().seam().state.mode).toBe("guarded");
  expect(gate().seam().state.grants.size).toBe(0);
});

test("applying the same choice twice is harmless, which is what makes the duplicate safe", async () => {
  // gated-dispatch still calls onChoice after choose() has already applied it. Every arm has to be
  // idempotent for that to be safe, so it is checked rather than assumed.
  const gate = await mountGate();
  const pending = gate().seam().requestConfirm!(request("studio_export"));
  await tick();
  runRenderUpdate(() => gate().choose({ type: "allow-session" }));
  await pending;
  const seam = gate().seam();
  runRenderUpdate(() => seam.onChoice!({ type: "allow-session" }, "studio_export"));

  expect(gate().seam().state.grants.has("studio_export")).toBe(true);
  expect(gate().seam().state.grants.size).toBe(1);
});

test("choosing with nothing pending does not change policy", async () => {
  const gate = await mountGate();
  runRenderUpdate(() => gate().choose({ type: "abort" }));
  expect(gate().seam().state.mode).toBe("guarded");
});
