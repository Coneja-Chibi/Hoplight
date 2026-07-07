// ============================================================================
// PRESET ASSETS TESTS — manifest parsing + asset: URI resolution
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parsePresetAssets, resolveAssetUris, ASSET_NAME_RE } from './assets';

const ASSETS = [
  { name: 'happy', url: 'https://cdn.example.com/u/happy_a1b2.webp' },
  { name: 'sad.face', url: 'https://cdn.example.com/u/sad_c3d4.webp' },
];

describe('parsePresetAssets', () => {
  it('accepts valid entries, skips junk', () => {
    const parsed = parsePresetAssets([
      ...ASSETS,
      { name: 'no-url' },
      { name: 'bad url', url: 'https://x.com/a.png' },        // space in name
      { name: 'http-only', url: 'http://insecure.com/a.png' }, // not https
      { name: 'js', url: 'javascript:alert(1)' },
      'garbage',
    ]);
    expect(parsed).toEqual(ASSETS);
  });

  it('returns empty for non-arrays', () => {
    expect(parsePresetAssets(undefined)).toEqual([]);
    expect(parsePresetAssets({})).toEqual([]);
  });

  it('name grammar', () => {
    expect(ASSET_NAME_RE.test('happy')).toBe(true);
    expect(ASSET_NAME_RE.test('mood-2_x.v1')).toBe(true);
    expect(ASSET_NAME_RE.test('-leading-dash')).toBe(false);
    expect(ASSET_NAME_RE.test('has space')).toBe(false);
    expect(ASSET_NAME_RE.test('a'.repeat(49))).toBe(false);
  });
});

describe('resolveAssetUris', () => {
  it('resolves known names case-insensitively, both quote styles', () => {
    const html = `<img src="asset:happy"> and <img src='asset:HAPPY' width="64">`;
    const out = resolveAssetUris(html, ASSETS);
    expect(out).toContain(`src="${ASSETS[0].url}"`);
    expect(out).toContain(`src='${ASSETS[0].url}'`);
    expect(out).not.toContain('asset:');
  });

  it('strips images with unknown asset names entirely', () => {
    const out = resolveAssetUris('before <img class="s" src="asset:nope" width="64"> after', ASSETS);
    expect(out).toBe('before  after');
  });

  it('dotted names resolve', () => {
    const out = resolveAssetUris('<img src="asset:sad.face">', ASSETS);
    expect(out).toContain(ASSETS[1].url);
  });

  it('text without asset: passes through untouched', () => {
    const text = 'plain text with <img src="https://x.com/a.png">';
    expect(resolveAssetUris(text, ASSETS)).toBe(text);
  });

  it('no assets → unknown refs still stripped, nothing resolved', () => {
    expect(resolveAssetUris('<img src="asset:any">', [])).toBe('');
  });
});
