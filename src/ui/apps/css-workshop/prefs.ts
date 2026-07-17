/**
 * CSS Workshop prefs keys + helpers. Namespaced for the studio settings open record.
 */

export const PREF_DRAFT = "css-workshop.draft";
export const PREF_PACK = "css-workshop.packId";

export const DEFAULT_PACK_ID = "universal";

export const STARTER_CSS = `/* CSS Workshop draft
 * Starters and Assist help; Source is the truth.
 * Paste this onto Chub, Janitor, Risu backdrop, or any host that takes CSS.
 */
.card {
  background: #1a1820;
  color: #e8e4ef;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid #2e2a38;
}
`;

export const asPrefString = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;
