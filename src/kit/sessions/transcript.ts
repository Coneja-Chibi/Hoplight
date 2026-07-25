/**
 * Pure transcript formatter: a Session rendered to a portable file body plus a safe filename. Markdown
 * for humans (## you / ## reply, fenced tool blocks), json for machines (the canonical record verbatim).
 * No fs and no render layer, so it is fully deterministic and testable. The filename is derived from the
 * display title through sanitizeFilename, which is the traversal guard: only [a-z0-9-] survives.
 */
import type { ModelMessage } from "../providers/provider";
import { deriveTitle, type Session } from "./session-model";

export interface Transcript {
  readonly filename: string;
  readonly body: string;
}

const NAME_CAP = 60;

/** Allowlist a user-controlled title down to [a-z0-9-] with a stable fallback. Path separators, dots,
 * and every other character collapse to a single hyphen, so no title can escape the export directory. */
export const sanitizeFilename = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, NAME_CAP)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "session";
};

/** YYYYMMDD in UTC from an epoch-ms reading, so the same session always stamps the same date. */
const dateStamp = (ms: number): string => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");

const fence = (label: string, body: string): string => {
  const longest = Math.max(2, ...Array.from(body.matchAll(/`+/g), (match) => match[0].length));
  const marker = "`".repeat(longest + 1);
  return `${marker}${label.replaceAll("`", "'")}\n${body}\n${marker}`;
};

/** One wire message as a markdown block, or "" for a message that carries nothing to show. */
const messageBlock = (message: ModelMessage): string => {
  const text = message.content.trim();
  if (message.role === "user") return text ? `## you\n\n${text}` : "";
  if (message.role === "tool") {
    return fence(`tool · ${message.toolName ?? "result"}`, text || "(no output)");
  }
  const parts: string[] = [];
  if (text) parts.push(`## reply\n\n${text}`);
  for (const call of message.toolCalls ?? []) {
    parts.push(fence(`call · ${call.name}`, JSON.stringify(call.args ?? null, null, 2)));
  }
  return parts.join("\n\n");
};

const toMarkdown = (session: Session, title: string): string => {
  const head = [`# ${title}`, `_${session.turns.length} turn${session.turns.length === 1 ? "" : "s"}_`];
  const blocks = session.turns
    .flatMap((turn) => turn.messages.map(messageBlock))
    .filter((block) => block.length > 0);
  return `${[...head, ...blocks].join("\n\n")}\n`;
};

/** Render a session to a portable file. Unknown formats fall back to markdown (fail-safe default). */
export const formatTranscript = (session: Session, format: string): Transcript => {
  const title = session.title ?? deriveTitle(session.turns);
  const stamp = dateStamp(session.updatedAt);
  const base = sanitizeFilename(title);
  const identity = sanitizeFilename(session.id).slice(-8);
  if (format === "json") {
    return { filename: `${base}-${stamp}-${identity}.json`, body: `${JSON.stringify(session, null, 2)}\n` };
  }
  return { filename: `${base}-${stamp}-${identity}.md`, body: toMarkdown(session, title) };
};
