/** Tests for the packaged-download guards: asset match to this binary, and the GitHub host allowlist. */
import { describe, expect, test } from "bun:test";
import { isAllowedDownloadHost, resolveAsset } from "./release-download";

const ASSETS = [
  "Hoplight.exe",
  "hoplight-windows-x64.exe",
  "hoplight-linux-x64",
  "hoplight-darwin-arm64",
  "hoplight-darwin-x64",
  "SHA256SUMS",
];

describe("resolveAsset", () => {
  test("matches the running binary exactly", () => {
    expect(resolveAsset(ASSETS, "Hoplight.exe")).toBe("Hoplight.exe");
    expect(resolveAsset(ASSETS, "hoplight-linux-x64")).toBe("hoplight-linux-x64");
  });
  test("fails closed when no asset matches (dev bun binary, or an arch with no build)", () => {
    expect(resolveAsset(ASSETS, "bun.exe")).toBeNull();
    expect(resolveAsset(ASSETS, "hoplight-windows-arm64.exe")).toBeNull();
    expect(resolveAsset([], "Hoplight.exe")).toBeNull();
  });
});

describe("isAllowedDownloadHost", () => {
  test("allows https GitHub release hosts (asset URL + redirect targets)", () => {
    expect(isAllowedDownloadHost("https://github.com/o/r/releases/download/v1/Hoplight.exe")).toBe(true);
    expect(isAllowedDownloadHost("https://objects.githubusercontent.com/x/y")).toBe(true);
    expect(isAllowedDownloadHost("https://release-assets.githubusercontent.com/z")).toBe(true);
  });
  test("denies non-https, non-GitHub, and garbage (SSRF + swap safety)", () => {
    expect(isAllowedDownloadHost("http://github.com/o/r")).toBe(false); // not https
    expect(isAllowedDownloadHost("https://evil.example/Hoplight.exe")).toBe(false);
    expect(isAllowedDownloadHost("https://github.com.evil.example/x")).toBe(false); // lookalike host
    expect(isAllowedDownloadHost("file:///etc/passwd")).toBe(false);
    expect(isAllowedDownloadHost("not a url")).toBe(false);
  });
});
