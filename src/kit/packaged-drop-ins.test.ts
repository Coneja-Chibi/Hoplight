/**
 * The baked manifest must name exactly what the folder walk finds.
 *
 * This is the test the whole bake stands on. A manifest that is merely PRESENT gets a compiled Kit
 * to start; a manifest that is CORRECT is what stops it starting without `/rail`, or with a provider
 * missing, in a way nobody would notice until a user typed the command. The shipped binary could not
 * start at all, which was loud. Silently missing one drop-in is the quiet version of the same bug,
 * and it is the one a static list invites.
 *
 * Both sides run here because the test process is a source checkout: the walk is available, so the
 * two can be compared directly rather than trusted.
 */
import { describe, expect, test } from "bun:test";
import { KIT_DROP_INS } from "./generated/drop-ins";
import { discoverCommands } from "./commands/discover";
import { discoverTools } from "./tools/discover";
import { discoverDoctorChecks } from "./doctor/discover";
import { loadSpokes } from "./providers/registry";
import { discoverChannels } from "./render/notify/discover";
import { discoverCapabilities } from "./capabilities/discover";
import { allCapabilities } from "../generated/capabilities";
import { isPackagedBuild, packagedDropIns } from "./packaged-drop-ins";

const named = (values: readonly unknown[], key: string): string[] =>
  values
    .map((value) => (value as Record<string, unknown> | undefined)?.[key])
    .filter((id): id is string => typeof id === "string")
    .sort();

describe("packaged drop-ins", () => {
  test("a source checkout walks folders rather than reading the manifest", () => {
    // The signal has to be false here, or these comparisons would be the manifest against itself.
    expect(isPackagedBuild()).toBe(false);
    expect(packagedDropIns("tools")).toBeNull();
  });

  test("every command in the folders is in the manifest", async () => {
    const walked = (await discoverCommands()).map((command) => command.name).sort();
    expect(named(KIT_DROP_INS.commands, "name")).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("every tool in the folder is in the manifest", async () => {
    const walked = (await discoverTools()).map((tool) => tool.name).sort();
    expect(named(KIT_DROP_INS.tools, "name")).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("every doctor check is in the manifest", async () => {
    const walked = (await discoverDoctorChecks()).map((check) => check.id).sort();
    expect(named(KIT_DROP_INS.doctorChecks, "id")).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("every provider spoke is in the manifest", async () => {
    const walked = [...(await loadSpokes()).keys()].sort();
    expect(named(KIT_DROP_INS.spokes, "id")).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("every notify channel is in the manifest", async () => {
    const walked = (await discoverChannels()).map((channel) => channel.name).sort();
    expect(named(KIT_DROP_INS.notifyChannels, "name")).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("every capability in the folders is in the generated seam", async () => {
    // Capabilities come from the seam the browser bundle already used, rather than a second list.
    const walked = (await discoverCapabilities()).map((capability) => capability.id).sort();
    expect(allCapabilities.map((capability) => capability.id).sort()).toEqual(walked);
    expect(walked.length).toBeGreaterThan(0);
  });

  test("the manifest carries no duplicate names within a family", () => {
    for (const [family, key] of [
      ["commands", "name"],
      ["tools", "name"],
      ["doctorChecks", "id"],
      ["spokes", "id"],
      ["notifyChannels", "name"],
    ] as const) {
      const ids = named(KIT_DROP_INS[family], key);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("nothing in the manifest is undefined", () => {
    // A file whose default export was removed still leaves an import binding behind, and `undefined`
    // in a list reads as a shorter list rather than as a broken one.
    for (const family of Object.values(KIT_DROP_INS)) {
      for (const entry of family) expect(entry).toBeDefined();
    }
  });
});
