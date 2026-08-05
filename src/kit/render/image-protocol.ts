/**
 * How Kit draws a picture, and why the safe answer is the default.
 *
 * WHAT WENT WRONG. `protocol: "auto"` picked sixel on Windows Terminal, and the image DID draw - but
 * its payload also landed in the cell buffer as text, so the whole frame filled with `$#109!15?G!21`
 * style run-length sixel data woven between the real rows. A picture that arrives at the cost of the
 * screen around it is not a feature.
 *
 * Half-blocks are ORDINARY CHARACTERS. Two vertical pixels per cell, coloured foreground over
 * background, no escape sequence, nothing for a redraw or a scroll to desynchronise. They composite
 * with the buffer because they ARE the buffer. That is the whole argument for the default: it is the
 * one mode that cannot break the frame it is drawn in.
 *
 * The protocol modes stay reachable, because where they work they are genuinely better - a real
 * photograph instead of a mosaic. They are opt-in rather than automatic now, because the failure is
 * not a worse picture, it is an unreadable terminal.
 *
 * Set KIT_IMAGE_PROTOCOL to blocks, sixel, kitty or auto.
 */
import type { ImageRenderProtocol } from "@opentui/core";

const MODES = new Set(["auto", "kitty", "sixel", "blocks"]);

/**
 * The protocol to draw with.
 *
 * Read per call rather than cached: this is one environment lookup, and a cached answer would mean
 * a person who set the variable had to explain to themselves why it did nothing until restart.
 */
export function imageProtocol(): ImageRenderProtocol {
  const asked = (process.env.KIT_IMAGE_PROTOCOL ?? "").trim().toLowerCase();
  return MODES.has(asked) ? (asked as ImageRenderProtocol) : "blocks";
}

/** True when Kit is drawing with a real image protocol rather than characters. */
export function usingRealProtocol(): boolean {
  return imageProtocol() !== "blocks";
}
