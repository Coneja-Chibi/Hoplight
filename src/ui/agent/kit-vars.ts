/**
 * Kit's palette, as CSS custom properties.
 *
 * DERIVED, NOT TRANSCRIBED. Kit's colours are locked in src/kit/render/theme.ts, and the obvious way
 * to give this window Kit's look would be to copy the hexes into a stylesheet. That is the same
 * duplicated-authority defect that put two damage-reason unions in this repo and printed `undefined`
 * on 123 files: two copies of one fact, and nothing that fails when they drift. A colour refined in
 * the terminal would silently stop matching the window, and nobody would find out from a test.
 *
 * So the palette is imported and emitted as variables at runtime. There is one palette. This file is
 * a projection of it, and it cannot fall behind.
 *
 * SCOPED TO THE PANEL, not the document. The desktop app has its own theme with its own tokens and
 * its own light mode; Kit's is a dark terminal palette and would be wrong applied globally. These
 * ride on the agent surface's root element and stop there.
 */
import type { CSSProperties } from "react";
import { theme, verbColor, kindColor } from "../../kit/render/theme";

/** The first step of Kit rose sweep ramp: the rule where the beam is not. */
const SWEEP_DIM = "#140409"; // hardcode-ok: one entry of Kit own sweep ramp, mirrored from sweep-line.ts

/** camelCase to the kebab-case a custom property wants. */
const dashed = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Every colour Kit has, prefixed so nothing collides with the studio's own tokens.
 *
 * The verb and kind palettes come too. They are what let a tool row's spine say what KIND of thing
 * is about to happen - cool for reads, warm for writes, red for destructive - which is the part of
 * Kit's transcript that carries risk at a glance, and the part a plain chat log throws away.
 */
export function kitVars(): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme)) vars[`--kit-${dashed(name)}`] = value;
  for (const [verb, value] of Object.entries(verbColor)) vars[`--kit-verb-${verb}`] = value;
  for (const [kind, value] of Object.entries(kindColor)) vars[`--kit-kind-${kind}`] = value;
  /**
   * The dim head of Kit sweep ramp, which is the colour of the UNLIT rule. It is a ramp entry
   * rather than a theme colour, so it is named here instead of being invented in CSS.
   */
  vars["--kit-sweep-dim"] = SWEEP_DIM;
  return vars as CSSProperties;
}

/**
 * The colour a tool's spine takes, by the verb in its name.
 *
 * Kit reads the verb off the tool name (`studio_read` reads, `studio_delete` destroys) and colours
 * the row's spine from it. Doing the same here means a window transcript and a terminal transcript
 * agree about what a given call looked like, which matters when somebody is comparing the two to
 * work out what happened.
 */
export function verbOf(toolName: string): string {
  const verb = toolName.includes("_") ? (toolName.split("_")[1] ?? "") : toolName;
  // The known verbs become their own variable; anything else falls back to Kit's neutral bright.
  return verb && verb in verbColor ? `var(--kit-verb-${verb})` : "var(--kit-bright)";
}
