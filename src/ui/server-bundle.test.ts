/**
 * Bundle inspect/export/save over the loopback API: emoji filenames, related lorebooks with
 * knowledgeRefs, preset bundles with regex sets, and export re-embedding. Split from
 * server.test.ts at the 500-line cap; the shared rig lives in server-test-rig.ts.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { loadFormats } from "../core";
import { SettingsStore } from "../studio/settings";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

describe("bundle inspect/export/save", () => {
  beforeAll(async () => {
    await loadFormats();
  });

  const cardWithBook = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Aria",
      description: "nav",
      character_book: {
        name: "Aetheria Lore",
        entries: [
          {
            id: 0,
            keys: ["skyport"],
            content: "Floating docks.",
            enabled: true,
            insertion_order: 10,
            extensions: {},
          },
        ],
      },
    },
  };

  test("inspect decodes a URI-encoded x-filename (emoji filenames broke fetch client-side)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-emoji-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    // a Marinara regex dump names its set from the FILENAME, so the receipt proves the decode
    const rows = [{ findRegex: "a", replaceString: "b", placement: ["ai_output"], order: 1 }];
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-hoplight-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", encodeURIComponent("[\u{1F48E}datacat] Sian rules.json"));
    const res = await handler(
      new Request("http://127.0.0.1:8321/api/inspect", {
        method: "POST",
        headers,
        body: new TextEncoder().encode(JSON.stringify(rows)),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; entity?: { body: { name: string } } };
    expect(body.ok).toBe(true);
    expect(body.entity?.body.name).toContain("\u{1F48E}datacat");
    await rm(dir, { recursive: true, force: true });
  });

  test("inspect returns related lorebook and matching knowledgeRefs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-insp-"));
    const sec = filledSec();
    const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
    const bytes = new TextEncoder().encode(JSON.stringify(cardWithBook));
    const res = await handler(
      apiReq("/api/inspect", {
        method: "POST",
        token: sec.token,
        contentType: "application/octet-stream",
        body: bytes,
      }),
    );
    // x-filename header
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-hoplight-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", "aria.json");
    const res2 = await handler(
      new Request("http://127.0.0.1:8321/api/inspect", {
        method: "POST",
        headers,
        body: bytes,
      }),
    );
    expect(res2.status).toBe(200);
    const body = await res2.json() as {
      ok: boolean;
      entity: { body: { knowledgeRefs?: string[] } };
      related?: { lorebooks?: { id: string; kind: string }[] };
      receipt?: { extras: string[] };
    };
    expect(body.ok).toBe(true);
    expect(body.related?.lorebooks?.length).toBe(1);
    const bookId = body.related!.lorebooks![0]!.id;
    expect(body.entity.body.knowledgeRefs).toEqual([bookId]);
    expect(body.receipt?.extras.some((x) => x.includes("lorebook"))).toBe(true);
  });

  test("preset bundle: inspect surfaces bundled regex; save-bundle shelves preset + regex set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-pre-"));
    const sec = filledSec();
    const store = new StudioStore(dir);
    const handler = createHandler(store, new SettingsStore(dir), undefined, sec);

    const presetFile = JSON.stringify({
      temperature: 0.9,
      top_p: 1,
      prompts: [{ identifier: "main", name: "Main", system_prompt: true, content: "You are {{char}}." }],
      prompt_order: [{ character_id: 100001, order: [{ identifier: "main", enabled: true }] }],
      extensions: {
        regex_scripts: [
          { id: "1", scriptName: "Fix quotes", findRegex: "/a/g", replaceString: "b", placement: [2], disabled: false },
        ],
      },
    });
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-hoplight-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", "paramnesia-vi-rc.json");
    const inspected = await (
      await handler(new Request("http://127.0.0.1:8321/api/inspect", { method: "POST", headers, body: new TextEncoder().encode(presetFile) }))
    ).json() as {
      ok: boolean;
      kind?: string;
      entity: unknown;
      related?: { regexSets?: { kind: string }[] };
      receipt?: { extras: string[] };
    };
    expect(inspected.ok).toBe(true);
    expect(inspected.kind).toBe("preset");
    expect(inspected.related?.regexSets?.length).toBe(1);
    expect(inspected.receipt?.extras.some((x) => x.includes("regex"))).toBe(true);

    const saveRes = await handler(
      apiReq("/api/studio/save-bundle", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity: inspected.entity, related: inspected.related }),
      }),
    );
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json() as { ok: boolean; primary: { kind: string; id: string }; related: { kind: string; id: string }[] };
    expect(saved.ok).toBe(true);
    expect(saved.primary.kind).toBe("preset");
    expect(saved.related.map((r) => r.kind)).toEqual(["regex"]);
    expect(await store.read("regex", saved.related[0]!.id)).not.toBeNull();
  });

  test("save-bundle then export re-embeds book; missing ref fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-exp-"));
    const sec = filledSec();
    const store = new StudioStore(dir);
    const handler = createHandler(store, new SettingsStore(dir), undefined, sec);

    const bytes = new TextEncoder().encode(JSON.stringify(cardWithBook));
    const headers = new Headers();
    headers.set("host", "127.0.0.1:8321");
    headers.set("origin", "http://127.0.0.1:8321");
    headers.set("x-hoplight-token", sec.token);
    headers.set("content-type", "application/octet-stream");
    headers.set("x-filename", "aria.json");
    const inspected = await (
      await handler(new Request("http://127.0.0.1:8321/api/inspect", { method: "POST", headers, body: bytes }))
    ).json() as {
      entity: unknown;
      related?: { lorebooks?: unknown[] };
    };

    const saveRes = await handler(
      apiReq("/api/studio/save-bundle", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({
          entity: inspected.entity,
          related: inspected.related,
        }),
      }),
    );
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json() as {
      ok: boolean;
      primary: { id: string; kind: string };
      related: { id: string; kind: string }[];
      knowledgeRefs: string[];
    };
    expect(saved.ok).toBe(true);
    expect(saved.related[0]?.kind).toBe("lorebook");
    expect(saved.knowledgeRefs).toEqual([saved.related[0]!.id]);

    const entity = await store.read(saved.primary.kind, saved.primary.id);
    expect(entity).not.toBeNull();

    const expRes = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity, targetId: "rolecall" }),
      }),
    );
    expect(expRes.status).toBe(200);
    const exp = await expRes.json() as { text?: string; report?: { dropped: string[] } };
    expect(exp.report).toBeDefined();
    const wire = JSON.parse(exp.text!);
    expect(wire.data.character_book).toBeDefined();
    expect(wire.data.character_book.entries[0].keys).toEqual(["skyport"]);

    // A disabled linked book is an explicit empty bundle, not permission to resurrect the raw twin.
    const disabledBook = await store.read(saved.related[0]!.kind, saved.related[0]!.id);
    expect(disabledBook).not.toBeNull();
    (disabledBook!.body as { enabled?: boolean }).enabled = false;
    await store.save(disabledBook, { overwrite: true });
    const disabledRes = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity, targetId: "sillytavern" }),
      }),
    );
    expect(disabledRes.status).toBe(200);
    const disabled = await disabledRes.json() as { text?: string; report: { dropped: string[] } };
    expect(JSON.parse(disabled.text!).data.character_book).toBeUndefined();
    expect(disabled.report.dropped).toContain("knowledgeRefs");

    // missing ref fails closed
    const broken = structuredClone(entity!);
    (broken.body as { knowledgeRefs: string[] }).knowledgeRefs = ["does-not-exist"];
    const miss = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity: broken, targetId: "sillytavern" }),
      }),
    );
    expect(miss.status).toBe(422);
    const missBody = await miss.json() as { error: string };
    expect(missBody.error).toContain("does-not-exist");

    const malformed = structuredClone(entity!);
    (malformed.body as { identity: { name: unknown } }).identity.name = 42;
    const bad = await handler(
      apiReq("/api/export", {
        method: "POST",
        token: sec.token,
        contentType: "application/json",
        body: JSON.stringify({ entity: malformed, targetId: "sillytavern" }),
      }),
    );
    expect(bad.status).toBe(400);
  });
});
