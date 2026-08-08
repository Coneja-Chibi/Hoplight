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
import { BlockDiffPane } from "./block-diff-pane";
import { rewrittenBlock } from "../../diff/rewritten-block";
import { CrossingPanel } from "./crossing-panel";
import { GateButton } from "./gate-button";
import { editAction } from "../../diff/gate-edit-keys";
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
  /**
   * The text in the after pane, and whether it has the keys.
   *
   * Starts as the model's version and becomes yours the moment you type. `null` means no rewrite
   * is on screen, which is every gate that is not a single block being rewritten.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  /**
   * ONE BLOCK REWRITTEN GETS A DIFF, because that is the case the rows serve worst: every value is
   * cut at 48 characters, so a rewrite reads as "block content rewritten -> 1" and you are asked to
   * approve words you cannot see. Anything else keeps the rows, which are good at scale.
   *
   * Computed up here rather than at the point it is drawn, because the KEY HANDLER needs it: e only
   * opens the box when there is a box, and allow only carries an edit when there is one to carry.
   */
  const rewritten = review ? rewrittenBlock(review.changes) : null;

  /**
   * Allow, carrying the correction when there is one.
   *
   * NOTHING IS SENT WHEN THE TEXT IS UNTOUCHED, so an ordinary approval stays an ordinary
   * approval and the amend path is never entered for a draft nobody edited.
   */
  const allowWithEdit = (): GateChoice => {
    if (!rewritten || draft === null || draft === rewritten.after) return { type: "allow-once" };
    return { type: "allow-once", edit: { blockId: rewritten.id, content: draft } };
  };

  useKeyboard((e: KeyEvent) => {
    const k = e.name;

    /**
     * WHILE TYPING, THE BOX OWNS EVERY KEY.
     *
     * First in the handler on purpose: below, `y` allows and `n` denies, so a letter reaching
     * those branches would answer the gate mid-word. Escape leaves the box; enter accepts what is
     * in it, which is the whole point of being able to type here at all.
     */
    if (typing && draft !== null) {
      // EVERY key is swallowed, recognised or not; see gate-edit-keys.ts for why.
      e.preventDefault();
      const act = editAction(e, draft);
      if (act?.kind === "leave") setTyping(false);
      else if (act?.kind === "accept") onChoice(allowWithEdit());
      else if (act?.kind === "text") setDraft(act.text);
      return;
    }
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
    if (rewritten && k === "e") {
      // Into the box. Only offered when there is a box to get into.
      e.preventDefault();
      setTyping(true);
      return;
    }
    if (review && (k === "y" || k === "return")) {
      e.preventDefault();
      onChoice(allowWithEdit());
    } else if (review && (k === "n" || k === "d" || k === "escape")) {
      e.preventDefault();
      onChoice({ type: "deny" });
    } else if (k === "y") {
      e.preventDefault();
      onChoice(allowWithEdit());
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
        {rewritten ? <BlockDiffPane block={rewritten} draft={draft ?? rewritten.after} editing={typing} /> : null}
        {rewritten ? null : shown.map((change, index) => (
          <text key={index} fg={theme.soft}>
            <span fg={theme.teal}>{change.label}</span>
            {"  "}{displayValue(change.before)}{"  ->  "}
            <span fg={theme.bright}>{displayValue(change.after)}</span>
          </text>
        ))}
        {!rewritten && hidden > 0 ? <text fg={theme.quiet}>+ {String(hidden)} more changes</text> : null}
        {/*
          PRINTED, not tallied. A count is the one thing about a warning that does not help: a draft
          can warn that applying an edit to a file read through an adapter saves a Hoplight copy
          beside it, and "1 warning" tells nobody that.
        */}
        {review.warningCount > 0 ? (
          <>
            <text fg={theme.gold}>
              {String(review.warningCount)} warning{review.warningCount === 1 ? "" : "s"}
            </text>
            {(review.warnings ?? []).map((warning, i) => (
              <text key={i} fg={theme.soft}>{`  ${warning}`}</text>
            ))}
          </>
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

const displayValue = (value: unknown): string => {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const text = raw === undefined ? "unset" : raw;
  return text.length <= 48 ? text : `${text.slice(0, 45)}...`;
};
