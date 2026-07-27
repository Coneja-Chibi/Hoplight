/**
 * Build Hoplight.exe - real software from the same code the CLI runs.
 * 1. Bake the UI assets (index/tokens/boot + every discovered app bundle + manifests) into
 *    src/generated/packaged-assets.ts.
 * 2. Bake a STATIC format registry into src/generated/packaged-formats.ts (a compiled binary cannot
 *    glob; the generator preserves drop-in truth by regenerating from the folder scan every build).
 * 3. bun build --compile src/desktop.ts -> dist/Hoplight.exe with the beam-V icon, console hidden.
 * Run: bun run scripts/build-desktop.ts
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { docsAssetMime, parseDocsIndex, resolveDocPage } from "../src/ui/docs-corpus";
import type { DocFigure, PackagedDocAsset } from "../src/ui/docs-types";

const root = fileURLToPath(new URL("..", import.meta.url));
const uiDir = join(root, "src", "ui");
const genDir = join(root, "src", "generated");
await mkdir(genDir, { recursive: true });

// Release knobs: --cli-targets=bun-linux-x64,... compiles the CLI (same bake) per target;
// --no-desktop skips the WebView2 exe on runners that cannot build it (everything but Windows).
const cliTargets = (process.argv.find((a) => a.startsWith("--cli-targets="))?.split("=")[1] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const skipDesktop = process.argv.includes("--no-desktop");
// --kit compiles the Kit terminal app for THIS runner's own platform. Unlike the CLI it cannot be
// cross-compiled: @opentui ships a native rendering library per platform, and a --target build fails
// to resolve the one it is not running on. So Kit is built where it will run, on each OS's runner.
const buildKit = process.argv.includes("--kit");

// -- 1. UI assets -----------------------------------------------------------------------------------

/** The react family stays OUT of every app/boot bundle; the page's import map resolves these to
 * the single /vendor copies (one React per page - two copies crash hooks with a null dispatcher). */
const REACT_EXTERNALS = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

/** CSS Modules emit SEPARATE css artifacts from Bun.build; keeping only outputs[0] shipped the
 * class names without their stylesheet (the unstyled-interiors bug). Each module's css rides
 * inside its own JS as a head-injected <style>, keeping the one-file-per-module contract. */
const withCssInjected = async (outputs: Bun.BuildArtifact[]): Promise<string> => {
  let js = "";
  let css = "";
  for (const out of outputs) {
    if (out.path.endsWith(".css")) css += await out.text();
    else js += await out.text();
  }
  if (!css) return js;
  const inject =
    `{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";` +
    `s.textContent=${JSON.stringify(css)};document.head.append(s);}\n`;
  return inject + js; // statements before import declarations are legal ESM (imports hoist)
};

async function bundleBrowser(entry: string, external: string[] = REACT_EXTERNALS): Promise<string> {
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm", external });
  if (!built.success) throw new Error(`bundle failed for ${entry}: ${built.logs.map((l) => l.message).join("; ")}`);
  return withCssInjected(built.outputs);
}

/** name -> entry stub + externals. One family bundle (react + both jsx runtimes inlined against a
 * single React copy - Bun's external "react" also externalizes react/* subpaths, so separate
 * runtime stubs self-alias through the import map); the renderer links against the family. */
const VENDOR_SPECS: Record<string, { entry: string; external: string[] }> = {
  "react-family": { entry: "vendor/react-family.ts", external: [] },
  "react-dom-client": { entry: "vendor/react-dom-client.ts", external: ["react"] },
};

const appsGlob = new Bun.Glob("*/index.{ts,tsx}");
const appIds: string[] = [];
const apps: Record<string, string> = {};
const manifests: unknown[] = [];
for await (const rel of appsGlob.scan({ cwd: join(uiDir, "apps") })) {
  const id = rel.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  appIds.push(id);
  const entry = join(uiDir, "apps", rel);
  apps[id] = await bundleBrowser(entry);
  const mod = (await import(entry)) as { default?: { manifest?: unknown } };
  if (mod.default?.manifest) manifests.push(mod.default.manifest);
}

const stepsGlob = new Bun.Glob("*/index.{ts,tsx}");
const stepIds: string[] = [];
const setupSteps: Record<string, string> = {};
for await (const rel of stepsGlob.scan({ cwd: join(uiDir, "setup", "steps") })) {
  const id = rel.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  stepIds.push(id);
  setupSteps[id] = await bundleBrowser(join(uiDir, "setup", "steps", rel));
}

const toursGlob = new Bun.Glob("*/index.{ts,tsx}");
const tourIds: string[] = [];
const tours: Record<string, string> = {};
for await (const rel of toursGlob.scan({ cwd: join(uiDir, "tours") })) {
  const id = rel.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  tourIds.push(id);
  tours[id] = await bundleBrowser(join(uiDir, "tours", rel));
}

const vendor: Record<string, string> = {};
for (const [name, spec] of Object.entries(VENDOR_SPECS)) {
  vendor[name] = await bundleBrowser(join(uiDir, spec.entry), spec.external);
}

// Wasmoon has guarded Node-only dynamic imports. They are unreachable in a browser worker, but Bun must
// leave them external while producing the browser bundle.
const sandboxWorkerJs = await bundleBrowser(join(root, "src", "sandbox", "lua", "worker.ts"), [
  "module", "url", "fs", "path", "child_process", "crypto",
]);
const regexWorkerJs = await bundleBrowser(join(root, "src", "sandbox", "regex", "worker.ts"));

const docsIndexRaw = await Bun.file(join(root, "docs", "generated", "docs-index.json")).json();
const docsIndex = parseDocsIndex(docsIndexRaw);
if (!docsIndex) throw new Error("docs bake: generated docs index is invalid");
const docPages: Record<string, string> = {};
for (const record of docsIndex.docs) {
  const path = resolveDocPage(root, docsIndex, record.id);
  if (!path) throw new Error(`docs bake: refused page path for ${record.id}`);
  docPages[record.id] = await Bun.file(path).text();
}
const docFiguresRaw = await Bun.file(join(root, "docs", "generated", "figures.json")).json();
if (!Array.isArray(docFiguresRaw)) throw new Error("docs bake: generated figure manifest is invalid");
const docFigures = docFiguresRaw as DocFigure[];
const docAssetPaths = new Set<string>(docFigures.map((figure) => figure.svg));
const mediaGlob = new Bun.Glob("**/*");
for await (const rel of mediaGlob.scan({ cwd: join(root, "docs", "media"), onlyFiles: true })) {
  docAssetPaths.add(`docs/media/${rel.replaceAll("\\", "/")}`);
}
const docAssets: Record<string, PackagedDocAsset> = {};
for (const path of docAssetPaths) {
  const mime = docsAssetMime(path);
  if (!mime) continue;
  const file = Bun.file(join(root, ...path.split("/")));
  if (!await file.exists()) throw new Error(`docs bake: missing asset ${path}`);
  docAssets[path] = { mime, b64: Buffer.from(await file.arrayBuffer()).toString("base64") };
}

const assets = {
  indexHtml: await Bun.file(join(uiDir, "index.html")).text(),
  tokensCss: await Bun.file(join(uiDir, "theme", "tokens.css")).text(),
  bootJs: await bundleBrowser(join(uiDir, "boot.ts")),
  vendor,
  faviconIcoB64: Buffer.from(await Bun.file(join(root, "build", "vaude.ico")).arrayBuffer()).toString("base64"),
  iconPngB64: Buffer.from(await Bun.file(join(root, "build", "vaude-256.png")).arrayBuffer()).toString("base64"),
  apps,
  manifests,
  docs: { index: docsIndex, pages: docPages, figures: docFigures, assets: docAssets },
  setupSteps,
  tours,
  sandboxWorkerJs,
  regexWorkerJs,
};
// The repo carries a null PLACEHOLDER at this path (a committed bake goes stale silently; null
// cannot lie). The real bake exists only for the duration of the compile and is restored after.
const PLACEHOLDER =
  `/**\n` +
  ` * PLACEHOLDER - the real module is baked by scripts/build-desktop.ts at build time and restored to\n` +
  ` * this placeholder afterwards, so the repo never carries (or claims to carry) a real asset bake.\n` +
  ` * A committed bake goes stale the moment any UI file changes; null cannot lie. desktop.ts refuses\n` +
  ` * to start on null with instructions, instead of shipping yesterday's UI silently.\n` +
  ` */\n` +
  `import type { PackagedAssets } from "../ui/assets";\n` +
  `export const PACKAGED_ASSETS: PackagedAssets | null = null;\n`;
await Bun.write(
  join(genDir, "packaged-assets.ts"),
  `/** GENERATED by scripts/build-desktop.ts - do not edit. */\n` +
    `import type { PackagedAssets } from "../ui/assets";\n` +
    `export const PACKAGED_ASSETS: PackagedAssets | null = ${JSON.stringify(assets)};\n`,
);
console.log(
  `baked ui assets (${appIds.length} apps: ${appIds.join(", ")}; ` +
    `${stepIds.length} setup steps: ${stepIds.join(", ")}; ` +
    `${tourIds.length} tours: ${tourIds.join(", ")}; ` +
    `${docsIndex.count} docs, ${Object.keys(docAssets).length} doc assets)`,
);

// -- 1b. BOOT SMOKE: the build proves the page can boot before anyone claims done -------------------
// Three first-boot crashes taught this: tsc + tests never exercise module RESOLUTION in the page.
// So the build (a) EXECUTES each vendor bundle and asserts the named exports the app relies on,
// and (b) asserts every bare import in every baked bundle has an import-map entry. Fail = no exe.
const REQUIRED_VENDOR_EXPORTS: Record<string, string[]> = {
  "react-family": [
    "createElement", "useState", "useEffect", "Fragment", "jsx", "jsxs", "jsxDEV",
    "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE",
  ],
  "react-dom-client": ["createRoot", "createPortal", "flushSync"],
};
const importMapMatch = /<script type="importmap">\s*([\s\S]*?)<\/script>/.exec(assets.indexHtml);
if (!importMapMatch) throw new Error("smoke: index.html carries no import map");
const importMapKeys = Object.keys((JSON.parse(importMapMatch[1]!) as { imports: Record<string, string> }).imports);

const smokeDir = join(root, "dist", ".smoke");
await mkdir(smokeDir, { recursive: true });
/** Reproduce the PAGE's linkage: vendor bundles must resolve the react family to OUR built stubs
 * (as the import map does), never to node_modules - the internals-drop crash slipped a smoke that
 * linked against node_modules react. Bare specifiers rewrite to the sibling smoke files. */
const linkToStubs = (code: string): string =>
  code
    .replace(/from\s*["']react\/jsx-dev-runtime["']/g, 'from"./react-family.mjs"')
    .replace(/from\s*["']react\/jsx-runtime["']/g, 'from"./react-family.mjs"')
    .replace(/from\s*["']react["']/g, 'from"./react-family.mjs"');
for (const name of Object.keys(REQUIRED_VENDOR_EXPORTS)) {
  await Bun.write(join(smokeDir, `${name}.mjs`), linkToStubs(vendor[name]!));
}
for (const [name, wanted] of Object.entries(REQUIRED_VENDOR_EXPORTS)) {
  const mod = (await import(pathToFileURL(join(smokeDir, `${name}.mjs`)).href)) as Record<string, unknown>;
  const missing = wanted.filter((exp) => mod[exp] === undefined);
  if (missing.length) {
    throw new Error(`smoke: /vendor/${name}.js lacks export(s) ${missing.join(", ")} - the page would crash at boot`);
  }
}

const bareSpecifiers = (code: string): string[] => {
  const out = new Set<string>();
  const re = /from\s*["']([^"'\n]+)["']|import\s*\(\s*["']([^"'\n]+)["']\s*\)/g;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const spec = (m[1] ?? m[2])!;
    if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/") || spec.startsWith("http")) continue;
    if (!/^[@\w][\w@/.-]*$/.test(spec)) continue; // module-shaped only: skips prose/concat inside bundled strings
    out.add(spec);
  }
  return [...out];
};
const allBundles: Record<string, string> = {
  boot: assets.bootJs,
  ...Object.fromEntries(Object.entries(apps).map(([k, v]) => [`app:${k}`, v])),
  ...Object.fromEntries(Object.entries(setupSteps).map(([k, v]) => [`step:${k}`, v])),
  ...Object.fromEntries(Object.entries(tours).map(([k, v]) => [`tour:${k}`, v])),
  ...Object.fromEntries(Object.entries(vendor).map(([k, v]) => [`vendor:${k}`, v])),
};
for (const [name, code] of Object.entries(allBundles)) {
  const uncovered = bareSpecifiers(code).filter((s) => !importMapKeys.includes(s));
  if (uncovered.length) {
    throw new Error(`smoke: bundle "${name}" imports bare ${uncovered.join(", ")} with no import-map entry - the page would crash at boot`);
  }
}
console.log(`boot smoke passed (${Object.keys(REQUIRED_VENDOR_EXPORTS).length} vendor graphs executed, ${Object.keys(allBundles).length} bundles resolution-checked)`);

// -- 2. static format registry ----------------------------------------------------------------------

const formatsGlob = new Bun.Glob("*/index.ts");
const formatIds: string[] = [];
for await (const rel of formatsGlob.scan({ cwd: join(root, "src", "formats") })) {
  const id = rel.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  formatIds.push(id);
}
formatIds.sort();
const importLines = formatIds.map((id, i) => `import f${i} from "../formats/${id}/index";`).join("\n");
const registerLines = formatIds
  .map((_, i) => `  for (const a of Array.isArray(f${i}) ? f${i} : [f${i}]) registry.register(a);`)
  .join("\n");
await Bun.write(
  join(genDir, "packaged-formats.ts"),
  `/** GENERATED by scripts/build-desktop.ts - do not edit. Static registry for the compiled exe. */\n` +
    `import { registry } from "../core";\n${importLines}\n\n` +
    `export function registerPackagedFormats(): void {\n${registerLines}\n}\n`,
);
console.log(`baked static format registry (${formatIds.length} families: ${formatIds.join(", ")})`);

// -- 3. compile -------------------------------------------------------------------------------------

await mkdir(join(root, "dist"), { recursive: true });
try {
  if (!skipDesktop) {
    const compile = Bun.spawnSync(
      [
        "bun", "build", "--compile",
        join(root, "src", "desktop.ts"),
        // the window worker MUST ride as its own entrypoint; without it the exe compiles fine and
        // then boots headless (worker ModuleNotFound at runtime, console hidden, no window)
        join(root, "src", "desktop-window.ts"),
        "--outfile", join(root, "dist", "Hoplight.exe"),
        `--windows-icon=${join(root, "build", "vaude.ico")}`,
        "--windows-hide-console",
      ],
      { cwd: root, stdout: "inherit", stderr: "inherit" },
    );
    if (compile.exitCode !== 0) throw new Error("compile failed");
    console.log("dist/Hoplight.exe ready");
  }
  for (const target of cliTargets) {
    const short = target.replace(/^bun-/, "");
    // "cli" is in the name on purpose. These are terminal tools, and a Windows user who
    // double-clicks a bare `hoplight-windows-x64.exe` sees a console flash and vanish, which reads
    // as a broken app rather than a program that wants arguments. The filename is the first and
    // cheapest place to say what this is.
    const out = join(root, "dist", `hoplight-cli-${short}${short.startsWith("windows") ? ".exe" : ""}`);
    const compile = Bun.spawnSync(
      ["bun", "build", "--compile", `--target=${target}`, join(root, "src", "cli.ts"), "--outfile", out],
      { cwd: root, stdout: "inherit", stderr: "inherit" },
    );
    if (compile.exitCode !== 0) throw new Error(`cli compile failed for ${target}`);
    console.log(`${out} ready`);
  }

  if (buildKit) {
    // Host platform only, and named for it, since this binary cannot be built anywhere else.
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
    const out = join(root, "dist", `hoplight-kit-${os}-${arch}${os === "windows" ? ".exe" : ""}`);
    const compile = Bun.spawnSync(
      ["bun", "build", "--compile", join(root, "src", "kit", "index.tsx"), "--outfile", out],
      { cwd: root, stdout: "inherit", stderr: "inherit" },
    );
    // A cross-target opentui miss exits 0 while writing nothing, so the file is the real check.
    if (compile.exitCode !== 0) throw new Error("kit compile failed");
    if (!await Bun.file(out).exists()) throw new Error(`kit compile produced no binary at ${out}`);
    console.log(`${out} ready`);
  }
} finally {
  // win or lose, the worktree goes back to the placeholder: the bake lives in the exe, not the repo
  await Bun.write(join(genDir, "packaged-assets.ts"), PLACEHOLDER);
}
