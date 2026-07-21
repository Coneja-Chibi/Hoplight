/**
 * Update-check core: version compare pinned to release semantics, the tolerant release reader, and
 * the status fold. APP_VERSION is pinned to package.json so the banner, the API, and the release
 * workflow can never disagree.
 */
import { describe, expect, test } from "bun:test";
import { APP_VERSION } from "../../version";
import pkg from "../../../package.json";
import { compareVersions, readLatestRelease, updateStatusOf, RELEASES_PAGE } from "./update-check";

test("APP_VERSION is package.json's version (one truth)", () => {
  expect(APP_VERSION).toBe((pkg as { version: string }).version);
});

describe("compareVersions", () => {
  test("numeric segments compare numerically, not lexically", () => {
    expect(compareVersions("0.9.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
  });
  test("v prefixes and missing segments are tolerated", () => {
    expect(compareVersions("v0.1.0", "0.1")).toBe(0);
    expect(compareVersions("v0.1.0", "V0.2.0")).toBe(-1);
  });
  test("a release beats its own prerelease", () => {
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc.2")).toBe(1);
  });
  test("garbage never throws and sorts below a real version", () => {
    // "not-a-version" parses as 0.0.0 with a prerelease tail, so it loses to the real release
    expect(compareVersions("not-a-version", "0.0.0")).toBe(-1);
    expect(compareVersions("garbage", "garbage")).toBe(0);
  });
});

describe("readLatestRelease", () => {
  test("reads tag_name + html_url; falls back to the releases page", () => {
    expect(readLatestRelease({ tag_name: "v0.2.0", html_url: "https://x/r" })).toEqual({
      version: "v0.2.0",
      url: "https://x/r",
    });
    expect(readLatestRelease({ tag_name: "v0.2.0" })?.url).toBe(RELEASES_PAGE);
  });
  test("null on anything that is not a release", () => {
    expect(readLatestRelease(null)).toBeNull();
    expect(readLatestRelease({})).toBeNull();
    expect(readLatestRelease({ tag_name: "" })).toBeNull();
    expect(readLatestRelease([{ tag_name: "v1" }])).toBeNull();
  });
});

describe("updateStatusOf", () => {
  test("404 means no releases yet, not an error", () => {
    expect(updateStatusOf("0.1.0", 404, null)).toEqual({ state: "none" });
  });
  test("newer release -> available; same or older -> current", () => {
    const body = { tag_name: "v0.2.0", html_url: "https://x/r" };
    expect(updateStatusOf("0.1.0", 200, body).state).toBe("available");
    expect(updateStatusOf("0.2.0", 200, body).state).toBe("current");
    expect(updateStatusOf("0.3.0", 200, body).state).toBe("current");
  });
  test("non-200 and malformed bodies fold to error", () => {
    expect(updateStatusOf("0.1.0", 500, null).state).toBe("error");
    expect(updateStatusOf("0.1.0", 200, { nope: true }).state).toBe("error");
  });
  test("httpStatus 0 (fetch itself failed) folds to the unreachable message", () => {
    const s = updateStatusOf("0.1.0", 0, null);
    expect(s).toEqual({ state: "error", message: "Could not reach GitHub." });
  });
});
