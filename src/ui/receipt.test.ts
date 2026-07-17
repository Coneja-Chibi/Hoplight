/**
 * The friendly-name map is a hand list beside a drop-in registry, which is exactly how it rotted:
 * the bare `lumiverse` character adapter was missing, so the setup quiz's publish list showed
 * "lumiverse" and "Lumiverse" as two different platforms. This pin walks the LIVE registry, so a
 * new adapter without a friendly name fails the gate instead of leaking its raw id into the UI.
 */
import { describe, expect, test } from "bun:test";
import { loadFormats } from "../core";
import { friendlyFormat } from "./receipt";

describe("friendlyFormat", () => {
  test("every registered adapter has a human name, never its raw id", async () => {
    const adapters = await loadFormats();
    const leaking = adapters.filter((a) => friendlyFormat(a.id) === a.id).map((a) => a.id);
    expect(leaking).toEqual([]);
  });

  test("an unknown id still degrades to itself instead of throwing", () => {
    expect(friendlyFormat("someday-format")).toBe("someday-format");
  });
});
