/**
 * One answer to "what does a file look like to an adapter", for every caller that has bytes.
 *
 * WHY IT IS SHARED. Detection reads `input.text` when it is there and falls back to sniffing bytes
 * when it is not, so which extensions get decoded decides which files are recognised. That list was
 * written twice, in the CLI and in the UI server, and the two had already drifted: the server decoded
 * `.lorebook` and the CLI did not, so the same book was a lorebook through one door and an unknown
 * file through the other. A third copy for Kit's importer would have made that three.
 *
 * The decode is deliberately narrow. Handing a PNG or a zip a `text` field costs nothing at best and
 * misleads a text-shaped detector at worst, so only extensions that are text by definition get one,
 * and a file that claims to be text but is not simply keeps its bytes.
 */
import type { AdapterInput } from "./adapter";

/**
 * The largest file any door hands an adapter, in bytes.
 *
 * One number rather than one per entry point, because a file the studio accepts and the importer
 * refuses is a bug reported as "it works in the app". Generous on purpose: a character archive with
 * expression sprites is genuinely tens of megabytes.
 */
export const ADAPTER_INPUT_MAX_BYTES = 64 * 1024 * 1024;

/** Extensions whose contents are text by definition. Everything else travels as bytes. */
const TEXT_EXTENSIONS = new Set(["json", "txt", "lorebook"]);

/** The extension without its dot, lowercased; empty for a name that has none. */
const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  return dot > slash + 1 ? filename.slice(dot + 1).toLowerCase() : "";
};

/**
 * Build the adapter input for a file that is already in memory.
 *
 * `filename` may be a full path or a bare name; only its extension and, for adapters that read it,
 * the name itself are used.
 */
export function toAdapterInput(bytes: Uint8Array, filename: string): AdapterInput {
  const input: AdapterInput = { bytes, filename };
  if (!TEXT_EXTENSIONS.has(extensionOf(filename))) return input;
  try {
    input.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    /* claimed to be text and is not: the bytes are still the truth */
  }
  return input;
}
