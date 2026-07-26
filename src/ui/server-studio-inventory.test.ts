/**
 * Studio inventory reports healthy and damaged files through the read-only HTTP boundary.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("/api/studio/inventory", () => {
  test("returns healthy entities and exact damage records", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-damaged-route-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);

    expect(await (await handler(apiReq("/api/studio/inventory"))).json()).toEqual({
      entities: [],
      damaged: [],
    });

    const characterDir = join(root, "character");
    await mkdir(characterDir, { recursive: true });
    await writeFile(join(characterDir, "broken.json"), '{"schemaVersion":');

    const response = await handler(apiReq("/api/studio/inventory?kind=character"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entities: [],
      damaged: [{ kind: "character", id: "broken", reason: "unreadable-json" }],
    });
  });

  test("is protected by the same API gate as the healthy list route", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-damaged-auth-"));
    roots.push(root);
    const security = filledSec();
    const handler = createHandler(
      new StudioStore(root),
      new SettingsStore(root),
      undefined,
      security,
    );
    const deniedList = await handler(apiReq("/api/studio/list", { host: "evil.example" }));
    const deniedInventory = await handler(
      apiReq("/api/studio/inventory", { host: "evil.example" }),
    );

    expect(deniedList.status).toBe(403);
    expect(deniedInventory.status).toBe(403);
  });
});
