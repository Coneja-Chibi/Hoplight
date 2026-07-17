/**
 * BYAF scenario/greeting mapping: stable ids, primary vs secondary partition, write-back.
 */
import type { CharacterBody, Greeting } from "../../entities/character/schema";
import type { OpenedByaf, Rec } from "./byaf-container";
import { str } from "./byaf-container";

/** Stable greeting id prefix; only archive-mapped scenario paths are ever resolved from an id. */
export const BYAF_GREET_PREFIX = "byaf:";

/** Mint a deterministic greeting id from an archive-internal scenario path (+ optional message index). */
export function mintGreetingId(scenarioPath: string, messageIndex?: number): string {
  if (messageIndex !== undefined) return `${BYAF_GREET_PREFIX}${scenarioPath}#${messageIndex}`;
  return `${BYAF_GREET_PREFIX}${scenarioPath}`;
}

/**
 * Resolve a greeting id to an archive path only when it is in `knownPaths` (twin-mapped).
 * Arbitrary user ids and path traversal never become filesystem paths.
 */
export function resolveGreetingPath(
  id: string | undefined,
  knownPaths: ReadonlySet<string>,
): string | null {
  if (typeof id !== "string" || !id.startsWith(BYAF_GREET_PREFIX)) return null;
  const rest = id.slice(BYAF_GREET_PREFIX.length);
  if (rest === "" || rest.includes("..") || rest.startsWith("/") || rest.includes("\\")) return null;
  const hash = rest.lastIndexOf("#");
  const path = hash >= 0 ? rest.slice(0, hash) : rest;
  if (hash >= 0) {
    const idx = Number(rest.slice(hash + 1));
    if (!Number.isInteger(idx) || idx < 0) return null;
  }
  return knownPaths.has(path) ? path : null;
}

/** Safe scenario path not already used by primary or files map. Never derived from user input. */
export function freshScenarioPath(arc: OpenedByaf, used: Set<string>): string {
  let n = 2;
  while (true) {
    const p = `scenarios/scenario${n}.json`;
    if (!used.has(p) && arc.files[p] === undefined) return p;
    n += 1;
  }
}

/** Clone primary sampling knobs onto a brand-new secondary scenario shell. */
export function newSecondaryShell(
  primary: Rec | undefined,
  title: string,
  cid: string,
  text: string,
): Rec {
  const data: Rec = {
    schemaVersion: 1,
    formattingInstructions: primary ? (str(primary.formattingInstructions) ?? "") : "",
    narrative: title,
    title,
    firstMessages: [{ characterID: cid, text }],
    exampleMessages: [],
    messages: [],
    canDeleteExampleMessages: true,
    promptTemplate: primary?.promptTemplate ?? null,
    grammar: primary?.grammar ?? null,
  };
  if (primary) {
    for (const k of [
      "temperature",
      "topP",
      "topK",
      "minP",
      "minPEnabled",
      "repeatPenalty",
      "repeatLastN",
    ] as const) {
      if (primary[k] !== undefined) data[k] = primary[k];
    }
  }
  return data;
}

/**
 * Build a secondary scenario from an alt greeting. Prefer stable id/path match, then legacy
 * title/narrative match; else create scenarios/scenarioN.json (never use a user id as a path).
 */
export function scenarioFromAlt(
  arc: OpenedByaf,
  g: Greeting,
  cid: string,
  primary: Rec | undefined,
  unusedSecondary: { path: string; data: Rec }[],
  usedPaths: Set<string>,
  knownPaths: ReadonlySet<string>,
): { path: string; data: Rec } {
  const title = (g.title ?? "").trim() || "Scenario";
  const idPath = resolveGreetingPath(g.id, knownPaths);
  let matchIdx = -1;
  if (idPath !== null) {
    matchIdx = unusedSecondary.findIndex((sc) => sc.path === idPath);
  }
  if (matchIdx < 0) {
    matchIdx = unusedSecondary.findIndex((sc) => {
      const narrative = (str(sc.data.narrative) ?? "").trim();
      const scTitle = (str(sc.data.title) ?? "").trim();
      return narrative === title || scTitle === title;
    });
  }
  if (matchIdx >= 0) {
    const [matched] = unusedSecondary.splice(matchIdx, 1);
    const data = matched!.data;
    data.narrative = title;
    data.title = title;
    data.firstMessages = [{ characterID: cid, text: g.text }];
    usedPaths.add(matched!.path);
    return { path: matched!.path, data };
  }
  const path = freshScenarioPath(arc, usedPaths);
  usedPaths.add(path);
  return { path, data: newSecondaryShell(primary, title, cid, g.text) };
}

/**
 * Partition alts by stable origin (id path) when present; legacy titled => secondary.
 * Primary alts rejoin primary firstMessages; secondary alts keep/create scenario files.
 * Delete a secondary only when its identity is absent from the edited list.
 */
export function applyGreetingsToArchive(arc: OpenedByaf, b: CharacterBody, cid: string): void {
  const alts = b.greetings.alternateGreetings ?? [];
  const primaryEntry = arc.scenarios[0];
  const primaryPath = primaryEntry?.path;
  const knownPaths = new Set(arc.scenarios.map((s) => s.path));
  const secondaryPathSet = new Set(arc.scenarios.slice(1).map((s) => s.path));

  const primaryAlts: Greeting[] = [];
  const secondaryAlts: Greeting[] = [];
  for (const g of alts) {
    const resolved = resolveGreetingPath(g.id, knownPaths);
    if (resolved !== null) {
      if (primaryPath !== undefined && resolved === primaryPath) primaryAlts.push(g);
      else if (secondaryPathSet.has(resolved)) secondaryAlts.push(g);
      else if ((g.title ?? "").trim().length > 0) secondaryAlts.push(g);
      else primaryAlts.push(g);
    } else if ((g.title ?? "").trim().length > 0) {
      secondaryAlts.push(g);
    } else {
      primaryAlts.push(g);
    }
  }

  const primary = primaryEntry?.data;
  if (primary) {
    if (b.persona.scenario !== undefined) primary.narrative = b.persona.scenario;
    if (b.prompts.systemPrompt !== undefined) {
      primary.formattingInstructions = b.prompts.systemPrompt;
    }
    const first = b.greetings.firstMessage;
    const msgs = [first, ...primaryAlts.map((g) => g.text)].filter(
      (t): t is string => typeof t === "string" && t.length > 0,
    );
    if (msgs.length > 0) {
      primary.firstMessages = msgs.map((text) => ({ characterID: cid, text }));
    }
    if (b.examples.exampleMessages !== undefined) {
      const lines = b.examples.exampleMessages.split("\n").filter((l) => l.length > 0);
      primary.exampleMessages = lines.map((text) => ({ characterID: cid, text }));
    }
  }

  const unusedSecondary = arc.scenarios.slice(1).map((s) => ({ path: s.path, data: s.data }));
  const usedPaths = new Set<string>();
  if (primaryEntry) usedPaths.add(primaryEntry.path);

  const secondary: { path: string; data: Rec }[] = [];
  for (const g of secondaryAlts) {
    secondary.push(scenarioFromAlt(arc, g, cid, primary, unusedSecondary, usedPaths, knownPaths));
  }

  for (const orphan of unusedSecondary) {
    delete arc.files[orphan.path];
  }

  if (primaryEntry) {
    arc.scenarios = [{ path: primaryEntry.path, data: primaryEntry.data }, ...secondary];
  } else {
    arc.scenarios = secondary;
  }
  arc.manifest.scenarios = arc.scenarios.map((s) => s.path);
}
