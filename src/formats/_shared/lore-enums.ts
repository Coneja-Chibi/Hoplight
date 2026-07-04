/**
 * Lorebook int-enum decoders shared across the Tavern-family lorebook dialects (the standalone
 * SillyTavern worldbook file and the embedded CCv2/v3 character_book). These two enums - selective
 * logic and injection role - use byte-identical integer codings in both dialects, so they live here
 * and are imported by each codec. Position and keyword-regex parsing genuinely DIFFER between the
 * dialects (character_book adds `before_char`/`after_char` string positions and a distinct regex
 * grammar), so those stay local to each codec rather than being forced into a false-shared helper.
 *
 * Codings verified against VAUDEVILLE packages/lorebook parser.ts + apps/rc character-book.ts
 * (interop facts only: enum values, not code).
 */
import type { SelectiveLogic, MessageRole } from "../../entities/lorebook/schema";

/** ST selective logic: 0 and_any (default), 1 not_all, 2 not_any, 3 and_all. */
export const parseSelectiveLogic = (v: unknown): SelectiveLogic =>
  v === 1 ? "not_all" : v === 2 ? "not_any" : v === 3 ? "and_all" : "and_any";

export const selectiveLogicToNumber = (l: SelectiveLogic): number =>
  l === "not_all" ? 1 : l === "not_any" ? 2 : l === "and_all" ? 3 : 0;

/** ST injection role: 0 system (default), 1 user, 2 assistant. */
export const parseRole = (v: unknown): MessageRole => (v === 1 ? "user" : v === 2 ? "assistant" : "system");

export const roleToNumber = (r: MessageRole): number => (r === "user" ? 1 : r === "assistant" ? 2 : 0);
