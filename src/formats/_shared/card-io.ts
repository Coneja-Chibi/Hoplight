/**
 * Read a Tavern-lineage card's JSON out of adapter input: from a PNG chara/ccv3 chunk when the
 * input is bytes, or from raw text otherwise. Shared by SillyTavern and RoleCall (both accept
 * png-or-json). Tolerant: returns null on anything that is not a parseable card, never throws.
 */
import type { AdapterInput } from "../../core/adapter";
import { extractCharacterJson } from "./png";

export function readCardJson(input: AdapterInput): unknown | null {
  // Try the PNG chara/ccv3 chunk first; a real .json read carries BOTH bytes and decoded text, so
  // fall through to text when the bytes are not a card-bearing PNG (do NOT stop at the bytes branch).
  let str: string | null = null;
  if (input.bytes) str = extractCharacterJson(input.bytes);
  if (str == null && input.text != null) str = input.text;
  if (str == null) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Decode plain json input (text, or non-PNG bytes) to an object, or null. The un-PNG'd sibling of
 * readCardJson: the shared decode+parse+object-check boundary the standalone lorebook readers layer
 * their own shape guard on. Tolerant: never throws, null on anything that is not a json object.
 */
export function readJsonObject(input: AdapterInput): Record<string, unknown> | null {
  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : null);
  if (text == null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
}
