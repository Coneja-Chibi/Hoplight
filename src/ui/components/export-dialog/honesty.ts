/**
 * Pure export honesty: what a platform will keep or drop for this card.
 * Behavior package first (Risu vs others); format-specific caveats (Agnai, Backyard, BYAF)
 * when body shows risk. Never guesses wire bytes; coverage + body flags only.
 */

export interface BehaviorFlags {
  hasTriggers: boolean;
  hasRegex: boolean;
  hasVirtual: boolean;
  hasBackground: boolean;
  hasPackage: boolean;
  hasDefaultVars: boolean;
}

export interface HonestyLine {
  /** keep = fine; warn = partial; drop = will not travel */
  kind: "keep" | "warn" | "drop";
  text: string;
}

export interface ExportHonesty {
  /** overall: ok | warn (something drops) */
  level: "ok" | "warn";
  lines: HonestyLine[];
  /** short headline for the dialog */
  headline: string;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Pull data.extensions from a kept-whole original bag if present. */
export function extensionsFromOriginal(original: unknown): Rec | undefined {
  if (!isRec(original)) return undefined;
  const st = isRec(original.sillytavern) ? original.sillytavern : undefined;
  const raw = st && isRec(st.raw) ? st.raw : isRec(original.raw) ? original.raw : original;
  const data = isRec(raw) && isRec(raw.data) ? raw.data : undefined;
  if (data && isRec(data.extensions)) return data.extensions;
  if (isRec(raw) && isRec(raw.extensions)) return raw.extensions;
  return undefined;
}

export function behaviorFlagsFromBody(body: unknown, hasPackage: boolean): BehaviorFlags {
  const b =
    typeof body === "object" && body !== null
      ? (body as { behavior?: Record<string, unknown> }).behavior
      : undefined;
  const beh = b && typeof b === "object" ? b : {};
  const triggers = Array.isArray(beh.triggerScripts) ? beh.triggerScripts : [];
  const regex = Array.isArray(beh.regexScripts) ? beh.regexScripts : [];
  return {
    hasTriggers: triggers.length > 0,
    hasRegex: regex.length > 0,
    hasVirtual: typeof beh.virtualScript === "string" && beh.virtualScript.length > 0,
    hasBackground: typeof beh.backgroundHTML === "string" && beh.backgroundHTML.length > 0,
    hasPackage,
    hasDefaultVars: typeof beh.defaultVariables === "string" && beh.defaultVariables.trim().length > 0,
  };
}

/** Does this coverage claim list include a path prefix (dot-boundary)? */
export function coverageCarries(carries: readonly string[], path: string): boolean {
  return carries.some((c) => c === path || path.startsWith(`${c}.`) || c.startsWith(`${path}.`));
}

/**
 * Agnai wire caveats when the body would actually lose something on export.
 * Grounded in formats/agnai applyBodyToCard (greeting titles, single insert, text persona collapse).
 */
export function agnaiHonestyLines(body: unknown): HonestyLine[] {
  if (!isRec(body)) return [];
  const lines: HonestyLine[] = [];

  const greetings = isRec(body.greetings) ? body.greetings : {};
  const alts = Array.isArray(greetings.alternateGreetings) ? greetings.alternateGreetings : [];
  const titled = alts.some(
    (g) => isRec(g) && typeof g.title === "string" && g.title.trim().length > 0,
  );
  if (titled) {
    lines.push({
      kind: "drop",
      text: "Agnai alternate greetings are plain strings. Greeting titles will not travel.",
    });
  }

  const prompts = isRec(body.prompts) ? body.prompts : {};
  const depths = Array.isArray(prompts.depthInjections) ? prompts.depthInjections : [];
  if (depths.length > 1) {
    lines.push({
      kind: "warn",
      text: "Agnai has one insert slot. Only the first depth injection re-exports; the rest stay on other formats or original.",
    });
  }

  // Group-only greetings: Agnai coverage does not carry them
  const group = Array.isArray(greetings.groupOnlyGreetings) ? greetings.groupOnlyGreetings : [];
  if (group.length > 0) {
    lines.push({
      kind: "drop",
      text: "Group-only greetings are not an Agnai field. They will not travel on this export.",
    });
  }

  return lines;
}

/**
 * Legacy Backyard flat JSON caveats. Grounded in formats/backyard/index.ts (no alts, no media).
 */
export function backyardHonestyLines(body: unknown): HonestyLine[] {
  if (!isRec(body)) return [];
  const lines: HonestyLine[] = [];

  const greetings = isRec(body.greetings) ? body.greetings : {};
  const alts = Array.isArray(greetings.alternateGreetings) ? greetings.alternateGreetings : [];
  if (alts.length > 0) {
    lines.push({
      kind: "drop",
      text: "Legacy Backyard JSON has one greeting field. Alternate greetings will not travel; export .byaf instead.",
    });
  }

  const media = isRec(body.media) ? body.media : {};
  const hasPortrait = media.portrait !== undefined && media.portrait !== null;
  const assets = Array.isArray(media.assets) ? media.assets : [];
  if (hasPortrait || assets.length > 0) {
    lines.push({
      kind: "drop",
      text: "Legacy Backyard JSON has no image archive. Portrait and gallery will not travel; use Backyard AI archive (.byaf).",
    });
  }

  const presentation = isRec(body.presentation) ? body.presentation : {};
  if (presentation.background !== undefined && presentation.background !== null) {
    lines.push({
      kind: "drop",
      text: "Legacy Backyard JSON has no scenario background image. Background will not travel; use .byaf.",
    });
  }

  return lines;
}

/**
 * BYAF archive caveats. Grounded in formats/backyard/byaf.ts applyBodyToArchive.
 * Titled alts auto-split into secondary scenarios (match twin by title, else create).
 */
export function byafHonestyLines(body: unknown): HonestyLine[] {
  if (!isRec(body)) return [];
  const lines: HonestyLine[] = [];

  const refs = Array.isArray(body.knowledgeRefs) ? body.knowledgeRefs : [];
  if (refs.length > 0) {
    lines.push({
      kind: "warn",
      text: "BYAF loreItems stay on the archive twin. Linked knowledge books are not rewritten from knowledgeRefs yet.",
    });
  }

  return lines;
}

/**
 * Linked knowledgeRefs honesty for Press/export.
 * Targets that re-embed character_book (ST family, RoleCall, Risu, Agnai) keep; lean targets warn.
 */
export function knowledgeHonestyLines(targetId: string, body: unknown): HonestyLine[] {
  if (!isRec(body)) return [];
  const refs = Array.isArray(body.knowledgeRefs)
    ? body.knowledgeRefs.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  if (refs.length === 0) return [];

  const n = refs.length;
  const books = `${n} linked lorebook${n === 1 ? "" : "s"}`;

  // Full re-embed carriers (Studio resolve + character_book / MemoryBook bridges)
  if (
    targetId === "sillytavern" ||
    targetId === "rolecall" ||
    targetId === "risu" ||
    targetId === "chub" ||
    targetId === "lumiverse"
  ) {
    return [
      {
        kind: "keep",
        text: `${books} will re-embed into this export when Studio can resolve them (N books merge with provenance when supported).`,
      },
    ];
  }
  if (targetId === "agnai") {
    return [
      {
        kind: "keep",
        text: `${books} map into Agnai MemoryBook when resolved. Regex keys and multi-book richness may collapse.`,
      },
      {
        kind: "warn",
        text: "Agnai favors plain keyword keys; advanced selective/regex triggers may not survive.",
      },
    ];
  }
  if (targetId === "byaf") {
    return []; // byafHonestyLines already covers knowledgeRefs
  }
  if (targetId === "backyard" || targetId === "pygmalion" || targetId === "default-ccv3") {
    return [
      {
        kind: "warn",
        text: `${books} are library links. This lean target may not carry a full character_book; prefer SillyTavern or RoleCall for lore.`,
      },
    ];
  }
  return [
    {
      kind: "warn",
      text: `${books} are attached in Studio. Confirm this target re-embeds or links lore before relying on export.`,
    },
  ];
}

/**
 * Lumiverse / ST export caveats when body or original shows Lumiverse-rich surfaces.
 * Grounded in clone character-export.service.ts INTERNAL_EXTENSION_KEYS + modules pack.
 * Call with body; optional originalExtensions if the dialog has twin access later.
 */
export function lumiverseHonestyLines(body: unknown, originalExtensions?: unknown): HonestyLine[] {
  const lines: HonestyLine[] = [];
  const ext = isRec(originalExtensions) ? originalExtensions : {};

  const hasExpr = isRec(ext.expressions) || isRec(ext.expression_groups);
  const hasAlts =
    isRec(ext.alternate_fields) ||
    (Array.isArray(ext.alternate_avatars) && (ext.alternate_avatars as unknown[]).length > 0);
  const hasLora = isRec(ext.lumiverse_image_gen_lora);
  const hasWb =
    (Array.isArray(ext.world_book_ids) && (ext.world_book_ids as unknown[]).length > 0) ||
    typeof ext.world_book_id === "string";

  if (hasExpr || hasAlts) {
    lines.push({
      kind: "warn",
      text: "Lumiverse plain CCv3 JSON strips expressions, expression_groups, alternate_fields, and alternate_avatars. Prefer a charx-style pack with lumiverse_modules if you need those on re-import to Lumiverse.",
    });
  }
  if (hasWb) {
    lines.push({
      kind: "warn",
      text: "World book ids are stripped from plain JSON extensions; Lumiverse merges books into character_book on its own export. Preserve the twin if you need the id list.",
    });
  }
  if (hasLora) {
    lines.push({
      kind: "keep",
      text: "Portable LoRA hint (filename/weight) can travel on the card. Runtime Comfy bind and safetensors files do not.",
    });
  }

  return lines;
}

const FORMAT_CAVEAT_TARGETS = new Set(["agnai", "backyard", "byaf", "lumiverse", "sillytavern"]);

/** Targets that re-emit expression packs on the wire. */
const PACK_CARRIERS = new Set([
  "sillytavern",
  "rolecall",
  "risu",
  "lumiverse",
  "chub",
  "byaf",
]);

/**
 * Honesty when the card has an emotion pack (media.assets role emotion).
 * Pure; does not invent host keys.
 */
export function mediaPackHonestyLines(targetId: string, body: unknown): HonestyLine[] {
  if (!isRec(body)) return [];
  const media = isRec(body.media) ? body.media : {};
  const assets = Array.isArray(media.assets) ? media.assets : [];
  const emotions = assets.filter((a) => isRec(a) && a.role === "emotion");
  const portrait = isRec(media.portrait) && typeof media.portrait.ref === "string";
  const lines: HonestyLine[] = [];

  if (emotions.length === 0 && !portrait) return lines;

  if (emotions.length > 0) {
    const n = emotions.length;
    const faces = `${n} expression face${n === 1 ? "" : "s"}`;
    if (targetId === "agnai") {
      lines.push({
        kind: "drop",
        text: `This card has ${faces}. Agnai uses a part recipe, not a PNG pack; expression images will not travel as sprites.`,
      });
    } else if (targetId === "default-ccv3" || targetId === "pygmalion" || targetId === "backyard") {
      lines.push({
        kind: "warn",
        text: `This card has ${faces}. This target is lean on media; the full pack may not travel.`,
      });
    } else if (PACK_CARRIERS.has(targetId)) {
      lines.push({
        kind: "keep",
        text: `Expression pack (${faces}) re-exports on this format.`,
      });
    } else {
      lines.push({
        kind: "warn",
        text: `This card has ${faces}. They may not travel on this export.`,
      });
    }
  }

  if (portrait && (targetId === "backyard" || targetId === "pygmalion")) {
    lines.push({
      kind: "warn",
      text: "Portrait may need the archive/PNG path for this target; plain JSON is lean on media.",
    });
  }

  return lines;
}

/** Re-export chip summary for Press UI (pure). */
export { mediaExportSummary, type MediaExportSummary } from "../../../core/media/summary";

/**
 * Build honesty for exporting to `targetId` given coverage carries for that format.
 * Risu-shaped formats that carry "behavior" keep scripts; others drop with plain words.
 * Format caveats (Agnai, Backyard, BYAF) append when body is provided.
 */
export function buildExportHonesty(args: {
  targetId: string;
  targetFriendly: string;
  carries: readonly string[];
  flags: BehaviorFlags;
  /** optional card body for format-specific caveats */
  body?: unknown;
  /** optional kept-whole original (for Lumiverse extension strip warnings) */
  original?: unknown;
}): ExportHonesty {
  const carriesBehavior = coverageCarries(args.carries, "behavior");
  const lines: HonestyLine[] = [];
  const f = args.flags;
  const anyBehavior =
    f.hasTriggers || f.hasRegex || f.hasVirtual || f.hasBackground || f.hasPackage || f.hasDefaultVars;

  if (!anyBehavior) {
    lines.push({
      kind: "keep",
      text: "This card has no scripts or package parts. Plain fields will travel.",
    });
  } else if (carriesBehavior) {
    lines.push({
      kind: "keep",
      text: `${args.targetFriendly} carries behavior (rules, scripts, variables) on the wire.`,
    });
    if (f.hasPackage) {
      if (args.targetId === "risu") {
        lines.push({
          kind: "keep",
          text: "Package scripts and module rows re-pack into the .charx package.",
        });
      } else {
        lines.push({
          kind: "warn",
          text: "A packaged module is Risu-shaped. Other formats that carry behavior still may not keep the full package blob.",
        });
      }
    }
  } else {
    // Format does not claim behavior
    lines.push({
      kind: "drop",
      text: `${args.targetFriendly} does not carry Vaude behavior scripts. Trigger rules, regex, virtual script, and backdrop HTML will not travel.`,
    });
    if (f.hasPackage) {
      lines.push({
        kind: "drop",
        text: "The card package (module scripts, module lore, module regex) will be dropped.",
      });
    }
    if (f.hasTriggers || f.hasDefaultVars) {
      lines.push({
        kind: "warn",
        text: "Prefer Risu (.charx) if you need the full rule pack. Plain identity and chat text still export.",
      });
    }
    lines.push({
      kind: "keep",
      text: "Name, description, greetings, and other plain card fields still go with this export.",
    });
  }

  if (args.body !== undefined) {
    if (args.targetId === "agnai") lines.push(...agnaiHonestyLines(args.body));
    if (args.targetId === "backyard") lines.push(...backyardHonestyLines(args.body));
    if (args.targetId === "byaf") lines.push(...byafHonestyLines(args.body));
    lines.push(...knowledgeHonestyLines(args.targetId, args.body));
  }
  if (args.targetId === "lumiverse" || args.targetId === "sillytavern") {
    const ext = extensionsFromOriginal(args.original);
    lines.push(...lumiverseHonestyLines(args.body, ext));
  }

  if (args.body !== undefined) {
    lines.push(...mediaPackHonestyLines(args.targetId, args.body));
  }

  const level = lines.some((l) => l.kind === "drop" || l.kind === "warn") ? "warn" : "ok";
  const formatCaveat =
    FORMAT_CAVEAT_TARGETS.has(args.targetId) &&
    lines.some((l) => l.kind === "drop" || l.kind === "warn");
  const partial = level === "warn" && ((anyBehavior && !carriesBehavior) || formatCaveat);
  return {
    level,
    headline:
      level === "ok"
        ? `Export as ${args.targetFriendly}`
        : partial
          ? `Export as ${args.targetFriendly} (partial)`
          : `Export as ${args.targetFriendly}`,
    lines,
  };
}
