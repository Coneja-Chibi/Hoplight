import { test, expect } from "bun:test";
import novelaiLorebook from "./lorebook";
import stWorldbook from "../sillytavern/lorebook";
import type { LorebookEntry } from "../../entities/lorebook/schema";

/**
 * The committed fixture is a verbatim 2-entry slice of a REAL NovelAI v3 export, reformatted only to
 * 4-space JSON (the codec's own output shape). Provenance: Mal.lorebook.json from
 * github.com/MagicShel/novel-ai (lore/firefly). Real bytes, fewer of them - the full v3/v4/v6 files are
 * live-verified via the CLI, not committed (size + third-party licensing in an AGPL repo).
 */
const FIXTURE_PATH = new URL("./fixtures/nai-v3-mal.slice.lorebook.json", import.meta.url);
const fixtureText = await Bun.file(FIXTURE_PATH).text();
const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("novelai-lorebook detects only a NAI export (lorebookVersion + entries[])", () => {
  expect(novelaiLorebook.detect({ text: fixtureText })).toBe(1);
  expect(novelaiLorebook.detect(asText({ entries: { "0": { keys: ["x"] } } }))).toBe(0); // ST worldbook (object entries)
  expect(novelaiLorebook.detect(asText({ type: "risu", ver: 1, data: [] }))).toBe(0); // Risu envelope
  expect(novelaiLorebook.detect(asText({ lorebookVersion: 3 }))).toBe(0); // no entries array
});

test("novelai-lorebook maps native fields to the canonical entry", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  const e0 = canon.body.entries[0]!;

  expect(e0.title).toBe("Characer: Mal: About"); // displayName (typo preserved from the real export)
  expect(e0.content).toBe("Malcolm \"Mal\" Reynolds/ Serenity owner/ captain/ scoundrel/ strong personal code");
  expect(e0.sortOrder).toBe(400); // contextConfig.budgetPriority IS placement -> sortOrder
  expect(e0.priority).toBe(100); // NAI is single-axis: no separate eviction priority -> default
  expect(e0.scanDepth).toBe(1000); // searchRange (chars) -> scanDepth
  expect(e0.constant).toBe(false); // forceActivation
  expect(e0.enabled).toBe(true);

  // NAI keys carry inline `/regex/`: /Mal/ and /Reynolds/ parse as regex, "captain" stays literal.
  expect(e0.triggers.map((t) => [t.keyword, t.isRegex])).toEqual([
    ["Mal", true],
    ["Reynolds", true],
    ["captain", false],
  ]);
  expect(e0.secondaryTriggers).toEqual([]); // NAI has no secondary-key axis

  // budgetPriority decreases across ordered entries (400, 399...) - a placement sequence, not eviction.
  expect(canon.body.entries[1]!.sortOrder).toBe(399);
});

test("novelai-lorebook re-emits an unedited entry byte-for-byte (original-of-raw twin)", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  const out = novelaiLorebook.fromCanonical(canon);
  expect(out.text).toBe(fixtureText); // contextConfig, category, settings residue untouched
});

test("novelai-lorebook rewrites only the edited field, preserving raw residue", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  canon.body.entries[0]!.title = "Renamed";
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");

  expect(out.entries[0].displayName).toBe("Renamed"); // edited field re-encoded
  expect(out.entries[0].text).toBe(canon.body.entries[0]!.content); // untouched, from twin
  expect(out.entries[0].contextConfig.reservedTokens).toBe(50); // NAI-only richness preserved verbatim
  expect(out.entries[0].category).toBe("cat-Mal"); // subcontext ref preserved
  expect(out.entries[1]).toEqual(JSON.parse(fixtureText).entries[1]); // sibling entry byte-identical
  expect(out.categories).toEqual(JSON.parse(fixtureText).categories); // subcontext block preserved
});

test("cross-format INTO NAI (no twin): ST worldbook placement lands in budgetPriority", () => {
  // A minimal ST worldbook: `order` (placement) 55, regex + plain keys.
  const worldbook = {
    entries: {
      "0": { uid: 0, comment: "Lore A", content: "body A", key: ["alpha", "/beta/i"], order: 55, disable: false },
    },
  };
  const canon = stWorldbook.toCanonical(asText(worldbook)); // original keyed "sillytavern-lorebook", no NAI twin
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");

  expect(out.lorebookVersion).toBe(3); // no twin -> proven-valid v3 shell
  const e = out.entries[0];
  expect(e.displayName).toBe("Lore A"); // title -> displayName
  expect(e.text).toBe("body A"); // content -> text
  expect(e.keys).toEqual(["alpha", "/beta/i"]); // regex re-wrapped with delimiters
  expect(e.forceActivation).toBe(false);
  expect(e.contextConfig.budgetPriority).toBe(55); // ST order (placement) -> sortOrder -> budgetPriority
  // contextConfig defaults are the real NAI blank-entry values, not invented.
  expect(e.contextConfig.trimDirection).toBe("doNotTrim");
  expect(e.contextConfig.insertionType).toBe("newline");
  expect(e.contextConfig.maximumTrimType).toBe("sentence");
  expect(e.contextConfig.insertionPosition).toBe(-1);
  expect(e.searchRange).toBe(1000); // ST has no per-entry scan window -> NAI default
});

// -- De-original: authored NAI surface is first-class (contextConfig, toggles, category refs) ---------

test("de-original read: contextConfig / keyRelative / nonStoryActivatable / category land in canonical slots", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  const e0 = canon.body.entries[0]!;
  expect(e0.contextConfig).toEqual({
    prefix: "[ Mal: ",
    suffix: " ]\n",
    tokenBudget: 2048,
    reservedTokens: 50,
    trimDirection: "doNotTrim",
    insertionType: "newline",
    maximumTrimType: "sentence",
    insertionPosition: -1,
  });
  expect(e0.keyRelative).toBe(false);
  expect(e0.nonStoryActivatable).toBe(false);
  expect(e0.categoryId).toBe("cat-Mal");
  expect(canon.body.categories).toEqual([
    { id: "cat-Mal", name: "Character: Mal", sortOrder: 0, enabled: true },
  ]);
});

test("de-original edit: mutating contextConfig/toggles/category reaches the wire (twin present)", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  const e0 = canon.body.entries[0]!;
  e0.contextConfig = { ...e0.contextConfig, prefix: "[ NEW: ", tokenBudget: 1024, trimDirection: "trimBottom" };
  e0.keyRelative = true;
  e0.categoryId = null; // un-file the entry from its category
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");
  expect(out.entries[0].contextConfig.prefix).toBe("[ NEW: ");
  expect(out.entries[0].contextConfig.tokenBudget).toBe(1024);
  expect(out.entries[0].contextConfig.trimDirection).toBe("trimBottom");
  expect(out.entries[0].contextConfig.budgetPriority).toBe(400); // sortOrder axis untouched by the block merge
  expect(out.entries[0].contextConfig.suffix).toBe(" ]\n"); // unedited dial survives from the twin
  expect(out.entries[0].keyRelative).toBe(true);
  expect(out.entries[0].category).toBe("");
  expect(out.entries[1]).toEqual(JSON.parse(fixtureText).entries[1]); // sibling untouched
});

test("de-original edit: renaming a category reaches the wire, subcontext residue survives", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  canon.body.categories![0]!.name = "Malcolm";
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");
  expect(out.categories[0].name).toBe("Malcolm");
  const twinCat = JSON.parse(fixtureText).categories[0];
  const { name: _oldName, ...restTwin } = twinCat;
  const { name: _newName, ...restOut } = out.categories[0];
  expect(restOut).toEqual(restTwin); // createSubcontext/settings/etc. rode the twin clone untouched
});

// Real corpus: a first-party v6 lorebook (see samples/novelai/SOURCES.md) - proves the de-original against
// a genuine export with a real category and the richer v6 entry surface.
const v6Text = await Bun.file(
  new URL("../../../samples/novelai/lorebooks/nai-v6-crystal-dragon.lorebook.json", import.meta.url),
).text();

test("real v6 sample: reads categories + entry refs + contextConfig, edits reach the wire", () => {
  const canon = novelaiLorebook.toCanonical({ text: v6Text });
  expect(canon.body.categories).toHaveLength(1);
  expect(canon.body.categories![0]!.name).toBe("Characters");
  const filed = canon.body.entries.filter((e) => e.categoryId === canon.body.categories![0]!.id);
  expect(filed.length).toBe(2); // third entry is uncategorized ("")
  expect(canon.body.entries[0]!.contextConfig?.trimDirection).toBe("trimBottom");

  // edit-test on the real file: retitle the category + flip a dial
  canon.body.categories![0]!.name = "Cast";
  canon.body.entries[0]!.contextConfig = { ...canon.body.entries[0]!.contextConfig, reservedTokens: 9 };
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");
  expect(out.categories[0].name).toBe("Cast");
  expect(out.entries[0].contextConfig.reservedTokens).toBe(9);
  expect(out.entries[0].loreBiasGroups).toEqual(JSON.parse(v6Text).entries[0].loreBiasGroups); // bias twin intact
});

/** Guard: canonical -> NAI keeps the placement/eviction split straight (regression for #15 doctrine). */
test("novelai-lorebook keeps sortOrder as budgetPriority, never leaking priority", () => {
  const canon = novelaiLorebook.toCanonical({ text: fixtureText });
  const e0 = canon.body.entries[0] as LorebookEntry;
  e0.sortOrder = 250; // move placement
  e0.priority = 7; // eviction change must NOT touch the NAI file (NAI has no eviction field)
  const out = JSON.parse(novelaiLorebook.fromCanonical(canon).text ?? "");
  expect(out.entries[0].contextConfig.budgetPriority).toBe(250);
  expect(JSON.stringify(out.entries[0])).not.toContain("\"priority\""); // priority never serialized
});
