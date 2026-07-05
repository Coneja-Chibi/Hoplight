/**
 * Packaged-assets contract: the difference between dev and shipped software, isolated to ONE seam.
 * Dev mode: the server discovers apps and bundles on the fly (drop-in modularity live).
 * Packaged mode (Vaude.exe): a build step bakes the same artifacts into a generated module, because
 * a compiled binary has no source tree to scan. Same server, same routes, same bytes either way.
 */
export interface PackagedAssets {
  indexHtml: string;
  tokensCss: string;
  bootJs: string;
  /** the beam-V icon, base64 ICO + PNG (favicon + web-manifest icon, so app windows wear our mark) */
  faviconIcoB64: string;
  iconPngB64: string;
  /** app id -> browser bundle */
  apps: Record<string, string>;
  /** the dock manifest list, pre-collected */
  manifests: unknown[];
}
