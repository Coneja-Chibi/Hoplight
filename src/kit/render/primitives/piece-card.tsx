/** @jsxImportSource @opentui/react */
/** PieceCard: a compact inline studio reference derived from a stable stored mention marker. */
import type { ReactNode } from "react";
import type { EntitySummary } from "../../bridge";
import { truncateGraphemes } from "../../_shared/graphemes";
import { kindColor, theme } from "../theme";

const VALID_ACCENT = /^#[0-9a-f]{6}$/i;
const NAME_CAP = 32;

export function PieceCard({ piece }: { piece: EntitySummary }): ReactNode {
  const accent =
    typeof piece.accent === "string" && VALID_ACCENT.test(piece.accent)
      ? piece.accent
      : (kindColor[piece.kind] ?? theme.teal);
  const portrait = piece.hasPortrait ? "* " : "";
  return (
    <span fg={accent} bg={theme.panel}>
      {`[${portrait}${truncateGraphemes(piece.name, NAME_CAP)} · ${piece.kind}]`}
    </span>
  );
}
