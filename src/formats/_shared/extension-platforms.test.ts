/**
 * Lens collapse for thin hosts: C.AI / Crushon / Janitor fold into one Default tab.
 */
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CCV3_ID,
  EXTENSION_PLATFORMS,
  migrateLensTargets,
  RETIRED_THIN_HOST_IDS,
} from "./extension-platforms";

describe("Default CCv3 lens", () => {
  test("one Default entry; no dual adapter hosts; retired thin hosts gone", () => {
    const ids = EXTENSION_PLATFORMS.map((p) => p.id);
    expect(ids).toContain(DEFAULT_CCV3_ID);
    expect(ids).toContain("marinara");
    expect(ids).toContain("chub");
    // real adapters own these ids; extension list must not re-emit them
    expect(ids).not.toContain("lumiverse");
    expect(ids).not.toContain("pygmalion");
    expect(ids).not.toContain("backyard");
    for (const retired of RETIRED_THIN_HOST_IDS) {
      expect(ids).not.toContain(retired);
    }
    const def = EXTENSION_PLATFORMS.find((p) => p.id === DEFAULT_CCV3_ID);
    expect(def?.label).toBe("Default");
    expect(def?.carries).toContain("identity.name");
    expect(def?.carries).toContain("greetings.firstMessage");
    expect(def?.originalFields ?? []).toEqual([]);
  });

  test("migrateLensTargets folds thin hosts, backyard->byaf, drops pygmalion", () => {
    expect(migrateLensTargets(["sillytavern", "characterai", "crushon"])).toEqual([
      "sillytavern",
      DEFAULT_CCV3_ID,
    ]);
    expect(migrateLensTargets(["janitor"])).toEqual([DEFAULT_CCV3_ID]);
    expect(migrateLensTargets(["default-ccv3", "characterai"])).toEqual([DEFAULT_CCV3_ID]);
    expect(migrateLensTargets(["rolecall", "chub"])).toEqual(["rolecall", "chub"]);
    expect(migrateLensTargets(["backyard", "pygmalion", "byaf"])).toEqual(["byaf"]);
    expect(migrateLensTargets(["pygmalion"])).toEqual([]);
    expect(migrateLensTargets(["backyard"])).toEqual(["byaf"]);
    expect(migrateLensTargets([])).toEqual([]);
  });
});
