/**
 * Path recognition, tested mostly on what it must NOT match.
 *
 * A false positive here mints a grant from a sentence, which is the one failure that costs
 * something: it turns "consent to a file you named" into "consent to whatever looked path-shaped".
 */
import { describe, expect, test } from "bun:test";
import { pastedPaths } from "./pasted-path";

const only = (draft: string): string[] => pastedPaths(draft).map((p) => p.path);

describe("what it finds", () => {
  test("a bare Windows path", () => {
    expect(only(String.raw`look at C:\cards\dite.png please`)).toEqual([String.raw`C:\cards\dite.png`]);
  });

  test("a bare POSIX path", () => {
    expect(only("look at /home/chi/cards/dite.png please")).toEqual(["/home/chi/cards/dite.png"]);
  });

  test("a quoted path, which is how a path with spaces survives at all", () => {
    expect(only(`open "C:\\My Cards\\dite.png" for me`)).toEqual([String.raw`C:\My Cards\dite.png`]);
  });

  test("forward slashes on Windows, which is what most people paste", () => {
    expect(only("C:/Users/chiev/Downloads/preset.json")).toEqual(["C:/Users/chiev/Downloads/preset.json"]);
  });

  test("several paths keep their order, and a repeat is not listed twice", () => {
    expect(only("/a/one.json and /b/two.png and /a/one.json again"))
      .toEqual(["/a/one.json", "/b/two.png"]);
  });

  test("trailing punctuation belongs to the sentence, not the path", () => {
    expect(only("is /cards/dite.png right?")).toEqual(["/cards/dite.png"]);
    expect(only("try /cards/dite.png, then stop")).toEqual(["/cards/dite.png"]);
  });
});

describe("folders, which the first version wrongly refused", () => {
  test("the exact path Chi pasted, which Kit told him was not shared", () => {
    // He wrote a folder and asked Kit to copy everything in it. Requiring a file extension meant
    // this minted no grant at all, so the friction the whole feature exists to remove was still
    // there - because I had guessed at his intent instead of reading it.
    const draft = String.raw`C:\Users\chiev\Downloads\SillyTavern\data\default-user\OpenAI Settings Can you copy everything in this folder into my preset folder please?`;
    expect(only(draft)).toContain(
      String.raw`C:\Users\chiev\Downloads\SillyTavern\data\default-user\OpenAI`,
    );
  });

  test("a deep POSIX folder", () => {
    expect(only("import everything in /home/chi/cards/imported")).toEqual(["/home/chi/cards/imported"]);
  });
});

describe("what it must NOT find", () => {
  test("a shallow path is a gesture at a drive, not a place somebody went and got", () => {
    // Two segments is `C:\Users` territory. The line is drawn low on purpose: the real guard is the
    // caller's stat plus saying out loud what it opened, not this count.
    expect(only(String.raw`my stuff lives in C:\Users`)).toEqual([]);
    expect(only("check /home")).toEqual([]);
  });

  test("ordinary prose containing slashes", () => {
    expect(only("use and/or whichever you prefer")).toEqual([]);
    expect(only("the read/write split")).toEqual([]);
  });

  test("a URL, which is not a file on this machine", () => {
    expect(only("see https://example.com/thing.json")).toEqual([]);
  });

  test("a file with an extension Kit cannot do anything with", () => {
    expect(only("/cards/dite.exe")).toEqual([]);
    expect(only(String.raw`C:\windows\system32\evil.dll`)).toEqual([]);
  });

  test("an empty draft", () => {
    expect(only("")).toEqual([]);
  });
});

describe("the regexes are not shared state", () => {
  test("calling twice over the same draft gives the same answer", () => {
    // Module-level /g regexes keep a lastIndex. Without resetting it the second call starts halfway
    // through and silently finds fewer paths than the first - the kind of bug that only shows up on
    // the second message somebody sends.
    const draft = "open /cards/dite.png now";
    expect(only(draft)).toEqual(only(draft));
    expect(only(draft)).toEqual(["/cards/dite.png"]);
  });
});

describe("positions", () => {
  test("start and end bracket the match, so a caller can show or strip it", () => {
    const [hit] = pastedPaths("look at /cards/dite.png please");
    expect(hit).toBeTruthy();
    expect("look at /cards/dite.png please".slice(hit!.start, hit!.end)).toContain("/cards/dite.png");
  });
});
