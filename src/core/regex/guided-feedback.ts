/**
 * Guided-mode "it will catch" feedback (REGEX-JEWEL-PLAN.md R3, QOL 19). Every chip is ENGINE TRUTH:
 * the hit chips are execution-verified examplesFor matches; the ONE miss chip is computed FROM THE
 * USER'S OWN EXAMPLES - substitute an unseen word into a real matching example, then render it struck
 * ONLY if the compiled pattern actually rejects it. The unseen word comes from the input's OWN script:
 * a fixed English list is the Latin fallback, but a non-Latin author gets an in-script mutant, never an
 * English word. Chi caught an earlier draft overpromising semantic generalization; nothing here claims
 * a word the pattern does not literally handle. Returns null when no honest miss can be built (the
 * fixed confession line carries the honesty instead).
 *
 * PURE: no rng here (hits come from readout.ts's injected stream); this only tests candidate strings
 * against the compiled pattern - a String.test over data, never eval (sandbox doctrine).
 */

/** Unseen English words for the Latin fallback; the first not already shown becomes the miss slot. */
const UNSEEN_LATIN = ["will", "would", "can", "might", "should", "never"];

const isLatin = (s: string): boolean => [...s].every((ch) => (ch.codePointAt(0) ?? 0) <= 0x7f);

/** Compile the pattern for a stateless whole-string test (keeps i/m/s/u, drops g/y). */
function compile(find: string, flags: string): RegExp | null {
  const kept = new Set<string>();
  for (const f of flags.replace(/<[^>]*>/g, "")) {
    if (f === "i" || f === "m" || f === "s" || f === "u") kept.add(f);
  }
  if (/\\[pP]\{/.test(find)) kept.add("u");
  try {
    return new RegExp(find, [...kept].join(""));
  } catch {
    return null;
  }
}

const cleanExamples = (examples: readonly string[]): string[] =>
  examples.map((e) => e.trim()).filter((e) => e.length > 0);

/** In-script single-character mutants of a token, drawn from the alphabet the examples themselves use. */
function inScriptMutants(token: string, alphabet: readonly string[]): string[] {
  const out: string[] = [];
  const chars = [...token];
  for (let i = 0; i < chars.length; i++) {
    for (const ch of alphabet) {
      if (ch === chars[i]) continue;
      out.push([...chars.slice(0, i), ch, ...chars.slice(i + 1)].join(""));
    }
  }
  return out;
}

/**
 * Build ONE unseen-word miss from the user's examples, or null. `matched` is the built pattern's
 * find/flags; `examples` is the raw example lines. Only returns a string the engine truly rejects.
 */
export function guidedMiss(find: string, flags: string, examples: readonly string[]): string | null {
  const cleaned = cleanExamples(examples);
  if (cleaned.length === 0) return null;
  const re = compile(find, flags);
  if (re === null) return null;

  const seed = cleaned.find((e) => re.test(e));
  if (seed === undefined) return null;

  const phraseSet = new Set(cleaned.map((e) => e.toLowerCase()));
  const tokenSet = new Set(cleaned.flatMap((e) => e.toLowerCase().split(/\s+/)));
  const alphabet = [...new Set(cleaned.join("").split("").filter((c) => c.trim().length > 0))];

  const seedTokens = seed.split(/\s+/);
  for (let t = 0; t < seedTokens.length; t++) {
    const token = seedTokens[t]!;
    const candidates = isLatin(token)
      ? UNSEEN_LATIN.filter((w) => !tokenSet.has(w))
      : inScriptMutants(token, alphabet).filter((w) => !tokenSet.has(w.toLowerCase()));
    for (const cand of candidates) {
      const phrase = [...seedTokens.slice(0, t), cand, ...seedTokens.slice(t + 1)].join(" ");
      if (phraseSet.has(phrase.toLowerCase())) continue;
      re.lastIndex = 0;
      if (!re.test(phrase)) return phrase;
    }
  }
  return null;
}
