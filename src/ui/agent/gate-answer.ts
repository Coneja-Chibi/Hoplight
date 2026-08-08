/**
 * Reading a Gate answer off the wire.
 *
 * THE ONE REQUEST IN THIS APP THAT AUTHORISES A WRITE. Everything else the window sends is a
 * question; this is the "yes". So it is parsed once, here, into a closed union, and anything that
 * is not exactly one of the shapes Kit understands is refused rather than coerced into the nearest
 * one - because the nearest one to a malformed answer is usually "allow".
 *
 * `set-mode` is accepted but LOCKED is not offered. Kit's own store refuses to persist it for the
 * same reason: a mode that blocks everything, set from a window, with no terminal open to undo it,
 * is a way to brick your own studio by clicking the wrong button.
 */
import type { GateChoice } from "../../kit/tools/safety/permission-mode";
import type { PermissionMode } from "../../kit/tools/safety/gate-core";

/** The modes a browser may set. `locked` is deliberately absent; see the file header. */
const SETTABLE: readonly PermissionMode[] = ["guarded", "autopilot", "full"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export interface GateAnswer {
  readonly id: string;
  readonly choice: GateChoice;
}

export function parseGateAnswer(
  body: unknown,
): { ok: true; value: GateAnswer } | { ok: false; why: string } {
  if (!isRecord(body)) return { ok: false, why: "expected an object" };

  const id = body["id"];
  if (typeof id !== "string" || !id) return { ok: false, why: "id is required" };
  // Bounded: the id is generated server-side and is short. A megabyte of "id" is not a typo.
  if (id.length > 200) return { ok: false, why: "id is not one of ours" };

  const type = body["type"];
  if (typeof type !== "string") return { ok: false, why: "type is required" };

  switch (type) {
    case "allow-once": {
      const edit = body["edit"];
      if (edit === undefined) return { ok: true, value: { id, choice: { type: "allow-once" } } };
      /**
       * "Yes, but with this text instead." The draft is amended BEFORE the answer resolves, so
       * what was authorised and what gets written are the same thing. A malformed edit must not
       * degrade into a plain yes - that would apply the model's version while somebody believed
       * they had corrected it.
       */
      if (!isRecord(edit)) return { ok: false, why: "edit must be an object" };
      const blockId = edit["blockId"];
      const content = edit["content"];
      if (typeof blockId !== "string" || !blockId) return { ok: false, why: "edit.blockId is required" };
      if (typeof content !== "string") return { ok: false, why: "edit.content must be a string" };
      if (content.length > 200_000) return { ok: false, why: "edit.content is too long" };
      return { ok: true, value: { id, choice: { type: "allow-once", edit: { blockId, content } } } };
    }
    case "allow-session":
      return { ok: true, value: { id, choice: { type: "allow-session" } } };
    case "deny":
      return { ok: true, value: { id, choice: { type: "deny" } } };
    case "abort":
      return { ok: true, value: { id, choice: { type: "abort" } } };
    /**
     * Neither yes nor no. The gate still closes - it cannot stay open across turns - but the window
     * can tell "I decided against this" from "I want to know more first", which are different
     * things to say back to a model.
     */
    case "hold":
      return { ok: true, value: { id, choice: { type: "hold" } } };
    case "set-mode": {
      const mode = body["mode"];
      if (typeof mode !== "string" || !SETTABLE.includes(mode as PermissionMode)) {
        return { ok: false, why: `mode must be one of: ${SETTABLE.join(", ")}` };
      }
      return { ok: true, value: { id, choice: { type: "set-mode", mode: mode as PermissionMode } } };
    }
    default:
      // Closed by construction. An unknown answer is not "probably yes".
      return { ok: false, why: `unknown answer: ${type.slice(0, 40)}` };
  }
}
