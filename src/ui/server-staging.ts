/**
 * Server-side staging between /api/inspect-archive and commit. A real Lumiverse backup's entities
 * total gigabytes; serializing them into one response body is what OOM'd the archive import
 * (JSON.stringify caps near 2 GiB in the engine), and a browser could neither hold nor re-upload
 * them at commit anyway. So the entities are parked here on disk, the sheet gets light summary
 * rows, and each committed row saves BY REFERENCE through the same saveBundle core as every other
 * import - never a second save path or schema.
 *
 * Stagings are keyed by token, one per inspected archive, because ONE DROP CAN CARRY SEVERAL
 * `.lvbak` FILES: the sheet inspects them serially (ARCHIVE_POOL = 1) but commits them together,
 * so an earlier archive's rows must stay committable after a later archive stages. A bounded map
 * (MAX_STAGINGS, oldest evicted first, files and all) keeps the disk footprint finite across
 * drops; shutdown clears everything. Keys are server-minted (`row-N`) and resolved through the
 * staging's own Map, so client input never reaches the filesystem as a path.
 *
 * A commit racing an eviction usually finds its token stale (409); when the readFile wins the
 * race instead, the row commits from the just-evicted staging - the same bytes it referenced, so
 * both outcomes are honest.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import { saveBundle } from "../studio/bundle";
import type { StudioStoreLike } from "../studio/contracts";
import { rewriteKnowledgeRefsFor } from "./_shared/knowledge-refs";
import type { SaveStagedPayload } from "./app-contract";
import { contentTypeIs, err, json, readJsonCapped } from "./server-security";

interface LiveStaging {
  dir: string;
  /** server-minted key -> absolute path of that row's entity JSON */
  files: Map<string, string>;
}

/** token -> staging, insertion-ordered (Map iteration order IS arrival order, which eviction uses). */
const stagings = new Map<string, LiveStaging>();

/** Enough for any realistic multi-archive drop; past it the OLDEST staging's rows go stale. */
const MAX_STAGINGS = 8;

export interface StagedRowRef {
  token: string;
  key: string;
  entityId: string;
  contentHash: string;
}

/**
 * Park one import's entities on disk as a NEW staging beside any live ones (multi-archive drops
 * commit older archives' rows after newer ones stage). Returns one ref per entity, index-aligned
 * with the input, for the handler to fold into its summary rows.
 */
export async function stageArchiveEntities(
  entities: readonly ParsedCanonicalEntity[],
): Promise<StagedRowRef[]> {
  while (stagings.size >= MAX_STAGINGS) {
    const oldest = stagings.keys().next().value!;
    const evicted = stagings.get(oldest)!;
    stagings.delete(oldest);
    await rm(evicted.dir, { recursive: true, force: true });
  }
  const dir = await mkdtemp(join(tmpdir(), "hoplight-lvbak-staged-"));
  const token = randomBytes(16).toString("base64url");
  const files = new Map<string, string>();
  const refs: StagedRowRef[] = [];
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i]!;
    const key = `row-${i}`;
    const text = JSON.stringify(entity);
    const file = join(dir, `${key}.json`);
    // Owner-only, same discipline as the upload's temp file: a staged entity is private content.
    await writeFile(file, text, { mode: 0o600 });
    files.set(key, file);
    refs.push({
      token,
      key,
      entityId: entity.id,
      contentHash: createHash("sha256").update(text).digest("hex"),
    });
  }
  stagings.set(token, { dir, files });
  return refs;
}

/** Drop every staging and its files. Wired to server shutdown; tests use it as a reset. */
export async function clearAllStagings(): Promise<void> {
  const doomed = [...stagings.values()];
  stagings.clear();
  for (const staging of doomed) await rm(staging.dir, { recursive: true, force: true });
}

const STALE_STAGING = "That backup's rows are no longer staged - drop the backup again to re-read it.";

/**
 * POST /api/studio/save-staged: commit one staged archive row by reference. Applies the commit
 * loop's minted-id-to-shelf-id map to knowledgeRefs (characters AND personas - the shared
 * rewriteKnowledgeRefsFor), then saves through the same saveBundle core as save-bundle, so
 * keep-both collisions and validation behave identically. Response contract mirrors save-bundle:
 * SaveBundleResult at 200/207/422.
 */
export async function handleSaveStaged(req: Request, store: StudioStoreLike): Promise<Response> {
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
  const parsed = await readJsonCapped(req);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.value as Partial<SaveStagedPayload> | null;
  if (typeof raw?.token !== "string" || typeof raw.key !== "string") {
    return err("expected { token, key, refIds? }");
  }
  const staging = stagings.get(raw.token);
  if (!staging) return err(STALE_STAGING, 409);
  const file = staging.files.get(raw.key);
  if (file === undefined) return err("unknown staged row", 404);

  let entity: unknown;
  try {
    entity = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return err(STALE_STAGING, 409);
  }

  // Rewrite whenever refIds is PRESENT, even empty: an empty map means "none of this row's books
  // made it to the shelf", and its refs must DROP rather than dangle - the exact semantics the
  // client's own entity path applies (deck-core case 3a/3b). Absent refIds means "not an archive
  // dependent": no rewrite at all.
  if (raw.refIds !== undefined && raw.refIds !== null && typeof raw.refIds === "object") {
    const idMap = new Map(
      Object.entries(raw.refIds).filter((pair): pair is [string, string] => typeof pair[1] === "string"),
    );
    entity = rewriteKnowledgeRefsFor(entity, idMap);
  }

  const result = await saveBundle(store, { entity: entity as ParsedCanonicalEntity });
  return json(result, result.ok ? 200 : result.partial ? 207 : 422);
}
