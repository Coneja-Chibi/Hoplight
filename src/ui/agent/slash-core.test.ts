/**
 * The popup's rules: when it is asking, what it offers, and what it inserts.
 *
 * The failures worth pinning are the ones that make the composer argue with the person typing: a
 * menu opening over the second line of a paragraph, `/unshare` being offered to somebody typing
 * `/share`, and a completed command that arrives without the space its argument needs.
 */
import { describe, expect, test } from "bun:test";
import type { CommandInfo } from "./command-core";
import {
  argStageChoices,
  commandMatches,
  draftForArg,
  draftForPick,
  exactCommand,
  nextIndex,
  slashQuery,
  unknownNote,
  wordStageChoices,
} from "./slash-core";

const catalog: CommandInfo[] = [
  { name: "/share", summary: "let Kit read a folder outside the studio", aliases: ["/folders"], completes: false },
  { name: "/unshare", summary: "stop Kit reading a shared folder", completes: false },
  { name: "/gates", summary: "how often Kit asks before writing", aliases: ["/ask"], completes: true },
  { name: "/usage", summary: "how much of your subscription plan is used", aliases: ["/quota"], completes: false },
];

describe("what the draft is asking for", () => {
  test("the word stage and the argument stage are told apart by one space", () => {
    expect(slashQuery("/gat")).toEqual({ word: "/gat", arg: null });
    expect(slashQuery("/gates ")).toEqual({ word: "/gates", arg: "" });
    expect(slashQuery("/gates gu")).toEqual({ word: "/gates", arg: "gu" });
  });

  test("A DRAFT WITH A NEWLINE IS PROSE, NOT A COMMAND", () => {
    /**
     * Somebody writing a paragraph that opens with a path is not asking for a menu, and popping one
     * open over their second line would be the composer arguing with them.
     */
    expect(slashQuery("/usr/local/bin\nis where it lives")).toBeNull();
  });

  test("// is the escape, so it never opens a menu", () => {
    expect(slashQuery("//not a command")).toBeNull();
  });

  test("ordinary prose is not a query", () => {
    expect(slashQuery("what is in the studio")).toBeNull();
    expect(slashQuery("")).toBeNull();
  });

  test("leading whitespace is forgiven, exactly as the matcher forgives it", () => {
    expect(slashQuery("  /decks")?.word).toBe("/decks");
  });
});

describe("what the popup offers", () => {
  test("PREFIX ONLY, so /share never offers to undo itself", () => {
    /**
     * A contains-match would put `/unshare` in the list for somebody typing `/share`. That is the
     * one pair in the whole set where taking the wrong row does the opposite of what was meant.
     */
    expect(commandMatches(catalog, "/share").map((c) => c.name)).toEqual(["/share"]);
  });

  test("an alias reaches its command, after the commands actually named that", () => {
    expect(commandMatches(catalog, "/q").map((c) => c.name)).toEqual(["/usage"]);
    expect(commandMatches(catalog, "/f").map((c) => c.name)).toEqual(["/share"]);
  });

  test("a bare slash offers everything", () => {
    expect(commandMatches(catalog, "/")).toHaveLength(4);
  });

  test("nothing matching is an empty list, not the whole list", () => {
    expect(commandMatches(catalog, "/zzz")).toEqual([]);
  });
});

describe("a word that is already a command", () => {
  test("A FINISHED WORD CLOSES THE LIST, or Enter can never send", () => {
    /**
     * Found by typing `/resume` into the real window: the popup still offered `/resume`, so Enter
     * completed it to what it already was. The command could be typed perfectly and never run,
     * which is the same dead end as having no commands at all.
     */
    expect(commandMatches(catalog, "/gates")).toHaveLength(1);
    expect(wordStageChoices(catalog, "/gates")).toEqual([]);
  });

  test("an alias counts as finished too", () => {
    expect(exactCommand(catalog, "/quota")?.name).toBe("/usage");
    expect(wordStageChoices(catalog, "/quota")).toEqual([]);
  });

  test("a word still being typed keeps its list", () => {
    expect(wordStageChoices(catalog, "/gat").map((c) => c.name)).toEqual(["/gates"]);
  });
});

describe("an argument that is already a candidate", () => {
  const found = [{ value: "adrian" }, { value: "adrian-two" }];

  test("THE SAME DEAD END AS THE WORD STAGE, one level down", () => {
    /**
     * Also found in the real window: completing `/art ` to `/art adrian` left `adrian` matching its
     * own prefix, so the popup reopened on the finished answer and Enter completed it again. The two
     * stages fail independently, which is why both need the rule.
     */
    expect(argStageChoices(found, "adrian").map((c) => c.value)).toEqual(["adrian-two"]);
  });

  test("a partial argument keeps every candidate", () => {
    expect(argStageChoices(found, "adr")).toHaveLength(2);
  });

  test("an argument matching the only candidate closes the list", () => {
    expect(argStageChoices([{ value: "guarded" }], "guarded")).toEqual([]);
  });
});

describe("what choosing inserts", () => {
  test("a command that takes an argument keeps the cursor going", () => {
    expect(draftForPick(catalog[2]!)).toBe("/gates ");
    expect(draftForPick(catalog[1]!)).toBe("/unshare");
  });

  test("an argument lands ready to send", () => {
    expect(draftForArg("/gates", "autopilot")).toBe("/gates autopilot");
  });
});

describe("a slash line that matches nothing", () => {
  test("a near miss is named, using Kit's own nearest-command rule", () => {
    expect(unknownNote(catalog, "/gate")).toContain("/gates");
    expect(unknownNote(catalog, "/gate")).toContain("how often Kit asks");
  });

  test("nothing close points at the list rather than guessing", () => {
    expect(unknownNote(catalog, "/qqqqqqzz")).toBe("Unknown command: /qqqqqqzz. Try /help.");
  });
});

describe("the highlight", () => {
  test("it wraps at both ends", () => {
    expect(nextIndex(2, 3, 1)).toBe(0);
    expect(nextIndex(0, 3, -1)).toBe(2);
    expect(nextIndex(0, 0, 1)).toBe(0);
  });
});
