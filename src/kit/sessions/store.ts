/**
 * The sessions filesystem edge: the single thin store that turns disk bytes into canonical Sessions
 * and back. One file per session (folders-as-schema) under configDir()/sessions, written atomically
 * (temp then rename) so a crash never shreds a session. parseSession is the trust boundary: untrusted
 * disk JSON is parsed ONCE, whole-session-or-null. A malformed turn or message denies the whole file
 * by absence rather than silently dropping wire history, which would corrupt losslessness on the next
 * write. Per-message tolerance lives only in the render replay, never here.
 */
import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { configDir } from "../providers/config";
import { writeAtomicReplace } from "../../studio/atomic-file";
import type { ModelMessage, ModelToolCall } from "../providers/provider";
import type { ForkParent, Session, SessionTurn } from "./session-model";
import { summarize, type SessionSummary } from "./projection";

export interface SessionStore {
  /** Every saved session summarized, newest activity first. Corrupt files are skipped, never thrown. */
  list(): Promise<SessionSummary[]>;
  /** One session by id, or null if missing/corrupt/unsafe (the current state must survive a bad read). */
  read(id: string): Promise<Session | null>;
  /** Persist one session atomically to its own file. */
  write(session: Session): Promise<void>;
  /** Remove one session file. True when a file was removed; a missing file is an idempotent no-op. */
  remove(id: string): Promise<boolean>;
  /** Write an already-formatted transcript into exportDir and return its final absolute path. */
  writeExport(exportDir: string, filename: string, body: string): Promise<string>;
}

/** Where sessions live on disk; HOPLIGHT_HOME (via configDir) makes it portable and test-friendly. */
export const sessionsDir = (): string => join(configDir(), "sessions");

/** A fresh session/fork id, minted at the edge and injected into the pure ops. */
export const newSessionId = (): string => randomUUID();

// Filenames are `${id}.json`; the id must not carry path separators or dots (traversal defense).
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseToolCall = (raw: unknown): ModelToolCall | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw["id"] !== "string" || typeof raw["name"] !== "string") return null;
  return { id: raw["id"], name: raw["name"], args: raw["args"] };
};

/** A wire message, or null if its role/content is malformed. Optional tool fields are lenient. */
/**
 * A stored question panel, or null for anything that is not one.
 *
 * TOLERANT ON PURPOSE, unlike the rest of this file: a malformed panel costs the ABILITY TO REDRAW
 * one question, while denying the message would cost the conversation it sits in. The turn is
 * still perfectly readable without it.
 */
const parseChoices = (raw: unknown): ModelMessage["choices"] | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw["question"] !== "string" || raw["question"].length === 0) return null;
  if (!Array.isArray(raw["options"])) return null;
  const options: { value: string; note?: string }[] = [];
  for (const entry of raw["options"]) {
    if (!isRecord(entry) || typeof entry["value"] !== "string" || entry["value"].length === 0) continue;
    options.push({
      value: entry["value"],
      ...(typeof entry["note"] === "string" ? { note: entry["note"] } : {}),
    });
  }
  // A question with nothing to pick is not a question; better no panel than an empty one.
  return options.length > 0 ? { question: raw["question"], options } : null;
};

const parseMessage = (raw: unknown): ModelMessage | null => {
  if (!isRecord(raw)) return null;
  const role = raw["role"];
  if (role !== "user" && role !== "assistant" && role !== "tool") return null;
  if (typeof raw["content"] !== "string") return null;
  const calls = Array.isArray(raw["toolCalls"])
    ? raw["toolCalls"].map(parseToolCall).filter((c): c is ModelToolCall => c !== null)
    : [];
  return {
    role,
    content: raw["content"],
    ...(typeof raw["reasoning"] === "string" ? { reasoning: raw["reasoning"] } : {}),
    ...(calls.length > 0 ? { toolCalls: calls } : {}),
    ...(typeof raw["toolCallId"] === "string" ? { toolCallId: raw["toolCallId"] } : {}),
    ...(typeof raw["toolName"] === "string" ? { toolName: raw["toolName"] } : {}),
    ...(parseChoices(raw["choices"]) ? { choices: parseChoices(raw["choices"])! } : {}),
  };
};

/** A turn, or null if any of its messages is malformed (whole-turn denial preserves losslessness). */
const parseTurn = (raw: unknown): SessionTurn | null => {
  if (!isRecord(raw) || !Array.isArray(raw["messages"])) return null;
  const messages: ModelMessage[] = [];
  for (const entry of raw["messages"]) {
    const message = parseMessage(entry);
    if (!message) return null;
    messages.push(message);
  }
  return {
    input: typeof raw["input"] === "string" ? raw["input"] : "",
    messages,
    at: isFiniteNumber(raw["at"]) ? raw["at"] : 0,
  };
};

const parseParent = (raw: unknown): ForkParent | null | undefined => {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw) || typeof raw["id"] !== "string" || !isFiniteNumber(raw["turn"])) return undefined; // bad shape
  return { id: raw["id"], turn: raw["turn"] };
};

/** The trust boundary: a disk blob becomes a Session only if the whole shape is sound, else null. */
export const parseSession = (raw: unknown): Session | null => {
  if (!isRecord(raw)) return null;
  if (raw["version"] !== 1) return null;
  if (typeof raw["id"] !== "string" || raw["id"].length === 0) return null;
  if (!isFiniteNumber(raw["createdAt"]) || !isFiniteNumber(raw["updatedAt"])) return null;
  if (!Array.isArray(raw["turns"])) return null;
  const parent = parseParent(raw["parent"]);
  if (parent === undefined) return null;
  const turns: SessionTurn[] = [];
  for (const entry of raw["turns"]) {
    const turn = parseTurn(entry);
    if (!turn) return null;
    turns.push(turn);
  }
  const title = raw["title"];
  // ABSENT IS NULL, not a denial: every session written before the rail was remembered has no
  // such field, and a strict parser that rejected them would eat somebody's whole history.
  const rail = raw["rail"];
  return {
    version: 1,
    id: raw["id"],
    title: typeof title === "string" ? title : null,
    createdAt: raw["createdAt"],
    updatedAt: raw["updatedAt"],
    parent,
    turns,
    rail: typeof rail === "string" && rail.length > 0 ? rail : null,
  };
};

const loadFile = async (path: string): Promise<Session | null> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null; // missing or unreadable
  }
  try {
    return parseSession(JSON.parse(text));
  } catch {
    return null; // not JSON
  }
};

/** Build a store rooted at a sessions directory (defaults to the real one under configDir). */
export const createSessionStore = (dir: string = sessionsDir()): SessionStore => ({
  async list() {
    const names = await readdir(dir).catch(() => [] as string[]);
    const sessions: Session[] = [];
    for (const name of names) {
      if (!name.endsWith(".json") || name.startsWith(".")) continue;
      const session = await loadFile(join(dir, name));
      if (session) sessions.push(session);
    }
    return sessions.map(summarize).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async read(id) {
    if (!SAFE_ID.test(id)) return null;
    return loadFile(join(dir, `${id}.json`));
  },

  async write(session) {
    if (!SAFE_ID.test(session.id)) throw new Error("sessions: unsafe session id");
    await mkdir(dir, { recursive: true });
    await writeAtomicReplace(join(dir, `${session.id}.json`), `${JSON.stringify(session, null, 2)}\n`);
  },

  async remove(id) {
    if (!SAFE_ID.test(id)) return false;
    try {
      await unlink(join(dir, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  },

  async writeExport(exportDir, filename, body) {
    await mkdir(exportDir, { recursive: true });
    const path = join(exportDir, basename(filename)); // basename strips any stray path parts
    await writeAtomicReplace(path, body);
    return path;
  },
});
