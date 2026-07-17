/**
 * api-fetch unit tests (DOM-free token/header logic via injected document).
 */
import { describe, expect, test } from "bun:test";
import { ApiHttpError, INSPECT_BODY_MAX_BYTES, readSessionToken } from "./api-fetch";

describe("api-fetch helpers", () => {
  test("INSPECT_BODY_MAX_BYTES is 64 MiB", () => {
    expect(INSPECT_BODY_MAX_BYTES).toBe(64 * 1024 * 1024);
  });

  test("readSessionToken reads meta content", () => {
    const doc = {
      querySelector: (sel: string) =>
        sel.includes("vaude-session")
          ? { getAttribute: (n: string) => (n === "content" ? "tok-abc" : null) }
          : null,
    } as unknown as Document;
    expect(readSessionToken(doc)).toBe("tok-abc");
  });

  test("readSessionToken empty when meta missing", () => {
    const doc = { querySelector: () => null } as unknown as Document;
    expect(readSessionToken(doc)).toBe("");
  });

  test("ApiHttpError carries status", () => {
    const e = new ApiHttpError(413, "too large");
    expect(e.status).toBe(413);
    expect(e.message).toBe("too large");
    expect(e.name).toBe("ApiHttpError");
  });
});
