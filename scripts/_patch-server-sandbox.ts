/**
 * Wire sandbox origin into server.ts: inject meta, startSandboxHost in startUi.
 */
const p = new URL("../src/ui/server.ts", import.meta.url);
let t = await Bun.file(p).text();

if (t.includes("startSandboxHost")) {
  console.log("server already patched");
  process.exit(0);
}

// 1) import
const importNeedle = `import type { PackagedAssets } from "./assets";`;
if (!t.includes(importNeedle)) throw new Error("import needle missing");
t = t.replace(
  importNeedle,
  `import type { PackagedAssets } from "./assets";\nimport { startSandboxHost } from "./sandbox-host";`,
);

// 2) injectSandboxOriginMeta after injectSessionMeta (before tokensEqual)
const tokensAt = t.indexOf("\nfunction tokensEqual");
if (tokensAt < 0) throw new Error("tokensEqual missing");
const injectFn = `

/**
 * Inject sandbox origin meta (public, not a secret). Never confuses this with the session token.
 * Empty origin removes any stale tag so the UI falls back to same-origin worker.
 */
export function injectSandboxOriginMeta(html: string, sandboxOrigin: string): string {
  const re = /<meta\\s+name="vaude-sandbox-origin"[^>]*>\\s*/gi;
  let out = html.replace(re, "");
  const origin = sandboxOrigin.trim();
  if (!origin) return out;
  if (!origin.startsWith("http://127.0.0.1:")) {
    throw new Error("server: sandbox origin must be http://127.0.0.1:<port>");
  }
  const safe = origin.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const tag = \`<meta name="vaude-sandbox-origin" content="\${safe}">\`;
  if (out.includes("</head>")) return out.replace("</head>", \`\${tag}\\n</head>\`);
  return tag + out;
}
`;
t = t.slice(0, tokensAt) + injectFn + t.slice(tokensAt);

// 3) createHandler: add optional runtime sandbox origin box
t = t.replace(
  `export function createHandler(
  store: StudioStore,
  settings: SettingsStore,
  packaged?: PackagedAssets,
  sec?: UiSecurityContext,
): (req: Request) => Promise<Response> {`,
  `export function createHandler(
  store: StudioStore,
  settings: SettingsStore,
  packaged?: PackagedAssets,
  sec?: UiSecurityContext,
  /**
   * Live sandbox origin for HTML meta injection (ADR-009). Mutable so startUi can fill it after
   * both listeners bind. String form also accepted for tests.
   */
  sandboxOrigin?: string | { current: string },
): (req: Request) => Promise<Response> {`,
);

if (!t.includes("const html = injectSessionMeta(rawHtml, security.token);")) {
  throw new Error("htmlResponse body missing");
}
t = t.replace(
  `  const htmlResponse = (rawHtml: string): Response => {
    const html = injectSessionMeta(rawHtml, security.token);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", ...HTML_SECURITY_HEADERS },
    });
  };`,
  `  const resolveSandboxOrigin = (): string => {
    if (!sandboxOrigin) return "";
    if (typeof sandboxOrigin === "string") return sandboxOrigin;
    return sandboxOrigin.current;
  };

  const htmlResponse = (rawHtml: string): Response => {
    let html = injectSessionMeta(rawHtml, security.token);
    const sb = resolveSandboxOrigin();
    if (sb) html = injectSandboxOriginMeta(html, sb);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", ...HTML_SECURITY_HEADERS },
    });
  };`,
);

// 4) startUi rewrite
const startIdx = t.indexOf("/** Boot the visual app. Loopback only:");
if (startIdx < 0) throw new Error("startUi comment missing");
const startNew = `/** Boot the visual app. Loopback only: a local forge, never an exposed service. */
export function startUi(
  port: number,
  studioDir: string,
  packaged?: PackagedAssets,
): { url: string; sandboxUrl: string | null; stop: () => void } {
  const store = new StudioStore(studioDir);
  const settings = new SettingsStore(studioDir);
  const sec = createSecurityContext();
  if (!packaged) startDevWatch(); // dev: edits to src/ui reload every open page

  // Filled after the sandbox listener binds; HTML injection reads this live.
  const sandboxOriginRef = { current: "" };
  const handler = createHandler(store, settings, packaged, sec, sandboxOriginRef);
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: handler });
  const host = \`127.0.0.1:\${server.port}\`;
  sec.expectedHost = host;
  sec.expectedOrigin = \`http://\${host}\`;

  let sandboxUrl: string | null = null;
  let stopSandbox: (() => void) | null = null;
  try {
    const sandbox = startSandboxHost({
      allowOrigin: sec.expectedOrigin,
      packaged,
    });
    sandboxUrl = sandbox.origin;
    sandboxOriginRef.current = sandbox.origin;
    stopSandbox = sandbox.stop;
  } catch (e) {
    console.warn(
      "server: sandbox host failed to start; falling back to same-origin worker:",
      e instanceof Error ? e.message : e,
    );
  }

  return {
    url: \`http://\${host}\`,
    sandboxUrl,
    stop: () => {
      server.stop(true);
      stopSandbox?.();
    },
  };
}
`;
t = t.slice(0, startIdx) + startNew;

await Bun.write(p, t);
console.log("server patched");
