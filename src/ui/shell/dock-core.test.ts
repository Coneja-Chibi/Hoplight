/**
 * Dock manifest routing tests keep catalog-only apps out of the everyday Dock while preserving
 * their discoverability through the one manifest-declared app catalog.
 */
import { describe, expect, test } from "bun:test";
import type { AppManifestEntry } from "../app-contract";
import { dockManifestGroups } from "./dock-core";

const manifest = (patch: Partial<AppManifestEntry>): AppManifestEntry => ({
  id: "app",
  title: "App",
  markSvg: "<svg/>",
  accent: "var(--accent)",
  order: 10,
  ...patch,
});

describe("dock manifest routing", () => {
  test("keeps catalog-only apps off the Dock and finds the catalog door", () => {
    const groups = dockManifestGroups([
      manifest({ id: "library" }),
      manifest({ id: "css-workshop", catalogOnly: true }),
      manifest({ id: "app-catalog", catalogOnly: true, appCatalog: true }),
      manifest({ id: "settings", dockFoot: true }),
      manifest({ id: "company", comingSoon: true, catalogOnly: true }),
    ]);

    expect(groups.present.map((app) => app.id)).toEqual(["library"]);
    expect(groups.future).toEqual([]);
    expect(groups.foot.map((app) => app.id)).toEqual(["settings"]);
    expect(groups.catalog?.id).toBe("app-catalog");
  });
});
