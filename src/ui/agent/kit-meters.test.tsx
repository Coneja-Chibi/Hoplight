/**
 * The meter row, rendered.
 *
 * The core test proves the thresholds. This proves the drawing: that the bar is made of Kit's
 * characters rather than a CSS fill, that a full window says what to do about it, and - the one
 * that matters - that an unknown context window draws no bar at all.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MeterBar } from "./kit-meters";
import { NO_TOKENS, foldUsage } from "./kit-meters-core";

const draw = (raw: unknown, max: number | undefined): string =>
  renderToStaticMarkup(<MeterBar tokens={foldUsage(NO_TOKENS, raw)} maxContext={max} />);

describe("the context meter", () => {
  test("IT IS DRAWN WITH KIT'S CHARACTERS, not a CSS fill", () => {
    // A screenshot of the window's meter beside the terminal's should be the same object.
    const out = draw({ input: 100_000, output: 500 }, 200_000);
    expect(out).toContain("#");
    expect(out).toContain(".");
    expect(out).toContain("|");
    expect(out).toContain("50%");
    expect(out).toContain("100k / 200k");
  });

  test("AN UNKNOWN WINDOW DRAWS NO BAR", () => {
    /**
     * Deny by absence. A provider that never reported a context length gets the count alone; a bar
     * against a guessed maximum would put a reassuring two percent in front of somebody whose
     * conversation is about to be truncated.
     */
    const out = draw({ input: 12_300, output: 40 }, undefined);
    expect(out).toContain("12.3k");
    expect(out).not.toContain("%");
    expect(out).not.toContain("#");
  });

  test("a full window says what to do about it", () => {
    const out = draw({ input: 210_000, output: 100 }, 200_000);
    expect(out).toContain("compact due");
    expect(out).toContain("var(--kit-rose)");
    expect(out).toContain("100%");
  });

  test("amber arrives at ninety percent, and not before", () => {
    expect(draw({ input: 178_000 }, 200_000)).toContain("var(--kit-teal)");
    expect(draw({ input: 181_000 }, 200_000)).toContain("var(--kit-gold)");
  });

  test("before the first turn the bar is drawn but not lit", () => {
    // A zero meter in the pressure colour would read as a live measurement of nothing.
    const out = draw(undefined, 200_000);
    expect(out).toContain("var(--kit-mut)");
    expect(out).toContain("0%");
  });
});

describe("the tally", () => {
  test("it says this turn and the running session", () => {
    const out = draw({ input: 1_400, output: 200 }, 200_000);
    expect(out).toContain("turn");
    expect(out).toContain("session");
    expect(out).toContain("up 1.4k down 200");
  });

  test("a turn that produced nothing shows no breakdown", () => {
    expect(draw(undefined, 200_000)).not.toContain("up 0");
  });
});
