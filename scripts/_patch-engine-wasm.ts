/** One-time maintenance patch for embedding the sandbox engine WebAssembly asset. */
const p = new URL("../src/sandbox/lua/engine.ts", import.meta.url);
let t = await Bun.file(p).text();

if (t.includes("defaultWasmUri")) {
  console.log("already patched");
  process.exit(0);
}

const oldLine = `  const wasmUri = opts.wasmUri ?? (isBrowser() ? "/sandbox/glue.wasm" : undefined);`;
const newLine = `  const wasmUri = opts.wasmUri ?? defaultWasmUri();`;
if (!t.includes(oldLine)) throw new Error("wasmUri line missing");
t = t.replace(oldLine, newLine);

const isBrowserBlock = `const isBrowser = (): boolean =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { document?: unknown }).document !== "undefined";
`;

const helper = `const isBrowser = (): boolean =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { document?: unknown }).document !== "undefined";

/** Prefer the worker/window origin so a distinct sandbox host serves glue.wasm (ADR-009). */
const defaultWasmUri = (): string | undefined => {
  try {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin && /^https?:\\/\\//.test(loc.origin)) {
      return \`\${loc.origin}/sandbox/glue.wasm\`;
    }
  } catch {
    /* ignore */
  }
  if (isBrowser()) return "/sandbox/glue.wasm";
  return undefined;
};
`;

if (!t.includes(isBrowserBlock)) throw new Error("isBrowser block missing");
t = t.replace(isBrowserBlock, helper);
await Bun.write(p, t);
console.log("engine patched");
