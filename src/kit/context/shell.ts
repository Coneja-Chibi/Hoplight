/**
 * Assembling the /context preview from the pieces the shell happens to hold.
 *
 * Separate from preview.ts because that module is pure formatting and must stay testable without a
 * Session, and separate from app.tsx because gathering four sources into one request shape is a
 * concept in its own right rather than part of rendering.
 *
 * A session with no snapshot still previews the conversation. That case is a stub in tests, not a
 * user with a broken install, and refusing would make the command look broken where it is merely
 * unfurnished.
 */
import type { ModelMessage } from "../providers/provider";
import type { Session } from "../session";
import { formatContextPreview } from "./preview";

export function buildContextPreview(
  session: Pick<Session, "contextSnapshot">,
  messages: readonly ModelMessage[],
  provider: { context?: number } | null,
): string {
  const snapshot = session.contextSnapshot?.() ?? { system: "", tools: [] };
  return formatContextPreview({
    system: snapshot.system,
    tools: snapshot.tools,
    messages,
    ...(provider?.context ? { contextWindow: provider.context } : {}),
  });
}
