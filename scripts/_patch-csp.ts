const p = new URL("../src/ui/server.ts", import.meta.url);
let t = await Bun.file(p).text();

if (t.includes("htmlSecurityHeaders(") && t.includes("workerExtra")) {
  console.log("csp already patched");
  process.exit(0);
}

const oldBlock = `const HTML_SECURITY_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; " +
    "font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};`;

const newBlock = `const HTML_SECURITY_HEADERS_BASE: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/** Build HTML CSP; when sandboxOrigin is set, worker-src may load the distinct-origin module worker. */
export function htmlSecurityHeaders(sandboxOrigin = ""): Record<string, string> {
  const workerExtra =
    sandboxOrigin && sandboxOrigin.startsWith("http://127.0.0.1:") ? \` \${sandboxOrigin}\` : "";
  return {
    ...HTML_SECURITY_HEADERS_BASE,
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; connect-src 'self'; " +
      \`worker-src 'self' blob:\${workerExtra}; \` +
      "font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
}

/** Static default (no sandbox origin) for call sites that only need the baseline header set. */
const HTML_SECURITY_HEADERS: Record<string, string> = htmlSecurityHeaders();`;

if (!t.includes(oldBlock)) throw new Error("HTML_SECURITY_HEADERS block not found");
t = t.replace(oldBlock, newBlock);

// htmlResponse must use dynamic CSP with the live sandbox origin
const oldHtml = `  const htmlResponse = (rawHtml: string): Response => {
    let html = injectSessionMeta(rawHtml, security.token);
    const sb = resolveSandboxOrigin();
    if (sb) html = injectSandboxOriginMeta(html, sb);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", ...HTML_SECURITY_HEADERS },
    });
  };`;

const newHtml = `  const htmlResponse = (rawHtml: string): Response => {
    let html = injectSessionMeta(rawHtml, security.token);
    const sb = resolveSandboxOrigin();
    if (sb) html = injectSandboxOriginMeta(html, sb);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...htmlSecurityHeaders(sb),
      },
    });
  };`;

if (!t.includes(oldHtml)) throw new Error("htmlResponse block not found");
t = t.replace(oldHtml, newHtml);

await Bun.write(p, t);
console.log("csp patched");
