/** Verifies fail-closed parsing for app and settings-section launch links. */
import { describe, expect, test } from "bun:test";
import { parseLaunchTarget } from "./launch-target";

describe("parseLaunchTarget", () => {
  test("reads an app plus an optional section", () => {
    expect(parseLaunchTarget("#settings/remote-access")).toEqual({
      appId: "settings",
      sectionId: "remote-access",
    });
    expect(parseLaunchTarget("#library")).toEqual({ appId: "library" });
  });

  test("ignores unsafe, unknown-shape, and empty hashes", () => {
    expect(parseLaunchTarget("")).toBeNull();
    expect(parseLaunchTarget("#settings/remote/access")).toBeNull();
    expect(parseLaunchTarget("#../settings")).toBeNull();
    expect(parseLaunchTarget("#Settings/remote-access")).toBeNull();
  });
});
