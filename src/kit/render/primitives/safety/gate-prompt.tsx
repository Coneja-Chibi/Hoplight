/** @jsxImportSource @opentui/react */
/**
 * GatePrompt: the interactive confirm pause. The gate loop holds here until the user answers. It shows
 * the danger stripe, the redacted tool peek, and the choice row, then resolves the injected choice
 * promise; nothing runs until the user says so. A global keyboard listener maps y / a / n / ! / esc to a
 * GateChoice and preventDefault()s so the composer never sees these keys while a prompt is open. The
 * floor set (unknown/exec) hides "allow all session", since a floor tool is never grantable.
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
import { DangerStripe } from "./danger-stripe";
import { ToolPeek } from "./tool-peek";

export function GatePrompt({
  req,
  mode,
  onChoice,
}: {
  req: GateRequest;
  mode: PermissionMode;
  onChoice: (choice: GateChoice) => void;
}): ReactNode {
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
    if (k === "y") {
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
        <text fg={theme.mut}>GATE</text>
        <box flexGrow={1} />
        <text fg={theme.soft}>{mode}</text>
      </box>
      <text>
        <DangerStripe stripe={stripe} showLabel />
        <span fg={theme.bright}>{req.peek.title}</span>
      </text>
      {req.peek.detail ? <text fg={theme.soft}>{req.peek.detail}</text> : null}
      <text fg={theme.soft}>{req.peek.reason}</text>
      <box height={1} />
      <box flexDirection="row">
        <text fg={theme.mut}>
          <span fg={theme.teal}>{"[y]"}</span> allow once
        </text>
        {grantable ? (
          <text fg={theme.mut}>
            {"   "}
            <span fg={theme.teal}>{"[a]"}</span> allow all session
          </text>
        ) : null}
        <text fg={theme.mut}>
          {"   "}
          <span fg={theme.teal}>{"[n]"}</span> deny
        </text>
      </box>
      <box flexDirection="row">
        <text fg={theme.mut}>
          <span fg={theme.rose}>{"[!]"}</span> lock down (deny the rest)
        </text>
        <text fg={theme.mut}>{"        esc = deny"}</text>
      </box>
    </box>
  );
}
