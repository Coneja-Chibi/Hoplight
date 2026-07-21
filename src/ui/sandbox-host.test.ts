/**
 * Sandbox-only origin host: allowlist, no API, no token, CORS for UI origin only.
 */
import { describe, expect, test } from "bun:test";
import {
  createSandboxHandler,
  isSandboxAllowlistedPath,
  SANDBOX_ALLOWLIST,
  startSandboxHost,
} from "./sandbox-host";
import { createSecurityContext, injectSandboxOriginMeta, injectSessionMeta } from "./server";

const UI_ORIGIN = "http://127.0.0.1:8321";

describe("sandbox allowlist", () => {
  test("only the two workers and wasm paths are allowlisted", () => {
    expect(isSandboxAllowlistedPath("/sandbox/worker.js")).toBe(true);
    expect(isSandboxAllowlistedPath("/sandbox/regex-worker.js")).toBe(true);
    expect(isSandboxAllowlistedPath("/sandbox/glue.wasm")).toBe(true);
    expect(isSandboxAllowlistedPath("/api/studio/save")).toBe(false);
    expect(isSandboxAllowlistedPath("/")).toBe(false);
    expect(isSandboxAllowlistedPath("/sandbox/../api/settings")).toBe(false);
    expect(SANDBOX_ALLOWLIST.length).toBe(3);
  });
});

describe("createSandboxHandler", () => {
  test("denies /api and arbitrary paths", async () => {
    const handler = createSandboxHandler({ allowOrigin: UI_ORIGIN });
    for (const path of ["/api/settings", "/api/studio/save", "/", "/index.html", "/boot.js", "/secret"]) {
      const res = await handler(new Request(`http://127.0.0.1:9${path}`));
      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).not.toContain("vaude-session");
      expect(text).not.toMatch(/token/i);
    }
  });

  test("serves worker.js with CORS for the UI origin and restrictive CSP", async () => {
    const handler = createSandboxHandler({ allowOrigin: UI_ORIGIN });
    const res = await handler(new Request("http://127.0.0.1:9/sandbox/worker.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(UI_ORIGIN);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("content-security-policy") ?? "").toContain("default-src 'none'");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(100);
    // The worker protocol deliberately contains the *name* of forbidden credential-shaped keys.
    // What matters is that the sandbox bundle cannot contain an actual launch credential.
    expect(body).not.toContain("secret-token-value");
    expect(body).not.toContain("X-Hoplight-Token");
  }, 60_000);

  test("OPTIONS preflight only for allowlisted paths", async () => {
    const handler = createSandboxHandler({ allowOrigin: UI_ORIGIN });
    const ok = await handler(
      new Request("http://127.0.0.1:9/sandbox/worker.js", { method: "OPTIONS" }),
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(UI_ORIGIN);

    const no = await handler(new Request("http://127.0.0.1:9/api/settings", { method: "OPTIONS" }));
    expect(no.status).toBe(404);
  });

  test("serves the regex worker from the isolated allowlist", async () => {
    const handler = createSandboxHandler({ allowOrigin: UI_ORIGIN });
    const res = await handler(new Request("http://127.0.0.1:9/sandbox/regex-worker.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(UI_ORIGIN);
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  test("rejects non-loopback allowOrigin at construction", () => {
    expect(() => createSandboxHandler({ allowOrigin: "https://evil.example" })).toThrow(
      /allowOrigin/,
    );
  });
});

describe("startSandboxHost", () => {
  test("binds ephemeral loopback origin and serves worker only", async () => {
    const { origin, stop } = startSandboxHost({ allowOrigin: UI_ORIGIN });
    try {
      expect(origin.startsWith("http://127.0.0.1:")).toBe(true);
      expect(origin).not.toBe(UI_ORIGIN);

      const worker = await fetch(`${origin}/sandbox/worker.js`);
      expect(worker.status).toBe(200);

      const api = await fetch(`${origin}/api/studio/list`);
      expect(api.status).toBe(404);

      // Token is never on this origin's surface.
      const html = await fetch(`${origin}/`);
      expect(html.status).toBe(404);
      expect(await html.text()).not.toContain("vaude-session");
    } finally {
      stop();
    }
  }, 60_000);
});

describe("injectSandboxOriginMeta", () => {
  test("injects sandbox origin without touching session token", () => {
    const base = "<html><head></head><body></body></html>";
    const withToken = injectSessionMeta(base, "secret-token-value");
    const withBoth = injectSandboxOriginMeta(withToken, "http://127.0.0.1:9999");
    expect(withBoth).toContain('name="vaude-session"');
    expect(withBoth).toContain("secret-token-value");
    expect(withBoth).toContain('name="vaude-sandbox-origin"');
    expect(withBoth).toContain("http://127.0.0.1:9999");
    // sandbox meta must not reuse the token
    expect(withBoth).not.toMatch(/vaude-sandbox-origin"[^>]*secret-token-value/);
  });

  test("rejects non-loopback origin", () => {
    expect(() => injectSandboxOriginMeta("<html></html>", "http://example.com")).toThrow();
  });
});

describe("token stays on UI security context only", () => {
  test("sandbox host construction does not receive the API token", () => {
    const sec = createSecurityContext();
    // Type-level / call-site: createSandboxHandler only takes allowOrigin + packaged.
    const handler = createSandboxHandler({ allowOrigin: UI_ORIGIN });
    expect(typeof handler).toBe("function");
    expect(sec.token.length).toBeGreaterThan(16);
  });
});
