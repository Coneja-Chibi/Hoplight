/**
 * The Apps page derives its official catalog from packaged manifests. No second app registry may
 * drift from the folders-as-schema source of truth.
 */
import { describe, expect, test } from "bun:test";
import type { AppManifestEntry } from "../../app-contract";
import { officialCatalogApps } from "./catalog-core";

const manifest = (patch: Partial<AppManifestEntry>): AppManifestEntry => ({
  id: "app",
  title: "App",
  markSvg: "<svg/>",
  accent: "var(--accent)",
  order: 10,
  ...patch,
});

describe("official app catalog", () => {
  test("includes dock and catalog-only shipped apps, but not shell/future/catalog entries", () => {
    const apps = officialCatalogApps([
      manifest({ id: "css-workshop", title: "CSS Workshop", order: 35, catalogOnly: true }),
      manifest({ id: "library", title: "Library", order: 10 }),
      manifest({ id: "settings", dockFoot: true }),
      manifest({ id: "company", comingSoon: true }),
      manifest({ id: "app-catalog", appCatalog: true, catalogOnly: true }),
    ]);

    expect(apps.map((app) => app.id)).toEqual(["library", "css-workshop"]);
  });
});
