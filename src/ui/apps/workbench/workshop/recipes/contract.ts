/**
 * Workshop recipe contract - what a drop-in pack folder default-exports.
 * A pack IS a folder recipes/<id>/index.ts; the filesystem is the schema.
 */
import type { TriggerScript } from "../../../../../entities/character/schema";

export interface WorkshopRecipe {
  /** folder name; must match recipes/<id>/ */
  id: string;
  title: string;
  blurb: string;
  /** Variables the recipe expects; seeded into the Test Bench if missing. */
  vars: ReadonlyArray<{ name: string; value: string }>;
  /** Trigger rows to append. */
  triggers: readonly TriggerScript[];
  /** optional sort key (lower first); default 100 */
  order?: number;
}
