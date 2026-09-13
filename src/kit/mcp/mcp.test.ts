/**
 * The MCP consuming side, proven against a LIVE fake server - real stdio, real child process.
 *
 * The config parser is proven pure (an entry here is a command this machine executes, so fail-closed
 * per entry is the whole safety story of the file). The connection manager is proven the way it will
 * fail in the field: a server that works, a tool that errors, a command that does not exist, and the
 * belt assembly that turns all of it into exact-name egress entries.
 *
 * HOPLIGHT_HOME points at a temporary directory throughout so tests never modify a developer's
 * actual MCP configuration or leak the fake server into later sessions.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMcpConfig } from "./config";
import {
  callMcpTool,
  connectedMcpTools,
  mcpStatus,
  probeMcpServer,
  stopAllMcp,
  syncMcpConnections,
} from "./connections";
import { externalHarnessTools, externalToolName } from "./external-tools";
import { createResultStore } from "../results/store";

const FIXTURE = fileURLToPath(new URL("./fake-server.fixture.mjs", import.meta.url));
const fakeEntry = (id: string) => ({
  id,
  command: process.execPath,
  args: [FIXTURE],
  env: {},
  enabled: true,
});

let home = "";
let savedHome: string | undefined;

beforeAll(async () => {
  savedHome = process.env["HOPLIGHT_HOME"];
  home = await mkdtemp(join(tmpdir(), "hoplight-mcp-"));
  process.env["HOPLIGHT_HOME"] = home;
});

afterAll(async () => {
  stopAllMcp();
  if (savedHome === undefined) delete process.env["HOPLIGHT_HOME"];
  else process.env["HOPLIGHT_HOME"] = savedHome;
  await rm(home, { recursive: true, force: true });
});

describe("parseMcpConfig", () => {
  test("fail-closed per entry: the bad ones are named, the good ones survive", () => {
    const parsed = parseMcpConfig({
      servers: [
        { id: "good", command: "bun", args: ["x.js"] },
        { id: "Bad Id!", command: "bun" },
        { id: "no-command", command: "  " },
        { id: "bad-args", command: "bun", args: [1] },
        { id: "bad-env", command: "bun", env: { KEY: 7 } },
        { id: "good", command: "other" },
        "not an object",
      ],
    });
    expect(parsed.servers.map((s) => s.id)).toEqual(["good"]);
    expect(parsed.rejected).toHaveLength(6);
    expect(parsed.rejected.join(" ")).toContain('duplicate id "good"');
  });

  test("enabled defaults on; env and args default empty", () => {
    const parsed = parseMcpConfig({ servers: [{ id: "a", command: "bun" }] });
    expect(parsed.servers[0]).toEqual({ id: "a", command: "bun", args: [], env: {}, enabled: true });
  });

  test("a non-boolean enabled flag is rejected instead of becoming runnable", () => {
    const parsed = parseMcpConfig({
      servers: [{ id: "misconfigured", command: "bun", enabled: "false" }],
    });
    expect(parsed.servers).toEqual([]);
    expect(parsed.rejected).toEqual([
      "servers[0] (misconfigured): enabled must be a boolean",
    ]);
  });

  test("anything that is not a config shape is no servers, not a crash", () => {
    for (const raw of [null, [], "x", { servers: "nope" }]) {
      expect(parseMcpConfig(raw).servers).toEqual([]);
    }
  });
});

describe("against the live fake server", () => {
  test("connects, lists tools, counts the malformed one, and round-trips a call", async () => {
    await syncMcpConnections([fakeEntry("fake")]);
    const status = mcpStatus([fakeEntry("fake")]);
    expect(status[0]).toMatchObject({ id: "fake", state: "connected", tools: 2, dropped: 1 });

    const echoed = await callMcpTool("fake", "echo", { text: "round trip" });
    expect(echoed).toEqual({ text: "echo: round trip", isError: false });

    // A tool that fails is failed TEXT the model reads, never a dropped connection.
    const grumbled = await callMcpTool("fake", "grumble", {});
    expect(grumbled.isError).toBe(true);
    expect(grumbled.text).toContain("grumble: no.");
  }, 30_000);

  test("a command that does not exist is a named failure, not a hang or a throw", async () => {
    const missing = { ...fakeEntry("missing"), command: join(home, "no-such-binary.exe") };
    // Must not throw: one broken server cannot cost the session its belt.
    await syncMcpConnections([fakeEntry("fake"), missing]);
    const status = mcpStatus([fakeEntry("fake"), missing]);
    expect(status.find((s) => s.id === "fake")?.state).toBe("connected");
    expect(status.find((s) => s.id === "missing")?.state).toBe("failed");
  }, 30_000);

  test("a disabled entry is stopped and says so", async () => {
    await syncMcpConnections([{ ...fakeEntry("fake"), enabled: false }]);
    const status = mcpStatus([{ ...fakeEntry("fake"), enabled: false }]);
    expect(status[0]).toMatchObject({ id: "fake", state: "failed", detail: "disabled" });
  }, 30_000);

  test("probe is a throwaway: it reports without joining the live set", async () => {
    stopAllMcp();
    const probe = await probeMcpServer(fakeEntry("probe-only"));
    expect(probe).toMatchObject({ ok: true, tools: 2, dropped: 1 });
    expect(connectedMcpTools()).toEqual([]);
  }, 30_000);
});

describe("external tools in the belt", () => {
  test("names fold to the belt's alphabet, exactly and predictably", () => {
    expect(externalToolName("lumi-tools", "preset_audit")).toBe("mcp_lumi_tools_preset_audit");
    expect(externalToolName("A B", "Weird.Tool!")).toBe("mcp_a_b_weird_tool");
  });

  test("wrapped tools carry the server's schema to the model and confirm-worthy effect", () => {
    const { tools, collisions } = externalHarnessTools([
      { serverId: "s", tool: { name: "echo", description: "d", inputSchema: { type: "object", properties: { text: {} } } } },
      // Same folded name from a different spelling: kept out, counted.
      { serverId: "s", tool: { name: "ECHO", description: "dup", inputSchema: { type: "object" } } },
    ]);
    expect(tools).toHaveLength(1);
    expect(collisions).toEqual(["s/ECHO -> mcp_s_echo"]);
    const tool = tools[0]!;
    expect(tool.effect).toBe("apply");
    expect(tool.exposure).toBe("direct");
    // The model sees the server's own schema, not the permissive zod stand-in.
    expect(tool.schemaOverride).toEqual({ type: "object", properties: { text: {} } });
    // And dispatch's boundary still holds: a non-object is refused before any wire traffic.
    expect(tool.input.safeParse("not an object").success).toBe(false);
  });

  test("a call to a server that is not connected is error text, not a throw", async () => {
    stopAllMcp();
    const { tools } = externalHarnessTools([
      { serverId: "gone", tool: { name: "echo", description: "", inputSchema: { type: "object" } } },
    ]);
    const result = await tools[0]!.execute({}, {} as never);
    expect(result.output).toContain("not connected");
  });

  test("large external results spill into the bounded session store", async () => {
    await syncMcpConnections([fakeEntry("fake")]);
    const advertised = connectedMcpTools().find((entry) => entry.tool.name === "echo")!;
    const { tools } = externalHarnessTools([advertised]);
    const results = createResultStore({ inlineChars: 32, maxEntryBytes: 20_000 });
    const result = await tools[0]!.execute({ text: "x".repeat(5_000) }, { results } as never);
    const captured = JSON.parse(result.output) as { spilled: boolean; handle: string; peek: string };
    expect(captured.spilled).toBe(true);
    expect(captured.peek.length).toBe(32);
    expect(results.stat(captured.handle)?.totalChars).toBeGreaterThan(5_000);
  }, 30_000);
});
