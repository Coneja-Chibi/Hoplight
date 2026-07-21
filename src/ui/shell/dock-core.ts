/**
 * Pure Dock manifest routing. Catalog-only apps stay packaged and mountable without crowding the
 * everyday Dock; the manifest declaring appCatalog becomes the Add app destination.
 */
import type { AppManifestEntry } from "../app-contract";

export interface DockManifestGroups {
  present: AppManifestEntry[];
  future: AppManifestEntry[];
  foot: AppManifestEntry[];
  catalog: AppManifestEntry | undefined;
}

export function dockManifestGroups(manifests: AppManifestEntry[]): DockManifestGroups {
  const visible = manifests.filter((app) => !app.catalogOnly);
  const body = visible.filter((app) => !app.dockFoot);
  return {
    present: body.filter((app) => !app.comingSoon),
    future: body.filter((app) => app.comingSoon),
    foot: visible.filter((app) => app.dockFoot),
    catalog: manifests.find((app) => app.appCatalog && !app.comingSoon),
  };
}
