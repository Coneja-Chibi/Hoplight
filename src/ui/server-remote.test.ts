/**
 * Remote-access control plane at the loopback boundary: status/enable/disable drive the sidecar manager
 * and persist the flag, and the trusted port refuses any request carrying the sidecar's secret header
 * (a sidecar-proxied request reaching the trusted door is by definition remote traffic and denied).
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { createHandler } from "./server";
import { checkRemoteApiRequest } from "./server-security";
import { apiReq, filledSec } from "./server-test-rig";
import type { SidecarManager } from "./remote/sidecar-manager";
import type { RemoteState } from "./remote/sidecar-status";

function fakeManager(): SidecarManager {
  let state: RemoteState = { phase: "off" };
  return {
    enable: () => {
      state = { phase: "starting" };
    },
    disable: async () => {
      state = { phase: "off" };
    },
    getState: () => state,
    getDevices: () => [],
    kick: () => {},
    openSignIn: () => {},
  };
}

async function withDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vaude-remote-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("/api/remote control plane", () => {
  test("status reports the manager state", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        fakeManager(),
      );
      const res = await handler(apiReq("/api/remote/status"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ phase: "off" });
    });
  });

  test("status without a manager reports off (unavailable, not an error)", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
      const res = await handler(apiReq("/api/remote/status"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ phase: "off" });
    });
  });

  test("enable starts the sidecar and persists the flag", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const settings = new SettingsStore(dir);
      const handler = createHandler(
        new StudioStore(dir),
        settings,
        undefined,
        sec,
        undefined,
        undefined,
        fakeManager(),
      );
      const res = await handler(
        apiReq("/api/remote/enable", {
          method: "POST",
          token: sec.token,
          contentType: "application/json",
          body: "{}",
        }),
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as RemoteState).phase).toBe("starting");
      expect((await settings.read()).remoteAccessEnabled).toBe(true);
    });
  });

  test("disable stops the sidecar and clears the flag", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const settings = new SettingsStore(dir);
      await settings.update({ remoteAccessEnabled: true });
      const handler = createHandler(
        new StudioStore(dir),
        settings,
        undefined,
        sec,
        undefined,
        undefined,
        fakeManager(),
      );
      const res = await handler(
        apiReq("/api/remote/disable", {
          method: "POST",
          token: sec.token,
          contentType: "application/json",
          body: "{}",
        }),
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as RemoteState).phase).toBe("off");
      expect((await settings.read()).remoteAccessEnabled).toBeUndefined();
    });
  });

  test("enable without a manager is 503, not a crash", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
      const res = await handler(
        apiReq("/api/remote/enable", {
          method: "POST",
          token: sec.token,
          contentType: "application/json",
          body: "{}",
        }),
      );
      expect(res.status).toBe(503);
    });
  });

  test("the trusted port refuses any /api request carrying the sidecar secret", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
      const req = apiReq("/api/version");
      req.headers.set("x-hoplight-sidecar-secret", "leaked");
      const res = await handler(req);
      expect(res.status).toBe(403);
    });
  });
});

describe("checkRemoteApiRequest (the untrusted remote gate)", () => {
  const SECRET = "the-per-boot-shared-secret";
  const withSecret = (req: Request): Request => {
    req.headers.set("x-hoplight-sidecar-secret", SECRET);
    return req;
  };

  test("no secret is 403 (a local process or rebinding page has none)", () => {
    expect(checkRemoteApiRequest(apiReq("/api/remote/status"), filledSec(), SECRET)?.status).toBe(403);
  });

  test("wrong secret is 403", () => {
    const req = apiReq("/api/remote/status");
    req.headers.set("x-hoplight-sidecar-secret", "nope");
    expect(checkRemoteApiRequest(req, filledSec(), SECRET)?.status).toBe(403);
  });

  test("valid secret GET passes (no loopback Host check needed)", () => {
    expect(checkRemoteApiRequest(withSecret(apiReq("/api/formats")), filledSec(), SECRET)).toBeNull();
  });

  test("valid secret but cross-site GET is 403 (blind-oracle guard)", () => {
    const req = withSecret(apiReq("/api/formats", { fetchSite: "cross-site" }));
    expect(checkRemoteApiRequest(req, filledSec(), SECRET)?.status).toBe(403);
  });

  test("POST with the secret still needs the CSRF token", () => {
    const sec = filledSec();
    const req = withSecret(
      apiReq("/api/settings", { method: "POST", token: null, contentType: "application/json" }),
    );
    expect(checkRemoteApiRequest(req, sec, SECRET)?.status).toBe(403);
  });

  test("POST with secret + valid token passes", () => {
    const sec = filledSec();
    const req = withSecret(
      apiReq("/api/settings", { method: "POST", token: sec.token, contentType: "application/json" }),
    );
    expect(checkRemoteApiRequest(req, sec, SECRET)).toBeNull();
  });
});

describe("untrusted remote handler gates every path (not just /api)", () => {
  const SECRET = "boot-secret";

  test("the index HTML (with the session token) is NOT served without the secret", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        SECRET,
      );
      const res = await handler(apiReq("/")); // a rebinding page / local process, no secret
      expect(res.status).toBe(403);
    });
  });

  test("a secret-bearing (sidecar-forwarded) request gets the app", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        SECRET,
      );
      const req = apiReq("/");
      req.headers.set("x-hoplight-sidecar-secret", SECRET);
      const res = await handler(req);
      expect(res.status).toBe(200);
    });
  });

  test("remote-access management is host-only: /api/remote/* is refused even with a valid secret + token", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        SECRET,
      );
      const req = apiReq("/api/remote/disable", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
      });
      req.headers.set("x-hoplight-sidecar-secret", SECRET);
      const res = await handler(req);
      expect(res.status).toBe(403); // a tailed-in device cannot turn remote access off or kick devices
    });
  });

  test("an approved LAN device is also refused remote-access management (host-only)", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      // lanApproved handler = the app served to an already-approved LAN device
      const handler = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );
      expect((await handler(apiReq("/api/remote/lan/status"))).status).toBe(403);
      expect((await handler(apiReq("/api/remote/status"))).status).toBe(403);
      // version updates are host-only too: a tailed-in device cannot switch the host's version
      expect((await handler(apiReq("/api/updates/releases"))).status).toBe(403);
      expect((await handler(apiReq("/api/update-check"))).status).toBe(403);
    });
  });
});
