/**
 * The grant book, and the seam that makes it reachable.
 *
 * The last test is the point of the file: a folder shared mid-session must be visible to a dispatch
 * context that was built before it was shared. That is the failure the getter in session.ts exists to
 * prevent, and a unit test of the book alone would pass while the wiring was frozen at startup.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createGrantBook } from "./grant-book";
import { checkGrant, type Grant } from "./grants";

const scratch = async (): Promise<string> => mkdtemp(join(tmpdir(), "hoplight-grant-"));
const basenameOf = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? "";

describe("grant book", () => {
  test("shares a real folder and reports it resolved", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    const outcome = await book.share(dir);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.already).toBe(false);
    expect(outcome.grant.root).toBe(resolve(dir));
    expect(book.list()).toHaveLength(1);
  });

  test("refuses a folder that does not exist rather than recording it", async () => {
    const book = createGrantBook();
    const outcome = await book.share(join(await scratch(), "never-made"));

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("missing");
    // The failure this prevents: a silent record, then every later read refused as "outside grants".
    expect(book.list()).toHaveLength(0);
  });

  test("refuses a file, because sharing one would read as sharing its folder", async () => {
    const dir = await scratch();
    const file = join(dir, "preset.json");
    await writeFile(file, "{}");
    const book = createGrantBook();
    const outcome = await book.share(file);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("not-a-folder");
    expect(book.list()).toHaveLength(0);
  });

  test("sharing the same folder twice does not duplicate it", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await book.share(dir);
    const again = await book.share(join(dir, "..", basenameOf(dir)));

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.already).toBe(true);
    expect(book.list()).toHaveLength(1);
  });

  test("revoking removes access, and revoking an unshared folder says so", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await book.share(dir);

    expect(book.revoke(join(dir, ".."))).toBe(false);
    expect(book.list()).toHaveLength(1);
    expect(book.revoke(dir)).toBe(true);
    expect(book.list()).toHaveLength(0);
    expect(book.revoke(dir)).toBe(false);
  });

  test("a context built before the share still sees it", async () => {
    const book = createGrantBook();
    // Built once, exactly as createSession builds it, and never rebuilt afterwards.
    const ctx: { grants?: readonly Grant[] } = {
      get grants() {
        return book.list();
      },
    };
    const dir = await scratch();

    expect(checkGrant(ctx.grants ?? [], dir).ok).toBe(false);
    await book.share(dir);
    const after = checkGrant(ctx.grants ?? [], join(dir, "preset.json"));
    expect(after.ok).toBe(true);
  });
});

describe("identity is the same comparison containment uses", () => {
  test("revoking with different casing works, rather than silently doing nothing", async () => {
    // A real fail-open: containment lowercases on Windows but identity compared raw strings, so
    // /unshare with different casing reported "was not shared" and left the grant fully live.
    // A revocation control that silently no-ops is worse than one that errors.
    const dir = await scratch();
    const book = createGrantBook();
    await book.share(dir);

    const variant = process.platform === "win32" ? dir.toUpperCase() : dir;
    expect(book.revoke(variant)).toBe(true);
    expect(book.list()).toHaveLength(0);
  });

  test("sharing a case variant does not record the same folder twice", async () => {
    const dir = await scratch();
    const book = createGrantBook();
    await book.share(dir);
    const again = await book.share(process.platform === "win32" ? dir.toUpperCase() : dir);

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.already).toBe(true);
    expect(book.list()).toHaveLength(1);
  });
});
