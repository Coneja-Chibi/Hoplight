/**
 * What Kit is about to send the model, shown before it goes.
 *
 * WHY THIS EXISTS. Everything else Kit says about a turn is after the fact: the egress ledger records
 * what left, /usage reports what it cost. Neither answers the question a person actually has before
 * pressing enter, which is "what is in this request". The system guidance, the tool belt and the
 * accumulated history are all things Kit adds to the words typed, and none of them were visible.
 *
 * ESTIMATES ARE LABELLED AS ESTIMATES. There is no tokenizer here and adding one would mean pinning a
 * vocabulary per provider that would drift. A character count divided by four is close enough to
 * answer "is my history about to blow the window", and pretending to a precision we do not have would
 * be worse than the rounding. Every number this module produces says it is an estimate, and the parts
 * are shown separately so a wrong total is still a useful breakdown.
 *
 * Pure and total: no I/O, no clock, never throws. The shell passes in what it holds.
 */
import type { ModelMessage, ToolSpec } from "../providers/provider";

/** Roughly four characters to a token, the usual English approximation. Never precise, never claimed to be. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export interface ContextSnapshot {
  /** The standing guidance Kit sends on every turn, whatever the user typed. */
  readonly system: string;
  /** The conversation as the model will receive it. */
  readonly messages: readonly ModelMessage[];
  /** The belt as it stands right now; discovery can change it between turns. */
  readonly tools: readonly ToolSpec[];
  /** The provider's window, when it reported one. Absent is common and not an error. */
  readonly contextWindow?: number;
  /** What would be sent as the next user turn, when the input line is not empty. */
  readonly pending?: string;
}

interface Part {
  readonly label: string;
  readonly tokens: number;
  readonly detail: string;
}

/** One tool costs its name, its description and its schema; the schema is usually the bulk of it. */
const toolTokens = (tool: ToolSpec): number =>
  estimateTokens(tool.name) + estimateTokens(tool.description) + estimateTokens(JSON.stringify(tool.schema));

/** A message costs its text plus any tool calls or results riding on it. */
export function messageTokens(message: ModelMessage): number {
  let total = estimateTokens(message.content);
  for (const call of message.toolCalls ?? []) {
    total += estimateTokens(call.name) + estimateTokens(JSON.stringify(call.args));
  }
  return total;
}

/** Naive "+s" gets "replys" wrong, so the plural is passed rather than guessed. */
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Counts by role, so a transcript dominated by tool results reads as one. */
function describeMessages(messages: readonly ModelMessage[]): string {
  if (messages.length === 0) return "nothing yet";
  const counts = { user: 0, assistant: 0, tool: 0 };
  for (const message of messages) counts[message.role] += 1;
  return [
    counts.user > 0 ? plural(counts.user, "user turn") : "",
    counts.assistant > 0 ? plural(counts.assistant, "reply", "replies") : "",
    counts.tool > 0 ? plural(counts.tool, "tool result") : "",
  ].filter(Boolean).join(", ");
}

/** The parts of the request, largest cost last so the reader ends on what dominates. */
export function contextParts(snapshot: ContextSnapshot): Part[] {
  const parts: Part[] = [
    {
      label: "system guidance",
      tokens: estimateTokens(snapshot.system),
      detail: snapshot.system ? "sent every turn, whatever you type" : "none",
    },
    {
      label: "tool belt",
      tokens: snapshot.tools.reduce((sum, tool) => sum + toolTokens(tool), 0),
      detail: snapshot.tools.length === 0
        ? "no tools offered"
        : `${plural(snapshot.tools.length, "tool")}, names and schemas`,
    },
    {
      label: "conversation",
      tokens: snapshot.messages.reduce((sum, message) => sum + messageTokens(message), 0),
      detail: describeMessages(snapshot.messages),
    },
  ];
  if (snapshot.pending) {
    parts.push({
      label: "your next message",
      tokens: estimateTokens(snapshot.pending),
      detail: "not sent yet",
    });
  }
  return parts;
}

const compact = (n: number): string =>
  n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;

/** A ten-cell bar for the share of a known window. */
const bar = (share: number): string => {
  const filled = Math.max(0, Math.min(10, Math.round(share * 10)));
  return `${"#".repeat(filled)}${".".repeat(10 - filled)}`;
};

/**
 * The /context readout. Markdown, so the transcript renders it like any other reply.
 *
 * The system text is printed IN FULL rather than summarised or counted. It is the part of the request
 * the person did not write and cannot otherwise see, so a line saying "system guidance: 180 tokens"
 * would report its existence while still hiding it, which is the failure this command exists to fix.
 */
export function formatContextPreview(snapshot: ContextSnapshot): string {
  const parts = contextParts(snapshot);
  const total = parts.reduce((sum, part) => sum + part.tokens, 0);
  const width = Math.max(...parts.map((part) => part.label.length));

  const lines: string[] = ["**What the next request carries**", ""];
  for (const part of parts) {
    lines.push(`- \`${part.label.padEnd(width)}\`  ~${compact(part.tokens)}  ${part.detail}`);
  }
  lines.push("");

  if (snapshot.contextWindow && snapshot.contextWindow > 0) {
    const share = total / snapshot.contextWindow;
    lines.push(
      `\`${bar(share)}\` ~${compact(total)} of ${compact(snapshot.contextWindow)} tokens `
      + `(${Math.round(share * 100)}% of the window)`,
    );
  } else {
    // Saying the window is unknown beats implying the total is safe.
    lines.push(`~${compact(total)} tokens estimated. This provider did not report a context window.`);
  }
  lines.push("");
  lines.push("Counts are estimates, roughly four characters to a token, not a real tokenizer.");

  if (snapshot.tools.length > 0) {
    lines.push("");
    lines.push(`**Tools offered** (${snapshot.tools.length})`);
    lines.push("");
    lines.push(snapshot.tools.map((tool) => `\`${tool.name}\``).join(" · "));
  }

  if (snapshot.system) {
    lines.push("");
    lines.push("**System guidance, in full.** Kit sends this on every turn; you did not write it.");
    lines.push("");
    lines.push("```");
    lines.push(snapshot.system);
    lines.push("```");
  }
  return lines.join("\n");
}
