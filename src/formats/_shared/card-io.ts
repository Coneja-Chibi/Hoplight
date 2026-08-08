/**
 * Read a Tavern-lineage card's JSON out of adapter input: from a PNG chara/ccv3 chunk when the
 * input is bytes, or from raw text otherwise. Shared by SillyTavern and RoleCall (both accept
 * png-or-json). Tolerant: returns null on anything that is not a parseable card, never throws.
 */
import type { AdapterInput } from "../../core/adapter";
import { extractCharacterJson } from "./png";

/**
 * ONE PARSE PER FILE, SHARED BY EVERY ADAPTER THAT SNIFFS IT.
 *
 * Detection asks all twenty-eight registered adapters what a file looks like, and each one parsed
 * the same text for itself. Measured on a real studio: parsing its sixty-nine megabytes ONCE takes
 * 149ms and detection took 4158ms - within noise of 28 x 149. That was ninety-three per cent of
 * Kit's startup, spent parsing the same documents twenty-eight times over.
 *
 * A WeakMap keyed on the input, not a cache with a lifetime: the memo lasts exactly as long as the
 * object it describes and disappears with it, so there is nothing to invalidate and no way for it to
 * answer about a file that has since changed. The entry is stored even when parsing FAILS, because
 * "this is not JSON" is just as expensive to rediscover twenty-eight times and just as stable.
 *
 * Holds only while nobody rewrites `input.text` in place. Nothing does: the input is built once, at
 * the boundary, and adapters read it.
 */
const parsedText = new WeakMap<AdapterInput, { readonly value: unknown } | null>();

/** The input's text parsed once, boxed so a legitimate `null` document is not a cache miss. */
function parseOnce(input: AdapterInput, text: string): { readonly value: unknown } | null {
  const seen = parsedText.get(input);
  if (seen !== undefined) return seen;
  let box: { readonly value: unknown } | null = null;
  try {
    box = { value: JSON.parse(text) as unknown };
  } catch {
    box = null;
  }
  parsedText.set(input, box);
  return box;
}

export function readCardJson(input: AdapterInput): unknown | null {
  // Try the PNG chara/ccv3 chunk first; a real .json read carries BOTH bytes and decoded text, so
  // fall through to text when the bytes are not a card-bearing PNG (do NOT stop at the bytes branch).
  let str: string | null = null;
  if (input.bytes) str = extractCharacterJson(input.bytes);
  // Only the plain-text path is memoised: a PNG's embedded chunk is a DIFFERENT document from the
  // input's own text, and sharing one entry between them would hand the wrong JSON to whichever
  // reader asked second.
  if (str !== null) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
  if (input.text == null) return null;
  return parseOnce(input, input.text)?.value ?? null;
}

/**
 * Decode plain json input (text, or non-PNG bytes) to ANY parsed JSON value, or null. The
 * shape-agnostic sibling of readJsonObject for readers whose wire is not an object (the regex
 * codecs accept bare arrays). Tolerant: never throws, null on undecodable input.
 */
export function readJsonAny(input: AdapterInput): unknown | null {
  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : null);
  if (text == null) return null;
  return parseOnce(input, text)?.value ?? null;
}

/**
 * Decode plain json input (text, or non-PNG bytes) to an object, or null. The un-PNG'd sibling of
 * readCardJson: the shared decode+parse+object-check boundary the standalone lorebook readers layer
 * their own shape guard on. Tolerant: never throws, null on anything that is not a json object.
 */
export function readJsonObject(input: AdapterInput): Record<string, unknown> | null {
  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : null);
  if (text == null) return null;
  const json = parseOnce(input, text)?.value ?? null;
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
}
