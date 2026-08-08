/** @jsxImportSource @opentui/react */
/**
 * GatePrompt: the interactive confirm pause. The gate loop holds here until the user answers; nothing
 * runs until they do. A global keyboard listener maps y / a / n / ! / esc to a GateChoice and
 * preventDefault()s so the composer never sees these keys while a prompt is open. The floor set
 * (unknown/exec) hides "allow for the session", since a floor tool is never grantable.
 *
 * THE RISK IS A FILLED BANNER, NOT A ONE-CHARACTER STRIPE. Danger and caution previously differed by
 * the colour of a single leading bar, which made two very different events look like the same event
 * in different ink. A filled band states the level before any word is read.
 *
 * CHOICES ARE GLYPHS, NEVER PRINTED LETTERS. The old row was six bracketed keys across two lines,
 * every one the same weight and none shaped like what it does. The bindings are unchanged - they are
 * simply not drawn, because the key belongs to muscle memory and the row belongs to meaning. Each
 * choice is also a real bordered target, so the mouse works here as it always has on the review card.
 */
import { useState, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../theme";
import { stripeFor } from "../../../tools/safety/stripe-core";
import { isFloor } from "../../../tools/safety/gate-core";
import type { PermissionMode } from "../../../tools/safety/gate-core";
import type { GateChoice } from "../../../tools/safety/permission-mode";
import type { GateRequest } from "../../../tools/safety/gated-dispatch";
import { BAR, CHECK, CROSS, HELD, STOP } from "../../glyphs";
import { crossingIsLossy, crossingLegend, type CrossingReview, type CrossingRow, type CrossingSeverity } from "../../../changes/crossing";
import { KeyHint } from "../key-hint";

export function GatePrompt({
  req,
  mode,
  onChoice,
}: {
  req: GateRequest;
  mode: PermissionMode;
  onChoice: (choice: GateChoice) => void;
}): ReactNode {
  const review = req.review;
  const crossing = req.crossing;
  const stripe = stripeFor(req.verdict.level);
  const grantable = !isFloor(req.verdict.access);
  const frameColor =
    req.verdict.level === "danger"
      ? theme.rose
      : req.verdict.level === "caution"
        ? theme.gold
        : theme.line;

  /**
   * The choices as DATA, so the cursor, the row of buttons and the keys all read one list.
   *
   * Built here rather than inline in the JSX because a cursor into a list that is written out by
   * hand three rows below is exactly how "left/right" ends up landing on the wrong button when
   * `grantable` is false and Session is absent.
   */
  const choices: Array<{ glyph: string; label: string; tone: string; choice: GateChoice }> = [
    { glyph: CHECK, label: "Allow", tone: theme.teal, choice: { type: "allow-once" } },
    ...(grantable
      ? [{ glyph: HELD, label: "Session", tone: theme.teal, choice: { type: "allow-session" } as GateChoice }]
      : []),
    { glyph: CROSS, label: "Deny", tone: theme.red, choice: { type: "deny" } },
    { glyph: STOP, label: "Lock down", tone: theme.red, choice: { type: "abort" } },
  ];
  // Starts on Allow, which is where a person's hand already is - but nothing is chosen until Enter,
  // so a stray keystroke cannot approve anything.
  const [cursor, setCursor] = useState(0);

  useKeyboard((e: KeyEvent) => {
    const k = e.name;
    // The crossing panel owns its own keys, including the third answer. Handled there so this
    // listener cannot claim "t" for a surface that has no hold.
    if (crossing) return;
    // Arrow the cursor across the buttons and commit with Enter. The letter shortcuts below still
    // fire directly, so nobody who already knows y/n has to start arrowing instead.
    if (k === "left" || k === "right") {
      e.preventDefault();
      setCursor((c) => (k === "left"
        ? (c - 1 + choices.length) % choices.length
        : (c + 1) % choices.length));
      return;
    }
    if (k === "return" && !review) {
      e.preventDefault();
      onChoice(choices[cursor]?.choice ?? { type: "deny" });
      return;
    }
    if (review && (k === "y" || k === "return")) {
      e.preventDefault();
      onChoice({ type: "allow-once" });
    } else if (review && (k === "n" || k === "d" || k === "escape")) {
      e.preventDefault();
      onChoice({ type: "deny" });
    } else if (k === "y") {
      e.preventDefault();
      onChoice({ type: "allow-once" });
    } else if (k === "a" && grantable) {
      e.preventDefault();
      onChoice({ type: "allow-session" });
    } else if (k === "n") {
      e.preventDefault();
      onChoice({ type: "deny" });
    } else if (k === "escape") {
      e.preventDefault();
      onChoice({ type: "deny" });
    } else if (k === "!" || (e.shift && k === "1")) {
      e.preventDefault();
      onChoice({ type: "abort" });
    }
  });

  if (crossing) {
    return <CrossingPanel review={crossing} mode={mode} onChoice={onChoice} />;
  }

  if (review) {
    const shown = review.changes.slice(0, 5);
    const hidden = review.changes.length - shown.length;
    return (
      <box
        flexDirection="column"
        border
        borderColor={frameColor}
        backgroundColor={theme.panel}
        paddingLeft={1}
        paddingRight={1}
      >
        <box flexDirection="row">
          <text fg={theme.rose}>REVIEW CHANGE</text>
          <box flexGrow={1} />
          <text fg={theme.soft}>{mode}</text>
        </box>
        <text fg={theme.bright}>
          {review.target.kind} / {review.target.id}
        </text>
        <box height={1} />
        {shown.map((change, index) => (
          <text key={index} fg={theme.soft}>
            <span fg={theme.teal}>{change.label}</span>
            {"  "}{displayValue(change.before)}{"  ->  "}
            <span fg={theme.bright}>{displayValue(change.after)}</span>
          </text>
        ))}
        {hidden > 0 ? <text fg={theme.quiet}>+ {String(hidden)} more changes</text> : null}
        {review.warningCount > 0 ? (
          <text fg={theme.gold}>
            {String(review.warningCount)} warning{review.warningCount === 1 ? "" : "s"}
          </text>
        ) : null}
        <box height={1} />
        <box flexDirection="row">
          <GateButton
            glyph={CHECK}
            label="Apply & save"
            tone={theme.teal}
            onPress={() => onChoice({ type: "allow-once" })}
          />
          <GateButton
            glyph={CROSS}
            label="Discard"
            tone={theme.red}
            onPress={() => onChoice({ type: "deny" })}
          />
          <box flexGrow={1} />
          <text fg={theme.quiet}>enter applies · esc discards</text>
        </box>
      </box>
    );
  }

  // The banner is the whole point of the treatment: a filled bar states the risk before any word is
  // read, so danger and caution stop looking like the same event in different ink.
  const bannerBg = req.verdict.level === "danger" ? theme.roseDeep : theme.goldDim;
  const bannerFg = req.verdict.level === "danger" ? theme.white : theme.gold;
  const banner = `${stripe.label.toUpperCase()} · ${req.peek.title.toUpperCase()}`;

  return (
    <box
      flexDirection="column"
      border
      borderColor={frameColor}
      backgroundColor={theme.panel}
    >
      <box flexDirection="row" backgroundColor={bannerBg} paddingLeft={1} paddingRight={1}>
        <text fg={bannerFg}>{banner}</text>
        <box flexGrow={1} />
        <text fg={bannerFg}>{mode}</text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {req.peek.detail ? <text fg={theme.bright}>{req.peek.detail}</text> : null}
        <text fg={theme.soft}>{req.peek.reason}</text>
        <box height={1} />
        {/*
          Glyphs, not letters. y / a / n / ! all still fire - they are simply not printed, because a
          row of bracketed letters gave six options identical weight and none of them the shape of
          what they do. Each button is also a mouse target, which the old text row never was.
        */}
        <box flexDirection="row">
          {choices.map((c, i) => (
            <GateButton
              key={c.label}
              glyph={c.glyph}
              label={c.label}
              tone={c.tone}
              focused={i === cursor}
              onPress={() => onChoice(c.choice)}
            />
          ))}
        </box>
        {/*
          No glyph here. CROSS already means Deny one row up, and reusing it for the escape footnote
          made one shape stand for two different things. This is a note about a physical key, not a
          fifth choice, so it stays quiet text.
        */}
        {/*
          The keys are named now. They always worked; nothing said so, so the panel read as
          mouse-only to the people most likely to be driving it from the keyboard.
          `quiet`, not `mut` - the palette marks mut as borders-only and this is text.
        */}
        <text fg={theme.quiet}>
          <span fg={theme.soft}>←/→</span> choose{"   "}
          <span fg={theme.soft}>enter</span> confirm{"   "}
          <span fg={theme.soft}>y</span>/<span fg={theme.soft}>n</span> straight through{"   "}
          <span fg={theme.soft}>esc</span> denies
        </text>
      </box>
    </box>
  );
}

/** The stripe colour for a row's severity. Teal reads as safe everywhere else in Kit, so a carried
 *  row must not borrow the gold that means "this changed". */
const SEVERITY_TONE: Record<CrossingSeverity, string> = {
  removed: theme.red,
  rewritten: theme.gold,
  carried: theme.teal,
};

/**
 * The crossing ledger: what each thing is, and what becomes of it on the other side.
 *
 * TWO COLUMNS, NOT BEFORE-AND-AFTER ROWS. A draft's honest shape is a field changing value. A
 * crossing's is a thing meeting an engine that may not have it, so the right column is a fate rather
 * than a new value, and reading across one row answers the whole question for that thing.
 *
 * BANDED BY SEVERITY, WORST FIRST. The stripe already means risk everywhere else in Kit, so severity
 * needs no legend. Blank rows separate the bands because a removal and a respelling are different
 * kinds of news and a flat list makes them look like one.
 *
 * THE THIRD ANSWER IS THE POINT. `y` and `n` force a decision from someone who may not know what a
 * loss costs. `t` holds the crossing and asks Kit, which is the one participant that already measured
 * it. The gate closes either way - it cannot stay open across turns - so holding returns a distinct
 * choice the shell turns into a question rather than a silent discard.
 */
function CrossingPanel({
  review,
  mode,
  onChoice,
}: {
  review: CrossingReview;
  mode: PermissionMode;
  onChoice: (choice: GateChoice) => void;
}): ReactNode {
  const lossy = crossingIsLossy(review);
  const [hovered, setHovered] = useState<number | null>(null);

  useKeyboard((e: KeyEvent) => {
    const k = e.name;
    if (k === "y" || k === "return") {
      e.preventDefault();
      onChoice({ type: "allow-once" });
    } else if (k === "t") {
      e.preventDefault();
      onChoice({ type: "hold" });
    } else if (k === "n" || k === "d" || k === "escape") {
      e.preventDefault();
      onChoice({ type: "deny" });
    }
  });

  // Blank separators between bands, computed from the rows rather than hand-placed, so a crossing
  // with no removals does not open on an empty gap.
  const rows: (CrossingRow | null)[] = [];
  let previous: CrossingSeverity | null = null;
  for (const row of review.rows) {
    if (previous !== null && row.severity !== previous) rows.push(null);
    rows.push(row);
    previous = row.severity;
  }

  // The key when nothing is hovered; that row's own reason when something is. A hovered row with no
  // note falls back to the key rather than blanking, so the line never empties under the pointer.
  const legend = crossingLegend(review);
  const footLine = (hovered === null ? null : rows[hovered]?.note) ?? legend;

  return (
    <box
      flexDirection="column"
      border
      borderColor={lossy ? theme.gold : theme.line}
      backgroundColor={theme.panel}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row">
        <text fg={theme.rose}>REVIEW CROSSING</text>
        <box flexGrow={1} />
        <text fg={theme.soft}>{mode}</text>
      </box>
      <text fg={theme.bright}>
        {review.target.kind} / {review.target.id}
        <span fg={theme.quiet}> {"->"} {review.to}</span>
      </text>
      <box height={1} />

      <box flexDirection="row">
        <text fg={theme.quiet}>{"  "}from</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>becomes{"  "}</text>
      </box>

      {rows.map((row, index) =>
        row === null ? (
          <box key={index} height={1} />
        ) : (
          <box
            key={index}
            flexDirection="column"
            // Hover writes to the foot line and NEVER to this row. Revealing the note here would
            // push every row below it down, moving the thing under the pointer as it is read.
            onMouseOver={() => setHovered(index)}
            onMouseOut={() => setHovered((current) => (current === index ? null : current))}
            backgroundColor={hovered === index ? theme.row : undefined}
          >
            <box flexDirection="row">
              <text fg={SEVERITY_TONE[row.severity]}>{BAR}</text>
              <text fg={theme.soft}>
                {" "}{row.from}
                {row.count === undefined ? "" : ` x${row.count}`}
              </text>
              <box flexGrow={1} />
              <text fg={SEVERITY_TONE[row.severity]}>{row.to}</text>
            </box>
            {row.where ? <text fg={theme.quiet}>{"    in "}{row.where}</text> : null}
          </box>
        ),
      )}

      {review.escrowDropped ? (
        <>
          <box height={1} />
          {/* Reassurance, deliberately out of the severity list: nothing here is lost to the user,
              only to the file, and colouring it like damage would have said the opposite. */}
          <text fg={theme.quiet}>
            The original is not written to the file. Hoplight keeps it, so converting back restores it.
          </text>
        </>
      ) : null}
      {review.warningCount > 0 ? (
        <text fg={theme.gold}>
          {String(review.warningCount)} warning{review.warningCount === 1 ? "" : "s"}
        </text>
      ) : null}

      {/*
        One fixed line, always present, whatever is hovered. It carries the key by default and one
        row's reason while that row is under the pointer. Fixed because the alternative - growing the
        panel when a note appears - moves every button below it, and a confirm whose buttons move
        while you read is a confirm you can misclick.
      */}
      {footLine ? (
        <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
          <text fg={hovered === null ? theme.mut : theme.soft}>{footLine}</text>
        </box>
      ) : null}

      <box height={1} />
      <box flexDirection="row">
        <GateButton
          glyph={CHECK}
          label="Write it"
          tone={theme.teal}
          onPress={() => onChoice({ type: "allow-once" })}
        />
        <GateButton
          glyph={HELD}
          label="Talk it through"
          tone={theme.violet}
          onPress={() => onChoice({ type: "hold" })}
        />
        <GateButton
          glyph={CROSS}
          label="Discard"
          tone={theme.red}
          onPress={() => onChoice({ type: "deny" })}
        />
      </box>
      <text fg={theme.mut}>enter writes · esc discards</text>
    </box>
  );
}

/** One glyph-led choice. A real bordered target, so the mouse works where it never used to. */
function GateButton({
  glyph,
  label,
  tone,
  onPress,
  focused,
}: {
  glyph: string;
  label: string;
  tone: string;
  onPress: () => void;
  /**
   * Whether the keyboard cursor is on this button.
   *
   * The gate always had y / a / n bound, and Levi still read it as mouse-only - correctly, because
   * nothing on screen said otherwise. Three bordered buttons with no cursor look like three things
   * you click. A visible selection is what makes the keyboard discoverable; the letter shortcuts and
   * the mouse both still work, and neither was taken away to add this.
   */
  focused?: boolean;
}): ReactNode {
  return (
    <box flexDirection="row">
      <box
        border
        borderStyle={focused ? "heavy" : "single"}
        borderColor={focused ? tone : theme.line}
        backgroundColor={focused ? theme.lift : undefined}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={onPress}
      >
        <text fg={focused ? theme.text : theme.soft}>
          <span fg={tone}>{glyph}</span> {label}
        </text>
      </box>
      <box width={1} />
    </box>
  );
}

const displayValue = (value: unknown): string => {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const text = raw === undefined ? "unset" : raw;
  return text.length <= 48 ? text : `${text.slice(0, 45)}...`;
};
