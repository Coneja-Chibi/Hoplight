/**
 * The loopback-only route family at the untrusted doors: archive inspect and staged commit are
 * desk-only surfaces (a multi-gigabyte upload is a disk-fill vector from remote, and save-staged
 * commits rows only the desk's own upload staged), so a fully-authenticated tailed-in or
 * approved-LAN request must be refused with the gate's OWN words before a byte streams - never an
 * incidental downstream auth 403. Split from server-remote.test.ts at the 500-line cap.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { buildMinimalLvbak } from "../formats/_fixtures/lumiverse-archive/build-lvbak";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

async function withDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vaude-remote-loopback-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("archive import stays loopback-only (a disk-fill vector on the untrusted surfaces)", () => {
  const SECRET = "boot-secret";
  // A valid token is what proves this is OUR early refusal, not a downstream auth gate happening
  // to also 403: the guard has to win even for an otherwise-legitimate, correctly-authenticated
  // remote/LAN request, or "refused before a byte streams" would not actually be true.
  const archiveReq = (token: string): Request => {
    const req = apiReq("/api/inspect-archive", {
      method: "POST",
      token,
      contentType: "application/octet-stream",
      body: "irrelevant, refused before a byte streams",
    });
    req.headers.set("x-filename", "backup.lvbak");
    return req;
  };

  test("a tailed-in (sidecar-proxied) request is refused with OUR warm words, never Bun's own body cap", async () => {
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
      const req = archiveReq(sec.token);
      req.headers.set("x-hoplight-sidecar-secret", SECRET);
      const res = await handler(req);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Archive import is available on the local desktop app only." });
    });
  });

  test("an approved LAN device is refused the same way", async () => {
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
        undefined,
        true, // lanApproved
      );
      const res = await handler(archiveReq(sec.token));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Archive import is available on the local desktop app only." });
    });
  });

  test("save-staged is refused on both untrusted doors the same way (it commits rows only the desk's own upload staged)", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const stagedReq = (token: string): Request =>
        apiReq("/api/studio/save-staged", {
          method: "POST",
          token,
          contentType: "application/json",
          body: JSON.stringify({ token: "t", key: "row-0" }),
        });
      const asTailedIn = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        SECRET,
      );
      const proxied = stagedReq(sec.token);
      proxied.headers.set("x-hoplight-sidecar-secret", SECRET);
      expect((await asTailedIn(proxied)).status).toBe(403);

      const asLan = createHandler(
        new StudioStore(dir),
        new SettingsStore(dir),
        undefined,
        sec,
        undefined,
        undefined,
        undefined,
        undefined,
        true, // lanApproved
      );
      const lanRes = await asLan(stagedReq(sec.token));
      expect(lanRes.status).toBe(403);
      expect(await lanRes.json()).toEqual({ error: "Archive import is available on the local desktop app only." });
    });
  });

  test("the trusted loopback listener is unaffected: a real archive still imports", async () => {
    await withDir(async (dir) => {
      const sec = filledSec();
      const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
      const req = apiReq("/api/inspect-archive", {
        method: "POST",
        token: sec.token,
        contentType: "application/octet-stream",
        body: buildMinimalLvbak() as unknown as BodyInit,
      });
      req.headers.set("x-filename", "backup.lvbak");
      const res = await handler(req);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });
  });
});
