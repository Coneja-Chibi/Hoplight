/**
 * The MCP connections routes: the boundary where a browser's JSON becomes a command this machine
 * will execute.
 *
 * Two promises dominate. Env values go in and NEVER come back - the listing carries key names only,
 * because that block is where API keys ride. And a save with env omitted keeps the stored values,
 * because the browser never saw them and must not erase them by round-tripping a form.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMcpConfig } from "../kit/mcp/config";
import { stopAllMcp } from "../kit/mcp/connections";
import { handleMcpRoutes } from "./server-mcp";
import { resetAgentSession, studioSession } from "./agent/turn-stream";

const FIXTURE = fileURLToPath(new URL("../kit/mcp/fake-server.fixture.mjs", import.meta.url));

let home = "";
let savedHome: string | undefined;
let savedMcp: string | undefined;

beforeAll(async () => {
  savedHome = process.env["HOPLIGHT_HOME"];
  savedMcp = process.env["HOPLIGHT_MCP"];
  home = await mkdtemp(join(tmpdir(), "hoplight-mcp-routes-"));
  process.env["HOPLIGHT_HOME"] = home;
  process.env["HOPLIGHT_MCP"] = "on";
});

afterAll(async () => {
  resetAgentSession();
  stopAllMcp();
  if (savedHome === undefined) delete process.env["HOPLIGHT_HOME"];
  else process.env["HOPLIGHT_HOME"] = savedHome;
  if (savedMcp === undefined) delete process.env["HOPLIGHT_MCP"];
  else process.env["HOPLIGHT_MCP"] = savedMcp;
  await rm(home, { recursive: true, force: true });
});

const post = (path: string, body: unknown): Request =>
  new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (path: string): Request => new Request(`http://127.0.0.1${path}`);

interface Row {
  id: string;
  command: string;
  envKeys: string[];
  enabled: boolean;
}

const rowsOf = async (res: Response | null): Promise<Row[]> =>
  ((await res!.json()) as { servers: Row[] }).servers;

describe("the MCP routes", () => {
  test("saving stores the entry; the listing carries env KEY NAMES and never a value", async () => {
    resetAgentSession();
    const before = await studioSession(home);
    expect(before.contextSnapshot?.().tools.some((tool) => tool.name === "mcp_fake_echo")).toBe(false);
    const res = await handleMcpRoutes("/api/mcp/servers", post("/api/mcp/servers", {
      id: "fake",
      command: process.execPath,
      args: [FIXTURE],
      env: { SECRET_KEY: "hunter2" },
    }));
    expect(res!.status).toBe(200);
    const rows = await rowsOf(res);
    expect(rows[0]).toMatchObject({ id: "fake", envKeys: ["SECRET_KEY"] });
    expect(JSON.stringify(await (await handleMcpRoutes("/api/mcp/servers", get("/api/mcp/servers")))!.json()))
      .not.toContain("hunter2");
    const after = await studioSession(home);
    expect(after).not.toBe(before);
    expect(after.contextSnapshot?.().tools.some((tool) => tool.name === "mcp_fake_echo")).toBe(true);
  }, 30_000);

  test("a save with env omitted keeps the stored values", async () => {
    // The edit form round-trips without the secret; saving it must not erase the secret.
    await handleMcpRoutes("/api/mcp/servers", post("/api/mcp/servers", {
      id: "fake",
      command: process.execPath,
      args: [FIXTURE],
      enabled: false,
    }));
    const config = await readMcpConfig();
    expect(config.servers[0]?.env).toEqual({ SECRET_KEY: "hunter2" });
    expect(config.servers[0]?.enabled).toBe(false);
  }, 30_000);

  test("a malformed entry is refused by name and nothing is stored", async () => {
    const res = await handleMcpRoutes("/api/mcp/servers", post("/api/mcp/servers", {
      id: "Bad Id!",
      command: "x",
    }));
    expect(res!.status).toBe(400);
    expect(((await res!.json()) as { error: string }).error).toContain("id must be");
    expect((await readMcpConfig()).servers.map((s) => s.id)).toEqual(["fake"]);
  });

  test("test spawns the SAVED entry as a throwaway and reports its tools", async () => {
    const res = await handleMcpRoutes("/api/mcp/test", post("/api/mcp/test", { id: "fake" }));
    expect((await res!.json()) as unknown).toMatchObject({ ok: true, tools: 2, dropped: 1 });
    const missing = await handleMcpRoutes("/api/mcp/test", post("/api/mcp/test", { id: "nope" }));
    expect(missing!.status).toBe(404);
  }, 30_000);

  test("remove deletes the entry", async () => {
    const res = await handleMcpRoutes("/api/mcp/servers/remove", post("/api/mcp/servers/remove", { id: "fake" }));
    expect(await rowsOf(res)).toEqual([]);
    expect((await readMcpConfig()).servers).toEqual([]);
  }, 30_000);

  test("returns null for a path that is not ours, and refuses a non-JSON body", async () => {
    expect(await handleMcpRoutes("/api/formats", get("/api/formats"))).toBeNull();
    const res = await handleMcpRoutes(
      "/api/mcp/servers",
      new Request("http://127.0.0.1/api/mcp/servers", { method: "POST", body: "x" }),
    );
    expect(res!.status).toBe(415);
  });
});
