/**
 * Which MCP servers this machine connects to - the file, its shape, and nothing else.
 *
 * HOME-KEYED, BESIDE THE VAULT. `~/.hoplight/mcp.json`, not the studio folder, for the same reason
 * the provider vault lives there: a server entry names a COMMAND THIS MACHINE EXECUTES, which is a
 * fact about the machine, not about any one studio - and a studio folder can be shared, synced, or
 * handed to somebody else, none of which should carry "run this program" along with it.
 *
 * THAT SAME FACT IS THE THREAT MODEL. An entry here is arbitrary command execution at the next
 * session build. The file is written only through the host-only /api/mcp/* routes or by the owner's
 * own editor; parsing is fail-closed per entry (a malformed entry is dropped and REPORTED, never
 * repaired into something runnable); and nothing in this module ever executes anything - spawning
 * belongs to connections.ts, so the file's shape and the act of running it stay in different rooms.
 */
import { join } from "node:path";
import { configDir } from "../providers/config";

export interface McpServerEntry {
  /** Short name; becomes the tool-name prefix, so it is id-shaped and unique. */
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  /** Extra environment for the child; it inherits the parent's on top of this. */
  readonly env: Readonly<Record<string, string>>;
  readonly enabled: boolean;
}

export interface McpConfig {
  readonly servers: readonly McpServerEntry[];
  /** Entries that did not parse, by index, so a hand-edit gone wrong is named rather than eaten. */
  readonly rejected: readonly string[];
}

export const mcpConfigPath = (): string => join(configDir(), "mcp.json");

const ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseEntry(raw: unknown, at: number): McpServerEntry | string {
  if (!isRec(raw)) return `servers[${at}]: not an object`;
  const id = raw["id"];
  if (typeof id !== "string" || !ID_RE.test(id)) {
    return `servers[${at}]: id must be lowercase letters, digits and hyphens (got ${JSON.stringify(raw["id"])})`;
  }
  const command = raw["command"];
  if (typeof command !== "string" || command.trim() === "") {
    return `servers[${at}] (${id}): command must be a non-empty string`;
  }
  const rawArgs = raw["args"] ?? [];
  if (!Array.isArray(rawArgs) || rawArgs.some((a) => typeof a !== "string")) {
    return `servers[${at}] (${id}): args must be an array of strings`;
  }
  const rawEnv = raw["env"] ?? {};
  if (!isRec(rawEnv) || Object.values(rawEnv).some((v) => typeof v !== "string")) {
    return `servers[${at}] (${id}): env must be an object of strings`;
  }
  const rawEnabled = raw["enabled"];
  if (rawEnabled !== undefined && typeof rawEnabled !== "boolean") {
    return `servers[${at}] (${id}): enabled must be a boolean`;
  }
  return {
    id,
    command: command.trim(),
    args: rawArgs as string[],
    env: rawEnv as Record<string, string>,
    enabled: rawEnabled ?? true,
  };
}

/** Fail-closed per entry; duplicate ids keep the first and reject the rest by name. */
export function parseMcpConfig(raw: unknown): McpConfig {
  if (!isRec(raw) || !Array.isArray(raw["servers"])) return { servers: [], rejected: [] };
  const servers: McpServerEntry[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  (raw["servers"] as unknown[]).forEach((entry, at) => {
    const parsed = parseEntry(entry, at);
    if (typeof parsed === "string") {
      rejected.push(parsed);
      return;
    }
    if (seen.has(parsed.id)) {
      rejected.push(`servers[${at}]: duplicate id "${parsed.id}"`);
      return;
    }
    seen.add(parsed.id);
    servers.push(parsed);
  });
  return { servers, rejected };
}

/** A missing file is no servers; a corrupt one is no servers plus a named rejection. */
export async function readMcpConfig(): Promise<McpConfig> {
  let text: string | null = null;
  try {
    const file = Bun.file(mcpConfigPath());
    text = (await file.exists()) ? await file.text() : null;
  } catch {
    return { servers: [], rejected: ["mcp.json could not be read"] };
  }
  if (text === null) return { servers: [], rejected: [] };
  try {
    return parseMcpConfig(JSON.parse(text));
  } catch {
    return { servers: [], rejected: ["mcp.json is not valid JSON; no servers were loaded"] };
  }
}

/** Replace the whole list. Read-modify-write callers own their own sequencing; the UI serializes. */
export async function writeMcpConfig(servers: readonly McpServerEntry[]): Promise<void> {
  const body = JSON.stringify({ servers }, null, 2);
  await Bun.write(mcpConfigPath(), `${body}\n`);
}
