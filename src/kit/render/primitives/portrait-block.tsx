/** @jsxImportSource @opentui/react */
/**
 * A character's own card art, in the terminal.
 *
 * PROTOCOL FIRST, BLOCKS AS THE FLOOR. opentui 0.5.1 ships an `<image>` renderable whose
 * `protocol: "auto"` picks the best thing the terminal actually supports - kitty graphics or sixel,
 * which draw a REAL image at real resolution - and falls back to half-blocks where neither exists.
 * Windows Terminal has had sixel since 1.22, so this is a genuine photograph on most machines and a
 * recognisable mosaic on the rest.
 *
 * The first version of this file hand-rolled the block path and stopped there, on the reasoning that
 * a portrait which appears on one machine and not another is worse than one that always looks the
 * same. That reasoning was right about the FAILURE and wrong about the choice: `auto` degrades on its
 * own, so there is no machine where nothing appears. Refusing the protocol only meant refusing the
 * good version everywhere.
 *
 * `studio/half-block.ts` stays, and is not dead: it is pure, so the sampling maths is testable
 * without a terminal, and it is the path for printing art outside opentui (a CLI subcommand piping
 * ANSI). This component is what the Kit UI uses.
 */
import type { ReactNode } from "react";
import type { ImageSource } from "@opentui/core";
import { theme } from "../theme";
import { imageProtocol } from "../image-protocol";

export function PortraitBlock({
  source,
  width,
  height,
  caption,
  accent,
}: {
  /** The image bytes, or a path. opentui decodes; nothing here touches pixels. */
  source: ImageSource;
  /** Cells. Height is what actually bounds a portrait, since 2:3 art is tall. */
  width: number;
  height: number;
  /** The piece's name, printed under the art in its own accent. */
  caption?: string;
  /** The entity's signature colour, when it has one; falls back to the deck accent. */
  accent?: string;
}): ReactNode {
  return (
    <box flexDirection="column">
      <image
        source={source}
        width={width}
        height={height}
        /**
         * "fit", not "cover": a cropped face is worse than a smaller one. Card art is 2:3 and the
         * subject is usually centred and close to the top, so cover would cut somebody's head off to
         * fill a box nobody asked to be filled.
         */
        fit="fit"
        protocol={imageProtocol()}
      />
      {caption ? (
        <box flexDirection="row" height={1} width={width}>
          <text fg={accent ?? theme.teal}>{caption}</text>
        </box>
      ) : null}
    </box>
  );
}
