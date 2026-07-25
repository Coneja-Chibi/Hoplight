/** @jsxImportSource @opentui/react */
/**
 * TokenTally: the thin shell that paints the turn/session token strings from the pure view model.
 * The up/down detail rides in parentheses when present; a pre-first-turn zero reads dim. No logic here.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import type { TokenUsage } from "../../../providers/usage";
import { tokenTally } from "./token-tally-core";

export function TokenTally({ turn, session }: { turn: TokenUsage; session: TokenUsage }): ReactNode {
  const tally = tokenTally(turn, session);
  const dim = turn.total <= 0 && session.total <= 0;
  return (
    <text fg={dim ? theme.mut : theme.soft}>
      <span fg={theme.mut}>turn</span> {tally.turn}
      {tally.detail ? <span fg={theme.mut}> ({tally.detail})</span> : null}
      {"   "}
      <span fg={theme.mut}>session</span> {tally.session}
    </text>
  );
}
