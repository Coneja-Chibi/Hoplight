/**
 * Near-miss keyword suggester for Playback (prototype LogAnalyzerView Levenshtein).
 * Applied only to words that matched nothing exactly.
 */
export interface NearMissHit {
  key: string;
  distance: number;
}

const levenshtein = (s1: string, s2: string): number => {
  if (!s1 || !s2) return (s1 || s2).length;
  const n = s1.length;
  const m = s2.length;
  let v0 = Array.from({ length: m + 1 }, (_, i) => i);
  let v1 = Array.from({ length: m + 1 }, () => 0);
  for (let i = 0; i < n; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < m; j++) {
      const cost = s1[i]!.toLowerCase() === s2[j]!.toLowerCase() ? 0 : 1;
      v1[j + 1] = Math.min((v1[j] ?? 0) + 1, (v0[j + 1] ?? 0) + 1, (v0[j] ?? 0) + cost);
    }
    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }
  return v0[m] ?? 0;
};

/**
 * Suggest up to `max` keys near `word`. Threshold max(1, floor(len/4)); length-delta gate.
 * Distance 0 (exact) is excluded - caller only uses this for non-hits.
 */
export function nearMisses(
  word: string,
  keys: readonly string[],
  max = 3,
): NearMissHit[] {
  const w = word.trim();
  if (!w || keys.length === 0) return [];
  const threshold = Math.max(1, Math.floor(w.length / 4));
  const lower = w.toLowerCase();
  return keys
    .map((key) => ({
      key,
      distance: levenshtein(lower, key.toLowerCase()),
    }))
    .filter(
      ({ distance, key }) =>
        distance > 0 &&
        distance <= threshold &&
        Math.abs(key.length - w.length) <= threshold,
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max);
}
