/**
 * Integration proof that the real authored corpus is searchable and navigable.
 */
import { expect, test } from "bun:test";
import { createHoplightDocs } from "./repository";

const DOCUMENTED_SILLYTAVERN_MACROS = [
  "user", "char", "group", "groupNotMuted", "charIfNotGroup", "notChar",
  "description", "personality", "scenario", "persona", "charPrompt", "charInstruction",
  "charDepthPrompt", "charCreatorNotes", "charVersion", "mesExamples", "mesExamplesRaw",
  "charFirstMessage", "original", "lastMessage", "lastMessageId", "lastUserMessage",
  "lastCharMessage", "firstIncludedMessageId", "firstDisplayedMessageId", "lastSwipeId",
  "currentSwipeId", "allChatRange", "summary", "time", "date", "weekday", "isotime",
  "isodate", "datetimeformat", "idleDuration", "timeDiff", "getvar", "setvar", "addvar",
  "incvar", "decvar", "hasvar", "deletevar", "getglobalvar", "setglobalvar",
  "addglobalvar", "incglobalvar", "decglobalvar", "hasglobalvar", "deleteglobalvar",
  "random", "pick", "roll", "maxPrompt", "maxContextTokens", "maxResponseTokens", "model",
  "isMobile", "lastGenerationType", "hasExtension", "systemPrompt", "defaultSystemPrompt",
  "authorsNote", "charAuthorsNote", "defaultAuthorsNote", "instructStoryStringPrefix",
  "instructStoryStringSuffix", "instructUserPrefix", "instructUserSuffix",
  "instructAssistantPrefix", "instructAssistantSuffix", "instructSeparator",
  "instructSystemPrefix", "instructSystemSuffix", "instructFirstAssistantPrefix",
  "instructLastAssistantPrefix", "instructFirstUserPrefix", "instructLastUserPrefix",
  "instructStop", "instructUserFiller", "instructSystemInstructionPrefix", "chatSeparator",
  "chatStart", "reasoningPrefix", "reasoningSuffix", "reasoningSeparator", "charPrefix",
  "charNegativePrefix", "newline", "space", "noop", "trim", "reverse", "input", "banned",
  "outlet",
] as const;

const VARIABLE_SHORTHAND_OPERATORS = [
  "=", "++", "--", "+=", "-=", "||", "??", "||=", "??=", "==", "!=", ">", ">=", "<", "<=",
] as const;

test("full-text search returns the best catalog section for body-only wording", async () => {
  const docs = createHoplightDocs();
  const hits = await docs.search("shared secret world readable process table");
  expect(hits[0]?.id).toBe("reference/security/remote-access");
  expect(hits[0]?.section).toBe("two-listeners-one-trust-boundary");
  expect(hits[0]?.excerpt).toContain("shared secret");
});

test("browse root is metadata-only and lists real collections", async () => {
  const docs = createHoplightDocs();
  const root = await docs.browse();
  expect(root).not.toBeNull();
  expect(root!.collection).toBeNull();
  expect(root!.collections.some((entry) => entry.id === "guide")).toBe(true);
  expect(root!.collections.some((entry) => entry.id === "reference")).toBe(true);
  expect(root!.pages.some((page) => page.id === "01-VISION" || page.id === "README")).toBe(true);
});

test("browse refuses path escape and outline returns a real page map", async () => {
  const docs = createHoplightDocs();
  expect(await docs.browse({ collection: "../SECURITY" })).toBeNull();
  const outline = await docs.outline("reference/security/remote-access");
  expect(outline).not.toBeNull();
  expect(outline!.id).toBe("reference/security/remote-access");
  expect(outline!.sections.some((section) => section.slug.includes("lan")
    || section.slug.includes("listener")
    || section.text.toLowerCase().includes("lan"))).toBe(true);
  expect(await docs.outline("nope/missing")).toBeNull();
});

test("whole-document reads can continue until the complete source is consumed", async () => {
  const docs = createHoplightDocs();
  const first = await docs.read("01-VISION", { maxChars: 1_000 });
  expect(first).not.toBeNull();
  expect(first!.section).toBeNull();
  expect(first!.offset).toBe(0);
  expect(first!.truncated).toBe(true);
  expect(first!.nextOffset).toBeGreaterThan(0);
  expect(first!.totalChars).toBeGreaterThan(first!.body.length);

  const second = await docs.read("01-VISION", {
    maxChars: 1_000,
    offset: first!.nextOffset!,
  });
  expect(second).not.toBeNull();
  expect(second!.offset).toBe(first!.nextOffset!);
  expect(second!.body).not.toBe(first!.body);
});

test("SillyTavern authoring references are searchable and readable by section", async () => {
  const docs = createHoplightDocs();
  const hits = await docs.search("World Info outlet recursion timed effects");
  expect(hits.some((hit) => hit.id === "reference/platforms/sillytavern/world-info")).toBe(true);

  const section = await docs.read("reference/platforms/sillytavern/macros", {
    section: "variables-and-state",
  });
  expect(section).not.toBeNull();
  expect(section!.section).toBe("variables-and-state");
  expect(section!.body).toContain("Local variables belong to the current chat");
  expect(section!.body).toContain("keeps macros sealed during conversion");
  expect(section!.body).toContain("evaluates them while importing");
});

test("SillyTavern reference enumerates every macro and operator in the pinned manual", async () => {
  const catalog = await Bun.file(
    "docs/reference/platforms/sillytavern/macro-reference.md",
  ).text();
  for (const name of DOCUMENTED_SILLYTAVERN_MACROS) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(catalog).toMatch(new RegExp(`\\{\\{${escaped}(?=[}: ])`));
  }

  const operators = await Bun.file(
    "docs/reference/platforms/sillytavern/macro-operators.md",
  ).text();
  for (const operator of VARIABLE_SHORTHAND_OPERATORS) {
    expect(operators).toContain(`| \`${operator}\` |`);
  }
  expect(operators).toContain("`/` | Closes a scoped block");
  expect(operators).toContain("`#` | Preserves all whitespace");
  expect(operators).toContain("planned but not");

  const docs = createHoplightDocs();
  const macroHits = await docs.search("charNegativePrefix image generation macro");
  expect(macroHits[0]?.id).toBe("reference/platforms/sillytavern/macro-reference");
  const operatorHits = await docs.search("nullish coalescing assign lazy fallback macro");
  expect(operatorHits.some(
    (hit) => hit.id === "reference/platforms/sillytavern/macro-operators",
  )).toBe(true);
});
