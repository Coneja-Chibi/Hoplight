/**
 * NovelAI format family. NAI has no character-card concept (its "card" IS a lorebook), so this family
 * ships a single codec: the native lorebook. Auto-discovered by the loader via this default export.
 */
import lorebookCodec from "./lorebook";

/** Folders-as-schema: NovelAI provides one codec (native lorebook). */
export default lorebookCodec;
