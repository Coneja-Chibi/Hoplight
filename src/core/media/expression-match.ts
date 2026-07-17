/**
 * Local sealed-stage matcher: sample text -> best pack label. No network.
 */
import { normalizeLabel, type SpritePackValue, normalizePack } from "./pack";
import type { ExpressionProfile } from "./expression-profiles";

type Bucket = { labels: string[]; re: RegExp };

const BUCKETS: Bucket[] = [
  { labels: ["angry", "anger", "annoyed", "rage"], re: /\b(angry|anger|rage|furious|annoyed|irritated|scowl|glare)\b/i },
  { labels: ["sad", "sadness", "grief", "crying"], re: /\b(sad|sorrow|cry|crying|tears|grief|heartbroken|melancholy)\b/i },
  { labels: ["happy", "joy", "smile", "laughing", "amusement"], re: /\b(happy|joy|smile[ds]?|smiling|grin(?:ning)?|laugh(?:ed|ing|s)?|delighted|cheer(?:ed|ing)?)\b/i },
  { labels: ["surprised", "surprise"], re: /\b(surpris|shock|startl|amazed|gasp)\b/i },
  { labels: ["fear", "scared", "nervous", "afraid"], re: /\b(fear|scared|afraid|nervous|terrified|anxious|worried)\b/i },
  { labels: ["love", "caring", "blush"], re: /\b(love|blush|affection|tender|caring|kiss)\b/i },
  { labels: ["confused", "confusion", "thinking"], re: /\b(confus|puzzled|uncertain|thinking|huh)\b/i },
  { labels: ["disgust"], re: /\b(disgust|gross|revolted|nauseat)\b/i },
  { labels: ["neutral", "default", "idle", "calm"], re: /\b(calm|neutral|quiet|still|idle)\b/i },
];

function packLabelSet(pack: SpritePackValue): Map<string, string> {
  const p = normalizePack(pack);
  const m = new Map<string, string>();
  for (const it of p.items) m.set(normalizeLabel(it.label), it.label);
  return m;
}

function resolveAlias(want: string, packLabels: Map<string, string>, profile?: ExpressionProfile): string | null {
  const n = normalizeLabel(want);
  if (packLabels.has(n)) return packLabels.get(n)!;
  if (profile?.aliases[n]) {
    const a = normalizeLabel(profile.aliases[n]!);
    if (packLabels.has(a)) return packLabels.get(a)!;
  }
  // try pack label containing want
  for (const [k, orig] of packLabels) {
    if (k.includes(n) || n.includes(k)) return orig;
  }
  return null;
}

/**
 * Match sample text to a pack label using keyword buckets + profile aliases.
 * Returns null if no pack faces.
 */
export function matchExpression(
  text: string,
  pack: SpritePackValue,
  profile?: ExpressionProfile,
): string | null {
  const labels = packLabelSet(pack);
  if (labels.size === 0) return null;
  const t = text.trim();
  if (!t) {
    return (
      resolveAlias(pack.defaultLabel ?? "neutral", labels, profile) ??
      labels.values().next().value ??
      null
    );
  }

  for (const bucket of BUCKETS) {
    if (!bucket.re.test(t)) continue;
    for (const cand of bucket.labels) {
      const hit = resolveAlias(cand, labels, profile);
      if (hit) return hit;
    }
  }

  return (
    resolveAlias(pack.defaultLabel ?? "neutral", labels, profile) ??
    labels.values().next().value ??
    null
  );
}
