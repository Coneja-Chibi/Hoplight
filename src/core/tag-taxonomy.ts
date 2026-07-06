/**
 * Tag taxonomy - the pure "what KIND of tag is this" classifier. Character tags arrive as free
 * strings from every source format (there is no category on the wire), so the editor colors a chip
 * by categorizing its text here. The category scheme mirrors RoleCall's display taxonomy (identity,
 * trait, role, genre, theme, setting, pov, mood, kink, warning); everything unrecognized falls to
 * the neutral "meta" bucket rather than being mis-colored.
 *
 * This is a SEED, not the full ~1000-tag taxonomy: the discovery milestone (Open Tagsheet) widens
 * the dictionary. It stays pure data + a lookup so it is trivially testable and extensible - add a
 * row to SEED, never a branch. Presentation (color + icon per category) lives in the UI layer.
 */

/** the category a tag paints as; "meta" is the neutral fallback for anything unrecognized */
export type TagCategory =
  | "identity"
  | "trait"
  | "role"
  | "genre"
  | "theme"
  | "setting"
  | "pov"
  | "mood"
  | "kink"
  | "warning"
  | "meta";

export const TAG_CATEGORIES: readonly TagCategory[] = [
  "identity", "trait", "role", "genre", "theme", "setting", "pov", "mood", "kink", "warning", "meta",
] as const;

/** fold a tag to its lookup key: drop a leading #, lowercase, collapse separators to single spaces */
const norm = (tag: string): string =>
  tag.trim().toLowerCase().replace(/^#+/, "").replace(/[\s_/-]+/g, " ").trim();

/**
 * Seed of tag -> category. Keys are written human-readable; they are normalized on load, so
 * "Slow Burn", "slow-burn", and "slow_burn" all resolve to the same row. Grouped by category for
 * auditability. Widened by the discovery milestone, never by adding code paths.
 */
const SEED: Readonly<Record<string, TagCategory>> = {
  // identity - gender, sexuality, species
  male: "identity", female: "identity", nonbinary: "identity", futanari: "identity",
  trans: "identity", transgender: "identity", intersex: "identity", genderfluid: "identity",
  gay: "identity", straight: "identity", bisexual: "identity", lesbian: "identity", pansexual: "identity", asexual: "identity",
  human: "identity", elf: "identity", demon: "identity", angel: "identity", vampire: "identity",
  werewolf: "identity", catgirl: "identity", catboy: "identity", kitsune: "identity", monster: "identity",
  robot: "identity", android: "identity", ai: "identity", orc: "identity", dragon: "identity", fairy: "identity",
  ghost: "identity", god: "identity", goddess: "identity", alien: "identity", furry: "identity", monstergirl: "identity",

  // trait - personality, dere, archetype
  arrogant: "trait", cruel: "trait", kind: "trait", shy: "trait", confident: "trait",
  manipulative: "trait", flirty: "trait", flirtatious: "trait", hedonistic: "trait", toxic: "trait",
  possessive: "trait", protective: "trait", cold: "trait", aloof: "trait", cheerful: "trait",
  sarcastic: "trait", bitter: "trait", gentle: "trait", stoic: "trait", playful: "trait",
  tsundere: "trait", yandere: "trait", kuudere: "trait", dandere: "trait", deredere: "trait",
  villain: "trait", hero: "trait", antihero: "trait", "villain protagonist": "trait",
  "femme fatale": "trait", brat: "trait", mischievous: "trait", jealous: "trait", loyal: "trait", psychological: "trait",

  // role - occupation, dynamic, relationship
  dominant: "role", submissive: "role", switch: "role",
  detective: "role", doctor: "role", nurse: "role", teacher: "role", student: "role",
  knight: "role", ceo: "role", boss: "role", assassin: "role", royalty: "role", prince: "role",
  princess: "role", king: "role", queen: "role", maid: "role", butler: "role", soldier: "role",
  thief: "role", mercenary: "role", mage: "role", warrior: "role", idol: "role", bodyguard: "role",
  boyfriend: "role", girlfriend: "role", husband: "role", wife: "role", roommate: "role",
  "best friend": "role", rival: "role", enemy: "role", stranger: "role", coworker: "role",
  childhood_friend: "role", mentor: "role", master: "role", servant: "role",

  // genre
  fantasy: "genre", "sci fi": "genre", scifi: "genre", "science fiction": "genre", romance: "genre",
  horror: "genre", comedy: "genre", drama: "genre", adventure: "genre", mystery: "genre",
  thriller: "genre", crime: "genre", action: "genre", "slice of life": "genre", isekai: "genre",
  supernatural: "genre", superhero: "genre", western: "genre", noir: "genre",

  // theme - trope
  "enemies to lovers": "theme", "friends to lovers": "theme", "slow burn": "theme",
  "forbidden love": "theme", "arranged marriage": "theme", "love triangle": "theme",
  "second chance": "theme", "fake dating": "theme", "found family": "theme", corruption: "theme",
  redemption: "theme", revenge: "theme", "coming of age": "theme", betrayal: "theme",

  // setting
  royal: "setting", school: "setting", academy: "setting", college: "setting", office: "setting",
  dungeon: "setting", space: "setting", "post apocalyptic": "setting", cyberpunk: "setting",
  medieval: "setting", victorian: "setting", modern: "setting", futuristic: "setting",
  fantasy_world: "setting", steampunk: "setting", dystopian: "setting", island: "setting", city: "setting",

  // pov
  anypov: "pov", "any pov": "pov", malepov: "pov", "male pov": "pov", femalepov: "pov",
  "female pov": "pov", "second person": "pov", "first person": "pov", secondpov: "pov", pov: "pov",

  // mood
  angst: "mood", fluff: "mood", wholesome: "mood", dark: "mood", "hurt comfort": "mood",
  comfort: "mood", lighthearted: "mood", melancholy: "mood", tense: "mood", cozy: "mood",

  // kink
  humiliation: "kink", bondage: "kink", degradation: "kink", praise: "kink", "praise kink": "kink",
  breeding: "kink", femdom: "kink", maledom: "kink", pet_play: "kink", "size difference": "kink",
  worship: "kink", teasing: "kink", edging: "kink", "power exchange": "kink",

  // warning - trigger / content warnings
  noncon: "warning", "non consensual": "warning", "non con": "warning", dubcon: "warning",
  "dubious consent": "warning", gore: "warning", violence: "warning", abuse: "warning",
  "self harm": "warning", suicide: "warning", "death": "warning", trauma: "warning", "sexual assault": "warning",

  // meta - authoring provenance, not a story descriptor
  oc: "meta", "original character": "meta", "original content": "meta", canon: "meta",
  fanart: "meta", nsfw: "meta", sfw: "meta", wip: "meta",
};

/** normalized-key -> category, built once (O(1) lookups; add rows to SEED, not branches here) */
const LOOKUP: ReadonlyMap<string, TagCategory> = new Map(
  Object.entries(SEED).map(([tag, cat]) => [norm(tag), cat]),
);

/** Classify a free-string tag. Unknown tags return "meta" (neutral) - never mis-colored. */
export const categorizeTag = (tag: string): TagCategory => LOOKUP.get(norm(tag)) ?? "meta";
