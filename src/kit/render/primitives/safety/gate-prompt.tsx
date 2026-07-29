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
import type { ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../theme";
import { stripeFor } from "../../../tools/safety/stripe-core";
import { isFloor } from "../../../tools/safety/gate-core";
import type { PermissionMode } from "../../../tools/safety/gate-core";
import type { GateChoice } from "../../../tools/safety/permission-mode";
import type { GateRequest } from "../../../tools/safety/gated-dispatch";
import { CHECK, CROSS, HELD, STOP } from "../../glyphs";
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
  const stripe = stripeFor(req.verdict.level);
  const grantable = !isFloor(req.verdict.access);
  const frameColor =
    req.verdict.level === "danger"
      ? theme.rose
      : req.verdict.level === "caution"
        ? theme.gold
        : theme.line;

  useKeyboard((e: KeyEvent) => {
    const k = e.name;
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
          <GateButton glyph={CHECK} label="Allow" tone={theme.teal} onPress={() => onChoice({ type: "allow-once" })} />
          {grantable ? (
            <GateButton glyph={HELD} label="Session" tone={theme.teal} onPress={() => onChoice({ type: "allow-session" })} />
          ) : null}
          <GateButton glyph={CROSS} label="Deny" tone={theme.red} onPress={() => onChoice({ type: "deny" })} />
          <GateButton glyph={STOP} label="Lock down" tone={theme.red} onPress={() => onChoice({ type: "abort" })} />
        </box>
        {/*
          No glyph here. CROSS already means Deny one row up, and reusing it for the escape footnote
          made one shape stand for two different things. This is a note about a physical key, not a
          fifth choice, so it stays quiet text.
        */}
        <text fg={theme.mut}>esc denies</text>
      </box>
    </box>
  );
}

/** One glyph-led choice. A real bordered target, so the mouse works where it never used to. */
function GateButton({
  glyph,
  label,
  tone,
  onPress,
}: {
  glyph: string;
  label: string;
  tone: string;
  onPress: () => void;
}): ReactNode {
  return (
    <box flexDirection="row">
      <box border borderColor={tone} paddingLeft={1} paddingRight={1} onMouseDown={onPress}>
        <text fg={theme.bright}>
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
