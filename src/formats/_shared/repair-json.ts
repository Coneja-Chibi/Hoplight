/**
 * Files that hold a real piece inside a shape nothing recognises.
 *
 * REPAIRED RATHER THAN REFUSED, because refusing is the wrong answer twice over: the data is all
 * there, and the person whose file it is did nothing wrong. Found in a real studio, where seven
 * files sat behind "is not in a format Hoplight recognises" and five held a preset: four encoded as
 * JSON twice over, one inside an export envelope. The other two are honestly refused - one is a
 * single injected block, the other a set of narration snippets. Neither is a preset.
 *
 * Every repair here is SHAPE-ONLY and reversible in the head: no field is renamed, no default is
 * invented, nothing is dropped. What comes out is handed to the ordinary detectors, so a repaired
 * file goes through exactly the same adapter as one that arrived intact - the repair decides what
 * the bytes MEAN, never what the piece is.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A whole document that is a JSON string holding more JSON.
 *
 * `JSON.stringify` applied twice, or a preset that travelled through a text field on its way out of
 * some tool. The file is valid JSON and parses on the first try, which is what makes it nasty: it
 * parses to a STRING, so every detector asks it for fields and gets nothing. Four presets in a real
 * studio arrived this way - `Clean.json`, `Marinara's Spaghetti Recipe`, `NemoEngine 5.9 Deepseek`
 * and `Loggo's Preset` - each an ordinary SillyTavern preset one parse away.
 *
 * BOUNDED TO ONE UNWRAP. Recursing would turn a file that is genuinely a string of a string of a
 * string into a piece, which is a shape nobody writes by accident and a cheap way to spend a lot of
 * time on hostile input.
 */
export function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== "string") return null;
  /**
   * The inner text has to be an object or an array. Without this, `"7"` parses to 7 and `"null"` to
   * null, and a file holding an ordinary quoted word would be "repaired" into a number - detectors
   * would refuse it anyway, but the reading would be a lie on the way there.
   */
  const first = value.trimStart()[0];
  if (first !== "{" && first !== "[") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    // A string that merely starts with a brace. Not our case, so it stays refused.
    return null;
  }
}

/**
 * An export envelope with the piece inside it.
 *
 * `{ exportedAt, type, version, data }` is a wrapper several web platforms write around whatever
 * they are exporting. The envelope says when and what; `data` is the piece. Detectors read the
 * piece, so they see a record of timestamps and answer no.
 *
 * The type field is CARRIED OUT, not discarded, because it is the exporter's own word for what this
 * is and a detector may want it. Unwrapping to a piece and losing the label would replace one
 * unreadable file with a slightly more readable one.
 */
export function unwrapExportEnvelope(
  value: unknown,
): { readonly data: unknown; readonly type: string } | null {
  if (!isRecord(value)) return null;
  if (!("data" in value) || !isRecord(value["data"])) return null;
  /**
   * Both markers required. `data` alone is far too common - half the payloads in this repository
   * have one - and unwrapping those would hand detectors a fragment of a piece instead of the piece.
   */
  if (typeof value["exportedAt"] !== "string" && typeof value["version"] !== "string") return null;
  if (typeof value["type"] !== "string") return null;
  return { data: value["data"], type: value["type"] };
}

/**
 * Every reading of these bytes worth trying, in order, starting with the honest one.
 *
 * THE ORIGINAL IS ALWAYS FIRST, so a file that parses normally is never touched by any of this. A
 * repair that ran ahead of the plain reading would be a rewrite applied to healthy files.
 */
export function readingsOf(value: unknown): unknown[] {
  const out: unknown[] = [value];
  const inner = unwrapDoubleEncoded(value);
  if (inner !== null) {
    out.push(inner);
    // A double-encoded document can hold an envelope: both repairs, in the order they were applied.
    const enveloped = unwrapExportEnvelope(inner);
    if (enveloped) out.push(enveloped.data);
  }
  const unwrapped = unwrapExportEnvelope(value);
  if (unwrapped) out.push(unwrapped.data);
  return out;
}
