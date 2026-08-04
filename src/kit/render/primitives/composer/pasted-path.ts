/**
 * A file path somebody typed or pasted, recognised in what they wrote.
 *
 * WHY THIS IS A BOUNDARY AND NOT A CONVENIENCE. Kit's folder grants exist so the MODEL cannot wander
 * the disk: it reads inside folders a person pointed it at, and nowhere else. That is the right rule
 * for a model and the wrong one for a person, and the difference showed up the first time somebody
 * handed Kit a path and was told to run a sharing command first - correctly reading it as an
 * arbitrary step, because they had just said which file they meant.
 *
 * A path the PERSON wrote is consent, exactly as picking a file in a dialog is. A path the MODEL
 * assembled is not. So this only ever runs over the composer's own draft, and what it mints is a
 * grant for ONE FILE - never the folder around it, which would turn "look at this card" into handing
 * over a Downloads directory.
 *
 * Pure and total: text in, candidates out. It touches no filesystem, so it cannot be the thing that
 * decides a path exists - the caller stats it, and a path that is not a real file simply never
 * becomes a grant.
 */

/**
 * Windows drive paths and POSIX absolute paths, quoted or bare.
 *
 * Quoted first, because a quoted path is unambiguous and may contain spaces. The bare forms stop at
 * whitespace, which is the honest limit: `C:\My Cards\dite.png` unquoted is indistinguishable from a
 * path followed by a sentence, and guessing where it ends would sometimes swallow the next word.
 */
const PATTERNS: readonly RegExp[] = [
  /"([a-zA-Z]:[\\/][^"\n]+|\/[^"\n]+)"/g,
  /'([a-zA-Z]:[\\/][^'\n]+|\/[^'\n]+)'/g,
  /(?<![\w"'])([a-zA-Z]:[\\/][^\s"'<>|]+)/g,
  // The `:` in the lookbehind matters: without it this pattern also matches the TAIL of a Windows
  // path written with forward slashes, so `C:/Users/chiev/preset.json` yielded a second, phantom
  // `/Users/chiev/preset.json` - a path that does not exist, offered as though it did.
  /(?<![\w"'/:])(\/(?:[^\s"'<>|/]+\/)+[^\s"'<>|/]+)/g,
];

/** Extensions Kit can actually do something with, for the FILE case. */
const KNOWN = new Set([
  ".json", ".png", ".yaml", ".yml", ".charx", ".card", ".webp", ".jpeg", ".jpg", ".txt", ".md", ".zip",
]);

/**
 * How many segments a bare path needs before it counts as one somebody meant.
 *
 * A FOLDER has no extension, so the file rule cannot vet it and something else has to. This is that
 * something, and it is deliberately weak: `C:\Users` or `/home` is a root somebody is gesturing at,
 * while `C:\Users\chiev\Downloads\SillyTavern\data\default-user\OpenAI Settings` is a place they went
 * and got. The real guard is not this count - it is that the caller STATS the path, so nothing that
 * does not exist ever becomes a grant, and it says out loud what it opened.
 */
const MIN_FOLDER_SEGMENTS = 3;

export interface PastedPath {
  /** The path exactly as it will be opened, quotes stripped. */
  readonly path: string;
  /** Where it sat in the draft, so a caller can show it or strip it. */
  readonly start: number;
  readonly end: number;
  /**
   * Longer readings of the same path, longest first, for an UNQUOTED path that may contain spaces.
   *
   * `C:\...\default-user\OpenAI Settings` typed without quotes is genuinely ambiguous: the path may
   * end at "OpenAI", or the next word may be part of it. Nothing in the text can settle that - but
   * the FILESYSTEM can. The caller stats these longest-first and takes the first that exists, which
   * is how Chi's real folder resolves without him having to quote it.
   *
   * Bounded to a few words: a path is allowed to contain spaces, not to swallow the sentence.
   */
  readonly longer: readonly string[];
}

/** How many following words a bare path may absorb. A path may contain spaces, not eat a sentence. */
const MAX_EXTRA_WORDS = 4;

/**
 * The same path with 1..N following words appended, LONGEST FIRST.
 *
 * Longest first because the caller stats them in order and stops at the first that exists: given
 * `...\OpenAI Settings Can you copy` on disk as `...\OpenAI Settings`, trying short-to-long would
 * stop at `...\OpenAI` if that happened to exist too, and quietly grant the wrong folder.
 */
function longerReadings(draft: string, path: string, end: number): string[] {
  const rest = draft.slice(end);
  const words = rest.split(/\s+/).filter((w) => w !== "").slice(0, MAX_EXTRA_WORDS);
  const out: string[] = [];
  let acc = path;
  for (const word of words) {
    // A word carrying sentence punctuation ends the path: "Settings." is where somebody stopped.
    if (/[.,;:!?"']$/.test(word) && !/\.[a-zA-Z0-9]{1,5}$/.test(word)) break;
    acc = `${acc} ${word}`;
    out.push(acc);
  }
  return out.reverse();
}

const extensionOf = (path: string): string => {
  const at = path.lastIndexOf(".");
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at > slash ? path.slice(at).toLowerCase() : "";
};

/**
 * Every path in a draft, in the order they appear, de-duplicated.
 *
 * FILES AND FOLDERS BOTH, and getting that wrong was a real miss. The first version required a known
 * extension and excluded bare folders on the reasoning that "a person who writes a bare folder is
 * describing, not handing over". Chi disproved it immediately: he pasted
 * `...\default-user\OpenAI Settings` and asked Kit to copy everything in it, and Kit answered that
 * the folder was not shared - the exact friction this was built to remove, still there, because I
 * had guessed at intent instead of reading it.
 *
 * So a file needs a known extension (an extension is what makes a file recognisable as one), and a
 * folder needs enough segments not to be a gesture at a drive root. Neither test is the real guard:
 * the CALLER stats the path, so nothing that does not exist becomes a grant, and it names what it
 * opened so a wrong one is visible and revocable rather than silent.
 */
export function pastedPaths(draft: string): PastedPath[] {
  const found: PastedPath[] = [];
  const seen = new Set<string>();
  for (const pattern of PATTERNS) {
    // Fresh lastIndex per call: these are module-level /g regexes, and a shared cursor would make
    // the second call over the same draft start halfway through and miss the first path.
    pattern.lastIndex = 0;
    for (const match of draft.matchAll(pattern)) {
      const raw = match[1];
      if (raw === undefined || match.index === undefined) continue;
      const path = raw.trim().replace(/[.,;:!?)\]]+$/, "");
      const extension = extensionOf(path);
      const segments = path.split(/[\\/]+/).filter((part) => part !== "" && !/^[a-zA-Z]:$/.test(part));
      // An extension makes it a file; enough depth makes it a folder worth taking at their word.
      // An unknown extension is neither - `evil.dll` is a file Kit has no business opening.
      const looksLikeFile = extension !== "";
      const ok = looksLikeFile ? KNOWN.has(extension) : segments.length >= MIN_FOLDER_SEGMENTS;
      if (!ok) continue;
      const key = path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const end = match.index + match[0].length;
      // Quoted paths already said where they end, so only a bare one needs the longer readings.
      const quoted = match[0].startsWith(`"`) || match[0].startsWith(`'`);
      found.push({ path, start: match.index, end, longer: quoted ? [] : longerReadings(draft, path, end) });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
