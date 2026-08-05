/**
 * Find one piece's card art by name, for the surfaces that draw it.
 *
 * The resolution itself was already built and unreachable: `studio/portrait.ts` reads a PNG card's
 * own pixels out of escrow, a data-URI portrait out of `body.media`, or a pack's default face, with
 * a mime allowlist that excludes SVG because it can carry scripts. Nothing in Kit ever called it, so
 * a studio full of art had no route to the screen.
 *
 * WHAT IT STILL CANNOT DO, said here rather than discovered: a portrait stored as an asset-store or
 * archive reference resolves to nothing. Those need the asset files loaded alongside the entity, and
 * Kit reads entities. `resolveAssetRef` in core/media is the piece that handles them and it needs a
 * file map nobody hands it yet. A piece like that reports no art rather than an error, which is the
 * honest answer and not a satisfying one.
 */
import { portraitBytes } from "../../studio/portrait";
import type { CanonicalEntity } from "../../core/canonical";

/** One piece's art, ready to draw. */
export interface FoundArt {
  id: string;
  name: string;
  bytes: Uint8Array;
  mime: string;
}

/** The narrow read this needs: list a deck, read one piece. Mirrors what the bridge already offers. */
export interface ArtSource {
  list: (kind: string) => Promise<readonly { id: string; name?: string }[]>;
  read: (kind: string, id: string) => Promise<CanonicalEntity<string, unknown> | null>;
}

const displayName = (entity: CanonicalEntity<string, unknown>, fallback: string): string => {
  const body = entity.body as { name?: unknown } | undefined;
  return typeof body?.name === "string" && body.name ? body.name : fallback;
};

/** The art on one piece, or null when it carries none. */
export async function artFor(
  source: ArtSource,
  kind: string,
  id: string,
): Promise<FoundArt | null> {
  const entity = await source.read(kind, id);
  if (!entity) return null;
  const found = portraitBytes(entity);
  return found ? { id, name: displayName(entity, id), bytes: found.bytes, mime: found.mime } : null;
}

/**
 * Resolve a written name to one piece, the same way /rail resolves a preset.
 *
 * REFUSES TO GUESS between several matches, for the reason /rail does: showing the wrong face is a
 * small failure and a confusing one, and one more keystroke is cheaper than wondering why Kit thinks
 * that is Wren. An exact id match wins outright, because somebody who typed an id meant it.
 */
export async function resolveArtTarget(
  source: ArtSource,
  kind: string,
  query: string,
): Promise<{ ok: true; id: string } | { ok: false; detail: string }> {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return { ok: false, detail: "Name a piece: /art wren" };
  const pieces = await source.list(kind);
  const exact = pieces.find((piece) => piece.id.toLowerCase() === wanted);
  if (exact) return { ok: true, id: exact.id };
  const matches = pieces.filter(
    (piece) =>
      piece.id.toLowerCase().includes(wanted)
      || (piece.name ?? "").toLowerCase().includes(wanted),
  );
  if (matches.length === 1) return { ok: true, id: matches[0]!.id };
  if (matches.length === 0) return { ok: false, detail: `Nothing matched "${query}".` };
  const names = matches.slice(0, 6).map((piece) => piece.name ?? piece.id).join(", ");
  return { ok: false, detail: `Several matched "${query}": ${names}. Name one exactly.` };
}
