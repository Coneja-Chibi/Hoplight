/**
 * CLI IO policy: flags, path identity, container agreement, atomic publish.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertContainerAgreement,
  guardConvertOutput,
  isJsonText,
  isZipBytes,
  normalizeExtension,
  normalizePathKey,
  parseConvertFlags,
  pathsAreSame,
  publishAtomic,
} from "./cli-io";

describe("parseConvertFlags", () => {
  test("happy path with --yes and --to", () => {
    const r = parseConvertFlags(["--to", "risu", "--yes", "--strict"]);
    expect(r).toEqual({ ok: true, yes: true, strict: true, to: "risu", rest: [] });
  });

  test("rejects unknown flag", () => {
    const r = parseConvertFlags(["--force"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unknown flag");
  });

  test("rejects missing --to value", () => {
    const r = parseConvertFlags(["--to"]);
    expect(r.ok).toBe(false);
  });

  test("rejects duplicate --to", () => {
    const r = parseConvertFlags(["--to", "a", "--to", "b"]);
    expect(r.ok).toBe(false);
  });
});

describe("normalizeExtension", () => {
  test("from path and bare", () => {
    expect(normalizeExtension("out.CHARX")).toBe("charx");
    expect(normalizeExtension(".json")).toBe("json");
    expect(normalizeExtension("json")).toBe("json");
  });
});

describe("path identity and guards", () => {
  test("same relative aliases are equal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-cli-"));
    const a = join(dir, "card.json");
    await writeFile(a, "{}");
    expect(await pathsAreSame(a, join(dir, ".", "card.json"))).toBe(true);
    if (process.platform === "win32") {
      expect(normalizePathKey(a)).toBe(normalizePathKey(a.toUpperCase()));
    }
  });

  test("in-place always refused even with yes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-cli-"));
    const p = join(dir, "x.json");
    await writeFile(p, "{}");
    const g = await guardConvertOutput(p, p, true);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.code).toBe("in-place");
  });

  test("existing output refused without --yes and preserved", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-cli-"));
    const inn = join(dir, "in.json");
    const out = join(dir, "out.json");
    await writeFile(inn, "IN");
    await writeFile(out, "KEEP");
    const g = await guardConvertOutput(inn, out, false);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.code).toBe("exists");
    expect(await readFile(out, "utf8")).toBe("KEEP");
  });

  test("existing output allowed with --yes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-cli-"));
    const inn = join(dir, "in.json");
    const out = join(dir, "out.json");
    await writeFile(inn, "IN");
    await writeFile(out, "OLD");
    const g = await guardConvertOutput(inn, out, true);
    expect(g.ok).toBe(true);
  });
});

describe("container agreement", () => {
  test("json text ok", () => {
    expect(
      assertContainerAgreement("json", "json", { text: JSON.stringify({ a: 1 }) }).ok,
    ).toBe(true);
  });

  test("zip magic for charx", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(isZipBytes(bytes)).toBe(true);
    expect(assertContainerAgreement("charx", "charx", { bytes }).ok).toBe(true);
  });

  test("mismatch suggested extension fails", () => {
    const r = assertContainerAgreement("json", "charx", { text: "{}" });
    expect(r.ok).toBe(false);
  });

  test("json request with zip bytes fails", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const r = assertContainerAgreement("json", "json", { bytes });
    expect(r.ok).toBe(false);
  });

  test("isJsonText", () => {
    expect(isJsonText('{"a":1}')).toBe(true);
    expect(isJsonText("not json")).toBe(false);
  });
});

describe("publishAtomic", () => {
  test("writes new file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-pub-"));
    const out = join(dir, "out.json");
    await publishAtomic(out, '{"ok":true}');
    expect(await readFile(out, "utf8")).toBe('{"ok":true}');
  });

  test("replaces existing; failed write leaves prior when rename path intact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaud-pub2-"));
    const out = join(dir, "out.json");
    await writeFile(out, "PRIOR");
    await publishAtomic(out, "NEXT");
    expect(await readFile(out, "utf8")).toBe("NEXT");
  });
});
