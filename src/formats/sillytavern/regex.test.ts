/** Regression coverage for the regex.test behavior owned beside this file. */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import codec from "./regex";

/**
 * A representative bare ST `RegexScriptData[]` file (Marinara's Essentials distribution form,
 * REGEX-JEWEL-PLAN.md R1 must #1). Two rows exercise the wrapped `/pattern/flags` form (one with
 * a depth window, multi-placement, and both markdownOnly+promptOnly set), one exercises a BARE
 * pattern with no delimiters (the regexFromString residual - R1 must #1), and one exercises
 * substituteRegex 1/2 and non-empty trimStrings (not present in the real fixture).
 */
function makeStRegexFile() {
  return [
    {
      id: "row-wrapped",
      scriptName: "Strip stage brackets",
      findRegex: "/\\[[^\\]]*\\]/gi",
      replaceString: "",
      trimStrings: ["  "],
      placement: [1, 2],
      disabled: false,
      markdownOnly: true,
      promptOnly: true,
      runOnEdit: true,
      substituteRegex: 0,
      minDepth: 3,
      maxDepth: null,
    },
    {
      id: "row-raw-sub",
      scriptName: "Substitute macros raw",
      findRegex: "/{{user}}/g",
      replaceString: "$0",
      trimStrings: [],
      placement: [5, 6],
      disabled: true,
      markdownOnly: false,
      promptOnly: false,
      runOnEdit: false,
      substituteRegex: 1,
      minDepth: null,
      maxDepth: 10,
    },
    {
      id: "row-escaped-sub",
      scriptName: "Substitute macros escaped",
      findRegex: "/foo/",
      replaceString: "bar",
      trimStrings: [],
      placement: [2],
      disabled: false,
      markdownOnly: false,
      promptOnly: false,
      runOnEdit: true,
      substituteRegex: 2,
      minDepth: null,
      maxDepth: null,
    },
    {
      id: "row-bare",
      scriptName: "Format User's Stats (bare pattern)",
      findRegex: "```\\n[\\s\\S]*?Health: ([\\d]+)%```",
      replaceString: "HP: $1",
      trimStrings: [],
      placement: [2],
      disabled: false,
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: true,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null,
    },
  ];
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

describe("detect", () => {
  test("recognizes a bare RegexScriptData[] file", () => {
    expect(codec.detect(asText(makeStRegexFile()))).toBeGreaterThan(0.5);
  });

  test("recognizes card extensions.regex_scripts (v2 data.extensions home)", () => {
    const card = { data: { name: "Card", extensions: { regex_scripts: makeStRegexFile() } } };
    expect(codec.detect(asText(card))).toBeGreaterThan(0.5);
  });

  test("rejects unrelated json", () => {
    expect(codec.detect(asText({ hello: "world" }))).toBe(0);
    expect(codec.detect(asText([1, 2, 3]))).toBe(0);
  });
});

describe("regexFromString residual (R1 must #1): bare pattern, no flags", () => {
  test("a bare findRegex with no delimiters becomes the whole pattern with empty flags", () => {
    const ent = codec.toCanonical(asText(makeStRegexFile()));
    const bare = ent.body.rules.find((r) => r.id === "row-bare")!;
    expect(bare.find).toBe("```\\n[\\s\\S]*?Health: ([\\d]+)%```");
    expect(bare.flags).toBe("");
  });

  test("a wrapped /pattern/flags string splits pattern and flags", () => {
    const ent = codec.toCanonical(asText(makeStRegexFile()));
    const wrapped = ent.body.rules.find((r) => r.id === "row-wrapped")!;
    expect(wrapped.find).toBe("\\[[^\\]]*\\]");
    expect(wrapped.flags).toBe("gi");
  });

  test("a wrapped pattern with empty flags (/pattern/) still splits to flags \"\"", () => {
    const ent = codec.toCanonical(asText(makeStRegexFile()));
    const noFlags = ent.body.rules.find((r) => r.id === "row-escaped-sub")!;
    expect(noFlags.find).toBe("foo");
    expect(noFlags.flags).toBe("");
  });
});

describe("field mapping", () => {
  const ent = codec.toCanonical(asText(makeStRegexFile()));

  test("placement numbers fold to phases (1/2/3/5/6 -> input/output/slash/lorebook/reasoning)", () => {
    const raw = ent.body.rules.find((r) => r.id === "row-wrapped")!;
    expect(raw.phases).toEqual(["input", "output"]);
    const lore = ent.body.rules.find((r) => r.id === "row-raw-sub")!;
    expect(lore.phases).toEqual(["lorebook", "reasoning"]);
  });

  test("markdownOnly/promptOnly fold onto the target axis", () => {
    const both = ent.body.rules.find((r) => r.id === "row-wrapped")!;
    expect(both.targets).toEqual(["display", "prompt"]);
    const neither = ent.body.rules.find((r) => r.id === "row-escaped-sub")!;
    expect(neither.targets).toBeUndefined();
  });

  test("substituteRegex 0/1/2 map to none(undefined)/raw/escaped", () => {
    expect(ent.body.rules.find((r) => r.id === "row-wrapped")!.substituteFind).toBeUndefined();
    expect(ent.body.rules.find((r) => r.id === "row-raw-sub")!.substituteFind).toBe("raw");
    expect(ent.body.rules.find((r) => r.id === "row-escaped-sub")!.substituteFind).toBe("escaped");
  });

  test("disabled inverts to enabled; sortOrder is array index", () => {
    const disabled = ent.body.rules.find((r) => r.id === "row-raw-sub")!;
    expect(disabled.enabled).toBe(false);
    expect(disabled.sortOrder).toBe(1);
  });

  test("depth window and trimStrings survive", () => {
    const raw = ent.body.rules.find((r) => r.id === "row-wrapped")!;
    expect(raw.minDepth).toBe(3);
    expect(raw.maxDepth).toBeNull();
    expect(raw.trimStrings).toEqual(["  "]);
  });
});

describe("round-trip (R1 must #6: byte-equal on unknown fields + cosmetic form)", () => {
  test("synthetic file round-trips losslessly", () => {
    const original = makeStRegexFile();
    const ent = codec.toCanonical(asText(original));
    const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
    expect(back).toEqual(original);
  });

  test("an edited rule re-encodes; untouched rows stay byte-identical", () => {
    const ent = codec.toCanonical(asText(makeStRegexFile()));
    const target = ent.body.rules.find((r) => r.id === "row-wrapped")!;
    target.replace = "[redacted]";
    target.enabled = false;
    const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
    expect(back[0].replaceString).toBe("[redacted]");
    expect(back[0].disabled).toBe(true);
    expect(back[3]).toEqual(makeStRegexFile()[3]); // row-bare untouched, still bare on the wire
  });

  test("the real Marinara's Essentials fixture round-trips byte-equal", () => {
    const path = join(import.meta.dir, "..", "_fixtures", "regex", "marinara-essentials.json");
    const original = JSON.parse(readFileSync(path, "utf8"));
    const ent = codec.toCanonical(asText(original));
    expect(ent.body.rules.length).toBe(original.length);
    const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
    expect(back).toEqual(original);
  });

  test("unrecognized extra row keys survive as extras and re-emit untouched", () => {
    const rowWithExtra = [{ ...makeStRegexFile()[0], customVendorField: "keep-me" }];
    const ent = codec.toCanonical(asText(rowWithExtra));
    expect(ent.body.rules[0]!.extras?.customVendorField).toBe("keep-me");
    const back = JSON.parse(codec.fromCanonical(ent).text ?? "");
    expect(back[0].customVendorField).toBe("keep-me");
  });
});

describe("set naming", () => {
  test("derives the set name from the input filename when present", () => {
    const ent = codec.toCanonical({ text: JSON.stringify(makeStRegexFile()), filename: "My Pack.json" });
    expect(ent.body.name).toBe("My Pack");
  });

  test("falls back to a generic name with no filename", () => {
    const ent = codec.toCanonical(asText(makeStRegexFile()));
    expect(ent.body.name).toBe("Imported regex scripts");
  });
});
