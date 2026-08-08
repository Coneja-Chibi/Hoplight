/**
 * A stored preset, written out as the file a platform's own engine expects.
 *
 * WHY THIS EXISTS. `preset_verify` used to take a filesystem path from the model, which asked it for
 * two facts it has no way to hold: where the studio lives, and what the file is called - and a
 * foreign piece's filename can be a bare hash. It guessed, and every guess cost a step. Kit knows
 * both, so Kit does the resolving and the model names a piece the way it names one everywhere else.
 *
 * A SIDE EFFECT WORTH NAMING: there is no longer a caller-supplied path naming a file anywhere on
 * the machine, so the containment check that used to guard one is not weakened, it is unnecessary.
 * The only path here is one Kit wrote itself, in a temporary directory it made.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get as adapterById } from "../../core/registry";
import { ensureFormats } from "../../ensure-formats";

/** Which platform's wire format to write. */
export type WireEngine = "sillytavern" | "marinara";

/** The adapter that writes each engine's own preset file. */
const ADAPTER_FOR: Record<WireEngine, string> = {
  sillytavern: "sillytavern-preset",
  marinara: "marinara-preset",
};

export type Exported =
  | { readonly ok: true; readonly path: string; readonly cleanup: () => Promise<void> }
  | { readonly ok: false; readonly detail: string };

/**
 * Write the entity out and hand back the path plus the way to remove it.
 *
 * The caller owns the cleanup in a `finally`, because a verifier that litters the disk on every call
 * is its own bug, and one that deletes on the happy path only leaves the mess exactly when something
 * has already gone wrong.
 */
export async function toWireFile(entity: unknown, engine: WireEngine): Promise<Exported> {
  // Kit loads codecs lazily; without this the registry is empty and every lookup answers nothing.
  await ensureFormats();
  const adapter = adapterById(ADAPTER_FOR[engine]);
  if (!adapter) {
    return { ok: false, detail: `no ${engine} preset adapter is registered` };
  }
  let text: string;
  try {
    const out = (adapter as { fromCanonical: (e: unknown) => { text?: string; bytes?: Uint8Array } })
      .fromCanonical(entity);
    text = out.text ?? (out.bytes ? new TextDecoder().decode(out.bytes) : "");
    if (text.length === 0) return { ok: false, detail: "the adapter produced an empty file" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  const dir = await mkdtemp(join(tmpdir(), "hoplight-verify-"));
  const path = join(dir, "preset.json");
  await writeFile(path, text, "utf8");
  return {
    ok: true,
    path,
    cleanup: async () => {
      // Tolerant: failing to tidy up must never turn a clean verification into a reported failure.
      try {
        await rm(dir, { recursive: true, force: true });
      } catch { /* the OS will get it */ }
    },
  };
}
