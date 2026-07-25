/** @jsxImportSource @opentui/react */
/**
 * Highlighted: renders a line's text as span runs with search hits lit like marquee lamps, the active
 * hit fully lit (gold) and the rest dimmed (unlit gold). It returns spans only, so it drops inside a
 * row's own <text> node; a row with no ranges renders one plain span. Kept out of markdown-text.ts so
 * the markdown renderer stays about markdown and the search overlay owns its own styling.
 */
import { Fragment } from "react";
import type { ReactNode } from "react";
import { theme } from "../../theme";
import { segments } from "./highlight";
import type { Range } from "./search";

export function Highlighted({
  text,
  ranges = [],
  activeRange,
  fg = theme.soft,
}: {
  text: string;
  ranges?: readonly Range[];
  activeRange?: Range;
  fg?: string;
}): ReactNode {
  const runs = segments(text, ranges, activeRange);
  return (
    <Fragment>
      {runs.map((run, index) =>
        run.hit ? (
          <span
            key={index}
            fg={run.active ? theme.well : theme.text}
            bg={run.active ? theme.gold : theme.goldDim}
          >
            {run.text}
          </span>
        ) : (
          <span key={index} fg={fg}>
            {run.text}
          </span>
        ),
      )}
    </Fragment>
  );
}
