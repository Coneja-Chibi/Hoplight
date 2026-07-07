// ============================================================================
// PRESET ASSETS — named images for regex & visual templates
//
// Authors upload images to a preset (Macro Engine panel → Assets); each
// gets a short name. Display-side, `asset:` URIs resolve to the hosted
// URL, so a sticker system is one visual template:
//
//   trigger: "[STICKER: $name]"
//   html:    "<img class=\"sticker\" src=\"asset:{{name}}\">"
//
// The model picks stickers by name; the display pipeline resolves them.
// No base64, no hand-pasted URLs. Unknown asset names strip the whole
// <img> (no broken-image icons). Resolution happens BEFORE sanitization,
// and the manifest only ever contains https URLs from upload, so the
// asset: scheme can't smuggle anything past the existing img policy.
//
// Manifest lives at presets.raw_settings.preset_assets: [{name, url}].
// ============================================================================

export interface PresetAsset {
  name: string;
  url: string;
}

/** Short, predictable names: letters/digits, then word chars, dots, dashes. */
export const ASSET_NAME_RE = /^[a-z0-9][\w.-]{0,47}$/i;

/** Parse a raw_settings.preset_assets manifest. Invalid entries skipped. */
export function parsePresetAssets(raw: unknown): PresetAsset[] {
  if (!Array.isArray(raw)) return [];
  const assets: PresetAsset[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || typeof e.url !== 'string') continue;
    if (!ASSET_NAME_RE.test(e.name)) continue;
    if (!/^https:\/\//i.test(e.url)) continue;
    assets.push({ name: e.name, url: e.url });
  }
  return assets;
}

const ASSET_SRC_RE = /(src\s*=\s*["'])asset:([\w.-]+)(["'])/gi;
const UNRESOLVED_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*["']asset:[^"']*["'][^>]*\/?>/gi;

/**
 * Resolve `src="asset:name"` URIs in display HTML against the manifest.
 * Images referencing unknown names are removed entirely.
 */
export function resolveAssetUris(html: string, assets: PresetAsset[]): string {
  if (!html.includes('asset:')) return html;

  const byName = new Map(assets.map(a => [a.name.toLowerCase(), a.url]));

  let resolved = html.replace(ASSET_SRC_RE, (match, pre: string, name: string, post: string) => {
    const url = byName.get(name.toLowerCase());
    return url ? `${pre}${url}${post}` : match;
  });

  // Anything still pointing at asset: is unknown — drop the whole tag
  resolved = resolved.replace(UNRESOLVED_IMG_RE, '');

  return resolved;
}
