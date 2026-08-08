/**
 * Kit's meter row: how full the context is on the left, what the tokens cost on the right.
 *
 * WHY A METER AND NOT A NUMBER. This window printed "1400 in / 200 out" in its header, which is two
 * facts nobody can act on. The thing a person actually needs to know is whether the conversation is
 * about to fall off the front of the model's window - and that is a RATIO with two thresholds on
 * it, which is exactly what a meter is for and exactly what a pair of raw counts is not.
 *
 * IT IS DRAWN WITH CHARACTERS, on purpose. Kit fills the bar with `#` and `.` between two `|`
 * pipes. A CSS bar would have been easy and would have made the two surfaces look like different
 * programs; the point of this translation is that a screenshot of one is a screenshot of the other.
 *
 * AN UNKNOWN WINDOW DRAWS NO BAR. Deny by absence: when the provider never reported a context
 * length, the row shows the count alone rather than a reassuring meter against a made-up maximum.
 */
import type { JSX } from "react";
import { contextMeter } from "../../kit/render/primitives/meters/context-meter-core";
import { compactTokens } from "../../kit/render/primitives/meters/format";
import { tokenTally } from "../../kit/render/primitives/meters/token-tally-core";
import { BAR_WIDTH, ZONE_INK, contextConsumed, type Tokens } from "./kit-meters-core";

/** The context bar, or the count alone when nothing said how big the window is. */
function ContextMeter({ consumed, max }: { consumed: number; max: number | undefined }): JSX.Element {
  const meter = contextMeter(consumed, max, BAR_WIDTH);
  if (!meter.known) {
    return (
      <span className="kit-meter">
        <span className="kit-meter__label">{"ctx"}</span>
        {` ${compactTokens(meter.consumed)}`}
      </span>
    );
  }
  /**
   * Before the first turn the bar is drawn but not lit. A zero meter in the pressure colour would
   * read as a live measurement of nothing, so it wears the border grey until there is a number.
   */
  const dim = meter.consumed === 0;
  const pct = Math.round(meter.pct * 100);
  return (
    <span className="kit-meter">
      <span className="kit-meter__label">{"ctx"}</span>{" "}
      <span className="kit-meter__rule">{"|"}</span>
      <span style={{ color: dim ? "var(--kit-mut)" : ZONE_INK[meter.zone] }}>
        {"#".repeat(meter.filled)}
      </span>
      <span className="kit-meter__rule">{".".repeat(meter.empty)}</span>
      <span className="kit-meter__rule">{"|"}</span>{" "}
      <span className={dim ? "kit-meter__label" : "kit-meter__pct"}>{`${String(pct)}%`}</span>{" "}
      {`${compactTokens(meter.consumed)} / ${compactTokens(meter.max)}`}
      {/* Kit's tail on a full window: the thing to DO about it, not just that it happened. */}
      {meter.zone === "crit" && <span className="kit-meter__crit">{"  compact due"}</span>}
    </span>
  );
}

/** This turn's tokens and the running total, in Kit's compact form. */
function TokenTally({ tokens }: { tokens: Tokens }): JSX.Element {
  const tally = tokenTally(tokens.turn, tokens.session);
  const dim = tokens.turn.total <= 0 && tokens.session.total <= 0;
  return (
    <span className={dim ? "kit-tally kit-tally--dim" : "kit-tally"}>
      <span className="kit-meter__label">{"turn"}</span>{` ${tally.turn}`}
      {tally.detail !== undefined && <span className="kit-meter__label">{` (${tally.detail})`}</span>}
      {"   "}
      <span className="kit-meter__label">{"session"}</span>{` ${tally.session}`}
    </span>
  );
}

/**
 * The composed row, which is the single widget the window drops in.
 *
 * Kit's placement exactly: meter left, tally right, a spacer between, on the panel ground. It is
 * chrome, not conversation, so it sits with the header rather than in the transcript.
 */
export function MeterBar({
  tokens,
  maxContext,
}: {
  tokens: Tokens;
  /** The active model's context window, when the provider reported one. */
  maxContext: number | undefined;
}): JSX.Element {
  return (
    <div className="kit-meterbar">
      <ContextMeter consumed={contextConsumed(tokens)} max={maxContext} />
      <span className="kit-meterbar__gap" />
      <TokenTally tokens={tokens} />
    </div>
  );
}
