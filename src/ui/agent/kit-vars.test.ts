/**
 * Kit's palette, as this window receives it.
 *
 * The point of these is not that a particular colour is a particular hex. It is that there is ONE
 * palette: the window projects src/kit/render/theme.ts rather than keeping a copy of it, so a colour
 * refined in the terminal cannot silently stop matching here. This repository has already shipped
 * the other arrangement once, as two damage-reason unions that printed `undefined` on 123 files.
 */
import { describe, expect, test } from "bun:test";
import { theme, verbColor } from "../../kit/render/theme";
import { kitVars, verbOf } from "./kit-vars";

describe("kitVars", () => {
  test("EVERY COLOUR KIT HAS ARRIVES, none invented here", () => {
    const vars = kitVars() as unknown as Record<string, string>;
    for (const [name, value] of Object.entries(theme)) {
      const key = `--kit-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(vars[key]).toBe(value);
    }
  });

  test("camelCase becomes the kebab-case a custom property needs", () => {
    // `roseDeep` in TypeScript is `--kit-rose-deep` in CSS; getting this wrong produces a variable
    // that resolves to nothing, and an unset custom property paints as transparent rather than
    // failing - a border that quietly disappears with no error.
    const vars = kitVars() as unknown as Record<string, string>;
    expect(vars["--kit-rose-deep"]).toBe(theme.roseDeep);
    expect(vars["--kit-teal-deep"]).toBe(theme.tealDeep);
    expect(vars["--kit-stamp-dim"]).toBe(theme.stampDim);
  });

  test("the verb palette comes too, because it is what carries risk", () => {
    // A tool row's spine is coloured by its verb: cool reads, warm writes, red destroys. Without
    // these the transcript is a flat list where deleting looks exactly like listing.
    const vars = kitVars() as unknown as Record<string, string>;
    expect(vars["--kit-verb-delete"]).toBe(verbColor["delete"]);
    expect(vars["--kit-verb-read"]).toBe(verbColor["read"]);
  });
});

describe("verbOf", () => {
  test("A DESTRUCTIVE TOOL AND A READING TOOL DO NOT LOOK ALIKE", () => {
    /**
     * The single most useful thing Kit's transcript does at a glance. `studio_delete` must not be
     * the same colour as `studio_read`, because by the time somebody has read the row's words the
     * call has already happened.
     */
    expect(verbOf("studio_delete")).not.toBe(verbOf("studio_read"));
    expect(verbOf("studio_delete")).toContain("delete");
    expect(verbOf("studio_read")).toContain("read");
  });

  test("the verb is the part after the underscore, matching Kit's own reading", () => {
    expect(verbOf("studio_list")).toContain("list");
    expect(verbOf("folder_import")).toContain("import");
  });

  test("AN UNKNOWN VERB IS NEUTRAL BRIGHT, never dim and never invented", () => {
    /**
     * Kit's rule twice over: an unmapped verb falls back to a neutral BRIGHT, not to a muted grey -
     * `mut` and `line` are borders only and never carry meaning. A new tool should look plain, not
     * look broken, and certainly not accidentally look destructive.
     */
    expect(verbOf("something_unheardof")).toBe("var(--kit-bright)");
    expect(verbOf("noundersore")).toBe("var(--kit-bright)");
    expect(verbOf("")).toBe("var(--kit-bright)");
  });
});
