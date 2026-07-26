/** HTTP-boundary regression tests for Studio save validation and persistence isolation. */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { entityRevision } from "../entities/canonical-revision";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("/api/studio/save", () => {
  test("returns the complete entity with its revision for an editor load", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    await store.save({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: "editable",
      body: { name: "Editable", content: "" },
    });
    const entity = (await store.read("persona", "editable"))!;

    const response = await handler(apiReq(
      "/api/studio/get?kind=persona&id=editable&revision=1",
      { token: security.token },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entity,
      revision: entityRevision(entity),
    });
  });

  test("returns a bounded 400 and writes nothing for malformed optional canonical data", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    const request = apiReq("/api/studio/save", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "character",
        id: "bad-settings",
        body: {
          identity: { name: "Bad settings" },
          persona: {},
          prompts: {},
          greetings: {},
          examples: {},
          media: {},
          attribution: {},
          discovery: {},
          settings: "not an object",
        },
      }),
    });

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid canonical entity" });
    expect(await store.read("character", "bad-settings")).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  test("rejects a stale editor revision without overwriting the newer entity", async () => {
    const root = await mkdtemp(join(tmpdir(), "hoplight-studio-write-"));
    roots.push(root);
    const store = new StudioStore(root);
    const security = filledSec();
    const handler = createHandler(store, new SettingsStore(root), undefined, security);
    const baseline = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: "stale-editor",
      body: { name: "Baseline", content: "" },
    };
    await store.save(baseline);
    const opened = (await store.read("persona", baseline.id))!;
    await store.save(
      { ...opened, body: { name: "Newer disk state", content: "" } },
      { overwrite: true },
    );

    const response = await handler(apiReq("/api/studio/save", {
      method: "POST",
      token: security.token,
      contentType: "application/json",
      body: JSON.stringify({
        entity: { ...opened, body: { name: "Stale tab", content: "" } },
        expectedRevision: entityRevision(opened),
      }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "piece changed since it was opened" });
    expect((await store.read("persona", baseline.id))?.body).toEqual({
      name: "Newer disk state",
      content: "",
    });
  });
});
