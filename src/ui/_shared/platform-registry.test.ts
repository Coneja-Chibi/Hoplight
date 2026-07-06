/**
 * Platform-registry tests - the lookup is pure, so these pin the matching contract: known hosts resolve,
 * subdomains fold to the registrable domain, a specific subdomain keeps its own identity, www/port are
 * stripped, and an unknown host resolves to null (so the gate shows a neutral globe, never a wrong badge).
 */
import { describe, expect, test } from "bun:test";
import { platformFor, platformMark } from "./platform-registry";

describe("platformFor", () => {
  test("recognizes RP hosts and mainstream hosts alike", () => {
    expect(platformFor("janitorai.com")?.name).toBe("JanitorAI");
    expect(platformFor("chub.ai")?.name).toBe("Chub");
    expect(platformFor("google.com")?.name).toBe("Google");
    expect(platformFor("bing.com")?.name).toBe("Bing");
  });

  test("folds a subdomain to its registrable domain", () => {
    expect(platformFor("old.reddit.com")?.name).toBe("Reddit");
    expect(platformFor("beta.character.ai")?.name).toBe("Character.AI");
  });

  test("a specific subdomain keeps its own identity", () => {
    expect(platformFor("drive.google.com")?.name).toBe("Google Drive");
    expect(platformFor("google.com")?.name).toBe("Google");
  });

  test("strips a leading www and any port", () => {
    expect(platformFor("www.youtube.com")?.name).toBe("YouTube");
    expect(platformFor("google.com:443")?.name).toBe("Google");
  });

  test("unknown hosts resolve to null", () => {
    expect(platformFor("some-random-blog.example")).toBeNull();
    expect(platformFor("localhost:8321")).toBeNull();
    expect(platformFor("")).toBeNull();
  });
});

describe("platformMark", () => {
  test("defaults to the first letter, honors an explicit mark", () => {
    expect(platformMark({ name: "JanitorAI", color: "#000" })).toBe("J");
    expect(platformMark({ name: "itch.io", color: "#000" })).toBe("I");
    expect(platformMark({ name: "AO3", color: "#000", mark: "AO3" })).toBe("AO3");
  });
});
