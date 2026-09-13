/**
 * SillyTavern QuickReply-set codec: the `{ version: 2, name, qrList: [...] }` files ST's Quick Reply
 * extension exports, into the canonical quick-reply entity and back.
 *
 * THE WIRE HAS MANY SWITCHES AND THE CANONICAL MODEL WANTS FOUR. A qrList row carries auto-execute
 * hooks (startup, user message, AI message, chat change, group draft), context-menu chains, icons,
 * automation ids - none of which Hoplight edits. The row map therefore mirrors the regex codec's
 * doctrine exactly: label / message / title / hidden are first-class, EVERY other row key is spread
 * into `extras` and re-merged on export untouched, and set-level keys other than name/qrList ride
 * the body's own `extras` the same way. An untouched import preserves the parsed JSON value; export
 * uses Hoplight's stable pretty-printed JSON rather than claiming source-byte identity.
 *
 * A REPLY'S MESSAGE IS A SLASH-COMMAND SCRIPT AND STAYS DATA. Nothing here interprets it; the same
 * scripts-as-data rule the regex kind lives under.
 */
import type { CanonicalQuickReplySet, QuickReply, QuickReplyBody } from "../../entities/quickreply/schema";
import type { AdapterInput, AdapterOutput, QuickReplyAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonAny } from "../_shared/card-io";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Row keys the canonical model first-classes; everything else is escrowed per row. */
const KNOWN_ROW_KEYS = new Set(["id", "label", "message", "title", "isHidden"]);

/** Set-level keys the canonical model owns; the rest ride body.extras. */
const KNOWN_SET_KEYS = new Set(["name", "qrList"]);

/** A qrList row, tolerantly: a label or a message is what makes it one. */
const looksLikeRow = (v: unknown): v is Record<string, unknown> =>
  isRec(v) && ("label" in v || "message" in v);

/**
 * The set shape, tolerantly. `qrList` is the load-bearing marker: no other circulating dialect in
 * this repo's corpus uses that key, and requiring `name` too keeps a stray fragment from claiming.
 */
function readSet(input: AdapterInput): Record<string, unknown> | null {
  const json = readJsonAny(input);
  if (!isRec(json)) return null;
  if (typeof json["name"] !== "string") return null;
  const list = json["qrList"];
  if (!Array.isArray(list) || !list.every(looksLikeRow)) return null;
  return json;
}

function rowToReply(row: Record<string, unknown>, index: number): QuickReply {
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!KNOWN_ROW_KEYS.has(k)) extras[k] = v;
  }
  return {
    id: row["id"] != null ? String(row["id"]) : String(index + 1),
    label: typeof row["label"] === "string" ? row["label"] : "",
    message: typeof row["message"] === "string" ? row["message"] : "",
    ...(typeof row["title"] === "string" && row["title"] !== "" ? { title: row["title"] } : {}),
    ...(row["isHidden"] === true ? { hidden: true } : {}),
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
}

function replyToRow(reply: QuickReply): Record<string, unknown> {
  return {
    ...(reply.extras ?? {}),
    // ST mints numeric ids; a numeric-looking canonical id goes back as a number so an edited set
    // still looks like one ST wrote.
    id: /^\d+$/.test(reply.id) ? Number(reply.id) : reply.id,
    label: reply.label,
    title: reply.title ?? "",
    message: reply.message,
    isHidden: reply.hidden === true,
  };
}

const sillytavernQuickReply: QuickReplyAdapter = {
  id: "sillytavern-quickreply",
  label: "SillyTavern quick-reply set",
  outputExtensions: ["json"],
  kind: "quickreply",

  detect(input: AdapterInput): number {
    return readSet(input) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalQuickReplySet {
    const wire = readSet(input);
    if (!wire) throw new Error("sillytavern-quickreply: not a recognizable QuickReply set");
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(wire)) {
      if (!KNOWN_SET_KEYS.has(k)) extras[k] = v;
    }
    const body: QuickReplyBody = {
      name: wire["name"] as string,
      replies: (wire["qrList"] as Record<string, unknown>[]).map(rowToReply),
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "quickreply",
      id: canonicalId(body.name),
      body,
      original: { "sillytavern-quickreply": { raw: wire } },
    };
  },

  fromCanonical(entity: CanonicalQuickReplySet): AdapterOutput {
    /**
     * ESCROW FIRST: an untouched import rebuilds from its parsed source value so unknown fields and
     * ordering survive semantically. Only when the reply count differs is a fresh v2 wire minted.
     */
    const escrowed = entity.original?.["sillytavern-quickreply"]?.raw;
    if (isRec(escrowed) && Array.isArray(escrowed["qrList"])
      && escrowed["qrList"].length === entity.body.replies.length) {
      const wire = {
        ...escrowed,
        name: entity.body.name,
        qrList: entity.body.replies.map(replyToRow),
      };
      return { text: JSON.stringify(wire, null, 4), suggestedExtension: "json" };
    }
    const wire = {
      version: 2,
      ...(entity.body.extras ?? {}),
      name: entity.body.name,
      qrList: entity.body.replies.map(replyToRow),
      idIndex: entity.body.replies.length,
    };
    return { text: JSON.stringify(wire, null, 4), suggestedExtension: "json" };
  },
};

export default sillytavernQuickReply;
