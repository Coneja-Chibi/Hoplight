/**
 * Pure derivation for the Apps page. The packaged manifest roster is the only registry, so the
 * catalog cannot drift from the app folders baked into the running build.
 */
import type { AppManifestEntry } from "../../app-contract";

export function officialCatalogApps(manifests: AppManifestEntry[]): AppManifestEntry[] {
  return manifests
    .filter((app) => !app.comingSoon && !app.dockFoot && !app.appCatalog)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
