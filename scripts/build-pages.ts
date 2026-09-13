/** Build the browser-only, tab-scoped Studio published by GitHub Pages. */
import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocsIndex } from "../src/ui/docs-corpus";
import type { DocFigure } from "../src/ui/docs-types";
import { bakeFormatRegistry } from "./format-bake";
import { bundleBrowser, VENDOR_SPECS } from "./ui-bundle";

const root = fileURLToPath(new URL("..", import.meta.url));
const ui = join(root, "src", "ui");
const output = join(root, "dist", "pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await bakeFormatRegistry(root);

const write = async (relative: string, body: string | Uint8Array): Promise<void> => {
  const path = join(output, ...relative.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, body);
};

const appGlob = new Bun.Glob("*/index.{ts,tsx}");
const manifests: unknown[] = [];
for await (const relative of appGlob.scan({ cwd: join(ui, "apps") })) {
  const id = relative.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  const entry = join(ui, "apps", relative);
  await write(`apps/${id}.js`, await bundleBrowser(entry));
  const module = await import(entry) as { default?: { manifest?: unknown } };
  if (module.default?.manifest) manifests.push(module.default.manifest);
}

const setupSteps: string[] = [];
for await (const relative of appGlob.scan({ cwd: join(ui, "setup", "steps") })) {
  const id = relative.split(/[\\/]/)[0]!;
  if (id.startsWith("_")) continue;
  setupSteps.push(id);
  await write(`setup/steps/${id}.js`, await bundleBrowser(join(ui, "setup", "steps", relative)));
}
setupSteps.sort();

for await (const relative of appGlob.scan({ cwd: join(ui, "tours") })) {
  const id = relative.split(/[\\/]/)[0]!;
  if (!id.startsWith("_")) await write(`tours/${id}.js`, await bundleBrowser(join(ui, "tours", relative)));
}

for (const [name, spec] of Object.entries(VENDOR_SPECS)) {
  await write(`vendor/${name}.js`, await bundleBrowser(join(ui, spec.entry), spec.external));
}

const docsIndex = parseDocsIndex(await Bun.file(join(root, "docs", "generated", "docs-index.json")).json());
if (!docsIndex) throw new Error("pages build: generated docs index is invalid");
const figuresRaw = await Bun.file(join(root, "docs", "generated", "figures.json")).json();
if (!Array.isArray(figuresRaw)) throw new Error("pages build: generated figures are invalid");
const docFigures = figuresRaw as DocFigure[];
for (const doc of docsIndex.docs) {
  const source = join(root, ...doc.path.split("/"));
  const target = join(output, ...doc.path.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
await cp(join(root, "docs", "media"), join(output, "docs", "media"), { recursive: true });
await cp(join(root, "docs", "generated", "figures"), join(output, "docs", "generated", "figures"), { recursive: true });

await write("pocket-data.js", `globalThis.__HOPLIGHT_POCKET_DATA__=${JSON.stringify({
  manifests,
  setupSteps,
  docsIndex,
  docFigures,
})};\n`);
await write("pocket.js", await bundleBrowser(join(root, "src", "pocket", "index.ts")));
await write("tokens.css", await Bun.file(join(ui, "theme", "tokens.css")).text());
await copyFile(join(root, "build", "vaude.ico"), join(output, "favicon.ico"));
await copyFile(join(root, "build", "vaude-256.png"), join(output, "icon-256.png"));

const rawHtml = await Bun.file(join(ui, "index.html")).text();
const html = rawHtml
  .replace("<head>", '<head>\n<base href="./">\n<meta name="vaude-session" content="browser-tab">\n<meta name="hoplight-runtime" content="browser">')
  .replaceAll('href="/', 'href="./')
  .replaceAll('src="/', 'src="./')
  .replaceAll('"/vendor/', '"./vendor/')
  .replace('<script type="module" src="./boot.js"></script>', '<script src="./pocket-data.js"></script>\n<script type="module" src="./pocket.js"></script>');
await write("index.html", html);
await write("404.html", html);
await write(".nojekyll", "");
await write("app.webmanifest", JSON.stringify({
  name: "Hoplight Studio",
  short_name: "Hoplight",
  start_url: "./",
  display: "standalone",
  icons: [{ src: "./icon-256.png", sizes: "256x256", type: "image/png" }],
}, null, 2));

console.log(`dist/pages ready: ${manifests.length} apps, ${setupSteps.length} setup steps, ${docsIndex.count} docs`);
