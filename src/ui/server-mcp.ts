/**
 * The MCP connections surface: which servers this machine talks to, and how to point clients back.
 *
 * HOST-ONLY WHOLE, and this one is not a judgement call. A server entry is a COMMAND THIS MACHINE
 * WILL EXECUTE at the next session build - accepting one from a tailed-in or LAN device would be
 * remote code execution with a settings screen for a face. isHostOnlyRoute covers the /api/mcp/
 * prefix; nothing here re-checks that, the same single-gate rule every other host-only route
 * follows.
 *
 * ENV VALUES GO IN AND NEVER COME BACK. A server's env block is where API keys ride, so the listing
 * carries env KEY NAMES only - the vault's one-direction rule, applied here. Saving with env omitted
 * keeps the stored env, which is what lets somebody change a command without re-pasting a key.
 */
import {
  mcpConfigPath,
  parseMcpConfig,
  readMcpConfig,
  writeMcpConfig,
  type McpServerEntry,
} from "../kit/mcp/config";
import { mcpStatus, probeMcpServer, syncMcpConnections } from "../kit/mcp/connections";
import { contentTypeIs, err, json, readJsonCapped } from "./server-security";
import { resetAgentSession } from "./agent/turn-stream";

const BODY_MAX = 32 * 1024;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The listing: entries with env REDACTED to key names, joined with live status. */
async function listServers(): Promise<Response> {
  const config = await readMcpConfig();
  const status = new Map(mcpStatus(config.servers).map((s) => [s.id, s]));
  return json({
    servers: config.servers.map((entry) => ({
      id: entry.id,
      command: entry.command,
      args: entry.args,
      envKeys: Object.keys(entry.env),
      enabled: entry.enabled,
      status: status.get(entry.id) ?? null,
    })),
    rejected: config.rejected,
    configPath: mcpConfigPath(),
  });
}

/** Parse one submitted entry through the SAME parser the file uses, so the shapes cannot drift. */
function parseSubmitted(body: Record<string, unknown>): McpServerEntry | string {
  const parsed = parseMcpConfig({ servers: [body] });
  if (parsed.servers.length === 1) return parsed.servers[0]!;
  return parsed.rejected[0] ?? "that entry did not parse";
}

async function saveServer(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
  const parsed = await readJsonCapped(req, BODY_MAX);
  if (!parsed.ok) return parsed.response;
  if (!isRec(parsed.value)) return err("expected an object", 400);

  const body = parsed.value;
  const config = await readMcpConfig();
  const existing = config.servers.find((s) => s.id === body["id"]);
  // env omitted = keep what is stored; the browser never saw the values and must not erase them.
  const submitted = body["env"] === undefined && existing ? { ...body, env: existing.env } : body;
  const entry = parseSubmitted(submitted);
  if (typeof entry === "string") return err(entry, 400);

  const next = [...config.servers.filter((s) => s.id !== entry.id), entry];
  await writeMcpConfig(next);
  // Bring the live set in line now, so the next turn uses the new belt without a restart.
  await syncMcpConnections(next);
  resetAgentSession();
  return listServers();
}

async function removeServer(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
  const parsed = await readJsonCapped(req, BODY_MAX);
  if (!parsed.ok) return parsed.response;
  const id = isRec(parsed.value) ? parsed.value["id"] : undefined;
  if (typeof id !== "string" || !id) return err("expected { id }", 400);
  const config = await readMcpConfig();
  const next = config.servers.filter((s) => s.id !== id);
  await writeMcpConfig(next);
  await syncMcpConnections(next);
  resetAgentSession();
  return listServers();
}

/** Test = a throwaway spawn of the SAVED entry (its env included), never of browser-supplied text. */
async function testServer(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
  const parsed = await readJsonCapped(req, BODY_MAX);
  if (!parsed.ok) return parsed.response;
  const id = isRec(parsed.value) ? parsed.value["id"] : undefined;
  if (typeof id !== "string" || !id) return err("expected { id }", 400);
  const config = await readMcpConfig();
  const entry = config.servers.find((s) => s.id === id);
  if (!entry) return err(`no server called "${id}"`, 404);
  const probe = await probeMcpServer(entry);
  return json(probe);
}

/** Returns null for anything that is not ours, so the caller's route table keeps its shape. */
export async function handleMcpRoutes(p: string, req: Request): Promise<Response | null> {
  if (p === "/api/mcp/servers" && req.method === "GET") return listServers();
  if (p === "/api/mcp/servers" && req.method === "POST") return saveServer(req);
  if (p === "/api/mcp/servers/remove" && req.method === "POST") return removeServer(req);
  if (p === "/api/mcp/test" && req.method === "POST") return testServer(req);
  return null;
}
