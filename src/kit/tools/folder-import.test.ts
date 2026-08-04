/**
 * The one-way door: read outside, draft inside.
 *
 * The refusals are the subject. An importer that works is obvious the first time somebody uses it; an
 * importer that reaches a path nobody shared, or lands half a bundle, is not visible until later.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureFormats } from "../../ensure-formats";
import { createChangeSession } from "../changes/session";
import type { KitBridge } from "../bridge";
import { readOnlyTools } from "../../mcp/server";
import { grantFolder } from "./_shared/grants";
import type { ToolContext } from "./tool";
import folderImport from "./folder-import";

const shelf = new Map<string, true>();

const bridge: KitBridge = {
  studioDir: join(tmpdir(), "hoplight-import-studio"),
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind, id) { return shelf.has(`${kind}/${id}`) ? ({ kind, id } as never) : null; },
  async save() { throw new Error("an import must never write directly"); },
  async delete() { return false; },
};

/** A ST v2 card carrying an embedded book: one file, two canonical pieces, one referring to the other. */
const CARD_WITH_BOOK = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Probe",
    description: "a card with a book inside",
    personality: "",
    scenario: "",
    first_mes: "hello",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator: "",
    character_version: "1",
    extensions: {},
    character_book: {
      name: "Probe Book",
      entries: [{ keys: ["alpha"], content: "alpha matters", enabled: true, insertion_order: 0, id: 0 }],
    },
  },
};

let shared = "";
let outside = "";

const ctx = (): ToolContext => ({
  bridge,
  changes: createChangeSession(),
  grants: [grantFolder(shared, "presets")],
});

beforeAll(async () => {
  await ensureFormats();
  const root = await mkdtemp(join(tmpdir(), "hoplight-import-"));
  shared = join(root, "shared");
  outside = join(root, "shared-elsewhere");
  await mkdir(shared);
  await mkdir(outside);
  await writeFile(join(shared, "probe.json"), JSON.stringify(CARD_WITH_BOOK));
  await writeFile(join(shared, "notes.md"), "not a card");
  await writeFile(join(outside, "probe.json"), JSON.stringify(CARD_WITH_BOOK));
});

describe("folder_import refusals", () => {
  test("a path outside every shared folder is refused before the file is opened", async () => {
    const result = await folderImport.execute({ path: join(outside, "probe.json") }, ctx());
    expect(result.summary).toContain("outside-grants");
    expect(result.outcome).toBe("failed");
  });

  test("a sibling whose name merely starts with a shared folder's name is refused", async () => {
    // `shared-elsewhere` passes a prefix match against `shared` and must not pass this one.
    expect(outside.startsWith(shared)).toBe(true);
    const result = await folderImport.execute({ path: join(outside, "probe.json") }, ctx());
    expect(result.summary).toContain("outside-grants");
  });

  test("climbing out with .. is refused, since the resolved path is what gets checked", async () => {
    const result = await folderImport.execute(
      { path: join(shared, "..", "shared-elsewhere", "probe.json") },
      ctx(),
    );
    expect(result.summary).toContain("outside-grants");
  });

  test("with nothing shared, only the studio is reachable", async () => {
    const result = await folderImport.execute(
      { path: join(shared, "probe.json") },
      { bridge, changes: createChangeSession() },
    );
    expect(result.summary).toContain("outside-grants");
  });

  test("a file no adapter claims is named as unrecognised, not silently empty", async () => {
    const result = await folderImport.execute({ path: join(shared, "notes.md") }, ctx());
    expect(result.summary).toContain("unrecognised");
    expect(result.outcome).toBe("failed");
  });
});

describe("folder_import drafts", () => {
  test("a bundled card drafts every piece it contains, never just the primary", async () => {
    const result = await folderImport.execute({ path: join(shared, "probe.json") }, ctx());
    expect(result.outcome).toBe("draft");

    const output = JSON.parse(result.output) as {
      drafts: { kind: string; id: string; draftId: string }[];
      note?: string;
    };
    // The character's body names the book in knowledgeRefs, so importing it alone would dangle.
    expect(output.drafts.map((d) => d.kind)).toEqual(["character", "lorebook"]);
    expect(output.note).toContain("Apply every draft");
    expect(new Set(output.drafts.map((d) => d.draftId)).size).toBe(2);
  });

  test("the review handed to the shell is the primary piece", async () => {
    const result = await folderImport.execute({ path: join(shared, "probe.json") }, ctx());
    expect(result.review?.target.kind).toBe("character");
  });

  test("an id already on the shelf is refused, never overwritten", async () => {
    shelf.set("character/probe", true);
    try {
      const result = await folderImport.execute({ path: join(shared, "probe.json") }, ctx());
      expect(result.outcome).not.toBe("draft");
      expect(result.summary).toContain("exists");
    } finally {
      shelf.delete("character/probe");
    }
  });

  test("a collision on a related piece imports nothing at all", async () => {
    // The half-import this prevents: the character lands, its book does not, and the reference dangles.
    shelf.set("lorebook/probe-book", true);
    try {
      const result = await folderImport.execute({ path: join(shared, "probe.json") }, ctx());
      expect(result.outcome).not.toBe("draft");
      expect(result.output).toContain("Nothing was imported");
    } finally {
      shelf.delete("lorebook/probe-book");
    }
  });

  test("the id override lets the same file be imported beside an existing piece", async () => {
    shelf.set("character/probe", true);
    try {
      const result = await folderImport.execute(
        { path: join(shared, "probe.json"), id: "probe-copy" },
        ctx(),
      );
      expect(result.outcome).toBe("draft");
      expect(result.review?.target.id).toBe("probe-copy");
    } finally {
      shelf.delete("character/probe");
    }
  });
});

test("importing stays out of the read-only MCP posture, where nothing would ask", () => {
  // The posture the Claude subscription provider spawns has no gate in front of it. This is the
  // assertion that keeps a later `effect` edit from quietly handing it a write.
  expect(folderImport.effect).toBe("draft");
  expect(readOnlyTools([folderImport]).length).toBe(0);
});
