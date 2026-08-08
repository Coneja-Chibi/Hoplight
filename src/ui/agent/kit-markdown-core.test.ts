/**
 * The link policy, and Kit's diff cap, held to their reasons.
 *
 * This is the one file in the transcript translation where getting it wrong is a security defect
 * rather than a cosmetic one: everything it governs is built out of MODEL OUTPUT, and the model's
 * words are data from outside the program no matter how friendly they look.
 */
import { describe, expect, test } from "bun:test";
import { DIFF_LINE_CAP, diffInk, safeLinkHref } from "./kit-markdown-core";

describe("safeLinkHref", () => {
  test("ordinary outward links survive", () => {
    expect(safeLinkHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeLinkHref("http://localhost:8321/docs")).toBe("http://localhost:8321/docs");
    expect(safeLinkHref("mailto:someone@example.com")).toBe("mailto:someone@example.com");
    expect(safeLinkHref("HTTPS://Example.com")).toBe("HTTPS://Example.com");
  });

  test("A LINK CAN NEVER EXECUTE", () => {
    /**
     * The whole reason this function exists. `[click me](javascript:...)` is four keystrokes for a
     * model and an arbitrary script running inside the app for whoever clicks it.
     */
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
    expect(safeLinkHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeLinkHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeLinkHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("A SMUGGLED SCHEME IS STRIPPED BEFORE IT IS JUDGED", () => {
    /**
     * `java\nscript:` navigates in every browser, because the URL parser removes tab, newline and
     * carriage return anywhere in the string before it resolves anything. A check that trims the
     * ends only is checking a different string than the one that will be followed.
     */
    expect(safeLinkHref("java\nscript:alert(1)")).toBeNull();
    expect(safeLinkHref("java\tscript:alert(1)")).toBeNull();
    expect(safeLinkHref("  javascript:alert(1)")).toBeNull();
    expect(safeLinkHref("\u0000javascript:alert(1)")).toBeNull();
    // And the stripping does not manufacture a pass for something that was already fine.
    expect(safeLinkHref(" https://example.com ")).toBe("https://example.com");
  });

  test("A LINK CANNOT STEER THIS APP, only leave it", () => {
    /**
     * The app's own `isSafeHref` passes `#fragment` and `/root-relative`, which is right for a
     * creator's card note inside a preview frame and wrong here: this window IS the app, so a
     * root-relative link in a reply would be a model writing navigation into somebody's chat log.
     */
    expect(safeLinkHref("/settings")).toBeNull();
    expect(safeLinkHref("#somewhere")).toBeNull();
    expect(safeLinkHref("//evil.example.com/x")).toBeNull();
    expect(safeLinkHref("file:///C:/Windows/System32")).toBeNull();
    expect(safeLinkHref("")).toBeNull();
  });
});

describe("Kit's diff shape", () => {
  test("the row cap is Kit's own", () => {
    // src/kit/render/primitives/markdown-text.tsx. A three thousand line patch rendered whole is a
    // transcript nobody can scroll back through; eighty rows is enough to read a hunk.
    expect(DIFF_LINE_CAP).toBe(80);
  });

  test("the colours are the diff, and every one is a palette variable", () => {
    expect(diffInk("add")).toBe("var(--kit-alive)");
    expect(diffInk("remove")).toBe("var(--kit-red)");
    expect(diffInk("meta")).toBe("var(--kit-violet)");
    expect(diffInk("context")).toBe("var(--kit-soft)");
    // Never a hex: the palette has exactly one home and this surface reads it through variables.
    for (const kind of ["add", "remove", "meta", "context"] as const) {
      expect(diffInk(kind)).toStartWith("var(--kit-");
    }
  });
});
