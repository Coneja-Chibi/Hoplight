/**
 * The whole belt assembled: first-party tools plus a LIVE external server's, with the trust entries
 * that travel beside them.
 *
 * The one invariant worth a process spawn: the belt and the egress enumeration come from the same
 * function in the same breath, because a name in the belt without a trust entry lands on the
 * unknown floor and becomes permanently unusable - the preset_copy_blocks failure, externalized.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleBelt } from "./belt";
import { stopAllMcp } from "./mcp/connections";
import { createAccessResolver } from "./tools/safety/access";

const FIXTURE = fileURLToPath(new URL("./mcp/fake-server.fixture.mjs", import.meta.url));

let home = "";
let studio = "";
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const key of ["HOPLIGHT_HOME", "HOPLIGHT_MCP"]) saved[key] = process.env[key];
  home = await mkdtemp(join(tmpdir(), "hoplight-belt-home-"));
  studio = await mkdtemp(join(tmpdir(), "hoplight-belt-studio-"));
  process.env["HOPLIGHT_HOME"] = home;
  process.env["HOPLIGHT_MCP"] = "on"; // the explicit override; without it the test runner never connects
  await mkdir(join(home, ".hoplight"), { recursive: true });
  await writeFile(
    join(home, ".hoplight", "mcp.json"),
    JSON.stringify({ servers: [{ id: "fake", command: process.execPath, args: [FIXTURE] }] }),
  );
});

afterAll(async () => {
  stopAllMcp();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(home, { recursive: true, force: true });
  await rm(studio, { recursive: true, force: true });
});

describe("assembleBelt", () => {
  test("external tools join the belt WITH their exact-name egress entries", async () => {
    const belt = await assembleBelt([], studio);
    const names = belt.tools.map((t) => t.name);
    expect(names).toContain("mcp_fake_echo");
    expect(names).toContain("mcp_fake_grumble");

    // The pairing that must not drift: every external name resolves to egress, not the floor.
    const resolve = createAccessResolver(belt.externalAccess);
    expect(resolve("mcp_fake_echo")).toBe("egress");
    expect(resolve("mcp_fake_grumble")).toBe("egress");
    // And an external name NOT enumerated stays on the floor - deny by absence.
    expect(resolve("mcp_fake_invented")).toBe("unknown");
  }, 30_000);

  test("without the explicit override, the test runner never connects to anything", async () => {
    delete process.env["HOPLIGHT_MCP"];
    try {
      const belt = await assembleBelt([], studio);
      expect(belt.tools.filter((t) => t.name.startsWith("mcp_"))).toEqual([]);
      expect(belt.externalAccess).toEqual([]);
    } finally {
      process.env["HOPLIGHT_MCP"] = "on";
    }
  });
});
