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
  /** the same committed docs corpus GitHub exposes, baked for the in-app Help reader */
  docs: import("./docs-types").PackagedDocs;
  /** setup step id -> browser bundle (same drop-in mechanism as apps) */
  setupSteps: Record<string, string>;
  /** tour id -> bundle; the record is required even though individual apps may omit a tour */
  tours: Record<string, string>;
  /** shared platform bundles (react, jsx-runtime, react-dom-client) served at /vendor/<name>.js;
   * every other bundle marks these external and resolves them through the page's import map so
   * exactly ONE React instance exists (two copies = null-dispatcher hook crashes) */
  vendor: Record<string, string>;
  /** browser-bundled sealed Lua worker (optional; dev serves live from src/sandbox/lua/worker.ts) */
  sandboxWorkerJs?: string;
  /** browser-bundled regex worker, served only by the sandbox authority */
  regexWorkerJs?: string;
}
